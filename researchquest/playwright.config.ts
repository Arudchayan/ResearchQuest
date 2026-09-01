import { defineConfig, devices } from "@playwright/test";

const e2ePort = 4174;
const baseURL = `http://127.0.0.1:${e2ePort}`;

/**
 * Default e2e: Scholar Access gate with stub Supabase (no prod writes).
 * First-run click receipt lives in e2e/first-run-demo.spec.ts.
 * Prefer `pnpm run test:first-run` for the Jules-style single-command receipt.
 */
export default defineConfig({
  testDir: "e2e",
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
