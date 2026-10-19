import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  stripHtml,
  escapeHtml,
  sanitizeHandle,
  validateHandle,
  sanitizeDisplayName,
  sanitizeBio,
  sanitizeCity,
  sanitizeSearchQuery,
  sanitizeMessageBody,
  sanitizeUrl,
  sanitizeCommunityInput,
  sanitizeThreadInput,
  sanitizeReplyInput,
  sanitizeReportInput,
  RESERVED_HANDLES,
} from "@/lib/security";
import { validateProfileUpdates } from "@/services/profiles";
import { validateMessageBody } from "@/services/messaging";
import {
  validateCommunityInput,
  validateThreadInput,
  validateReplyInput,
} from "@/services/communities";
import { validateReportInput } from "@/services/safety";

describe("Phase 12: Production Hardening, RLS & Security Engine", () => {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
  const hardeningMigrationFile = path.join(
    migrationsDir,
    "20261017000007_production_hardening_rls.sql",
  );

  describe("1. Database Migration & RLS Defense-in-Depth Audit", () => {
    it("verifies 20261017000007_production_hardening_rls.sql exists", () => {
      expect(fs.existsSync(hardeningMigrationFile)).toBe(true);
    });

    const migrationContent = fs.readFileSync(hardeningMigrationFile, "utf-8");

    it("verifies profiles hardening policies: profiles_delete and profiles_select_connections", () => {
      expect(migrationContent).toContain("CREATE POLICY profiles_delete ON public.profiles");
      expect(migrationContent).toContain("FOR DELETE USING (auth.uid() = id)");
      expect(migrationContent).toContain(
        "CREATE POLICY profiles_select_connections ON public.profiles",
      );
      expect(migrationContent).toContain("c.status = 'accepted'");
    });

    it("verifies connections hardening: connections_delete and anti-tampering trigger", () => {
      expect(migrationContent).toContain("CREATE POLICY connections_delete ON public.connections");
      expect(migrationContent).toContain("FUNCTION public.check_connection_status_transition()");
      expect(migrationContent).toContain("Requester cannot accept their own connection request");
      expect(migrationContent).toContain("trg_check_connection_status");
    });

    it("verifies messages hardening: messages_delete policy for message authors", () => {
      expect(migrationContent).toContain("CREATE POLICY messages_delete ON public.messages");
      expect(migrationContent).toContain("FOR DELETE USING (auth.uid() = sender_id)");
    });

    it("verifies conversations hardening: conversations_delete and conv_members lifecycle", () => {
      expect(migrationContent).toContain(
        "CREATE POLICY conversations_delete ON public.conversations",
      );
      expect(migrationContent).toContain(
        "CREATE POLICY conv_members_update ON public.conversation_members",
      );
      expect(migrationContent).toContain(
        "CREATE POLICY conv_members_delete ON public.conversation_members",
      );
    });

    it("verifies communities hardening: communities_delete and comm_members_update", () => {
      expect(migrationContent).toContain("CREATE POLICY communities_delete ON public.communities");
      expect(migrationContent).toContain(
        "CREATE POLICY comm_members_update ON public.community_members",
      );
    });

    it("verifies interests hardening: interests_update and interests_delete", () => {
      expect(migrationContent).toContain("CREATE POLICY interests_update ON public.interests");
      expect(migrationContent).toContain("CREATE POLICY interests_delete ON public.interests");
    });

    it("verifies notifications hardening: notifications_insert restricted to peers/self", () => {
      expect(migrationContent).toContain(
        "CREATE POLICY notifications_insert ON public.notifications",
      );
      expect(migrationContent).toContain("auth.uid() = user_id");
    });

    it("verifies storage bucket public_assets isolation policies", () => {
      expect(migrationContent).toContain("public_assets");
      expect(migrationContent).toContain("public_assets_insert");
      expect(migrationContent).toContain("name LIKE 'avatars/' || (auth.uid())::text || '/%'");
      expect(migrationContent).toContain("public_assets_update");
      expect(migrationContent).toContain("public_assets_delete");
    });
  });

  describe("2. XSS Mitigation & HTML Sanitization Engine", () => {
    it("strips malicious script tags and inner contents", () => {
      const malicious = "Hello <script>alert('pwned')</script>World";
      expect(stripHtml(malicious)).toBe("Hello World");
    });

    it("strips style, iframe, object, and embed elements", () => {
      const input = "<iframe src='evil.com'></iframe><style>body{display:none}</style>Clean Text";
      expect(stripHtml(input)).toBe("Clean Text");
    });

    it("neutralizes dangerous pseudo-protocols like javascript: and data:text/html", () => {
      const input = "Click javascript:void(0) or data:text/html;base64,...";
      expect(stripHtml(input)).not.toContain("javascript:");
      expect(stripHtml(input)).not.toContain("data:text/html");
    });

    it("escapes raw HTML entity characters", () => {
      const unescaped = `<a href="test" data-val='1'>Tom & Jerry</a>`;
      const escaped = escapeHtml(unescaped);
      expect(escaped).toContain("&lt;");
      expect(escaped).toContain("&gt;");
      expect(escaped).toContain("&amp;");
      expect(escaped).toContain("&quot;");
      expect(escaped).toContain("&#x27;");
    });
  });

  describe("3. Handle Validation & Sanitization", () => {
    it("normalizes handles by stripping @, trimming, and converting to lowercase", () => {
      expect(sanitizeHandle("  @User_Name123  ")).toBe("user_name123");
      expect(sanitizeHandle("@@@Dev_Orbit")).toBe("dev_orbit");
    });

    it("validates compliant user handles", () => {
      expect(validateHandle("mira_k").valid).toBe(true);
      expect(validateHandle("alex_sound").valid).toBe(true);
      expect(validateHandle("orbit_99").valid).toBe(true);
    });

    it("rejects handles with length < 3 or > 30", () => {
      expect(validateHandle("ab").valid).toBe(false);
      expect(validateHandle("a".repeat(31)).valid).toBe(false);
    });

    it("rejects handles with invalid special characters", () => {
      expect(validateHandle("user!name").valid).toBe(false);
      expect(validateHandle("user name").valid).toBe(false);
      expect(validateHandle("user.name").valid).toBe(false);
      expect(validateHandle("user-name").valid).toBe(false);
    });

    it("rejects handles with leading/trailing or consecutive underscores", () => {
      expect(validateHandle("_username").valid).toBe(false);
      expect(validateHandle("username_").valid).toBe(false);
      expect(validateHandle("user__name").valid).toBe(false);
    });

    it("rejects reserved system handles", () => {
      for (const reserved of Array.from(RESERVED_HANDLES)) {
        expect(validateHandle(reserved).valid).toBe(false);
      }
    });
  });

  describe("4. Profile Attributes Sanitization", () => {
    it("sanitizes display names and limits length to 60 characters", () => {
      const dirty = "  <b>Kevin</b> <i>R.</i>  ";
      expect(sanitizeDisplayName(dirty)).toBe("Kevin R.");
      expect(sanitizeDisplayName("A".repeat(100)).length).toBe(60);
    });

    it("sanitizes user bios and limits length to 240 characters", () => {
      const bioWithXss = "Creative builder <img src=x onerror=alert(1)> focusing on sound.";
      expect(sanitizeBio(bioWithXss)).toBe("Creative builder focusing on sound.");
      expect(sanitizeBio("Word ".repeat(60)).length).toBeLessThanOrEqual(240);
    });

    it("sanitizes city strings and limits length to 80 characters", () => {
      const cityDirty = "<script>steal()</script>Bengaluru, India";
      expect(sanitizeCity(cityDirty)).toBe("Bengaluru, India");
      expect(sanitizeCity("C".repeat(120)).length).toBe(80);
    });

    it("integrates with validateProfileUpdates service", () => {
      const valid = validateProfileUpdates({
        display_name: "Mira K",
        handle: "@mira_k",
        bio: "Curator of analog audio",
        city: "Berlin",
      });
      expect(valid.valid).toBe(true);

      const invalidHandle = validateProfileUpdates({
        handle: "admin",
      });
      expect(invalidHandle.valid).toBe(false);
      expect(invalidHandle.error).toContain("reserved");
    });
  });

  describe("5. Search Query Sanitization & Injection Defense", () => {
    it("neutralizes SQL wildcards and PostgREST injection syntax", () => {
      const injection1 = "mira%_'; DROP TABLE profiles;--";
      const cleaned1 = sanitizeSearchQuery(injection1);
      expect(cleaned1).not.toContain("%");
      expect(cleaned1).not.toContain("_");
      expect(cleaned1).not.toContain(";");

      const injection2 = "eq.100 or=id.eq.admin";
      const cleaned2 = sanitizeSearchQuery(injection2);
      expect(cleaned2).not.toContain("eq.");
      expect(cleaned2).not.toContain("or=");
    });

    it("limits search query length to 100 characters", () => {
      const longQuery = "search ".repeat(30);
      expect(sanitizeSearchQuery(longQuery).length).toBeLessThanOrEqual(100);
    });
  });

  describe("6. Message & URL Sanitization", () => {
    it("sanitizes message body while preserving safe multi-line text and emojis", () => {
      const rawMsg = "Hello! 👋\n\n<script>alert('xss')</script>Let's build something beautiful.";
      const cleanMsg = sanitizeMessageBody(rawMsg);
      expect(cleanMsg).toContain("Hello! 👋");
      expect(cleanMsg).toContain("Let's build something beautiful.");
      expect(cleanMsg).not.toContain("<script>");
      expect(cleanMsg).not.toContain("alert('xss')");
    });

    it("validates message body via validateMessageBody service", () => {
      expect(validateMessageBody("   <script>alert(1)</script>   ").valid).toBe(false);
      expect(validateMessageBody("Valid icebreaker message").valid).toBe(true);
      expect(validateMessageBody("a".repeat(5001)).valid).toBe(false);
    });

    it("validates and sanitizes safe URLs while rejecting dangerous schemes", () => {
      expect(sanitizeUrl("https://cesium.orbit/avatar.png")).toBe(
        "https://cesium.orbit/avatar.png",
      );
      expect(sanitizeUrl("http://example.com/pic.jpg")).toBe("http://example.com/pic.jpg");
      expect(sanitizeUrl("/assets/logo.svg")).toBe("/assets/logo.svg");

      expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
      expect(sanitizeUrl("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
      expect(sanitizeUrl("file:///etc/passwd")).toBeNull();
      expect(sanitizeUrl("vbscript:MsgBox(1)")).toBeNull();
    });
  });

  describe("7. Community & Safety Reports Sanitization", () => {
    it("sanitizes community name and description", () => {
      const cleanComm = sanitizeCommunityInput({
        name: "<b>2AM Builders</b>",
        description: "Late night creative hacking <script>evil()</script>group.",
      });
      expect(cleanComm.name).toBe("2AM Builders");
      expect(cleanComm.description).toBe("Late night creative hacking group.");
    });

    it("sanitizes thread title and content", () => {
      const cleanThread = sanitizeThreadInput({
        title: "New Synth Patch <script>",
        content: "Check this out <iframe src='malicious'></iframe>here.",
      });
      expect(cleanThread.title).toBe("New Synth Patch");
      expect(cleanThread.content).toBe("Check this out here.");
    });

    it("sanitizes reply text", () => {
      expect(sanitizeReplyInput("Great idea! <script>xss()</script>")).toBe("Great idea!");
    });

    it("sanitizes safety reports input and enforces length bounds", () => {
      const cleanReport = sanitizeReportInput({
        reason: "<b>Harassment</b> in chat",
        details: "User posted unwanted <b>links</b> in community.",
      });
      expect(cleanReport.reason).toBe("Harassment in chat");
      expect(cleanReport.details).toBe("User posted unwanted links in community.");

      expect(validateReportInput(cleanReport.reason, cleanReport.details).valid).toBe(true);
    });
  });
});
