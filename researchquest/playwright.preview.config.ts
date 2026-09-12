import { defineConfig, devices } from "@playwright/test";

const previewPort = 4174;
const baseURL = `http://127.0.0.1:${previewPort}`;

/**
 * Preview smoke (PR9 item 9): runs ONLY e2e/preview-smoke.spec.ts against an
 * already-served production build (`vite preview --port 4174` from
 * researchquest/dist). No webServer here — CI starts preview explicitly so a
 * hung dev server can never mask a broken production bundle.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "preview-smoke.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
