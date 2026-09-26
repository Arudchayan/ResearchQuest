import { expect, test } from "@playwright/test";
import {
  assertFocusContained,
  enableDemoMode,
  gotoDemoView,
} from "./a11y";

/**
 * Item 95 — interaction-level accessibility proofs that a static axe scan
 * cannot cover: focus trap, tab order, contrast, and reduced motion.
 */
test.describe("a11y interactions", () => {
  test.beforeEach(async ({ context }) => {
    await enableDemoMode(context);
  });

  // NOTE (P1 Batch 3): the tasks/notes color-contrast re-scans that lived
  // here were removed — axe-views.spec.ts already runs the full WCAG 2.1 AA
  // suite (contrast included) over every MAIN_VIEW_ROUTE, so they scanned the
  // same pages twice.

  test("new-idea dialog traps focus and closes on Escape", async ({
    page,
  }) => {
    await gotoDemoView(page, "/ideas");
    await page
      .getByRole("button", { name: "Create a new idea" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Capture New Idea" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    // Radix auto-focus lands on the title field (has the `autoFocus` attr).
    await expect(page.locator("#create-idea-title")).toBeFocused();
    // Cycle well past the dialog's focusable count; focus must stay inside.
    await assertFocusContained(page, '[role="dialog"]', 14);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("skip link is reachable by keyboard and targets main content", async ({
    page,
  }) => {
    await gotoDemoView(page, "/notes");
    const skipLink = page.getByRole("link", { name: "Skip to content" });

    let reached = false;
    for (let index = 0; index < 6; index++) {
      await page.keyboard.press("Tab");
      reached = await skipLink.evaluate(
        (element) => element === document.activeElement,
      );
      if (reached) break;
    }
    expect(reached, "skip link not reachable within 6 tabs").toBe(true);

    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("tab order starts at the skip link, not buried chrome", async ({
    page,
  }) => {
    await gotoDemoView(page, "/tasks");
    // Reset sequential-navigation origin to the top of the document.
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test.beforeEach(async ({ context }) => {
    await enableDemoMode(context);
  });

  test("kills transitions when prefers-reduced-motion is set", async ({
    page,
  }) => {
    // Emulate explicitly per-test: survives project-level `use` merges and
    // applies before first paint assertions below.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoDemoView(page, "/tasks");
    await expect(
      page.evaluate(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).resolves.toBe(true);

    // index.css forces `transition-duration: 0.01ms !important` under the
    // reduce query; any animated card must collapse to ~zero.
    const seconds = await page.evaluate(() => {
      const animated =
        document.querySelector(".transition") ?? document.body;
      return Number.parseFloat(
        getComputedStyle(animated).transitionDuration,
      );
    });
    expect(seconds).toBeLessThan(0.05);
  });
});
