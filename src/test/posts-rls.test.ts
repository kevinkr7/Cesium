import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  validateMediaFile,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  getR2Config,
} from "@/lib/r2";

describe("Phase 1: Media Database Infrastructure & Security Hardening", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261022000001_posts_and_media_feed.sql",
  );

  it("verifies the posts & media feed SQL migration file exists and is well-formed", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Table declarations
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.posts");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.post_likes");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.post_comments");

    // Post visibility enum
    expect(sql).toContain("CREATE TYPE public.post_visibility AS ENUM ('public', 'connections_only')");

    // Helper functions
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.are_users_connected");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.is_user_blocked");

    // RLS activation
    expect(sql).toContain("ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY");

    // RLS policies
    expect(sql).toContain("CREATE POLICY posts_select ON public.posts");
    expect(sql).toContain("CREATE POLICY posts_insert ON public.posts");
    expect(sql).toContain("CREATE POLICY posts_delete ON public.posts");
    expect(sql).toContain("visibility = 'connections_only'");
    expect(sql).toContain("public.are_users_connected(auth.uid(), user_id)");

    // Triggers
    expect(sql).toContain("CREATE TRIGGER trg_sync_post_likes");
    expect(sql).toContain("CREATE TRIGGER trg_sync_post_comments");
  });

  describe("Cloudflare R2 Media Validation", () => {
    it("accepts valid image uploads within size limits", () => {
      for (const type of ALLOWED_IMAGE_TYPES) {
        const res = validateMediaFile({ size: 2 * 1024 * 1024, type });
        expect(res.valid).toBe(true);
        expect(res.mediaType).toBe("image");
      }
    });

    it("accepts valid video uploads within size limits", () => {
      for (const type of ALLOWED_VIDEO_TYPES) {
        const res = validateMediaFile({ size: 15 * 1024 * 1024, type });
        expect(res.valid).toBe(true);
        expect(res.mediaType).toBe("video");
      }
    });

    it("strictly rejects unsupported file types", () => {
      const invalidTypes = ["application/pdf", "text/html", "application/x-msdownload", "audio/mp3"];
      for (const type of invalidTypes) {
        const res = validateMediaFile({ size: 1024, type });
        expect(res.valid).toBe(false);
        expect(res.error).toContain("Unsupported file type");
      }
    });

    it("strictly enforces maximum size thresholds for images and videos", () => {
      // 10MB + 1 byte image
      const oversizedImage = validateMediaFile({ size: MAX_IMAGE_SIZE + 1, type: "image/jpeg" });
      expect(oversizedImage.valid).toBe(false);
      expect(oversizedImage.error).toContain("10MB");

      // 50MB + 1 byte video
      const oversizedVideo = validateMediaFile({ size: MAX_VIDEO_SIZE + 1, type: "video/mp4" });
      expect(oversizedVideo.valid).toBe(false);
      expect(oversizedVideo.error).toContain("50MB");
    });

    it("loads R2 config safely without throwing even when environment is unconfigured", () => {
      const config = getR2Config();
      expect(config).toBeDefined();
      expect(config.bucketName).toBeTruthy();
    });
  });
});
