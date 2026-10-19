import { test, expect } from "@playwright/test";
import { seedSession } from "./helpers/session";

test.describe("Connections & Messaging Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, {
      userId: "explorer-user-1",
      name: "Alex Rivera",
      onboarded: true,
      connections: {
        mira: "connected",
        eli: "pending",
      },
      messages: {
        mira: [
          {
            id: "msg-1",
            from: "them",
            text: "Your note about modular synthesizer patch design was fascinating.",
            at: Date.now() - 3600000,
            status: "sent",
          },
        ],
      },
    });
  });

  test("Renders messages view, handles pending requests, and sends chat messages", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/messages");
    await expect(page).toHaveTitle(/Messages — Cesium/);

    // Verify main header
    await expect(page.locator("h1")).toHaveText(/Messages/);

    // 1. Pending connection request handling
    const pendingSection = page.locator("li", { hasText: "Pending Requests" });
    if (await pendingSection.isVisible()) {
      await expect(pendingSection.locator("text=Eli Okafor")).toBeVisible();
      const acceptBtn = pendingSection.locator("button", { hasText: "Accept" });
      await expect(acceptBtn).toBeVisible();

      // Accept Eli's request
      await acceptBtn.click();
      await page.waitForTimeout(300);
    }

    // 2. Select Mira Raman conversation
    const miraContact = page.locator("li button", { hasText: "Mira Raman" });
    if (await miraContact.isVisible()) {
      await miraContact.click();
    }

    // Verify active chat header
    await expect(page.locator("p.font-medium", { hasText: "Mira Raman" })).toBeVisible();

    // Verify past message is visible
    await expect(
      page.locator("p", {
        hasText: "Your note about modular synthesizer patch design was fascinating.",
      }),
    ).toBeVisible();

    // 3. Icebreaker chips or textarea input
    const textarea = page.locator("textarea[aria-label='Message']");
    await expect(textarea).toBeVisible();

    const icebreakerChips = page.locator(".border-t button.chip");
    if ((await icebreakerChips.count()) > 0) {
      const firstChip = icebreakerChips.first();
      const starterText = await firstChip.innerText();
      await firstChip.click();

      // Verify starter was populated into the textarea
      await expect(textarea).toHaveValue(starterText);
    } else {
      await textarea.fill("Have you experimented with algorithmic sequencers recently?");
    }

    // 4. Send message
    const sendBtn = page.locator("button[aria-label='Send']");
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // Verify the sent message bubble appears in chat
    const sentMessages = page.locator("p.bg-signal.text-ink");
    await expect(sentMessages.last()).toBeVisible();

    // Verify message delivery indicator (✓ or text)
    await expect(page.locator("text=✓").first()).toBeVisible();

    // 5. Mobile responsive check: back button returns to list
    if (isMobile) {
      const backBtn = page.locator("button[aria-label='Back']");
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await expect(page.locator("ul[aria-label='Conversations']")).toBeVisible();
      }
    }
  });
});
