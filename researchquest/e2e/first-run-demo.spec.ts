import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * First-run receipt: one real click of Use demo workspace must land the loop.
 * This replaces the old "Supabase configuration required" smoke as the e2e proof.
 */
const ARTIFACTS_DIR =
  process.env.RQ_FIRST_RUN_ARTIFACTS_DIR ??
  (process.env.CI ? "e2e/artifacts/first-run" : "/opt/cursor/artifacts");
const TOPIC_PATH = "/topics/topic-ai-agents";

test.describe("first-run demo click", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.addInitScript(() => {
      try {
        localStorage.clear();
      } catch {
        // ignore
      }
    });
  });

  test("first click of Use demo workspace lands seeded topic loop", async ({
    page,
  }) => {
    mkdirSync(ARTIFACTS_DIR, { recursive: true });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Prefer the static first-paint control; fall back to the React gate link.
    const demoCta = page.locator("[data-rq-demo-entry]").first();
    await expect(demoCta).toBeVisible({ timeout: 15_000 });
    await expect(demoCta).toHaveText(/Use demo workspace/i);

    // Gate card receipt (loop line, solid CTA, quiet Sign In, no Submit).
    await expect(
      page.getByText("One topic. Three papers. A note. A focus session."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Submit application/i)).toHaveCount(0);

    // AuthScreen may have replaced the static shell by now — Sign In should be quiet.
    const signIn = page.getByRole("button", { name: /^Sign In$/i });
    if ((await signIn.count()) > 0) {
      await expect(signIn).toBeVisible();
      const signInClass = (await signIn.getAttribute("class")) ?? "";
      expect(signInClass).not.toMatch(/bg-black|bg-primary-500/);
    }

    const demoClass = (await demoCta.getAttribute("class")) ?? "";
    // Solid primary: black journal CTA (React) or static .rq-demo styles.
    expect(
      demoClass.includes("bg-black") || demoClass.includes("rq-demo"),
    ).toBeTruthy();

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, "first_run_gate_card.png"),
      fullPage: true,
    });

    // THE CLICK — not a string grep, not a seed-table assert.
    await demoCta.click();

    await page.waitForURL((url) => url.pathname === TOPIC_PATH, {
      timeout: 30_000,
    });
    expect(page.url()).toContain(TOPIC_PATH);

    await expect(
      page.getByRole("heading", { name: /AI Agents for Research/i }),
    ).toBeVisible({ timeout: 30_000 });

    await expect(
      page.getByText(/Retrieval-Augmented Generation/i),
    ).toBeVisible();
    await expect(page.getByText(/Attention Is All You Need/i)).toBeVisible();
    await expect(page.getByText(/ReAct:/i)).toBeVisible();

    const note = page.getByRole("textbox", { name: /Session note/i });
    await expect(note).toBeVisible();
    await expect(note).toHaveValue("");

    await expect(
      page.getByRole("button", { name: /Focus Studio/i }),
    ).toBeVisible();

    // Dashboard chrome stripped on demo first-run topic.
    await expect(page.getByRole("button", { name: /Export/i })).toHaveCount(0);
    await expect(page.getByText(/Topic Quests/i)).toHaveCount(0);
    await expect(page.getByText(/Connected work/i)).toHaveCount(0);
    await expect(page.getByText(/Total links/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Edit$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Delete$/i })).toHaveCount(
      0,
    );
    await expect(page.getByText(/^LEVEL$/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Dashboard/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Feeds$/i })).toHaveCount(0);
    await expect(page.locator('[data-first-run="true"]')).toHaveCount(1);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, "first_run_seeded_topic.png"),
      fullPage: true,
    });
  });
});
