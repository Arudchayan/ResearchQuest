import { expect, test } from "@playwright/test";
import { enableDemoMode, gotoDemoView } from "./a11y";

const responsiveViewports = [
  { width: 320, height: 720 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
] as const;

test.describe("responsive reflow", () => {
  for (const viewport of responsiveViewports) {
    test(`does not horizontally overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");

      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    });
  }

  test("does not horizontally overflow at 200%-zoom-equivalent width", async ({
    page,
    context,
  }) => {
    await enableDemoMode(context);
    // 200% browser zoom on a 1280px screen == a 640 CSS-px layout viewport,
    // emulated with viewport width instead of the non-standard style.zoom.
    await page.setViewportSize({ width: 640, height: 900 });
    await gotoDemoView(page, "/tasks");
    await expect(
      page.getByRole("heading", { name: "Task Manager" }),
    ).toBeVisible({ timeout: 15_000 });

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(640);
  });
});
