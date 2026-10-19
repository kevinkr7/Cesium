import { test, expect } from "@playwright/test";
import { seedSession } from "./helpers/session";

test.describe("Multi-Step Onboarding Journey", () => {
  test("Completes full 5-step onboarding and enters discovery feed", async ({ page }) => {
    // Seed authenticated but un-onboarded user session
    await seedSession(page, {
      userId: "new-user-orbit-99",
      name: "Taylor Vance",
      email: "taylor@cesium.orbit",
      onboarded: false,
      interests: [],
      niche: [],
    });

    await page.goto("/onboarding");
    await expect(page).toHaveTitle(/Build your universe — Cesium/);

    // ==========================================
    // Step 0: Identity & Handle
    // ==========================================
    await expect(page.locator("text=01 // Identity & Home Orbit")).toBeVisible();
    await expect(page.locator("h1")).toHaveText(/Who are you in this universe/);

    const displayNameInput = page.locator("#display-name");
    const handleInput = page.locator("#handle");
    const cityInput = page.locator("#city");

    await expect(displayNameInput).toBeVisible();
    await expect(handleInput).toBeVisible();

    // Verify handle validation when handle is invalid/cleared
    await handleInput.fill("@");
    await page.locator("button.btn-signal", { hasText: "Continue" }).click();
    await expect(page.locator("text=Handle must be between 2 and 30 characters")).toBeVisible();

    // Fix handle and fill identity details
    await displayNameInput.fill("Taylor Vance");
    await handleInput.fill("@taylor_vance");
    await cityInput.fill("Toronto");

    // Advance to Step 1
    const continueBtn = page.locator("button.btn-signal", { hasText: "Continue" });
    await continueBtn.click();

    // ==========================================
    // Step 1: Core Constellation (Curated Interests)
    // ==========================================
    await expect(page.locator("text=02 // Core Constellation")).toBeVisible();
    await expect(page.locator("h1")).toHaveText(/What pulls you in/);

    // Button should initially be disabled or indicate requirement
    const continueStep1Btn = page.locator("button.btn-signal", { hasText: "Continue" });
    await expect(continueStep1Btn).toBeDisabled();

    // Select 3 curated interests
    const interestChips = page.locator(".chip:not([data-on='true'])");
    await interestChips.nth(0).click();
    await interestChips.nth(1).click();
    await interestChips.nth(2).click();

    // Button should now be enabled with count >= 3
    await expect(continueStep1Btn).toBeEnabled();
    await continueStep1Btn.click();

    // ==========================================
    // Step 2: Personal Constellation (Niche Obsessions)
    // ==========================================
    await expect(page.locator("text=03 // Personal Constellation")).toBeVisible();
    await expect(page.locator("h1")).toHaveText(/What could you talk about for hours/);

    const nicheInput = page.locator("#niche");
    await nicheInput.fill("Analogue synthesizer restoration");
    await nicheInput.press("Enter");

    // Verify custom obsession chip was added
    await expect(
      page.locator(".chip[data-on='true']", { hasText: "Analogue synthesizer restoration" }),
    ).toBeVisible();

    // Also pick a suggested obsession chip
    const suggestionChip = page.locator("button.chip", { hasText: "+ Lighthouse architecture" });
    if (await suggestionChip.isVisible()) {
      await suggestionChip.click();
    }

    // Advance to Step 3
    const continueToResonanceBtn = page.locator("button.btn-signal", { hasText: "Continue" });
    await continueToResonanceBtn.click();

    // ==========================================
    // Step 3: Conversation Style & Bio
    // ==========================================
    await expect(page.locator("text=04 // Resonance & Cadence")).toBeVisible();
    await expect(page.locator("h1")).toHaveText(/How do you like to talk/);

    // Fill bio
    const bioTextarea = page.locator("#bio");
    await bioTextarea.fill("Building strange analog audio boxes and decoding telemetry signals.");

    // Fill preferred topics
    const topicsInput = page.locator("#topics");
    await topicsInput.fill("Hardware hacking, retro electronics");

    // Select style chip
    const styleChip = page.locator("button.chip", { hasText: "Deep dives" });
    await styleChip.click();

    // Advance to Step 4 (Finish and calibrate)
    const assembleUniverseBtn = page.locator("button.btn-signal", { hasText: "Assemble universe" });
    await assembleUniverseBtn.click();

    // ==========================================
    // Step 4: Constellation Complete
    // ==========================================
    await expect(page.locator("text=05 // Constellation Complete")).toBeVisible();
    await expect(page.locator("h1")).toHaveText(/Your universe is ready/);

    // Verify completion mini-constellation SVG and Enter button
    await expect(page.locator("svg[aria-label*='interests in your constellation']")).toBeVisible();

    const enterFeedBtn = page.locator("a.btn-signal", { hasText: "Enter discovery feed" });
    await expect(enterFeedBtn).toBeVisible();
    await enterFeedBtn.click();

    // Verify transition to /discover
    await page.waitForURL("**/discover**");
    expect(page.url()).toContain("/discover");
  });
});
