import { test } from "@playwright/test";

/**
 * Former smoke asserted the missing-config screen. That screen is the wart for
 * first-run strangers — the receipt is `first-run-demo.spec.ts` (click Use demo
 * workspace → seeded topic). Keep this file as an explicit skip so CI does not
 * treat the wart as green proof.
 */
test.describe("legacy no-supabase smoke (not the first-run receipt)", () => {
  test.skip(
    true,
    "Replaced by e2e/first-run-demo.spec.ts — run: pnpm run test:first-run",
  );
});
