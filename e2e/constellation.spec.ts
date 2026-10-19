import { test, expect } from "@playwright/test";
import { seedSession } from "./helpers/session";

test.describe("Constellation Graph & Profile Settings", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, {
      userId: "explorer-user-1",
      name: "Alex Rivera",
      onboarded: true,
      interests: ["Creative coding", "Astronomy", "Ambient music", "Film photography"],
      niche: ["Modular synthesizer patches"],
    });
  });

  test("Renders interactive constellation graph, inspects node, and updates profile settings", async ({
    page,
  }) => {
    await page.goto("/constellation");
    await expect(page).toHaveTitle(/Your constellation — Cesium/);

    // Verify profile header information
    await expect(page.locator("h1")).toHaveText(/Alex Rivera/);
    await expect(page.locator("text=@alex_orbit")).toBeVisible();

    // Verify SVG graph is rendered
    const svgGraph = page.locator("svg[viewBox='0 0 1000 700']");
    await expect(svgGraph).toBeVisible();

    // 1. Inspect a node in the constellation graph
    const interestNode = page.locator("g[aria-label='Creative coding']").first();
    if (await interestNode.isVisible()) {
      await interestNode.click();

      // Card should open with interest details
      const nodeCard = page
        .locator("div", { hasText: "Creative coding" })
        .filter({ has: page.locator("button[aria-label='Close']") });
      await expect(nodeCard.first()).toBeVisible();

      // Close the details card
      const closeDrawerBtn = page.locator("button[aria-label='Close']").first();
      await closeDrawerBtn.click();
    }

    // 2. Open Profile Settings Modal
    const editProfileBtn = page.locator("button", { hasText: "Edit Profile" });
    await expect(editProfileBtn).toBeVisible();
    await editProfileBtn.click();

    // Verify Dialog opened
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("text=Edit Profile Parameters")).toBeVisible();

    // Edit display name and bio
    const nameInput = dialog.locator("#edit-display-name");
    await nameInput.fill("Alex Rivera-Chen");

    const bioInput = dialog.locator("textarea");
    await bioInput.fill("Sonic explorer, modular synthesist, and creative developer.");

    // Select conversation style
    const styleBtn = dialog.locator("button", { hasText: "Technical" });
    if (await styleBtn.isVisible()) {
      await styleBtn.click();
    }

    // Save changes
    const saveBtn = dialog.locator("button", { hasText: "Save Changes" });
    await saveBtn.click();

    // Dialog should close and header reflects new name
    await expect(dialog).not.toBeVisible();
    await expect(page.locator("h1")).toHaveText(/Alex Rivera-Chen/);
  });
});
