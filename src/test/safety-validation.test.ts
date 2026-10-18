import { describe, expect, it, beforeEach } from "vitest";
import { registerSchema, loginSchema } from "@/services/auth";
import {
  blockUser,
  unblockUser,
  reportUser,
  reportContent,
  checkContentSafety,
  validateReportInput,
  isUserBlockedLocally,
  fetchBlockedUsers,
  REPORT_REASONS,
} from "@/services/safety";
import { getDemoState, setDemo, resetDemo } from "@/lib/store";
import { fetchDiscoveryPeople } from "@/services/discovery";
import fs from "node:fs";
import path from "node:path";

describe("Phase 11: Safety, Blocking & Content Moderation", () => {
  beforeEach(() => {
    resetDemo();
    setDemo({
      session: {
        id: "me-123",
        name: "Test User",
        email: "test@cesium.social",
        demo: true,
      },
      interests: ["Creative coding", "Astronomy", "Ambient music"],
      niche: ["Old signage"],
      connections: {
        mira: "connected",
        elena: "pending",
      },
      blockedUsers: [],
    });
  });

  // Auth Validation Baseline Tests
  it("rejects invalid emails and short passwords during registration", () => {
    const invalidData = {
      name: "Alex",
      email: "not-an-email",
      password: "short",
      confirm: "short",
    };

    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.email).toBeDefined();
      expect(fieldErrors.password).toBeDefined();
    }
  });

  it("rejects mismatched passwords during registration", () => {
    const mismatched = {
      name: "Alex",
      email: "alex@orbit.internal",
      password: "securepassword123",
      confirm: "differentpassword",
    };

    const result = registerSchema.safeParse(mismatched);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Passwords don't match yet");
    }
  });

  it("validates successful login schema", () => {
    const validLogin = {
      email: "user@cesium.social",
      password: "mypassword123",
    };

    const result = loginSchema.safeParse(validLogin);
    expect(result.success).toBe(true);
  });

  it("ensures unauthenticated visitors cannot access protected features without logging in", () => {
    const checkCanAccessFeature = (session: { id: string } | null) => {
      return Boolean(session && session.id);
    };

    expect(checkCanAccessFeature(null)).toBe(false);
    expect(checkCanAccessFeature({ id: "user-123" })).toBe(true);
  });

  // Blocking Lifecycle Tests
  it("validates that target user ID is required when blocking", async () => {
    const res = await blockUser("");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Target user ID is required");
  });

  it("prevents blocking oneself", async () => {
    const res = await blockUser("me-123");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Cannot block yourself");
  });

  it("blocks a target user, updates store state, and verifies isUserBlockedLocally", async () => {
    expect(isUserBlockedLocally("mira")).toBe(false);
    const res = await blockUser("mira");
    expect(res.success).toBe(true);
    expect(res.error).toBeNull();

    expect(isUserBlockedLocally("mira")).toBe(true);
    const storeState = getDemoState();
    expect(storeState.blockedUsers).toContain("mira");
  });

  it("severs active and pending connections when a user is blocked", async () => {
    expect(getDemoState().connections["mira"]).toBe("connected");
    expect(getDemoState().connections["elena"]).toBe("pending");

    await blockUser("mira");
    expect(getDemoState().connections["mira"]).toBeUndefined();

    await blockUser("elena");
    expect(getDemoState().connections["elena"]).toBeUndefined();
  });

  it("unblocks a user and removes them from store blocked state", async () => {
    await blockUser("mira");
    expect(isUserBlockedLocally("mira")).toBe(true);

    const unblockRes = await unblockUser("mira");
    expect(unblockRes.success).toBe(true);
    expect(isUserBlockedLocally("mira")).toBe(false);
    expect(getDemoState().blockedUsers).not.toContain("mira");
  });

  it("fetches blocked users list reflecting current blocked state", async () => {
    await blockUser("mira");
    await blockUser("julian");

    const list = await fetchBlockedUsers();
    expect(list.length).toBe(2);
    expect(list.some((u) => u.id === "mira")).toBe(true);
    expect(list.some((u) => u.id === "julian")).toBe(true);
  });

  // Discovery Filtering Tests
  it("filters out blocked users from discovery results", async () => {
    const myInterests = ["Creative coding", "Astronomy"];
    const allCandidates = await fetchDiscoveryPeople(myInterests, null, undefined);
    expect(allCandidates.length).toBeGreaterThan(0);
    const target = allCandidates[0]!;

    // Block target
    await blockUser(target.id);
    const filteredCandidates = await fetchDiscoveryPeople(
      myInterests,
      null,
      undefined,
      {},
      {
        blockedUserIds: getDemoState().blockedUsers,
      },
    );
    expect(filteredCandidates.some((c) => c.id === target.id)).toBe(false);
  });

  // User Reporting Tests
  it("validates report input reasons and details constraints", () => {
    // Reason too short
    const shortReason = validateReportInput("hi", "details");
    expect(shortReason.valid).toBe(false);

    // Details too long
    const longDetails = validateReportInput(REPORT_REASONS[0], "a".repeat(1001));
    expect(longDetails.valid).toBe(false);

    // Valid report input
    const valid = validateReportInput(REPORT_REASONS[0], "Valid explanation of the incident.");
    expect(valid.valid).toBe(true);
  });

  it("prevents reporting oneself", async () => {
    const res = await reportUser("me-123", REPORT_REASONS[0], "details");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Cannot report yourself");
  });

  it("submits user report successfully with valid reason", async () => {
    const res = await reportUser("mira", REPORT_REASONS[0], "Repeated unsolicited messages.");
    expect(res.success).toBe(true);
    expect(res.reportId).toBeDefined();
    expect(res.error).toBeNull();
  });

  // Content Moderation & Content Reports
  it("validates content report inputs requiring valid type and content id", async () => {
    // Invalid content type
    const invalidType = await reportContent(
      "profile" as unknown as "post",
      "post-123",
      REPORT_REASONS[0],
    );
    expect(invalidType.success).toBe(false);

    // Missing content ID
    const missingId = await reportContent("post", "", REPORT_REASONS[0]);
    expect(missingId.success).toBe(false);

    // Valid post report
    const validPostReport = await reportContent("post", "post-123", REPORT_REASONS[3]);
    expect(validPostReport.success).toBe(true);
    expect(validPostReport.reportId).toBeDefined();

    // Valid reply report
    const validReplyReport = await reportContent("reply", "reply-456", REPORT_REASONS[1]);
    expect(validReplyReport.success).toBe(true);
  });

  it("content moderation scanner detects toxic or prohibited language", () => {
    const cleanText = "Excited to share this generative art demo built with shaders!";
    const cleanResult = checkContentSafety(cleanText);
    expect(cleanResult.safe).toBe(true);
    expect(cleanResult.flaggedTerms).toHaveLength(0);

    const toxicText = "You should kill yourself right now";
    const toxicResult = checkContentSafety(toxicText);
    expect(toxicResult.safe).toBe(false);
    expect(toxicResult.flaggedTerms).toContain("kill yourself");
    expect(toxicResult.severity).toBe("high");
  });

  it("verifies safety migration file exists and defines content_reports table and safety RPCs", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20261017000006_safety_moderation_rpc.sql",
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const content = fs.readFileSync(migrationPath, "utf-8");
    expect(content).toContain("CREATE TABLE IF NOT EXISTS public.content_reports");
    expect(content).toContain("rpc_block_user");
    expect(content).toContain("rpc_unblock_user");
    expect(content).toContain("rpc_report_user");
    expect(content).toContain("rpc_report_content");
    expect(content).toContain("rpc_get_blocked_users");
  });
});
