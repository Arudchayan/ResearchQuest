import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4199";
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  workers: 1,
  reporter: [["list", { printSteps: false }]],
  use: {
    baseURL,
    locale: "en-US",
    timezoneId: "UTC",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        deviceScaleFactor: 1,
        ...(chromiumExecutablePath !== undefined
          ? { launchOptions: { executablePath: chromiumExecutablePath } }
          : {}),
      },
    },
  ],
});
