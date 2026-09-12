import { expect, test } from "@playwright/test";
import { enableDemoMode, gotoDemoView } from "./a11y";

/**
 * Item 97 — multi-user (multi-session) isolation end to end.
 *
 * Each browser context boots its own seeded demo workspace, modelling two
 * different signed-in users. Rows created in session A must never surface in
 * session B — not in lists, and not via deep links — while B's own seed
 * stays intact.
 */
test.describe("multi-session isolation", () => {
  test("session B never sees session A rows", async ({ browser }) => {
    const title = `E2E Private Task ${Date.now()}`;

    const contextA = await browser.newContext();
    await enableDemoMode(contextA);
    const pageA = await contextA.newPage();
    await gotoDemoView(pageA, "/tasks");
    await pageA.getByRole("button", { name: "New Task" }).first().click();
    await pageA.locator("#task-title").fill(title);
    await pageA.getByRole("button", { name: "Create" }).click();
    await expect(pageA.getByText(title).first()).toBeVisible({
      timeout: 15_000,
    });

    const contextB = await browser.newContext();
    await enableDemoMode(contextB);
    const pageB = await contextB.newPage();
    await gotoDemoView(pageB, "/tasks");

    // B's workspace is intact (seed renders) but A's row is absent.
    await expect(
      pageB.getByRole("heading", { name: "Task Manager" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByText(title)).toHaveCount(0);

    await contextA.close();
    await contextB.close();
  });

  test("deep link to another session's note resolves to empty state, not data", async ({
    browser,
  }) => {
    const title = `E2E Private Note ${Date.now()}`;

    const contextA = await browser.newContext();
    await enableDemoMode(contextA);
    const pageA = await contextA.newPage();
    await gotoDemoView(pageA, "/notes");
    await pageA.getByRole("button", { name: "Create new note" }).click();
    await pageA.waitForURL((url) => url.pathname.startsWith("/notes/"), {
      timeout: 15_000,
    });
    await pageA.getByLabel("Note title").fill(title);
    await expect(pageA.getByText("Saved")).toBeVisible({ timeout: 15_000 });
    const privateId = pageA.url().split("/notes/")[1] ?? "";

    const contextB = await browser.newContext();
    await enableDemoMode(contextB);
    const pageB = await contextB.newPage();
    await gotoDemoView(pageB, `/notes/${privateId}`);

    // URL is preserved but no private content leaks: the editor shows the
    // empty-state placeholder and the sidebar has no such card.
    await expect(pageB.getByText("Select a note")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      pageB.locator("[data-note-card]", { hasText: title }),
    ).toHaveCount(0);

    await contextA.close();
    await contextB.close();
  });
});
