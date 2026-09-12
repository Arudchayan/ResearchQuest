import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Item 43 — single streak authority.
 *
 * STREAK AUTHORITY RULE:
 * - Signed in (server reachable, not demo): the server is the single streak
 *   authority (`user_profiles.current_streak`, `daily_logs`, `focus_sessions`,
 *   reconciled into this store via `applyServerSnapshot`). Server values win
 *   over local counters for the signals the server tracks.
 * - Demo / offline / signed out: there is no server, so this persisted local
 *   store is the authority and `applyServerSnapshot` is never called
 *   (see `useDataSync`: it skips reconciliation in demo mode).
 *
 * Only the focus mission is server-reconcilable (`focus_sessions` carries
 * minutes; `daily_logs` carries XP totals, not per-action event counts), so
 * only `focus_25` is ever overwritten — every other mission stays local-only.
 */

export type MissionEvent =
  | "note"
  | "paper"
  | "idea_advance"
  | "task_complete"
  | "focus_minute"
  | "topic_link";

export interface DailyMission {
  id: string;
  label: string;
  hint: string;
  target: number;
  event: MissionEvent;
  xp: number;
}

export const DAILY_MISSIONS: DailyMission[] = [
  {
    id: "capture_note",
    label: "Capture a note",
    hint: "Write down one idea or finding",
    target: 1,
    event: "note",
    xp: 20,
  },
  {
    id: "add_paper",
    label: "Add a paper",
    hint: "Grow the library by one source",
    target: 1,
    event: "paper",
    xp: 25,
  },
  {
    id: "advance_idea",
    label: "Advance an idea",
    hint: "Move an idea to its next stage",
    target: 1,
    event: "idea_advance",
    xp: 30,
  },
  {
    id: "complete_task",
    label: "Complete a task",
    hint: "Close one reading or research task",
    target: 1,
    event: "task_complete",
    xp: 20,
  },
  {
    id: "focus_25",
    label: "Focus for 25 minutes",
    hint: "Finish one deep work sprint",
    target: 25,
    event: "focus_minute",
    xp: 30,
  },
];

export const DAILY_MISSION_REWARD = 15;

function dateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface DailyMissionsState {
  date: string;
  progress: Record<string, number>;
  recordEvent: (event: MissionEvent, amount?: number) => void;
  getMissionProgress: (missionId: string) => number;
  completedToday: number;
  resetIfNeeded: () => void;
  /**
   * Server-wins reconcile for the focus mission (see authority rule above).
   * Sets `focus_25` progress to the server-observed focus minutes (capped at
   * the mission target) and keeps `completedToday` consistent. No-op when the
   * store already rolled over to a different day — day rollover is owned by
   * `resetIfNeeded`, never by the server snapshot.
   */
  applyServerSnapshot: (focusMinutes: number) => void;
}

function completedCount(progress: Record<string, number>): number {
  return DAILY_MISSIONS.filter((mission) => {
    const current = progress[mission.id] ?? 0;
    return current >= mission.target;
  }).length;
}

export const useDailyMissionsStore = create<DailyMissionsState>()(
  persist(
    (set, get) => ({
      date: dateKey(),
      progress: {},
      completedToday: 0,
      recordEvent: (event, amount = 1) => {
        get().resetIfNeeded();
        const progress = { ...get().progress };
        DAILY_MISSIONS.forEach((mission) => {
          if (mission.event === event) {
            progress[mission.id] = Math.min(
              mission.target,
              (progress[mission.id] ?? 0) + amount,
            );
          }
        });
        set({ progress, completedToday: completedCount(progress) });
      },
      getMissionProgress: (missionId) => {
        get().resetIfNeeded();
        return get().progress[missionId] ?? 0;
      },
      resetIfNeeded: () => {
        const today = dateKey();
        if (get().date !== today) {
          set({ date: today, progress: {}, completedToday: 0 });
        }
      },
      applyServerSnapshot: (focusMinutes) => {
        get().resetIfNeeded();
        const focusMission = DAILY_MISSIONS.find(
          (mission) => mission.id === "focus_25",
        );
        if (!focusMission) return;
        const next = Math.min(
          focusMission.target,
          Math.max(0, Math.floor(focusMinutes)),
        );
        const progress = { ...get().progress };
        if ((progress.focus_25 ?? 0) === next) return;
        progress.focus_25 = next;
        set({ progress, completedToday: completedCount(progress) });
      },
    }),
    {
      name: "researchquest-daily-missions",
      // Versioned so legacy unversioned persists migrate safely instead of
      // being dropped or misread when the shape evolves.
      version: 1,
      migrate: (persisted) => {
        const legacy = (persisted ?? {}) as Partial<{
          date: unknown;
          progress: unknown;
          completedToday: unknown;
        }>;
        const progress =
          legacy.progress && typeof legacy.progress === "object"
            ? (legacy.progress as Record<string, number>)
            : {};
        return {
          date: typeof legacy.date === "string" ? legacy.date : dateKey(),
          progress,
          completedToday:
            typeof legacy.completedToday === "number"
              ? legacy.completedToday
              : completedCount(progress),
        };
      },
    },
  ),
);

export function recordDailyMissionEvent(
  event: MissionEvent,
  amount = 1,
): void {
  useDailyMissionsStore.getState().recordEvent(event, amount);
}
