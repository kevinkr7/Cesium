import { describe, expect, it } from "vitest";
import { getIcebreakerStarters } from "@/services/messaging";

describe("Phase 9: Break the Ice Conversation Starters", () => {
  it("generates deterministic conversation starters based on actual shared interests", () => {
    const starters = getIcebreakerStarters(["Film photography", "Astronomy"]);

    expect(starters).toHaveLength(3);
    // Specifically checks that prompts derived from Film photography and Astronomy are returned
    expect(
      starters.some((s) => s.toLowerCase().includes("film") || s.toLowerCase().includes("roll")),
    ).toBe(true);
    expect(
      starters.some(
        (s) => s.toLowerCase().includes("space") || s.toLowerCase().includes("astronomy"),
      ),
    ).toBe(true);
  });

  it("provides high quality fallbacks when users have 0 shared interests", () => {
    const starters = getIcebreakerStarters([]);
    expect(starters).toHaveLength(3);
    expect(starters[0]).toBeTruthy();
  });
});
