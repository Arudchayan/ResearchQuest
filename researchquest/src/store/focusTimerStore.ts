// Live Pomodoro/Focus countdown authority.
//
// The countdown is deadline-derived: `remaining = deadline - Date.now()`.
// The tick interval only re-renders; wall-clock time always counts, so the
// timer survives in-app navigation, unmount/remount, hidden tabs, and full
// document reloads. Pause/resume shifts the deadline; completion fires when
// the deadline passes. Persisted to localStorage (same zustand/persist
// pattern as todayPlanStore/topicKindStore) so a remount restores the live
// run instead of a frozen snapshot.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SelectedTarget } from "../components/focus/focusUtils";

export type FocusTimerStatus = "idle" | "running" | "paused" | "complete";

export const FOCUS_TIMER_STORAGE_KEY = "researchquest-focus-timer";

export const DEFAULT_FOCUS_SESSION_SECONDS = 25 * 60;

export interface FocusTimerData {
  /** Target + length frozen at start for the live run. */
  selectedTarget: SelectedTarget | null;
  sessionLength: number;
  status: FocusTimerStatus;
  /** Wall-clock epoch ms the live run ends. Set while running. */
  deadlineMs: number | null;
  /**
   * Alias of `deadlineMs` kept for the persisted-store contract (remaining-time
   * readout): while running it is the epoch ms the run ends, else null.
   */
  endsAt: number | null;
  /** Display value while idle/paused/complete. */
  remainingSec: number;
  startedAtMs: number | null;
  /** Stable id for the live run; completion XP is awarded once per run. */
  runId: string | null;
  sessionCount: number;
  /** Run already completed + awarded (exactly-once across restores). */
  awardedRunId: string | null;
}

export const initialFocusTimerData: FocusTimerData = {
  selectedTarget: null,
  sessionLength: DEFAULT_FOCUS_SESSION_SECONDS,
  status: "idle",
  deadlineMs: null,
  endsAt: null,
  remainingSec: DEFAULT_FOCUS_SESSION_SECONDS,
  startedAtMs: null,
  runId: null,
  sessionCount: 0,
  awardedRunId: null,
};

/** Deadline-derived remaining. Pure + unit-testable. */
export function remainingSecondsForRun(
  snapshot: Pick<FocusTimerData, "status" | "deadlineMs" | "remainingSec">,
  nowMs = Date.now(),
): number {
  if (
    snapshot.status === "running" &&
    typeof snapshot.deadlineMs === "number"
  ) {
    return Math.max(0, Math.ceil((snapshot.deadlineMs - nowMs) / 1000));
  }
  return Math.max(0, Math.floor(snapshot.remainingSec));
}

