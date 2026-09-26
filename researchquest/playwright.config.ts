import { defineConfig, devices } from "@playwright/test";

const e2ePort = 4174;
const baseURL = `http://127.0.0.1:${e2ePort}`;

/**
 * Default e2e: Scholar Access gate with stub Supabase (no prod writes).
 * First-run click receipt lives in e2e/first-run-demo.spec.ts.
 * Prefer `pnpm run test:first-run` for the Jules-style single-command receipt.
 *
 * Cross-browser matrix (item 97): Firefox/WebKit/mobile projects are gated
 * behind RQ_E2E_MATRIX=1 so CI chromium stays fast. Nightly runs
 * `RQ_E2E_MATRIX=1 pnpm run test:e2e:matrix`, which also un-skips
 * e2e/nightly.matrix.spec.ts.
 */
const matrixEnabled = process.env.RQ_E2E_MATRIX === "1";

export default defineConfig({
  testDir: "e2e",
  // Preview / standalone / nightly-only specs have their own configs (or env
  // gates) and must never run under the default dev-server run: preview-smoke
  // needs `vite preview` on a prod bundle, smoke-no-supabase is a legacy
  // skip, redesign-visual needs RQ_VISUAL_QA=1, nightly.matrix needs
  // RQ_E2E_MATRIX=1 (plus extra browser projects).
  testIgnore: [
    "preview-smoke.spec.ts",
    "smoke-no-supabase.spec.ts",
    "redesign-visual.spec.ts",
    "nightly.matrix.spec.ts",
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ...(matrixEnabled
      ? [
          { name: "firefox", use: { ...devices["Desktop Firefox"] } },
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
          { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
        ]
      : []),
  ],
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${e2ePort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      // Stub credentials so the Scholar Access gate renders (not the
      // missing-config wart). Demo mode never writes to production.
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.stub",
      VITE_DEMO_MODE: "",
      VITE_USE_DEMO: "",
    },
  },
});
