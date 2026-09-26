import { expect, test } from "@playwright/test";
import { enableDemoMode, gotoDemoView } from "./a11y";

/**
 * Preview smoke (PR9 item 9): the production build in `researchquest/dist`,
 * served via `vite preview --port 4174`, must boot — and the first-run gate
 * must be a working door, not just a title. No backend is required: the app is
 * built with stub Supabase env so the Scholar Access gate renders.
 */
test.describe("preview smoke (production build boots)", () => {
  test("scholar gate + demo entry CTA land the seeded topic loop", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/ResearchQuest/, { timeout: 15_000 });
    await expect(page.locator("#root")).toBeAttached({ timeout: 15_000 });
    // React mounted (static gate replaced or hydrated): body has content.
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 15_000 });

    // Scholar Access gate (static first-paint shell or React AuthScreen).
    await expect(page.getByText(/Scholar Access/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page
        .getByText("Four sample topics. Papers, notes, and Focus Studio to explore.")
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    // Demo entry CTA: real link into the seeded topic.
    const demoCta = page.locator("[data-rq-demo-entry]").first();
    await expect(demoCta).toBeVisible({ timeout: 15_000 });
    await expect(demoCta).toHaveText(/Use demo workspace/i);
    await expect(demoCta).toHaveAttribute("href", "/topics/topic-ai-agents");

    // THE CLICK — not a string grep: the door opens the seeded topic loop.
    await demoCta.click();
    await expect(page).toHaveURL(/\/topics\/topic-ai-agents/, {
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { name: /AI Agents for Research/i }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("deep-linked demo view settles (prod bundle)", async ({
    page,
    context,
  }) => {
    await enableDemoMode(context);
    await gotoDemoView(page, "/topics/topic-ai-agents");
    await expect(
      page.getByRole("heading", { name: /AI Agents for Research/i }),
    ).toBeVisible({ timeout: 30_000 });
  });
});
