import { describe, expect, it, vi } from "vitest";
import {
  getIcebreakerStarters,
  validateMessageBody,
  getOrCreateDirectConversation,
  sendChatMessage,
  fetchConversationMessages,
  subscribeToConversationMessages,
  markConversationRead,
  ICEBREAKER_TEMPLATES,
  ICEBREAKER_FALLBACKS,
} from "@/services/messaging";
import fs from "node:fs";
import path from "node:path";

describe("Phase 9: Icebreakers & Realtime Messaging", () => {
  describe("1. Deterministic Icebreaker Starters", () => {
    it("generates deterministic conversation starters based on actual shared interests", () => {
      const starters = getIcebreakerStarters(["Film photography", "Astronomy"]);

      expect(starters).toHaveLength(3);
      expect(
        starters.some((s) => s.toLowerCase().includes("film") || s.toLowerCase().includes("roll")),
      ).toBe(true);
      expect(
        starters.some(
          (s) => s.toLowerCase().includes("space") || s.toLowerCase().includes("astronomy"),
        ),
      ).toBe(true);
    });

    it("matches interest names case-insensitively and handles whitespace", () => {
      const starters = getIcebreakerStarters(["  film PHOTOGRAPHY  ", "astronomy"]);
      expect(starters).toHaveLength(3);
      expect(starters[0]).toContain("roll of film");
    });

    it("has bespoke questions for all 29 catalog interests ending with question mark", () => {
      const interests = Object.keys(ICEBREAKER_TEMPLATES);
      expect(interests.length).toBeGreaterThanOrEqual(29);

      for (const interest of interests) {
        const question = ICEBREAKER_TEMPLATES[interest];
        expect(question).toBeTruthy();
        expect(question?.endsWith("?")).toBe(true);
      }
    });

    it("incorporates cross-domain bridges when provided", () => {
      const starters = getIcebreakerStarters(["Film photography"], {
        bridges: [
          {
            from: "Creative coding",
            to: "Astronomy",
            explanation: "Generative celestial visualization",
          },
        ],
      });

      expect(starters).toHaveLength(3);
      expect(starters.some((s) => s.includes("Creative coding") && s.includes("Astronomy"))).toBe(
        true,
      );
    });

    it("incorporates uncommon ground anchor prompt when provided", () => {
      const starters = getIcebreakerStarters([], {
        uncommonAnchor: "Ambient music",
      });

      expect(starters).toHaveLength(3);
      expect(starters.some((s) => s.includes("Ambient music"))).toBe(true);
    });

    it("provides high quality fallbacks when users have 0 shared interests", () => {
      const starters = getIcebreakerStarters([]);
      expect(starters).toHaveLength(3);
      expect(starters[0]).toBeTruthy();
      expect(new Set(starters).size).toBe(3); // All distinct
      for (const s of starters) {
        expect(ICEBREAKER_FALLBACKS).toContain(s);
      }
    });

    it("respects custom requested count", () => {
      const starters = getIcebreakerStarters(["Typography"], { count: 5 });
      expect(starters).toHaveLength(5);
      expect(new Set(starters).size).toBe(5);
    });
  });

  describe("2. Message Validation & Security", () => {
    it("validates message body length between 1 and 5000 characters", () => {
      const valid = validateMessageBody("Hello there!");
      expect(valid.valid).toBe(true);
      expect(valid.error).toBeNull();

      const empty = validateMessageBody("   ");
      expect(empty.valid).toBe(false);
      expect(empty.error).toContain("empty");

      const tooLong = validateMessageBody("a".repeat(5001));
      expect(tooLong.valid).toBe(false);
      expect(tooLong.error).toContain("5000");
    });
  });

  describe("3. Direct Conversation Resolution & Messaging Transport", () => {
    it("resolves bilateral conversation for peer user in offline/demo fallback", async () => {
      const res = await getOrCreateDirectConversation("peer-user-123");
      expect(res.conversationId).toBeTruthy();
      expect(res.error).toBeNull();
    });

    it("rejects sending empty message and returns validation error", async () => {
      const res = await sendChatMessage("conv-123", "   ");
      expect(res.success).toBe(false);
      expect(res.error).toContain("empty");
    });

    it("sends valid chat message and returns messageId", async () => {
      const res = await sendChatMessage("conv-123", "What do you think of this synth patch?");
      expect(res.success).toBe(true);
      expect(res.messageId).toBeTruthy();
      expect(res.error).toBeNull();
    });

    it("fetches conversation messages returning empty list for mock/offline conv prefix", async () => {
      const msgs = await fetchConversationMessages("conv-mock-123", "user-me");
      expect(msgs).toEqual([]);
    });

    it("subscribes and unsubscribes cleanly to conversation Realtime channel", () => {
      const onMsg = vi.fn();
      const unsubscribe = subscribeToConversationMessages("conv-test-123", onMsg, "user-me");
      expect(typeof unsubscribe).toBe("function");

      // Calling unsubscribe should execute cleanly without throwing
      expect(() => unsubscribe()).not.toThrow();
    });

    it("marks conversation as read successfully in offline/demo fallback", async () => {
      const ok = await markConversationRead("conv-mock-123");
      expect(ok).toBe(true);
    });
  });

  describe("4. Migration Parity: 20261017000004_realtime_messaging_rpc.sql", () => {
    it("verifies migration file exists and defines direct conversation RPCs", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20261017000004_realtime_messaging_rpc.sql",
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("rpc_get_or_create_direct_conversation");
      expect(content).toContain("rpc_mark_conversation_read");
      expect(content).toContain("supabase_realtime");
      expect(content).toContain("SECURITY DEFINER");
    });
  });
});
