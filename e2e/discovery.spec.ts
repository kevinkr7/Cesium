import { test, expect } from "@playwright/test";
import { seedSession } from "./helpers/session";

test.describe("Discovery & Uncommon Ground Journey", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, {
      userId: "explorer-user-1",
      name: "Alex Rivera",
      onboarded: true,
      interests: ["Creative coding", "Astronomy", "Ambient music", "Film photography"],
      niche: ["Modular synthesizer patches"],
      connections: { mira: "connected" }, // Mira is connected, others are discoverable
    });
  });

  test("Renders discovery feed with candidates, category filters, and search", async ({ page }) => {
    await page.goto("/discover");
    await expect(page).toHaveTitle(/Discover — Cesium/);

    // Verify main header
    await expect(page.locator("h1")).toHaveText(/Interesting people, unexpected overlaps/);

    // Verify candidate cards are present
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Test filter chips
    const sharedFilter = page.locator("button.chip", { hasText: "Shared interests" });
    await sharedFilter.click();
    await expect(sharedFilter).toHaveAttribute("data-on", "true");

    const uncommonFilter = page.locator("button.chip", { hasText: "Uncommon connections" });
    await uncommonFilter.click();
    await expect(uncommonFilter).toHaveAttribute("data-on", "true");
    await expect(sharedFilter).toHaveAttribute("data-on", "false");

    // Reset filter
    await uncommonFilter.click();
    await expect(uncommonFilter).toHaveAttribute("data-on", "false");

    // Test search input
    const searchInput = page.locator("input[aria-label='Search people']");
    await searchInput.fill("Eli");
    await page.waitForTimeout(300); // Debounce / state update

    // Eli should be visible in search results
    await expect(page.locator("article", { hasText: "Eli" })).toBeVisible();

    // Clear search
    await searchInput.fill("");
    await page.waitForTimeout(300);
  });

  test("Opens ProfileSheet drawer and displays uncommon ground anchor", async ({ page }) => {
    await page.goto("/discover");

    // Locate first candidate card and click "View"
    const card = page.locator("article").first();
    await expect(card).toBeVisible();

    const candidateName = await card.locator("h2").innerText();

    const viewBtn = card.locator("button", { hasText: "View" }).first();
    await viewBtn.click();

    // Verify ProfileSheet drawer slides open
    const sheet = page.locator("aside[role='dialog']");
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("h2")).toContainText(candidateName);

    // Check shared interests & overlap note
    await expect(sheet.locator("text=Shared with you")).toBeVisible();
    await expect(sheet.locator("text=Overlap engine note")).toBeVisible();

    // Verify Uncommon Ground perspective section
    const uncommonSection = sheet.locator("text=Uncommon Ground perspective");
    if (await uncommonSection.isVisible()) {
      await expect(
        sheet.locator("text=Shared Anchor").or(sheet.locator("text=Novel Horizons")).first(),
      ).toBeVisible();
    }

    // Verify Safety actions in profile sheet
    await expect(sheet.locator("button", { hasText: "Report profile" })).toBeVisible();
    await expect(sheet.locator("button", { hasText: "Block user" })).toBeVisible();

    // Close the drawer
    const closeBtn = sheet.locator("button[aria-label='Close']");
    await closeBtn.click();
    await expect(sheet).not.toBeVisible();
  });

  test("Sends connection request and allows cancelling pending request", async ({ page }) => {
    await page.goto("/discover");

    // Find a card that has "Request connection"
    const requestBtn = page.locator("button", { hasText: "Request connection" }).first();
    await expect(requestBtn).toBeVisible();

    // Send connection request
    await requestBtn.click();

    // Card should now display pending status and cancel button
    const pendingIndicator = page.locator("text=Pending…").first();
    await expect(pendingIndicator).toBeVisible();

    const cancelBtn = page.locator("button[title='Cancel request']").first();
    await expect(cancelBtn).toBeVisible();

    // Cancel the request
    await cancelBtn.click();

    // Button reverts back to "Request connection"
    await expect(page.locator("button", { hasText: "Request connection" }).first()).toBeVisible();
  });
});
