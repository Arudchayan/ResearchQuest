import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = (rel: string) =>
  readFileSync(resolve(__dirname, "../../..", rel), "utf8");

const css = () => src("src/index.css");

// Parses `--token: #hex` declarations out of the `:root { ... }` and
// `.dark { ... }` blocks of index.css.
function parseThemeVars(blockSelector: ":root" | ".dark") {
  const text = css();
  const start = text.indexOf(blockSelector);
  if (start === -1) throw new Error(`missing ${blockSelector} block`);
  const open = text.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = text.slice(open, end);
  const vars = new Map<string, string>();
  for (const match of block.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) {
    vars.set(match[1], match[2]);
  }
  return vars;
}

function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
    );
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrastRatio(a: string, b: string) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("PR12 layout wrappers + containment (static guards)", () => {
  it("App.tsx renders route views bare (no double padding / nested scrollers)", () => {
    const app = src("src/App.tsx");
    expect(app).not.toContain("p-6 h-full overflow-auto");
    expect(app).not.toContain("h-full overflow-auto");
    expect(app).not.toContain("h-full overflow-hidden");
    // Guides are owned by the views now, above each scroll container.
    expect(app).not.toContain("OnboardingGuide");
  });

  it("page-scroll views normalize to p-4 sm:p-6 lg:p-8 with a per-view max-w", () => {
    // Dashboard carries extra rhythm/animation classes on the same node, so
    // its padding tokens are asserted individually; Focus/Feeds are canonical.
    const dashboard = src("src/components/dashboard/Dashboard.tsx");
    for (const token of ["p-4", "sm:p-6", "lg:p-8", "max-w-7xl"]) {
      expect(dashboard).toContain(token);
    }
    for (const [file, maxw] of [
      ["src/components/focus/FocusWorkspace.tsx", "max-w-6xl"],
      ["src/components/feeds/FeedsView.tsx", "max-w-5xl"],
    ] as const) {
      const text = src(file);
      expect(text).toContain("p-4 sm:p-6 lg:p-8");
      expect(text).toContain(maxw);
    }
  });

  it("split-pane views keep h-full with internal scroll (no App-level wrapper)", () => {
    for (const file of [
      "src/components/notes/NotesView.tsx",
      "src/components/papers/PapersView.tsx",
      "src/components/ideas/IdeasBoard.tsx",
      "src/components/topics/TopicsView.tsx",
      "src/components/tasks/TaskManager.tsx",
    ]) {
      expect(src(file)).toContain("h-full");
    }
  });

  it("all views use PageHeader (Notes keeps an sr-only h1 instead of chrome)", () => {
    for (const file of [
      "src/components/dashboard/Dashboard.tsx",
      "src/components/papers/PapersView.tsx",
      "src/components/ideas/IdeasBoard.tsx",
      "src/components/topics/TopicsView.tsx",
      "src/components/tasks/TaskManager.tsx",
      "src/components/focus/FocusWorkspace.tsx",
      "src/components/feeds/FeedsView.tsx",
    ]) {
      expect(src(file)).toMatch(/PageHeader/);
    }
    expect(src("src/components/notes/NotesView.tsx")).toContain(
      '<h1 className="sr-only">Notes</h1>',
    );
  });

  it("OnboardingGuide renders exactly once per owning view, above the scroll region", () => {
    for (const file of [
      "src/components/tasks/TaskManager.tsx",
      "src/components/papers/PapersView.tsx",
      "src/components/ideas/IdeasBoard.tsx",
    ]) {
      const text = src(file);
      const guideCount = text.match(/<OnboardingGuide/g)?.length ?? 0;
      expect(guideCount).toBe(1);
    }
    expect(src("src/components/focus/FocusWorkspace.tsx")).not.toContain(
      "<OnboardingGuide",
    );
    // Guide precedes each view's scroll container in source order.
    const papers = src("src/components/papers/PapersView.tsx");
    expect(papers.indexOf("<OnboardingGuide")).toBeLessThan(
      papers.indexOf("ref={parentRef}"),
    );
    const tasks = src("src/components/tasks/TaskManager.tsx");
    expect(tasks.indexOf("<OnboardingGuide")).toBeLessThan(
      tasks.indexOf("overflow-y-auto p-4"),
    );
    const ideas = src("src/components/ideas/IdeasBoard.tsx");
    expect(ideas.indexOf("<OnboardingGuide")).toBeLessThan(
      ideas.indexOf("overflow-x-auto"),
    );
  });

  it("dashboard counts grid steps through an intermediate breakpoint (no orphan)", () => {
    expect(src("src/components/dashboard/Dashboard.tsx")).toContain(
      "sm:grid-cols-3 lg:grid-cols-5",
    );
  });

  it("containment is scoped to .sidebar-scroll, not the aside element", () => {
    const text = css();
    expect(text).toContain(".sidebar-scroll");
    expect(text).toMatch(
      /\.sidebar-scroll\s*\{\s*contain:\s*layout style paint;/,
    );
    expect(text).not.toMatch(/^\s*aside\s*\{/m);
  });

  it("reduced-motion opts out of smooth scrolling", () => {
    const text = css();
    expect(text).toContain("@media (prefers-reduced-motion: reduce)");
    const reduceIdx = text.indexOf("prefers-reduced-motion");
    const tail = text.slice(reduceIdx, reduceIdx + 800);
    expect(tail).toContain(".smooth-scroll");
    expect(tail).toContain("scroll-behavior: auto");
  });

  it("key text/background pairs meet WCAG AA contrast (spot-check)", () => {
    const light = parseThemeVars(":root");
    const dark = parseThemeVars(".dark");
    const pairs: Array<[Map<string, string>, string, string]> = [
      [light, "text-primary", "bg-base"],
      [light, "text-secondary", "bg-base"],
      [light, "text-tertiary", "bg-base"],
      [light, "text-tertiary", "bg-elevated"],
      [dark, "text-primary", "bg-base"],
      [dark, "text-secondary", "bg-base"],
      [dark, "text-tertiary", "bg-base"],
      [dark, "text-tertiary", "bg-elevated"],
    ];
    for (const [vars, fg, bg] of pairs) {
      const ratio = contrastRatio(vars.get(fg)!, vars.get(bg)!);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
