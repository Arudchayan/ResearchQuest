import { expect, test } from "@playwright/test";

/**
 * Preview smoke (PR9 item 9): the production build in `researchquest/dist`,
 * served via `vite preview --port 4174`, must boot — title set and React
 * root mounted. No backend is required: without Supabase env the app renders
 * the config screen, with stub env the Scholar gate; either proves boot.
 */
test.describe("preview smoke (production build boots)", () => {
  test("title and root element are present", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/ResearchQuest/, { timeout: 15_000 });
    await expect(page.locator("#root")).toBeAttached({ timeout: 15_000 });
    // React mounted (static gate replaced or hydrated): body has content.
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 15_000 });
  });
});
