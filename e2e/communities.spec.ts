import { test, expect } from "@playwright/test";
import { seedSession } from "./helpers/session";

test.describe("Micro-Communities & Discussion Threads", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, {
      userId: "explorer-user-1",
      name: "Alex Rivera",
      onboarded: true,
      joined: ["2am-builders"],
    });
  });

  test("Explores communities directory, creates a micro-community, and interacts in threads", async ({
    page,
  }) => {
    // ==========================================
    // 1. Communities Directory & Search
    // ==========================================
    await page.goto("/communities");
    await expect(page).toHaveTitle(/Communities — Cesium/);

    await expect(page.locator("h1")).toHaveText(/Small rooms\. Loud curiosity\./);

    // Verify search filtering
    const searchInput = page.locator("input[placeholder='Search communities']");
    await searchInput.fill("2am");
    await expect(page.locator("text=/The 2AM Builders/i").first()).toBeVisible();
    await searchInput.fill("");

    // ==========================================
    // 2. Start a New Micro-Community
    // ==========================================
    const startCommunityBtn = page.locator("button.btn-signal", { hasText: "Start a community" });
    await startCommunityBtn.click();

    // Verify modal opened
    const modal = page.locator("form[role='dialog']");
    await expect(modal).toBeVisible();

    // Fill form
    await modal.locator("#cname").fill("Ambient Sound Lab");
    await modal
      .locator("#cdesc")
      .fill("A creative space for generative acoustics and analog tape synthesis.");

    // Submit creation
    await modal.locator("button[type='submit']").click();

    // Modal should close and new community is visible
    await expect(modal).not.toBeVisible();
    await expect(page.locator("text=Ambient Sound Lab").first()).toBeVisible();

    // ==========================================
    // 3. Community Details & Membership Toggle
    // ==========================================
    await page.goto("/communities/2am-builders");
    await expect(page).toHaveTitle(/The 2AM Builders — Cesium/);

    // Verify header and description
    await expect(page.locator("h1")).toHaveText(/The 2AM Builders/);

    // Verify join button state
    const joinBtn = page.locator("button", { hasText: /Joined|Join/ }).first();
    await expect(joinBtn).toBeVisible();

    // Toggle membership
    await joinBtn.click();
    await page.waitForTimeout(300);

    // ==========================================
    // 4. Thread Creation & Inline Replies
    // ==========================================
    const newThreadBtn = page.locator("button", { hasText: "New thread" });
    await newThreadBtn.click();

    // Verify new thread form is displayed
    const threadTitleInput = page.locator("#thread-title");
    await expect(threadTitleInput).toBeVisible();
    await threadTitleInput.fill("What is your favorite late-night hardware tool?");

    const threadContentTextarea = page.locator("textarea[placeholder*='Optional thoughts']");
    await threadContentTextarea.fill(
      "Currently pairing a vintage sampler with custom reverb algorithms.",
    );

    // Post thread
    await page.locator("button.btn-signal", { hasText: "Post thread" }).click();

    // Verify posted thread appears in the thread list
    const createdThread = page.locator("li", {
      hasText: "What is your favorite late-night hardware tool?",
    });
    await expect(createdThread).toBeVisible();

    // Expand the thread if not already open
    const threadToggleBtn = createdThread.locator("button.label-mono", { hasText: "+" });
    if (await threadToggleBtn.isVisible()) {
      await threadToggleBtn.click();
    }

    // Post an inline reply
    const replyInput = createdThread.locator("input[placeholder*='Write a reply']");
    await expect(replyInput).toBeVisible();
    await replyInput.fill("The Roland RE-201 Space Echo is unbeatable at 2 AM.");

    const replySubmitBtn = createdThread.locator("button.btn-signal", { hasText: "Reply" });
    await replySubmitBtn.click();

    // Verify reply appears under thread
    await expect(
      createdThread.locator("p", {
        hasText: "The Roland RE-201 Space Echo is unbeatable at 2 AM.",
      }),
    ).toBeVisible();
  });
});
