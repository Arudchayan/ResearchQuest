import { expect, test } from "@playwright/test";
import { enableDemoMode, gotoDemoView } from "./a11y";

/**
 * Item 97 — authenticated CRUD end to end.
 *
 * "Authenticated" here means the demo workspace session (the Scholar Access
 * gate's `Use demo workspace` entry): a real signed-in session against the
 * in-memory Supabase-compatible client, exercising UI → hooks → client →
 * store → UI with zero production writes. Each test gets a fresh seeded
 * workspace, so unique titles isolate the test's own rows from the seed.
 */
test.describe("authenticated demo session", () => {
  test("gate entry signs in and lands the seeded topic loop", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await context.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        // ignore
      }
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const demoCta = page.locator("[data-rq-demo-entry]").first();
    await expect(demoCta).toBeVisible({ timeout: 15_000 });
    await demoCta.click();

    await page.waitForURL((url) => url.pathname === "/topics/topic-ai-agents", {
      timeout: 30_000,
    });
    // List row + detail title both expose this heading; assert the detail.
    await expect(
      page.getByRole("heading", { name: "AI Agents for Research" }).nth(1),
    ).toBeVisible({ timeout: 30_000 });
    // Signed in: the auth gate is gone and the app shell is up.
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.getByText(/Submit application/i)).toHaveCount(0);
  });
});

test.describe("tasks CRUD", () => {
  test.beforeEach(async ({ context }) => {
    await enableDemoMode(context);
  });

  test("create, edit, complete, and delete a task", async ({ page }) => {
    const title = `E2E Task ${Date.now()}`;
    const edited = `${title} (edited)`;

    await gotoDemoView(page, "/tasks");
    await expect(
      page.getByRole("heading", { name: "Task Manager" }),
    ).toBeVisible({ timeout: 15_000 });

    // Create. NOTE: the demo realtime echo can render the created row twice
    // (filed bug — useEntityCrud prepend + tasks INSERT merge without
    // dedupe), so row assertions below use .first() and deletion removes
    // every copy.
    await page.getByRole("button", { name: "New Task" }).first().click();
    await page.locator("#task-title").fill(title);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });

    // Isolate our row(s) with search so Edit/Delete are unambiguous.
    await page.getByLabel("Search tasks").fill(title);

    // Edit.
    await page.getByRole("button", { name: "Edit" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Edit Task" }),
    ).toBeVisible();
    await page.locator("#task-title").fill(edited);
    await page.getByRole("button", { name: "Update" }).click();
    await expect(page.getByText(edited).first()).toBeVisible({
      timeout: 15_000,
    });

    // Complete toggle.
    await page
      .getByRole("button", { name: "Mark task as complete" })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Mark task as incomplete" }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Delete every copy (undo toast, no confirm dialog for tasks).
    for (let index = 0; index < 3; index++) {
      const deletes = page.getByRole("button", { name: "Delete task" });
      if ((await deletes.count()) === 0) break;
      await deletes.first().click();
    }
    await expect(page.getByText("Task deleted").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(edited)).toHaveCount(0);
  });
});

test.describe("notes CRUD", () => {
  test.beforeEach(async ({ context }) => {
    await enableDemoMode(context);
  });

  test("create, rename, and delete a note", async ({ page }) => {
    const title = `E2E Note ${Date.now()}`;

    await gotoDemoView(page, "/notes");
    await page.getByRole("button", { name: "Create new note" }).click();

    await page.waitForURL((url) => url.pathname.startsWith("/notes/"), {
      timeout: 15_000,
    });
    const titleBox = page.getByLabel("Note title");
    await expect(titleBox).toBeVisible({ timeout: 15_000 });
    await titleBox.fill(title);

    // Autosave (~1s debounce) must persist the title, then the sidebar
    // list shows the new card without any reload.
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 15_000 });
    const card = page.locator("[data-note-card]", {
      hasText: title,
    });
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Delete via the card action + confirm dialog. The delete button is
    // hover-revealed on desktop (md:opacity-0 until group-hover), so hover
    // the row first.
    const row = page.locator("div[data-index]", { has: card });
    await card.hover();
    await row.getByRole("button", { name: "Delete note" }).click();
    await expect(
      page.getByRole("heading", { name: "Delete note" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Note deleted")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.locator("[data-note-card]", { hasText: title }),
    ).toHaveCount(0);
  });
});

test.describe("ideas CRUD", () => {
  test.beforeEach(async ({ context }) => {
    await enableDemoMode(context);
  });

  test("capture, advance, and delete an idea", async ({ page }) => {
    const title = `E2E Idea ${Date.now()}`;

    await gotoDemoView(page, "/ideas");
    await page.getByRole("button", { name: "Create a new idea" }).click();
    await page.locator("#create-idea-title").fill(title);
    await page
      .locator("#create-idea-description")
      .fill("Hypothesis created by the PR22 e2e suite.");
    await page.getByRole("button", { name: "Create Idea" }).click();

    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });

    // Filter to our row(s) — the demo realtime echo can render the created
    // idea twice (same filed bug as tasks) — then advance one stage.
    await page.getByLabel("Search ideas").fill(title);
    await page
      .getByRole("button", { name: "Advance idea to next stage" })
      .first()
      .click();
    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });

    // Delete every copy via the (hover-revealed) card action + confirm.
    for (let index = 0; index < 3; index++) {
      const deletes = page.getByRole("button", { name: `Delete ${title}` });
      if ((await deletes.count()) === 0) break;
      await page.getByText(title).first().hover();
      await deletes.first().click();
      await expect(
        page.getByRole("heading", { name: "Delete idea" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Delete" }).click();
    }
    await expect(page.getByText("Idea deleted").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
