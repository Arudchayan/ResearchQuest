import { expect, test } from "@playwright/test";
import { enableDemoMode, gotoDemoView } from "./a11y";

test.describe("Today plan smoke", () => {
  test.beforeEach(async ({ context }) => {
    await enableDemoMode(context);
  });

  test("adds a Today item and starts Focus on it", async ({ page }) => {
    await gotoDemoView(page, "/tasks");

    await page.getByRole("link", { name: "Today" }).click();
    const today = page.getByRole("region", { name: "Today" });
    await expect(today.getByRole("heading", { name: "Today" })).toBeVisible({
      timeout: 15_000,
    });

    const title = `Gym ${Date.now()}`;
    await today.getByLabel("Add what you will do today").fill(title);
    await today.getByRole("button", { name: "Add", exact: true }).click();

    const openTask = today.getByRole("button", { name: `Open task: ${title}` });
    await expect(openTask.first()).toBeVisible({ timeout: 15_000 });

    await today
      .getByRole("button", { name: `Start focus: ${title}` })
      .first()
      .click();
    await expect(page).toHaveURL(/\/focus/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible({
      timeout: 15_000,
    });
  });
});
