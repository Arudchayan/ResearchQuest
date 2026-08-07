import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const showcaseBaseUrl = "http://127.0.0.1:4174";
const shellBaseUrl = "http://127.0.0.1:4175";
const snapshotsDirectory = path.resolve("e2e/snapshots/initial");
const viewports = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
] as const;
const themes = ["light", "dark"] as const;

test("captures informational initial visual baselines", async ({ browser }) => {
  await mkdir(snapshotsDirectory, { recursive: true });

  const metadata = {
    capturePurpose: "Informational initial visual baselines only; no visual comparison thresholds are configured.",
    capturedAt: new Date().toISOString(),
    runtime: {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      node: process.version,
      browser: `Chromium ${browser.version()}`,
    },
    captureMode: {
      appShell: "Missing Supabase configuration screen from the no-Supabase dev server.",
      showcase: "Dev-only showcase with an in-memory test user and fake local configuration; no Supabase backend is contacted.",
      animations: "disabled while taking each screenshot for deterministic static captures.",
    },
    viewports,
    themes,
  };

  for (const viewport of viewports) {
    for (const theme of themes) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto(shellBaseUrl, { waitUntil: "networkidle" });
      await expect(
        page.getByRole("heading", { name: "Supabase configuration required" }),
      ).toBeVisible();
      await page.evaluate((currentTheme) => {
        document.documentElement.classList.toggle("dark", currentTheme === "dark");
      }, theme);
      await page.screenshot({
        path: path.join(snapshotsDirectory, "shell", "missing-config", theme, `${viewport.name}.png`),
        fullPage: true,
        animations: "disabled",
      });
      await context.close();
    }
  }

  for (const viewport of viewports) {
    for (const theme of themes) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(() => {
        Reflect.set(window, "__TEST_USER__", { id: "visual-baseline-user" });
      });
      const page = await context.newPage();
      await page.route("https://example.invalid/**", (route) => route.abort());
      await page.goto(`${showcaseBaseUrl}/showcase`, { waitUntil: "networkidle" });
      await expect(page.getByTestId("showcase-page")).toBeVisible();
      await page.evaluate((currentTheme) => {
        document.documentElement.classList.toggle("dark", currentTheme === "dark");
      }, theme);
      await page.screenshot({
        path: path.join(snapshotsDirectory, "showcase", theme, `${viewport.name}.png`),
        fullPage: true,
        animations: "disabled",
      });
      await context.close();
    }
  }

  await writeFile(
    path.join(snapshotsDirectory, "metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
});
