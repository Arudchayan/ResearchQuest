import { expect, test } from "@playwright/test";
import { enableDemoMode, gotoDemoView } from "./a11y";

/**
 * Item 97 — realtime behaviour end to end.
 *
 * Architecture note (demo transport): the demo workspace is an in-memory
 * Supabase-compatible client, so each page owns its own realtime scope —
 * postgres_changes fan-out is per-page, not cross-tab. These specs prove
 * what that architecture guarantees:
 *
 * 1. Same-page live updates: writes merge into the store and render with no
 *    reload (the exact INSERT → subscription → list path realtime uses).
 * 2. Session scoping: concurrent tabs never leak rows into each other and
 *    both stay fully interactive (no cross-talk crashes).
 */
test.describe("realtime live updates", () => {
  test.beforeEach(async ({ context }) => {
    await enableDemoMode(context);
  });

  test("created task renders with no reload", async ({ page }) => {
    const title = `E2E Live Task ${Date.now()}`;
    await gotoDemoView(page, "/tasks");

    await page.getByRole("button", { name: "New Task" }).first().click();
    await page.locator("#task-title").fill(title);
    await page.getByRole("button", { name: "Create" }).click();

    // No reload, no navigation: the live store merge must render the row
    // (.first() — the demo realtime echo can render it twice, see the
    // filed bug referenced in authenticated-crud.spec.ts).
    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });
    expect(page.url()).toContain("/tasks");
  });

  test("created note appears in the sidebar with no reload", async ({
    page,
  }) => {
    const title = `E2E Live Note ${Date.now()}`;
    await gotoDemoView(page, "/notes");

    await page.getByRole("button", { name: "Create new note" }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/notes/"), {
      timeout: 15_000,
    });
    await page.getByLabel("Note title").fill(title);

    await expect(page.getByText("Saved")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator("[data-note-card]", { hasText: title }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("concurrent tabs keep independent realtime scopes", async ({
    context,
    page,
  }) => {
    const title = `E2E Scoped Task ${Date.now()}`;
    const second = await context.newPage();

    await gotoDemoView(page, "/tasks");
    await gotoDemoView(second, "/tasks");

    // Tab A creates a row through its own realtime scope.
    await page.getByRole("button", { name: "New Task" }).first().click();
    await page.locator("#task-title").fill(title);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });

    // Tab B (separate in-memory scope) must NOT see tab A's row, and both
    // tabs stay interactive — no cross-talk, no shared-state crash.
    await expect(second.getByText(title)).toHaveCount(0);
    await expect(
      second.getByRole("heading", { name: "Task Manager" }),
    ).toBeVisible();
    await second.getByLabel("Search tasks").fill("e2e-no-match-xyz");
    await expect(page.getByText(title).first()).toBeVisible();

    await second.close();
  });
});
