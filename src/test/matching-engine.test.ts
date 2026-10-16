import { describe, expect, it } from "vitest";
import {
  computeMatchScore,
  computeUncommonGroundExplanation,
  getCategoryOf,
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
  });

  it("gives bonus for shared primary interests and category diversity", () => {
    const mine = ["Creative coding", "Astronomy"];
    const theirsA = ["Creative coding", "Indie games"]; // Both tech/gaming
    const theirsB = ["Creative coding", "Astronomy"]; // Tech + Science (diverse categories)

    const scoreA = computeMatchScore(mine, theirsA, ["Creative coding"]);
    const scoreB = computeMatchScore(mine, theirsB, ["Creative coding", "Astronomy"]);

    expect(scoreB.score).toBeGreaterThan(scoreA.score);
  });

  it("categorizes interests into proper domains", () => {
    expect(getCategoryOf("Film photography")).toBe("Creative");
    expect(getCategoryOf("Creative coding")).toBe("Technology");
    expect(getCategoryOf("Ambient music")).toBe("Music");
    expect(getCategoryOf("Astronomy")).toBe("Science");
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
