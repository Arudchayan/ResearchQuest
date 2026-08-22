import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const visualQaEnabled = process.env.RQ_VISUAL_QA === "1";
const snapshotsDirectory = path.join("e2e", "snapshots", "redesign");
const captureTime = new Date("2026-01-15T09:30:00Z");

const routes = [
  { name: "dashboard", path: "/" },
  { name: "notes", path: "/notes" },
  { name: "papers", path: "/papers" },
  { name: "ideas", path: "/ideas" },
  { name: "tasks", path: "/tasks" },
  { name: "focus", path: "/focus" },
  { name: "topics", path: "/topics" },
] as const;

const viewports = [
  { name: "375", width: 375, height: 812 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 900 },
] as const;

const themes = ["light", "dark"] as const;
const requestedRouteNames = process.env.RQ_VISUAL_ROUTES?.split(",")
  .map((routeName) => routeName.trim())
  .filter((routeName) => routeName.length > 0);
const selectedRoutes = requestedRouteNames?.length
  ? routes.filter((route) => requestedRouteNames.includes(route.name))
  : routes;

test.skip(visualQaEnabled === false, "Set RQ_VISUAL_QA=1 to capture redesign evidence.");

test("captures deterministic redesign evidence", async ({ browser }) => {
  await mkdir(snapshotsDirectory, { recursive: true });
  const interactionsDirectory = path.join(snapshotsDirectory, "interactions");

  if (selectedRoutes.length === 0) {
    throw new Error("RQ_VISUAL_ROUTES did not match a supported route name.");
  }

  for (const routeDefinition of selectedRoutes) {
    for (const viewport of viewports) {
      for (const theme of themes) {
        const context = await browser.newContext({
          viewport,
          colorScheme: theme,
          deviceScaleFactor: 1,
        });

        await context.addInitScript(() => {
          window.localStorage.clear();
          Reflect.set(window, "__TEST_USER__", {
            id: "00000000-0000-4000-8000-000000000001",
          });
        });
        await context.route("https://example.invalid/**", (request) => request.abort());

        const page = await context.newPage();
        await page.clock.install({ time: captureTime });

        try {
          await page.goto(routeDefinition.path, { waitUntil: "networkidle" });
          await expect(page.locator("#main-content")).toBeVisible();
          await page.evaluate((currentTheme) => {
            document.documentElement.classList.toggle("dark", currentTheme === "dark");
          }, theme);
          await page.evaluate(async () => {
            await document.fonts.ready;
          });

          const requiredFontStates = await page.evaluate(() => {
            const requiredFamilies = new Set([
              "Inter",
              "JetBrains Mono",
              "Playfair Display",
            ]);

            return Array.from(document.fonts)
              .filter((font) => requiredFamilies.has(font.family))
              .map((font) => ({
                family: font.family,
                weight: font.weight,
                status: font.status,
              }));
          });
          expect(
            requiredFontStates.every((font) => font.status === "loaded"),
            `Required fonts did not load: ${JSON.stringify(requiredFontStates)}`,
          ).toBe(true);

          const documentSize = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
          }));
          expect(
            documentSize.scrollWidth,
            `${routeDefinition.name}/${theme}/${viewport.name} has horizontal overflow`,
          ).toBeLessThanOrEqual(documentSize.viewportWidth);

          const outputPath = path.join(
            snapshotsDirectory,
            routeDefinition.name,
            theme,
            `${viewport.name}.png`,
          );
          await mkdir(path.dirname(outputPath), { recursive: true });
          await page.screenshot({
            path: outputPath,
            fullPage: true,
            animations: "disabled",
            caret: "hide",
            scale: "css",
          });
        } finally {
          await context.close();
        }
      }
    }
  }
});
