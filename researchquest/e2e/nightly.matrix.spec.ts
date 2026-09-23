import { expect, test } from "@playwright/test";
import { enableDemoMode, gotoDemoView, seededTopicDetailHeading } from "./a11y";

/**
 * Nightly-only cross-browser receipt (item 97).
 *
 * Skipped by default so CI chromium stays fast. Runs when RQ_E2E_MATRIX=1,
 * which enables the extra Playwright projects (firefox, webkit,
 * mobile-chrome) in `playwright.config.ts`:
 *
 *   RQ_E2E_MATRIX=1 pnpm exec playwright test
 *   RQ_E2E_MATRIX=1 pnpm run test:e2e:matrix
 */
const MATRIX_ENABLED = process.env.RQ_E2E_MATRIX === "1";

test.describe("nightly cross-browser matrix", () => {
  test.skip(
    !MATRIX_ENABLED,
    "Matrix runs nightly with RQ_E2E_MATRIX=1 (CI chromium stays fast).",
  );

  test.beforeEach(async ({ context }) => {
    await enableDemoMode(context);
  });

  test("demo first-run loop renders", async ({ page }) => {
    await gotoDemoView(page, "/topics/topic-ai-agents");
    await expect(seededTopicDetailHeading(page)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Attention Is All You Need/i)).toBeVisible();
  });

  test("tasks view is interactive", async ({ page }) => {
    await gotoDemoView(page, "/tasks");
    await expect(
      page.getByRole("heading", { name: "Task Manager" }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: "New Task" }).first(),
    ).toBeVisible();
  });
});
