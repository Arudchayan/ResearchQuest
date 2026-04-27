import { expect, test } from "@playwright/test";

test.describe("App shell without Supabase", () => {
  test("shows configuration required screen", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Supabase configuration required" }),
    ).toBeVisible();
    await expect(
      page.getByText("ResearchQuest needs Supabase credentials before it can start."),
    ).toBeVisible();
    await expect(page.getByText("VITE_SUPABASE_URL")).toBeVisible();
    await expect(page.getByText("VITE_SUPABASE_ANON_KEY")).toBeVisible();
  });
});
