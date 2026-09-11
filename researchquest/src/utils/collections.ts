import type {
  Idea,
  Note,
  Paper,
  Task,
  TopicWithCounts,
} from "../types/database";
import { parseDateInput } from "./time";

export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }

  return deduped.reverse();
}

/**
 * PERFORMANCE OPTIMIZATION:
 * Gets the top N items from an array in a single O(N) pass without sorting the entire array.
 * Useful for widgets that only need to display a small slice of a large collection.
 */
export function getTopN<T>(
  items: T[],
  limit: number,
  compareFn: (a: T, b: T) => number,
  filterFn?: (item: T) => boolean,
): T[] {
  const top: T[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (filterFn && !filterFn(item)) continue;

    if (top.length < limit) {
      top.push(item);
      top.sort(compareFn);
    } else if (compareFn(item, top[limit - 1]) < 0) {
      let pos = limit - 2;
      while (pos >= 0 && compareFn(item, top[pos]) < 0) {
        top[pos + 1] = top[pos];
        pos--;
      }
      top[pos + 1] = item;
    }
  }
  return top;
}

/**
 * Bounded sorted-insert collector: keeps the best `limit` items seen so far
 * per `compare` (same ordering contract as `getTopN`). Lets a single loop
 * maintain several top-N groups at once.
 */
function topCollector<T>(limit: number, compare: (a: T, b: T) => number) {
  const top: T[] = [];
  return {
    push(item: T) {
      if (top.length < limit) {
        top.push(item);
        top.sort(compare);
      } else if (compare(item, top[top.length - 1]) < 0) {
        top[top.length - 1] = item;
        top.sort(compare);
      }
    },
    result(): T[] {
      return top;
    },
  };
}

const byUpdatedDesc = (a: { updated_at: string }, b: { updated_at: string }) =>
  a.updated_at > b.updated_at ? -1 : a.updated_at < b.updated_at ? 1 : 0;

const byCreatedDesc = (a: { created_at: string }, b: { created_at: string }) =>
  a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0;

const byCreatedAsc = (a: { created_at: string }, b: { created_at: string }) =>
  a.created_at > b.created_at ? 1 : a.created_at < b.created_at ? -1 : 0;

const byDueDateAsc = (a: { due_date?: string }, b: { due_date?: string }) =>
  !a.due_date
    ? 1
    : !b.due_date
      ? -1
      : a.due_date > b.due_date
        ? 1
        : a.due_date < b.due_date
          ? -1
          : 0;

function taskIsOverdue(t: Task, now: Date): boolean {
  if (!t.due_date || t.completed) return false;
  const parsed = parseDateInput(t.due_date);
  if (!parsed) return false;
  // Same "day has passed" rule as TaskCard.isOverdue.
  parsed.setHours(23, 59, 59, 999);
  return parsed.getTime() < now.getTime();
}

function taskIsDueToday(t: Task, now: Date): boolean {
  if (!t.due_date || t.completed) return false;
  const parsed = parseDateInput(t.due_date);
  if (!parsed) return false;
  return (
    parsed.getFullYear() === now.getFullYear() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getDate() === now.getDate()
  );
}

export interface DashboardSections {
  recentNotes: Note[];
  readingList: Paper[];
  activeIdeas: Idea[];
  activeTopics: TopicWithCounts[];
  upcomingTasks: Task[];
  overdueTasks: Task[];
  dueTodayTasks: Task[];
  stuckIdeas: Idea[];
  untaggedNotes: Note[];
  pendingTaskCount: number;
  completedTaskCount: number;
}

export interface DashboardSectionInput {
  notes: readonly Note[];
  papers: readonly Paper[];
  ideas: readonly Idea[];
  tasks: readonly Task[];
  topics: Readonly<Record<string, TopicWithCounts>>;
  now?: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole calendar days between an ISO/date-only string and now (local). */
function daysBetweenLocal(from: string, to: Date): number {
  const startOfLocalDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(
    (startOfLocalDay(to).getTime() -
      startOfLocalDay(parseDateInput(from) ?? to).getTime()) /
      MS_PER_DAY,
  );
}

/**
 * Single-pass dashboard selector (plan item 41). Computes every dashboard
 * section with one loop per collection (5 passes total) instead of the
 * previous 7+ `getTopN` full-array passes plus separate count/filter loops.
 * Group ordering matches the former per-group `getTopN` calls exactly.
 */
export function getDashboardSections({
  notes,
  papers,
  ideas,
  tasks,
  topics,
  now = new Date(),
}: DashboardSectionInput): DashboardSections {
  const recentNotes = topCollector<Note>(3, byUpdatedDesc);
  const untaggedNotes = topCollector<Note>(2, byUpdatedDesc);
  for (const note of notes) {
    recentNotes.push(note);
    if (note.tags.length === 0) untaggedNotes.push(note);
  }

  const readingList = topCollector<Paper>(3, byCreatedDesc);
  for (const paper of papers) {
    if (paper.status === "To Read") readingList.push(paper);
  }

  const activeIdeas = topCollector<Idea>(3, byUpdatedDesc);
  const stuckIdeas = topCollector<Idea>(2, byCreatedAsc);
  for (const idea of ideas) {
    // NB: the dashboard "active ideas" rail is the 3 most recently updated
    // ideas (no stage filter), matching the previous getTopN call.
    activeIdeas.push(idea);
    if (
      idea.stage === "Seed" &&
      daysBetweenLocal(idea.created_at, now) >= 14
    ) {
      stuckIdeas.push(idea);
    }
  }

  const activeTopics = topCollector<TopicWithCounts>(3, byUpdatedDesc);
  for (const topic of Object.values(topics)) activeTopics.push(topic);

  const upcomingTasks = topCollector<Task>(3, byDueDateAsc);
  const overdueTasks = topCollector<Task>(3, byDueDateAsc);
  const dueTodayTasks = topCollector<Task>(3, byDueDateAsc);
  let pendingTaskCount = 0;
  let completedTaskCount = 0;
  for (const task of tasks) {
    if (task.completed) {
      completedTaskCount += 1;
      continue;
    }
    pendingTaskCount += 1;
    // NB: upcoming keeps dateless tasks (nulls sort last), matching the
    // previous getTopN filter of `!t.completed` with no due-date filter.
    upcomingTasks.push(task);
    if (taskIsOverdue(task, now)) overdueTasks.push(task);
    else if (taskIsDueToday(task, now)) dueTodayTasks.push(task);
  }

  return {
    recentNotes: recentNotes.result(),
    readingList: readingList.result(),
    activeIdeas: activeIdeas.result(),
    activeTopics: activeTopics.result(),
    upcomingTasks: upcomingTasks.result(),
    overdueTasks: overdueTasks.result(),
    dueTodayTasks: dueTodayTasks.result(),
    stuckIdeas: stuckIdeas.result(),
    untaggedNotes: untaggedNotes.result(),
    pendingTaskCount,
    completedTaskCount,
  };
}
