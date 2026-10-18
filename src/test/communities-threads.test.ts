import { describe, expect, it } from "vitest";
import {
  validateCommunityInput,
  validateThreadInput,
  validateReplyInput,
  createNewCommunity,
  joinCommunityMembership,
  leaveCommunityMembership,
  fetchUserJoinedCommunities,
  createCommunityThread,
  createCommunityReply,
  deleteCommunityThread,
  fetchCommunitiesList,
} from "@/services/communities";
import fs from "node:fs";
import path from "node:path";

describe("Phase 10: Micro-Communities & Discussion Threads", () => {
  describe("1. Community & Thread Input Validation", () => {
    it("validates community name and description constraints", () => {
      const valid = validateCommunityInput({
        name: "Retro Computing",
        description: "A cozy haven for legacy machines and vintage OS lovers.",
      });
      expect(valid.valid).toBe(true);
      expect(valid.errors).toEqual({});

      const shortName = validateCommunityInput({
        name: "ab",
        description: "Valid description longer than ten characters.",
      });
      expect(shortName.valid).toBe(false);
      expect(shortName.errors.name).toContain("3");

      const longName = validateCommunityInput({
        name: "a".repeat(41),
        description: "Valid description longer than ten characters.",
      });
      expect(longName.valid).toBe(false);
      expect(longName.errors.name).toContain("40");

      const shortDesc = validateCommunityInput({
        name: "Valid Name",
        description: "Short",
      });
      expect(shortDesc.valid).toBe(false);
      expect(shortDesc.errors.description).toContain("10");

      const longDesc = validateCommunityInput({
        name: "Valid Name",
        description: "a".repeat(501),
      });
      expect(longDesc.valid).toBe(false);
      expect(longDesc.errors.description).toContain("500");
    });

    it("validates thread title and content bounds", () => {
      const valid = validateThreadInput({
        title: "Best 8-bit sound chip?",
        content: "I'm torn between SID 6581 and Yamaha YM2149.",
      });
      expect(valid.valid).toBe(true);
      expect(valid.error).toBeNull();

      const shortTitle = validateThreadInput({ title: "hi" });
      expect(shortTitle.valid).toBe(false);
      expect(shortTitle.error).toContain("3");

      const longTitle = validateThreadInput({ title: "a".repeat(201) });
      expect(longTitle.valid).toBe(false);
      expect(longTitle.error).toContain("200");

      const longContent = validateThreadInput({
        title: "Valid Title",
        content: "a".repeat(5001),
      });
      expect(longContent.valid).toBe(false);
      expect(longContent.error).toContain("5000");
    });

    it("validates reply text bounds", () => {
      const valid = validateReplyInput("Definitely the SID chip for warm analog filters.");
      expect(valid.valid).toBe(true);
      expect(valid.error).toBeNull();

      const empty = validateReplyInput("   ");
      expect(empty.valid).toBe(false);
      expect(empty.error).toContain("empty");

      const longReply = validateReplyInput("a".repeat(3001));
      expect(longReply.valid).toBe(false);
      expect(longReply.error).toContain("3000");
    });
  });

  describe("2. Community Creation & Membership Lifecycle", () => {
    it("creates a new community with slug, description, and topics", async () => {
      const res = await createNewCommunity({
        name: "Late Night Synthesizers",
        description: "Patching modular racks into the early morning hours.",
        topics: ["Synthesizers", "Ambient music"],
        userId: "user-creator-123",
      });

      expect(res.success).toBe(true);
      expect(res.community).toBeDefined();
      expect(res.community?.name).toBe("Late Night Synthesizers");
      expect(res.community?.topics).toEqual(["Synthesizers", "Ambient music"]);
      expect(res.community?.custom).toBe(true);
      expect(res.community?.members).toBe(1);
    });

    it("rejects invalid community creation", async () => {
      const res = await createNewCommunity({
        name: "ab",
        description: "short",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeTruthy();
    });

    it("handles joining community membership cleanly", async () => {
      const res = await joinCommunityMembership("2am-builders", "user-joiner-123");
      expect(res.success).toBe(true);
      expect(res.error).toBeNull();
    });

    it("handles leaving community membership cleanly", async () => {
      const res = await leaveCommunityMembership("2am-builders", "user-joiner-123");
      expect(res.success).toBe(true);
      expect(res.error).toBeNull();
    });

    it("fetches joined community memberships", async () => {
      const joined = await fetchUserJoinedCommunities("user-joiner-123");
      expect(Array.isArray(joined)).toBe(true);
    });
  });

  describe("3. Discussion Threads & Replies", () => {
    it("creates a discussion thread in a community", async () => {
      const res = await createCommunityThread(
        "2am-builders",
        "user-author-123",
        "Show off your micro-tools",
        "What small CLI or browser script did you write this week?",
      );

      expect(res.success).toBe(true);
      expect(res.postId).toBeTruthy();
      expect(res.error).toBeNull();
    });

    it("rejects thread creation with invalid title", async () => {
      const res = await createCommunityThread("2am-builders", "user-author-123", "no");
      expect(res.success).toBe(false);
      expect(res.error).toContain("3");
    });

    it("creates a reply to a discussion thread", async () => {
      const res = await createCommunityReply(
        "post-uuid-123",
        "user-replier-123",
        "I wrote a tiny canvas recorder that exports WebM files directly.",
      );

      expect(res.success).toBe(true);
      expect(res.replyId).toBeTruthy();
      expect(res.error).toBeNull();
    });

    it("rejects empty replies", async () => {
      const res = await createCommunityReply("post-uuid-123", "user-replier-123", "   ");
      expect(res.success).toBe(false);
      expect(res.error).toContain("empty");
    });

    it("deletes a discussion thread", async () => {
      const res = await deleteCommunityThread("post-uuid-123", "user-author-123");
      expect(res.success).toBe(true);
      expect(res.error).toBeNull();
    });

    it("fetches list of communities including starter communities", async () => {
      const list = await fetchCommunitiesList();
      expect(list.length).toBeGreaterThanOrEqual(5);
      expect(list.some((c) => c.id === "2am-builders")).toBe(true);
    });
  });

  describe("4. Migration Structure: 20261017000005_micro_communities_rpc.sql", () => {
    it("verifies migration file exists and defines community & thread RPCs", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20261017000005_micro_communities_rpc.sql",
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("rpc_create_community");
      expect(content).toContain("rpc_create_community_post");
      expect(content).toContain("rpc_create_community_reply");
      expect(content).toContain("rpc_delete_community_post");
      expect(content).toContain("SECURITY DEFINER");
    });
  });
});
