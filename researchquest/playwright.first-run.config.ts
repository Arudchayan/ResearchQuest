import { defineConfig, devices } from "@playwright/test";

const e2ePort = 4175;
const baseURL = `http://127.0.0.1:${e2ePort}`;
const chromePath =
  process.env.PLAYWRIGHT_CHROME ?? "/usr/bin/google-chrome-stable";

/**
 * First-run click receipt. Serves the app with stub Supabase env so the
 * Scholar Access gate (not the missing-config wart) is the door under test.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: /first-run-demo\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 90_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath: chromePath },
      },
    },
  ],
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${e2ePort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      // Stub only — demo mode never writes to production Supabase.
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.stub",
      VITE_DEMO_MODE: "",
      VITE_USE_DEMO: "",
    },
  },
});
