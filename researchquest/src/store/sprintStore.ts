import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Item 43 — single streak authority.
 *
 * STREAK AUTHORITY RULE (shared with `dailyMissionsStore`):
 * - Signed in (server reachable, not demo): the server is the single streak
 *   authority (`user_profiles.current_streak`, `daily_logs`, `focus_sessions`,
 *   reconciled into this store via `applyServerSnapshot`). Server values win
 *   for today's minutes/XP counters.
 * - Demo / offline / signed out: there is no server, so this persisted local
 *   store is the authority and `applyServerSnapshot` is never called
 *   (see `useDataSync`: it skips reconciliation in demo mode).
 *
 * Sprint *goals* are local-only by design (no server counterpart) and are
 * never touched by reconciliation — only today's minutes/XP counters are.
 */

export type SprintGoalStatus = "active" | "done";

export interface SprintGoal {
  id: string;
  title: string;
  detail?: string;
  createdAt: string;
  completedAt?: string;
  status: SprintGoalStatus;
}

export interface SprintDay {
  date: string;
  label: string;
  minutes: number;
  xp: number;
  events: string[];
}

export type SprintEventType =
  | "note"
  | "paper"
  | "idea"
  | "task"
  | "focus"
  | "quest";

interface SprintState {
  weekKey: string;
  days: Record<string, SprintDay>;
  goals: SprintGoal[];
  recordEvent: (
    eventType: SprintEventType,
    xp: number,
    minutes?: number,
  ) => void;
  addGoal: (title: string, detail?: string) => void;
  completeGoal: (goalId: string) => void;
  deleteGoal: (goalId: string) => void;
  resetIfNeeded: () => void;
  /**
   * Server-wins reconcile for today's counters (see authority rule above).
   * Overwrites today's minutes/XP with the server-observed values while
   * preserving the day's label and local event trail; goals are untouched.
   */
  applyServerSnapshot: (minutes: number, xp: number) => void;
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekKeyFor(date: Date): string {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy.toISOString().split("T")[0];
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function buildWeek(key: string): Record<string, SprintDay> {
  const start = new Date(`${key}T00:00:00`);
  const days: Record<string, SprintDay> = {};
  for (let index = 0; index < 7; index++) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = date.toISOString().split("T")[0];
    days[dateKey] = {
      date: dateKey,
      label: DAY_LABELS[date.getDay()],
      minutes: 0,
      xp: 0,
      events: [],
    };
  }
  return days;
}

function eventLabel(eventType: SprintEventType): string {
  switch (eventType) {
    case "note":
      return "Note";
    case "paper":
      return "Paper";
    case "idea":
      return "Idea";
    case "task":
      return "Task";
    case "focus":
      return "Focus";
    case "quest":
      return "Quest";
  }
}

export const useSprintStore = create<SprintState>()(
  persist(
    (set, get) => ({
      weekKey: weekKeyFor(new Date()),
      days: {},
      goals: [],
      recordEvent: (eventType, xp, minutes = 0) => {
        get().resetIfNeeded();
        const today = new Date().toISOString().split("T")[0];
        const days = { ...get().days };
        const day = days[today] ?? {
          date: today,
          label: DAY_LABELS[new Date().getDay()],
          minutes: 0,
          xp: 0,
          events: [],
        };
        day.minutes += minutes;
        day.xp += xp;
        day.events = [...day.events, eventLabel(eventType)].slice(-40);
        days[today] = day;
        set({ days });
      },
      addGoal: (title, detail) => {
        get().resetIfNeeded();
        const goal: SprintGoal = {
          id: `goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          title: title.trim(),
          detail: detail?.trim() || undefined,
          createdAt: new Date().toISOString(),
          status: "active",
        };
        set({ goals: [goal, ...get().goals] });
      },
      completeGoal: (goalId) => {
        set({
          goals: get().goals.map((goal) =>
            goal.id === goalId
              ? {
                  ...goal,
                  status: "done",
                  completedAt: new Date().toISOString(),
                }
              : goal,
          ),
        });
      },
      deleteGoal: (goalId) => {
        set({ goals: get().goals.filter((goal) => goal.id !== goalId) });
      },
      resetIfNeeded: () => {
        const key = weekKeyFor(new Date());
        if (get().weekKey !== key) {
          set({ weekKey: key, days: buildWeek(key) });
        }
        if (Object.keys(get().days).length === 0) {
          set({ days: buildWeek(key) });
        }
      },
      applyServerSnapshot: (minutes, xp) => {
        get().resetIfNeeded();
        const today = new Date().toISOString().split("T")[0];
        const days = { ...get().days };
        const day = days[today] ?? {
          date: today,
          label: DAY_LABELS[new Date().getDay()],
          minutes: 0,
          xp: 0,
          events: [],
        };
        days[today] = {
          ...day,
          minutes: Math.max(0, Math.floor(minutes)),
          xp: Math.max(0, xp),
        };
        set({ days });
      },
    }),
    {
      name: "researchquest-sprint",
      // Versioned so legacy unversioned persists migrate safely instead of
      // being dropped or misread when the shape evolves.
      version: 1,
      migrate: (persisted) => {
        const legacy = (persisted ?? {}) as Partial<{
          weekKey: unknown;
          days: unknown;
          goals: unknown;
        }>;
        return {
          weekKey:
            typeof legacy.weekKey === "string"
              ? legacy.weekKey
              : weekKeyFor(new Date()),
          days:
            legacy.days && typeof legacy.days === "object"
              ? (legacy.days as Record<string, SprintDay>)
              : {},
          goals: Array.isArray(legacy.goals)
            ? (legacy.goals as SprintGoal[])
            : [],
        };
      },
    },
  ),
);

export function recordSprintEvent(
  eventType: SprintEventType,
  xp: number,
  minutes = 0,
): void {
  useSprintStore.getState().recordEvent(eventType, xp, minutes);
}

export function sprintGoalsForWeek(goals: SprintGoal[]): SprintGoal[] {
  const start = startOfWeek(new Date());
  return goals.filter((goal) => new Date(goal.createdAt) >= start);
}
