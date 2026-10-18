import { describe, expect, it } from "vitest";
import {
  analyzeUncommonGround,
  computeUncommonGroundExplanation,
  fetchDiscoveryPeople,
} from "@/services/discovery";
import fs from "node:fs";
import path from "node:path";

describe("Phase 7: Uncommon Ground Discovery", () => {
  describe("1. Anchor & Novel Horizon Extraction", () => {
    it("identifies shared anchor interest and extracts novel horizons", () => {
      const mine = ["Film photography", "Creative coding"];
      const theirs = ["Film photography", "Tabletop RPGs", "Astronomy"];

      const analysis = analyzeUncommonGround(mine, theirs);

      expect(analysis.anchor).toBe("Film photography");
      expect(analysis.novelInterests).toEqual(["Tabletop RPGs", "Astronomy"]);
      expect(analysis.novelCategories).toContain("Gaming");
      expect(analysis.novelCategories).toContain("Science");
      expect(analysis.contrastScore).toBeGreaterThanOrEqual(40);
      expect(analysis.contrastScore).toBeLessThanOrEqual(100);
    });

    it("detects novel categories that the caller does not participate in", () => {
      // Caller is purely in Creative and Technology
      const mine = ["Film photography", "Typography", "Creative coding"];
      // Peer has 1 anchor (Film photography), but also explores Music and Science
      const theirs = ["Film photography", "Ambient music", "Astronomy"];

      const analysis = analyzeUncommonGround(mine, theirs);

      expect(analysis.anchor).toBe("Film photography");
      expect(analysis.novelCategories).toEqual(expect.arrayContaining(["Music", "Science"]));
      expect(analysis.novelCategories).not.toContain("Creative");
      expect(analysis.novelCategories).not.toContain("Technology");
    });
  });

  describe("2. Serendipity & Contrast Scoring", () => {
    it("computes serendipity contrast score bounded between 0 and 100", () => {
      const testCases = [
        { mine: [], theirs: [] },
        { mine: ["Creative coding"], theirs: ["Creative coding"] },
        {
          mine: ["Film photography", "Creative coding"],
          theirs: ["Film photography", "Tabletop RPGs", "Weather maps", "Mycology"],
        },
        { mine: ["Speedrunning"], theirs: ["Ceramics", "Linguistics"] },
      ];

      for (const tc of testCases) {
        const res = analyzeUncommonGround(tc.mine, tc.theirs);
        expect(res.contrastScore).toBeGreaterThanOrEqual(0);
        expect(res.contrastScore).toBeLessThanOrEqual(100);
        expect(Number.isInteger(res.contrastScore)).toBe(true);
      }
    });

    it("awards highest serendipity sweet spot to profiles with exactly 1 shared anchor plus broad horizons", () => {
      const mine = ["Creative coding", "Film photography"];
      // 1 anchor + 3 novel categories
      const oneAnchorBroad = ["Creative coding", "Astronomy", "Ambient music", "Tabletop RPGs"];
      // 3 anchors + 0 novel categories
      const threeAnchorsNarrow = ["Creative coding", "Film photography"];

      const scoreBroad = analyzeUncommonGround(mine, oneAnchorBroad).contrastScore;
      const scoreNarrow = analyzeUncommonGround(mine, threeAnchorsNarrow).contrastScore;

      expect(scoreBroad).toBeGreaterThan(scoreNarrow);
    });
  });

  describe("3. Contextual Narrative Generation", () => {
    it("generates an Uncommon Ground explanation highlighting shared anchor and novel horizons", () => {
      const mine = ["Film photography", "Creative coding"];
      const theirs = ["Film photography", "Tabletop RPGs"];

      const explanation = computeUncommonGroundExplanation(mine, theirs);
      expect(explanation).toContain("Film photography");
      expect(explanation).toContain("Tabletop RPGs");
      expect(explanation).toContain("orbit");
    });

    it("incorporates novel domain category name into explanation when from an uncharted domain", () => {
      const mine = ["Creative coding", "Mechanical keyboards"];
      const theirs = ["Creative coding", "Astronomy"]; // Astronomy is in Science

      const explanation = computeUncommonGroundExplanation(mine, theirs);
      expect(explanation).toContain("Creative coding");
      expect(explanation).toContain("Astronomy");
      expect(explanation).toContain("Science");
    });

    it("identifies 1-hop cross-domain bridge as anchor when 0 direct shared interests exist", () => {
      const mine = ["Creative coding"];
      const theirs = ["Astronomy", "Tabletop RPGs"]; // Bridge: Creative coding ↔ Astronomy

      const analysis = analyzeUncommonGround(mine, theirs);
      expect(analysis.anchor).toContain("Creative coding ↔ Astronomy");
      expect(analysis.perspectiveExplanation).toContain("Connected across domains");
      expect(analysis.perspectiveExplanation).toContain("Creative coding ↔ Astronomy");
    });

    it("handles edge cases gracefully without runtime exceptions", () => {
      const disjoint = analyzeUncommonGround(["Speedrunning"], ["Ceramics"]);
      expect(disjoint.anchor).toBeNull();
      expect(disjoint.perspectiveExplanation).toBe(
        "An uncommon overlap of disparate perspectives and shared curiosity.",
      );

      const empty = analyzeUncommonGround([], []);
      expect(empty.anchor).toBeNull();
      expect(empty.perspectiveExplanation).toBe(
        "An uncommon overlap of disparate perspectives and shared curiosity.",
      );
    });
  });

  describe("4. Discovery Integration & Sorting", () => {
    it("attaches uncommonGround analysis to all discovery candidates in fetchDiscoveryPeople", async () => {
      const candidates = await fetchDiscoveryPeople(
        ["Film photography", "Creative coding"],
        "Uncommon connections",
      );

      expect(candidates.length).toBeGreaterThan(0);
      for (const c of candidates) {
        expect(c.uncommonGround).toBeDefined();
        expect(c.uncommonGround?.contrastScore).toBeGreaterThanOrEqual(0);
        expect(c.uncommonGround?.perspectiveExplanation).toBeTruthy();
        expect(c.why).toBe(c.uncommonGround?.perspectiveExplanation);
      }
    });

    it("orders uncommon connections by matchScore ASC with deterministic name tie-breaking", async () => {
      const candidates = await fetchDiscoveryPeople(
        ["Creative coding", "Film photography", "Astronomy"],
        "Uncommon connections",
      );

      expect(candidates.length).toBeGreaterThan(0);
      for (let i = 0; i < candidates.length - 1; i++) {
        const curr = candidates[i]!;
        const next = candidates[i + 1]!;
        if (curr.matchScore === next.matchScore) {
          expect(curr.name.localeCompare(next.name)).toBeLessThanOrEqual(0);
        } else {
          expect(curr.matchScore).toBeLessThanOrEqual(next.matchScore);
        }
      }
    });
  });

  describe("5. Migration Integrity", () => {
    it("verifies 20261017000003_uncommon_ground_rpc.sql migration structure", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20261017000003_uncommon_ground_rpc.sql",
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("CREATE OR REPLACE FUNCTION public.rpc_get_discovery");
      expect(content).toContain("p_filter = 'Uncommon connections'");
      expect(content).toContain("unshared_names");
      expect(content).toContain("STABLE SECURITY DEFINER");
    });
  });
});
