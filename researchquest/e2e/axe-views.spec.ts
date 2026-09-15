import { test } from "@playwright/test";
import {
  MAIN_VIEW_ROUTES,
  enableDemoMode,
  expectNoAxeViolations,
  gotoDemoView,
} from "./a11y";

/**
 * Item 95 — systematic axe sweep over every main view.
 *
 * Replaces the previous ad-hoc coverage (six unit-level a11y tests) with a
 * repeatable WCAG 2.1 AA scan of each shipped route in the demo workspace.
 * Runs on chromium in CI; the nightly matrix (RQ_E2E_MATRIX=1) re-runs this
 * file on Firefox/WebKit/mobile via the extra Playwright projects.
 */
test.describe("systematic axe sweep", () => {
  test.beforeEach(async ({ context }) => {
    await enableDemoMode(context);
  });

  for (const route of MAIN_VIEW_ROUTES) {
    test(`no WCAG 2.1 AA violations on ${route}`, async ({ page }) => {
      await gotoDemoView(page, route);
      await expectNoAxeViolations(page);
    });
  }
});
