import { describe, expect, it } from "vitest";
import {
  computeMatchScore,
  computeUncommonGroundExplanation,
  getCategoryOf,
  findCrossDomainBridges,
  calculateStyleSynergy,
  fetchDiscoveryPeople,
} from "@/services/discovery";

describe("Phase 6: The Overlap Engine", () => {
  it("calculates match score deterministically with 3 shared interests", () => {
    const mine = ["Creative coding", "Astronomy", "Ambient music", "Film photography"];
    const theirs = ["Creative coding", "Astronomy", "Synthesizers", "Ambient music"];
    const primaries = ["Creative coding", "Astronomy"];

    const result = computeMatchScore(mine, theirs, primaries);

    // Shared: Creative coding, Astronomy, Ambient music (3 items)
    expect(result.sharedList).toHaveLength(3);
    expect(result.sharedList).toEqual(["Creative coding", "Astronomy", "Ambient music"]);

    // Score should be bounded and significant
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThanOrEqual(100);

    // Factual explanation template
    expect(result.explanation).toContain("You both explore");
    expect(result.explanation).toContain("Creative coding");
  });

  it("handles empty interests gracefully without NaN or runtime exceptions", () => {
    const mine: string[] = [];
    const theirs = ["Creative coding", "Astronomy"];

    const result = computeMatchScore(mine, theirs);
    expect(result.score).toBe(0);
    expect(result.sharedList).toEqual([]);
    expect(result.explanation).toBe("Different constellations waiting to cross paths.");

    const bothEmpty = computeMatchScore([], []);
    expect(bothEmpty.score).toBe(0);
    expect(bothEmpty.explanation).toBe("Different constellations waiting to cross paths.");
  });

  it("strictly enforces mathematical bounds 0 <= score <= 100 across varied inputs", () => {
    const sets = [
      { a: [], b: [] },
      { a: ["Creative coding"], b: ["Creative coding"] },
      {
        a: [
          "Creative coding",
          "Astronomy",
          "Ambient music",
          "Film photography",
          "Zine making",
          "Typography",
        ],
        b: [
          "Creative coding",
          "Astronomy",
          "Ambient music",
          "Film photography",
          "Zine making",
          "Typography",
        ],
        p: ["Creative coding", "Astronomy", "Ambient music", "Film photography"],
      },
      { a: ["Speedrunning"], b: ["Ceramics"] },
      { a: ["Retro computing", "Home automation"], b: ["Deep sea biology", "Mycology"] },
    ];

    for (const s of sets) {
      const res = computeMatchScore(s.a, s.b, s.p ?? []);
      expect(res.score).toBeGreaterThanOrEqual(0);
      expect(res.score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(res.score)).toBe(true);
    }
  });

  it("exhibits symmetry for standard sets without asymmetric style or primary biases", () => {
    const setA = ["Creative coding", "Astronomy", "Indie games"];
    const setB = ["Astronomy", "Ambient music", "Indie games"];

    const scoreAB = computeMatchScore(setA, setB);
    const scoreBA = computeMatchScore(setB, setA);

    expect(scoreAB.score).toBe(scoreBA.score);
    expect(scoreAB.sharedList.sort()).toEqual(scoreBA.sharedList.sort());
  });

  it("gives bonus for shared primary interests and category diversity", () => {
    const mine = ["Creative coding", "Astronomy"];
    const theirsA = ["Creative coding", "Indie games"]; // Both tech/gaming
    const theirsB = ["Creative coding", "Astronomy"]; // Tech + Science (diverse categories)

    const scoreA = computeMatchScore(mine, theirsA, ["Creative coding"]);
    const scoreB = computeMatchScore(mine, theirsB, ["Creative coding", "Astronomy"]);

    expect(scoreB.score).toBeGreaterThan(scoreA.score);
    expect(scoreB.breakdown?.primaryBonus).toBe(24); // 2 shared primaries * 12
    expect(scoreA.breakdown?.primaryBonus).toBe(12); // 1 shared primary * 12
  });

  it("categorizes interests into proper domains", () => {
    expect(getCategoryOf("Film photography")).toBe("Creative");
    expect(getCategoryOf("Creative coding")).toBe("Technology");
    expect(getCategoryOf("Ambient music")).toBe("Music");
    expect(getCategoryOf("Astronomy")).toBe("Science");
    expect(getCategoryOf("Indie cinema")).toBe("Culture");
    expect(getCategoryOf("Speedrunning")).toBe("Gaming");
    expect(getCategoryOf("01:43 AM ideas")).toBe("Unusual obsessions");
  });

  it("detects conversation style synergy for matching and complementary styles", () => {
    // Direct match
    const direct = calculateStyleSynergy("Deep dives", "Deep dives");
    expect(direct.synergy).toBe(true);
    expect(direct.bonus).toBe(6);

    // Case-insensitive match
    const caseMatch = calculateStyleSynergy(["slow & thoughtful"], ["Slow & Thoughtful"]);
    expect(caseMatch.synergy).toBe(true);
    expect(caseMatch.bonus).toBe(6);

    // Complementary pair (Listener + Deep dives)
    const complementary = calculateStyleSynergy("Listener", "Deep dives");
    expect(complementary.synergy).toBe(true);
    expect(complementary.bonus).toBe(6);

    // Incompatible / disparate styles
    const disparate = calculateStyleSynergy("Rapid-fire ideas", "Slow & thoughtful");
    expect(disparate.synergy).toBe(false);
    expect(disparate.bonus).toBe(0);

    // Integration into computeMatchScore
    const withStyle = computeMatchScore(["Creative coding"], ["Creative coding"], {
      myStyles: ["Deep dives"],
      theirStyles: ["Deep dives"],
    });
    const withoutStyle = computeMatchScore(["Creative coding"], ["Creative coding"], {
      myStyles: ["Rapid-fire ideas"],
      theirStyles: ["Slow & thoughtful"],
    });
    expect(withStyle.score).toBeGreaterThan(withoutStyle.score);
    expect(withStyle.breakdown?.styleBonus).toBe(6);
    expect(withoutStyle.breakdown?.styleBonus).toBe(0);
  });

  it("identifies 1-hop cross-domain graph bridges between disparate interests", () => {
    // Creative coding ↔ Astronomy is a curated cross-domain bridge
    const bridges = findCrossDomainBridges(["Creative coding"], ["Astronomy"]);
    expect(bridges.length).toBeGreaterThanOrEqual(1);
    expect(bridges[0]?.from).toBe("Creative coding");
    expect(bridges[0]?.to).toBe("Astronomy");
    expect(bridges[0]?.relationType).toBe("cross-domain");

    // Film photography ↔ Indie cinema is another cross-domain bridge
    const cinemaBridges = findCrossDomainBridges(["Film photography"], ["Indie cinema"]);
    expect(cinemaBridges.length).toBeGreaterThanOrEqual(1);
    expect(cinemaBridges[0]?.relationType).toBe("cross-domain");
  });

  it("incorporates cross-domain bridges into match score and explanation when no direct overlap exists", () => {
    const mine = ["Creative coding"];
    const theirs = ["Astronomy"];

    const result = computeMatchScore(mine, theirs, { includeBridges: true });

    expect(result.sharedList).toHaveLength(0);
    expect(result.bridges).toBeDefined();
    expect(result.bridges!.length).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
    expect(result.explanation).toContain("Bridging distinct worlds");
    expect(result.explanation).toContain("Creative coding connects with Astronomy");
  });

  it("generates hybrid explanation when 1 direct interest is shared alongside a graph bridge", () => {
    const mine = ["Film photography", "Creative coding"];
    const theirs = ["Film photography", "Astronomy"]; // Shared: Film photography, Bridge: Creative coding ↔ Astronomy

    const result = computeMatchScore(mine, theirs, { includeBridges: true });

    expect(result.sharedList).toEqual(["Film photography"]);
    expect(result.explanation).toContain("You both have an affinity for Film photography");
    expect(result.explanation).toContain("Creative coding ↔ Astronomy");
  });

  it("fetches and sorts discovery candidates deterministically in fetchDiscoveryPeople", async () => {
    const candidates = await fetchDiscoveryPeople(
      ["Creative coding", "Film photography", "Astronomy"],
      null,
      undefined,
      {},
    );

    expect(candidates.length).toBeGreaterThan(0);
    // Highest match score first
    for (let i = 0; i < candidates.length - 1; i++) {
      expect(candidates[i]!.matchScore).toBeGreaterThanOrEqual(candidates[i + 1]!.matchScore);
    }
  });

  it("correctly filters by search query and category filters", async () => {
    const all = await fetchDiscoveryPeople(["Creative coding"], null, undefined);
    expect(all.length).toBeGreaterThan(0);

    // Search query matching
    const filteredSearch = await fetchDiscoveryPeople(["Creative coding"], null, "Mira");
    expect(filteredSearch.length).toBeGreaterThan(0);
    expect(filteredSearch.some((c) => c.name.toLowerCase().includes("mira"))).toBe(true);

    // Search query non-matching
    const noResults = await fetchDiscoveryPeople(
      ["Creative coding"],
      null,
      "NonExistentOrbitQueryXYZ",
    );
    expect(noResults).toHaveLength(0);

    const sharedFilter = await fetchDiscoveryPeople(
      ["Creative coding", "Film photography", "Astronomy"],
      "Shared interests",
    );
    for (const c of sharedFilter) {
      expect(c.sharedInterests.length).toBeGreaterThanOrEqual(2);
    }

    const uncommonFilter = await fetchDiscoveryPeople(["Creative coding"], "Uncommon connections");
    for (const c of uncommonFilter) {
      expect(c.sharedInterests.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("Phase 7: Uncommon Ground", () => {
  it("generates an Uncommon Ground explanation highlighting shared anchor and novel horizons", () => {
    const mine = ["Film photography", "Creative coding"];
    const theirs = ["Film photography", "Tabletop RPGs"];

    const explanation = computeUncommonGroundExplanation(mine, theirs);
    expect(explanation).toContain("Film photography");
    expect(explanation).toContain("Tabletop RPGs");
    expect(explanation).toContain("orbit");
  });
});
