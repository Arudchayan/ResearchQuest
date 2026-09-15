/**
 * Parity lock for plan item 41: `getDashboardSections` (one loop per
 * collection) must return exactly what the former per-section `getTopN`
 * passes computed. The "old pipeline" below mirrors the pre-change Dashboard
 * code (same filters, limits, sort directions) using `getTopN` directly.
 */
import { describe, it, expect } from "vitest";
import { getDashboardSections, getTopN } from "../../utils/collections";
import { parseDateInput } from "../../utils/time";
import type {
  Idea,
  Note,
  Paper,
  Task,
  TopicWithCounts,
} from "../../types/database";

const NOW = new Date(2026, 8, 11, 12, 0, 0); // local 2026-09-11 noon

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
const dayOffset = (n: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};

const byUpdatedDesc = (a: { updated_at: string }, b: { updated_at: string }) =>
  a.updated_at > b.updated_at ? -1 : a.updated_at < b.updated_at ? 1 : 0;
const byCreatedDesc = (a: { created_at: string }, b: { created_at: string }) =>
  a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0;
const byCreatedAsc = (a: { created_at: string }, b: { created_at: string }) =>
  a.created_at > b.created_at ? 1 : a.created_at < b.created_at ? -1 : 0;
const byDueDateAsc = (a: Task, b: Task) =>
  !a.due_date ? 1 : !b.due_date ? -1 : a.due_date > b.due_date ? 1 : a.due_date < b.due_date ? -1 : 0;

// Old TaskCard.isOverdue rule + old Dashboard isDueToday, replicated here.
const oldIsOverdue = (t: Task): boolean => {
  if (!t.due_date || t.completed) return false;
  const parsed = parseDateInput(t.due_date);
  if (!parsed) return false;
  parsed.setHours(23, 59, 59, 999);
  return parsed.getTime() < NOW.getTime();
};
const oldIsDueToday = (t: Task): boolean => {
  if (!t.due_date || t.completed) return false;
  const parsed = parseDateInput(t.due_date);
  if (!parsed) return false;
  return (
    parsed.getFullYear() === NOW.getFullYear() &&
    parsed.getMonth() === NOW.getMonth() &&
    parsed.getDate() === NOW.getDate()
  );
};
const daysBetween = (from: string) => {
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(
    (sod(NOW).getTime() - sod(parseDateInput(from) ?? NOW).getTime()) /
      (24 * 60 * 60 * 1000),
  );
};

const note = (id: string, updated: string, tags: string[] = ["t"]): Note =>
  ({
    id,
    user_id: "u",
    title: id,
    markdown_body: "",
    tags,
    updated_at: updated,
    created_at: updated,
  }) as Note;

const paper = (id: string, created: string, status: string): Paper =>
  ({
    id,
    user_id: "u",
    title: id,
    status,
    updated_at: created,
    created_at: created,
  }) as unknown as Paper;

const idea = (id: string, stage: string, created: string, updated: string): Idea =>
  ({
    id,
    user_id: "u",
    title: id,
    stage,
    updated_at: updated,
    created_at: created,
  }) as unknown as Idea;

const task = (id: string, opts: Partial<Task> = {}): Task =>
  ({
    id,
    user_id: "u",
    title: id,
    completed: false,
    priority: "medium",
    ...opts,
  }) as Task;

const topic = (id: string, updated: string): TopicWithCounts =>
  ({ id, user_id: "u", name: id, updated_at: updated }) as TopicWithCounts;

const notes = [
  note("n1", "2026-09-11T10:00:00"),
  note("n2", "2026-09-10T10:00:00", []),
  note("n3", "2026-09-09T10:00:00"),
  note("n4", "2026-09-08T10:00:00", []),
  note("n5", "2026-09-07T10:00:00", []),
];
const papers = [
  paper("p1", "2026-09-11T10:00:00", "To Read"),
  paper("p2", "2026-09-10T10:00:00", "To Read"),
  paper("p3", "2026-09-09T10:00:00", "Reading"),
  paper("p4", "2026-09-08T10:00:00", "To Read"),
  paper("p5", "2026-09-07T10:00:00", "To Read"),
  paper("p6", "2026-09-06T10:00:00", "Finished"),
];
const ideas = [
  idea("i1", "Developing", "2026-09-01", "2026-09-11T09:00:00"),
  idea("i2", "Seed", "2026-08-01", "2026-09-10T09:00:00"), // stuck (41d)
  idea("i3", "Seed", "2026-09-06", "2026-09-09T09:00:00"), // young seed
  idea("i4", "Mature", "2026-08-15", "2026-09-08T09:00:00"),
  idea("i5", "Seed", dayOffset(-14), "2026-09-07T09:00:00"), // boundary: stuck
];
const tasks = [
  task("t-overdue", { due_date: dayOffset(-1) }),
  task("t-today", { due_date: dayOffset(0) }),
  task("t-future", { due_date: dayOffset(9) }),
  task("t-future2", { due_date: dayOffset(10) }),
  task("t-dateless"),
  task("t-done-overdue", { due_date: dayOffset(-1), completed: true }),
  task("t-done", { completed: true }),
];
const topics: Record<string, TopicWithCounts> = {
  k1: topic("k1", "2026-09-11T10:00:00"),
  k2: topic("k2", "2026-09-10T10:00:00"),
  k3: topic("k3", "2026-09-09T10:00:00"),
  k4: topic("k4", "2026-09-08T10:00:00"),
};