export function makeFocusRunId(nowMs = Date.now()): string {
  return `${nowMs.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface FocusTimerSessionImport {
  selectedTarget: SelectedTarget | null;
  sessionLength: number;
  status: FocusTimerStatus;
  deadlineMs: number | null;
  endsAt?: number | null;
  remainingSec: number;
  startedAtMs: number | null;
  runId?: string | null;
  sessionCount: number;
  awardedRunId: string | null;
}

interface FocusTimerActions {
  /** Fresh start: new run id, new deadline, session count + 1. */
  start: (input: {
    selectedTarget: SelectedTarget;
    sessionLength: number;
    nowMs?: number;
  }) => void;
  /** Freeze the countdown: capture deadline-derived remaining, drop deadline. */
  pause: (nowMs?: number) => void;
  /** Shift the deadline forward by the paused remaining. */
  resume: (nowMs?: number) => void;
  /** Back to idle (keeps target/length for the next start). */
  resetRun: () => void;
  /** Pick (or re-pick) a target: stops any live run, arms an idle session. */
  selectTarget: (target: SelectedTarget | null) => void;
  /** Set the idle session length (live runs keep their frozen length). */
  setSessionLength: (sessionLength: number) => void;
  markComplete: () => void;
  markAwarded: (runId: string) => void;
  /** One-way restore of a legacy rq_focus_session snapshot. */
  importSession: (snapshot: FocusTimerSessionImport) => void;
}

export const useFocusTimerStore = create<FocusTimerData & FocusTimerActions>()(
  persist(
    (set, get) => ({
      ...initialFocusTimerData,
      start: ({ selectedTarget, sessionLength, nowMs = Date.now() }) => {
        const runId = makeFocusRunId(nowMs);
        const deadlineMs = nowMs + sessionLength * 1000;
        set({
          selectedTarget,
          sessionLength,
          status: "running",
          startedAtMs: nowMs,
          deadlineMs,
          endsAt: deadlineMs,
          remainingSec: sessionLength,
          runId,
          sessionCount: get().sessionCount + 1,
        });
      },
      pause: (nowMs = Date.now()) => {
        const snapshot = get();
        if (snapshot.status !== "running") return;
        set({
          status: "paused",
          remainingSec: remainingSecondsForRun(snapshot, nowMs),
          deadlineMs: null,
          endsAt: null,
        });
      },
      resume: (nowMs = Date.now()) => {
        const snapshot = get();
        if (snapshot.status !== "paused") return;
        if (snapshot.remainingSec <= 0) {
          // Nothing left to run: go live with an already-passed deadline so
          // the next tick reconcile completes through the award path
          // (completeSession keys on runId) instead of silently dropping XP.
          set({
            status: "running",
            deadlineMs: nowMs,
            endsAt: nowMs,
            remainingSec: 0,
            runId: snapshot.runId ?? makeFocusRunId(nowMs),
          });
          return;
        }
        const deadlineMs = nowMs + snapshot.remainingSec * 1000;
        set({
          status: "running",
          deadlineMs,
          endsAt: deadlineMs,
          // Imported pauses predate run ids; mint one so completion awards
          // exactly once per run.
          runId: snapshot.runId ?? makeFocusRunId(nowMs),
        });
      },
      resetRun: () =>
        set((snapshot) => ({
          status: "idle",
          deadlineMs: null,
          endsAt: null,
          runId: null,
          startedAtMs: null,
          remainingSec: snapshot.sessionLength,
        })),
      selectTarget: (target) =>
        set((snapshot) => ({
          selectedTarget: target,
          status: "idle",
          deadlineMs: null,
          endsAt: null,
          runId: null,
          startedAtMs: null,
          remainingSec: snapshot.sessionLength,
        })),
      setSessionLength: (sessionLength) => {
        const snapshot = get();
        if (
          snapshot.status === "running" ||
          snapshot.status === "paused"
        ) {
          return;
        }
        // After completion the display stays at 00:00; the length applies to
        // the next start.
        if (snapshot.status === "complete") {
          set({ sessionLength });
          return;
        }
        set({ sessionLength, remainingSec: sessionLength });
      },
      markComplete: () =>
        set({
          status: "complete",
          deadlineMs: null,
          endsAt: null,
          remainingSec: 0,
        }),
      markAwarded: (runId) => set({ awardedRunId: runId }),
      importSession: (snapshot) =>
        set({
          ...snapshot,
          endsAt: snapshot.endsAt ?? snapshot.deadlineMs,
          runId: snapshot.runId ?? null,
        }),
    }),
    {
      name: FOCUS_TIMER_STORAGE_KEY,
      partialize: (snapshot) => ({
        selectedTarget: snapshot.selectedTarget,
        sessionLength: snapshot.sessionLength,
        status: snapshot.status,
        deadlineMs: snapshot.deadlineMs,
        endsAt: snapshot.endsAt,
        remainingSec: snapshot.remainingSec,
        startedAtMs: snapshot.startedAtMs,
        runId: snapshot.runId,
        sessionCount: snapshot.sessionCount,
        awardedRunId: snapshot.awardedRunId,
      }),
    },
  ),
);
