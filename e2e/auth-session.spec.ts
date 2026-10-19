import { test, expect } from "@playwright/test";
import { seedSession, seedUnauthenticated } from "./helpers/session";

test.describe("Authentication & Session Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await seedUnauthenticated(page);
  });

  test("Renders login view and allows toggling to register mode", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Sign in — Cesium/);
    await expect(page.locator("section[data-hydrated='true']")).toBeVisible({ timeout: 15000 });

    // Initial state is Login mode
    await expect(page.locator("text=01 / Sign in")).toBeVisible();
    await expect(page.locator("h1")).toHaveText(/Welcome back/);
    const emailInput = page.locator("input[type='email']");
    await expect(emailInput).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.locator("#name")).not.toBeVisible();
    await expect(page.locator("#confirm")).not.toBeVisible();

    // Toggle to Register mode using deterministic button ID
    const toggleBtn = page.locator("#toggle-auth-mode");
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // Verify Register mode view
    await expect(page.locator("h1")).toHaveText(/Come as you are/);
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#confirm")).toBeVisible();

    // Toggle back to Login mode
    await toggleBtn.click();
    await expect(page.locator("h1")).toHaveText(/Welcome back/);
    await expect(page.locator("#name")).not.toBeVisible();
  });

  test("Validates client-side authentication inputs", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("section[data-hydrated='true']")).toBeVisible();
    await expect(page.locator("input[type='email']")).toBeVisible();

    // Toggle to register mode to check multi-field validation
    const toggleBtn = page.locator("#toggle-auth-mode");
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    await expect(page.locator("#name")).toBeVisible();

    // Fill invalid email and mismatched password
    await page.locator("#name").fill("Alex");
    await page.locator("input[type='email']").fill("invalid-email");
    await page.locator("#password").fill("pass12345");
    await page.locator("#confirm").fill("different12345");

    // Submit form
    await page.locator("button[type='submit']").click();

    // Verify error messages
    await expect(page.locator("#email-err")).toBeVisible();
    await expect(page.locator("#confirm-err")).toBeVisible();
  });

  test("Protected routes redirect unauthenticated users to login", async ({ page }) => {
    // Attempt accessing discover
    await page.goto("/discover");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");

    // Attempt accessing constellation
    await page.goto("/constellation");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");

    // Attempt accessing communities
    await page.goto("/communities");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");

    // Attempt accessing messages
    await page.goto("/messages");
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
  });

  test("Authenticated user sees active navigation and can sign out", async ({ page, isMobile }) => {
    await seedSession(page, { name: "Alex Rivera", onboarded: true });
    await page.goto("/");
    if (isMobile) {
      await page.waitForSelector("header[data-hydrated='true']");
      const openMenuBtn = page.locator("#mobile-open-menu-btn");
      await expect(openMenuBtn).toBeVisible();
      await openMenuBtn.click({ force: true });

      // Mobile menu dialog opens
      const menu = page.locator("div[role='dialog'][aria-label='Menu']");
      await expect(menu).toBeVisible();
      await expect(menu.locator("text=Discover")).toBeVisible();
      await expect(menu.locator("text=Constellation")).toBeVisible();
      await expect(menu.locator("text=Communities")).toBeVisible();
      await expect(menu.locator("text=Messages")).toBeVisible();

      // Sign out
      const signOutBtn = page.locator("#mobile-signout-btn");
      await expect(signOutBtn).toBeVisible();
      await signOutBtn.click();
      await expect(menu).not.toBeVisible();

      // Open menu again to verify unauthenticated state
      await expect(page.locator("header[data-hydrated='true']")).toBeVisible();
      await openMenuBtn.click({ force: true });
      await expect(menu).toBeVisible();
      await expect(menu.locator("a", { hasText: "Sign in" })).toBeVisible();
      await expect(menu.locator("text=Discover")).not.toBeVisible();
    } else {
      // Desktop floating vertical navbar
      const nav = page.locator("nav[aria-label='Primary']");
      await expect(nav).toBeVisible();

      // Check navigation links
      await expect(nav.locator("a", { hasText: "Discover" })).toBeVisible();
      await expect(nav.locator("a", { hasText: "Constellation" })).toBeVisible();
      await expect(nav.locator("a", { hasText: "Communities" })).toBeVisible();
      await expect(nav.locator("a", { hasText: "Messages" })).toBeVisible();

      // Verify user identity displayed
      await expect(nav.locator("text=Alex")).toBeVisible();

      // Click sign out button
      const signOutBtn = nav.locator("button[aria-label='Sign out']");
      await signOutBtn.click();

      // After sign out, the navbar should show the "Sign in" call to action
      await expect(nav.locator("a", { hasText: "Sign in" })).toBeVisible();
      await expect(nav.locator("a", { hasText: "Discover" })).not.toBeVisible();
    }
  });
});