function oldPipeline() {
  return {
    recentNotes: getTopN(notes, 3, byUpdatedDesc),
    readingList: getTopN(papers, 3, byCreatedDesc, (p) => p.status === "To Read"),
    activeIdeas: getTopN(ideas, 3, byUpdatedDesc),
    activeTopics: getTopN(Object.values(topics), 3, byUpdatedDesc),
    upcomingTasks: getTopN(tasks, 3, byDueDateAsc, (t) => !t.completed),
    overdueTasks: getTopN(tasks, 3, byDueDateAsc, oldIsOverdue),
    dueTodayTasks: getTopN(tasks, 3, byDueDateAsc, oldIsDueToday),
    stuckIdeas: getTopN(
      ideas,
      2,
      byCreatedAsc,
      (i) => i.stage === "Seed" && daysBetween(i.created_at) >= 14,
    ),
    untaggedNotes: getTopN(notes, 2, byUpdatedDesc, (n) => n.tags.length === 0),
    pendingTaskCount: tasks.filter((t) => !t.completed).length,
    completedTaskCount: tasks.filter((t) => t.completed).length,
  };
}

describe("getDashboardSections parity", () => {
  it("matches the former per-section getTopN pipeline exactly", () => {
    const actual = getDashboardSections({ notes, papers, ideas, tasks, topics, now: NOW });
    const expected = oldPipeline();
    expect(actual).toEqual(expected);
  });

  it("locks boundary semantics (overdue/today/dateless/done/stuck)", () => {
    const s = getDashboardSections({ notes, papers, ideas, tasks, topics, now: NOW });
    expect(s.overdueTasks.map((t) => t.id)).toEqual(["t-overdue"]);
    expect(s.dueTodayTasks.map((t) => t.id)).toEqual(["t-today"]);
    // Upcoming keeps dateless tasks (nulls last) and truncates to 3.
    expect(s.upcomingTasks.map((t) => t.id)).toEqual([
      "t-overdue",
      "t-today",
      "t-future",
    ]);
    expect(s.stuckIdeas.map((i) => i.id)).toEqual(["i2", "i5"]);
    expect(s.pendingTaskCount).toBe(5);
    expect(s.completedTaskCount).toBe(2);
    expect(s.readingList.map((p) => p.id)).toEqual(["p1", "p2", "p4"]);
    expect(s.untaggedNotes.map((n) => n.id)).toEqual(["n2", "n4"]);
  });

  it("handles 5k rows per collection within budget (perf)", () => {
    const big = <T,>(make: (i: number) => T) =>
      Array.from({ length: 5000 }, (_, i) => make(i));
    const t0 = performance.now();
    getDashboardSections({
      notes: big((i) => note(`n${i}`, `2026-09-${`${(i % 28) + 1}`.padStart(2, "0")}T10:00:00`, i % 2 ? [] : ["t"])),
      papers: big((i) => paper(`p${i}`, `2026-09-${`${(i % 28) + 1}`.padStart(2, "0")}T10:00:00`, i % 3 ? "Reading" : "To Read")),
      ideas: big((i) => idea(`i${i}`, i % 5 ? "Developing" : "Seed", "2026-08-01", `2026-09-${`${(i % 28) + 1}`.padStart(2, "0")}T10:00:00`)),
      tasks: big((i) => task(`t${i}`, { due_date: dayOffset(i % 30), completed: i % 7 === 0 })),
      topics: Object.fromEntries(big((i) => [`k${i}`, topic(`k${i}`, "2026-09-10T10:00:00")])),
      now: NOW,
    });
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
