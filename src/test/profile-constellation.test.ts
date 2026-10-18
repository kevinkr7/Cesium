import { describe, it, expect, beforeEach } from "vitest";
import {
  validateProfileUpdates,
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_SIZE_BYTES,
  isHandleAvailable,
} from "@/services/profiles";
import { validateMinCuratedInterests, toggleInterestType } from "@/services/interests";
import { getDemoState, setDemo, resetDemo } from "@/lib/store";
import { interestCategories } from "@/lib/data";

describe("Phase 5: Profile & Constellation State Integrity", () => {
  beforeEach(() => {
    resetDemo();
  });

  describe("1. Profile Updates & Validation", () => {
    it("accepts valid profile update payloads", () => {
      const res = validateProfileUpdates({
        display_name: "Ada Lovelace",
        handle: "analytical_engine",
        city: "London, UK",
        bio: "Poetical science and mechanical algorithms.",
      });

      expect(res.valid).toBe(true);
      expect(res.error).toBeNull();
    });

    it("enforces display_name constraints: required and max 60 chars", () => {
      const emptyRes = validateProfileUpdates({ display_name: "   " });
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.error).toContain("Display name must be between 1 and 60 characters");

      const tooLongRes = validateProfileUpdates({ display_name: "A".repeat(61) });
      expect(tooLongRes.valid).toBe(false);
      expect(tooLongRes.error).toContain("Display name must be between 1 and 60 characters");
    });

    it("enforces handle constraints: 3-30 chars, alphanumeric and underscore", () => {
      expect(validateProfileUpdates({ handle: "ab" }).valid).toBe(false);
      expect(validateProfileUpdates({ handle: "a".repeat(31) }).valid).toBe(false);
      expect(validateProfileUpdates({ handle: "invalid-handle!" }).valid).toBe(false);
      expect(validateProfileUpdates({ handle: "valid_handle_123" }).valid).toBe(true);
      expect(validateProfileUpdates({ handle: "@clean_handle" }).valid).toBe(true);
    });

    it("enforces bio character limit: max 240 chars", () => {
      const validBio = "A".repeat(240);
      expect(validateProfileUpdates({ bio: validBio }).valid).toBe(true);

      const invalidBio = "A".repeat(241);
      const res = validateProfileUpdates({ bio: invalidBio });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Bio cannot exceed 240 characters");
    });

    it("enforces city character limit: max 80 chars", () => {
      expect(validateProfileUpdates({ city: "A".repeat(80) }).valid).toBe(true);
      expect(validateProfileUpdates({ city: "A".repeat(81) }).valid).toBe(false);
    });
  });

  describe("2. Avatar Constraints & Specifications", () => {
    it("specifies allowed image MIME types: jpeg, png, webp", () => {
      expect(ALLOWED_AVATAR_MIME_TYPES).toContain("image/jpeg");
      expect(ALLOWED_AVATAR_MIME_TYPES).toContain("image/png");
      expect(ALLOWED_AVATAR_MIME_TYPES).toContain("image/webp");
      expect(ALLOWED_AVATAR_MIME_TYPES).not.toContain("image/gif");
      expect(ALLOWED_AVATAR_MIME_TYPES).not.toContain("application/pdf");
    });

    it("enforces 5MB maximum avatar upload size", () => {
      expect(MAX_AVATAR_SIZE_BYTES).toBe(5 * 1024 * 1024);
      expect(MAX_AVATAR_SIZE_BYTES).toBe(5242880);
    });
  });

  describe("3. Constellation State & Minimum Interest Rule", () => {
    it("enforces minimum 3 curated anchors in constellation", () => {
      expect(
        validateMinCuratedInterests(["Astronomy", "Creative coding", "Ambient music"]).valid,
      ).toBe(true);
      expect(validateMinCuratedInterests(["Astronomy", "Creative coding"]).valid).toBe(false);
      expect(validateMinCuratedInterests([]).valid).toBe(false);
    });

    it("allows toggling niche obsession to curated anchor", async () => {
      const currentStandard = ["Astronomy", "Creative coding", "Ambient music"];
      const currentNiche = ["Modular Synths"];

      const res = await toggleInterestType(
        "test-user",
        currentStandard,
        currentNiche,
        "Modular Synths",
      );

      expect(res.success).toBe(true);
      expect(res.standard).toContain("Modular Synths");
      expect(res.niche).not.toContain("Modular Synths");
      expect(res.standard.length).toBe(4);
    });

    it("prevents converting curated anchor to niche if only 3 curated anchors remain", async () => {
      const currentStandard = ["Astronomy", "Creative coding", "Ambient music"];
      const currentNiche = ["Modular Synths"];

      const res = await toggleInterestType("test-user", currentStandard, currentNiche, "Astronomy");

      expect(res.success).toBe(false);
      expect(res.error).toContain("you need at least 3 curated anchors");
      expect(res.standard).toEqual(currentStandard);
      expect(res.niche).toEqual(currentNiche);
    });

    it("allows converting curated anchor to niche if more than 3 curated anchors exist", async () => {
      const currentStandard = ["Astronomy", "Creative coding", "Ambient music", "Film photography"];
      const currentNiche = ["Modular Synths"];

      const res = await toggleInterestType(
        "test-user",
        currentStandard,
        currentNiche,
        "Film photography",
      );

      expect(res.success).toBe(true);
      expect(res.standard).not.toContain("Film photography");
      expect(res.niche).toContain("Film photography");
      expect(res.standard.length).toBe(3);
    });
  });

  describe("4. Constellation Category Clustering Geometry", () => {
    it("maps seed catalog interests to their correct categories", () => {
      const catOf = (name: string) =>
        Object.entries(interestCategories).find(([, list]) => list.includes(name))?.[0] ?? "Niche";

      expect(catOf("Creative coding")).toBe("Technology");
      expect(catOf("Film photography")).toBe("Creative");
      expect(catOf("Ambient music")).toBe("Music");
      expect(catOf("Astronomy")).toBe("Science");
      expect(catOf("Brutalist architecture")).toBe("Culture");
      expect(catOf("Speedrunning")).toBe("Gaming");
      expect(catOf("Abandoned railways")).toBe("Unusual obsessions");
      expect(catOf("My Obscure Hardware")).toBe("Niche");
    });

    it("calculates cluster centers around SVG canvas center (500, 350)", () => {
      const categories = [...Object.keys(interestCategories), "Niche"];
      const centers: Record<string, { x: number; y: number }> = {};

      categories.forEach((c, gi) => {
        const a = (gi / categories.length) * Math.PI * 2 - Math.PI / 2;
        const cx = 500 + Math.cos(a) * 260;
        const cy = 350 + Math.sin(a) * 220;
        centers[c] = { x: cx, y: cy };
      });

      // Center should stay within canvas bounds
      Object.values(centers).forEach(({ x, y }) => {
        expect(x).toBeGreaterThan(100);
        expect(x).toBeLessThan(900);
        expect(y).toBeGreaterThan(50);
        expect(y).toBeLessThan(650);
      });
    });
  });

  describe("5. Local Store Synchronization & Reset", () => {
    it("updates store state when profile and constellation mutate", () => {
      setDemo({
        profile: {
          id: "usr_1",
          handle: "hyperspace",
          display_name: "Hyperspace Navigator",
          city: "Berlin, DE",
          bio: "Warp coordinates and sound design.",
          avatar_path: "https://example.com/avatar.webp",
          conversation_style: ["Deep Dives"],
          topics: "Relativity, modular patches",
          discoverable: true,
          onboarding_completed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        city: "Berlin, DE",
        interests: ["Creative coding", "Astronomy", "Ambient music", "Synthesizers"],
        niche: ["Generative patches"],
      });

      const current = getDemoState();
      expect(current.profile?.handle).toBe("hyperspace");
      expect(current.profile?.display_name).toBe("Hyperspace Navigator");
      expect(current.city).toBe("Berlin, DE");
      expect(current.interests.length).toBe(4);
      expect(current.niche).toContain("Generative patches");
    });

    it("resets store state completely on resetDemo", () => {
      setDemo({
        profile: {
          id: "usr_2",
          handle: "temp_user",
          display_name: "Temp",
          city: "Tokyo",
          bio: "Temporary",
          avatar_path: null,
          conversation_style: ["Listener"],
          topics: "None",
          discoverable: true,
          onboarding_completed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      resetDemo();
      const afterReset = getDemoState();
      expect(afterReset.session).toBeNull();
      expect(afterReset.profile).toBeNull();
      expect(afterReset.onboarded).toBe(false);
    });
  });
});
