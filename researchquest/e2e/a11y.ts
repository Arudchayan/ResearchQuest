import { expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

/**
 * Shared accessibility + demo-mode helpers for the systematic axe sweep
 * (plan item 95). All specs run against the in-memory demo workspace so CI
 * needs no Supabase credentials and never writes to production.
 */

/** localStorage flag read by `src/lib/supabase.ts` at module load. */
export const DEMO_MODE_KEY = "rq_demo_mode";

/** Main product views covered by the systematic axe sweep. */
export const MAIN_VIEW_ROUTES = [
  "/topics",
  "/topics/topic-ai-agents",
  "/notes",
  "/papers",
  "/ideas",
  "/tasks",
  "/focus",
  "/feeds",
] as const;

/**
 * Enable demo mode for every page in this context. Must run before the first
 * `page.goto` — the app reads the flag once at module load.
 */
export async function enableDemoMode(
  context: BrowserContext,
): Promise<void> {
  await context.addInitScript((key: string) => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      // Private browsing / disabled storage: specs will fail loudly below.
    }
  }, DEMO_MODE_KEY);
}

/** Navigate to a demo view and wait for the app shell to settle. */
export async function gotoDemoView(
  page: Page,
  path: string,
): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#main-content")).toBeVisible({ timeout: 30_000 });
}

export interface AxeScanOptions {
  /** axe rule ids to skip, with the reason documented at the call site. */
  disableRules?: string[];
  /** selectors to exclude from the scan. */
  exclude?: string[];
  /** Run only these rules (e.g. `["color-contrast"]` for a contrast sweep). */
  onlyRules?: string[];
}

type AxeViolation = Awaited<
  ReturnType<AxeBuilder["analyze"]>
>["violations"][number];

/** One-line-per-node rendering so CI logs pinpoint the offender. */
export function formatAxeViolations(violations: AxeViolation[]): string {
  return violations
    .map(
      (violation) =>
        `- [${violation.impact ?? "unknown"}] ${violation.id}: ${violation.help} (${violation.nodes.length} node(s))\n` +
        violation.nodes
          .map(
            (node) =>
              `    ${node.target.join(", ")}: ${(node.failureSummary ?? node.html).slice(0, 200)}`,
          )
          .join("\n"),
    )
    .join("\n");
}

/**
 * Full axe scan with the WCAG 2.1 AA tag set. Fails with a readable
 * violation list instead of a JSON blob.
 */
export async function expectNoAxeViolations(
  page: Page,
  options: AxeScanOptions = {},
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
  ]);
  if (options.onlyRules?.length) {
    builder = builder.withRules(options.onlyRules);
  }
  if (options.disableRules?.length) {
    builder = builder.disableRules(options.disableRules);
  }
  if (options.exclude?.length) {
    for (const selector of options.exclude) {
      builder = builder.exclude(selector);
    }
  }
  const results = await builder.analyze();
  expect(
    results.violations,
    `axe violations:\n${formatAxeViolations(results.violations)}`,
  ).toEqual([]);
}

/**
 * Press Tab `tabs` times and assert keyboard focus never leaves
 * `containerSelector` (focus-trap proof for dialogs/drawers).
 */
export async function assertFocusContained(
  page: Page,
  containerSelector: string,
  tabs: number,
): Promise<void> {
  for (let index = 0; index < tabs; index++) {
    await page.keyboard.press("Tab");
    const contained = await page.evaluate((selector) => {
      const container = document.querySelector(selector);
      return (
        container !== null &&
        document.activeElement !== null &&
        container.contains(document.activeElement)
      );
    }, containerSelector);
    expect(
      contained,
      `focus escaped ${containerSelector} after Tab #${index + 1}`,
    ).toBe(true);
  }
}
