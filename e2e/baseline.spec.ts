import { test, expect } from "@playwright/test";

test.describe("Cesium Baseline Quality Gates", () => {
  test("Homepage loads with hero constellation and title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Cesium/);

    // Verify main brand heading
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();

    // Verify navigation is present (either desktop navbar or mobile menu button is visible)
    const nav = page
      .locator("nav[aria-label='Primary'], header button[aria-label='Open menu']")
      .locator("visible=true");
    await expect(nav).toBeVisible();
  });

  test("Authentication page displays login and register options", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Sign in — Cesium/);

    const emailInput = page.locator("input[type='email']");
    await expect(emailInput).toBeVisible();

    const passwordInput = page.locator("input[type='password']");
    await expect(passwordInput).toBeVisible();
  });

  test("Protected routes redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/discover");
    // Verify redirection to /login
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
  });

  test("404 Error page is rendered for unknown routes", async ({ page }) => {
    await page.goto("/non-existent-route-404");
    await expect(page.locator("text=404")).toBeVisible();
  });
});
