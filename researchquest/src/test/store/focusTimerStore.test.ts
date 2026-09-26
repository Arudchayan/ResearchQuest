import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  FOCUS_SESSION_STORAGE_KEY,
  loadStoredFocusSession,
  persistPausedFocusSession,
  remainingSecondsOnRestore,
  restoredSessionNeedsContinue,
  saveFocusSession,
  type FocusSessionSnapshot,
} from "../../components/focus/focusUtils";

const SESSION_LENGTH = 25 * 60; // 1500s
const T0 = 1_700_000_000_000;

const liveSnapshot = (
  overrides: Partial<FocusSessionSnapshot> = {},
): FocusSessionSnapshot => ({
  version: 1,
  selectedTarget: { type: "note", id: "note-1" },
  sessionLength: SESSION_LENGTH,
  isRunning: false,
  startedAt: T0,
  timeLeft: SESSION_LENGTH,
  hasCompletedSession: false,
  sessionCount: 1,
  ...overrides,
});

describe("focus timer persisted store shape", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists an active session that survives rehydration with its deadline material", () => {
    persistPausedFocusSession({
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: SESSION_LENGTH,
      liveIsRunning: true,
      liveStartedAt: T0,
      timeLeft: 24 * 60,
      hasCompletedSession: false,
      sessionCount: 1,
      keepAlive: true,
    });

    const raw = window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const rehydrated = loadStoredFocusSession();
    expect(rehydrated).not.toBeNull();
    expect(rehydrated?.selectedTarget).toEqual({
      type: "note",
      id: "note-1",
    });
    expect(rehydrated?.sessionLength).toBe(SESSION_LENGTH);
    expect(rehydrated?.timeLeft).toBe(24 * 60);
    expect(rehydrated?.sessionCount).toBe(1);
    // Deadline material must survive: a correct fix reconstructs the deadline
    // from storage, so startedAt must never be dropped for a live session.
    expect(rehydrated?.startedAt).toBe(T0);
  });

  it("restore is deadline-based: remaining reflects wall-clock elapsed since start", () => {
    // Started at T0 with a full 25:00 session; 3 minutes of wall-clock pass
    // while unmounted/hidden. Deadline-based remaining is 22:00, NOT the
    // last-painted 25:00 and NOT a reset to the full session length.
    const snapshot = liveSnapshot({ timeLeft: SESSION_LENGTH });
    const remaining = remainingSecondsOnRestore(snapshot, T0 + 3 * 60 * 1000);
    expect(remaining).toBe(22 * 60);
  });

  it("restore counts down partial progress against the deadline, not the frozen paint", () => {
    // 1 minute ticked live (last paint 24:00), then 2 minutes away.
    // Deadline-based: 25:00 - 3:00 = 22:00.
    const snapshot = liveSnapshot({ timeLeft: 24 * 60 });
    const remaining = remainingSecondsOnRestore(snapshot, T0 + 3 * 60 * 1000);
    expect(remaining).toBe(22 * 60);
  });

  it("a session whose deadline passed while away restores as expired (remaining 0)", () => {
    const snapshot = liveSnapshot({ timeLeft: 20 * 60 });
    expect(
      remainingSecondsOnRestore(snapshot, T0 + 30 * 60 * 1000),
    ).toBe(0);
  });

  it("a completed session never needs continue and never re-completes on rehydrate", () => {
    saveFocusSession(
      liveSnapshot({
        timeLeft: 0,
        startedAt: null,
        hasCompletedSession: true,
      }),
    );
    const rehydrated = loadStoredFocusSession();
    expect(rehydrated?.hasCompletedSession).toBe(true);
    expect(restoredSessionNeedsContinue(rehydrated)).toBe(false);
    expect(remainingSecondsOnRestore(rehydrated!, T0 + 60 * 60 * 1000)).toBe(0);

    // Re-saving the completed state (what a remount does) must be idempotent:
    // no new session material, no revived deadline.
    persistPausedFocusSession({
      selectedTarget: rehydrated!.selectedTarget,
      sessionLength: rehydrated!.sessionLength,
      liveIsRunning: false,
      liveStartedAt: null,
      timeLeft: 0,
      hasCompletedSession: true,
      sessionCount: rehydrated!.sessionCount ?? 0,
      keepAlive: false,
    });
    const again = loadStoredFocusSession();
    expect(again?.hasCompletedSession).toBe(true);
    expect(restoredSessionNeedsContinue(again)).toBe(false);
  });

  it("uses a dedicated persisted timer store when the fix introduces one", async () => {
    // The fix may introduce src/store/focusTimerStore.ts (a zustand persisted
    // store holding endsAt/remaining + a complete-once guard). import.meta.glob
    // is build-safe when the file does not exist yet (a bare dynamic import
    // would fail at transform time). If the store is absent, the localStorage
    // snapshot contract above IS the store shape under test, so this passes
    // vacuously.
    const candidates = import.meta.glob("../../store/focusTimerStore.*");
    const keys = Object.keys(candidates);
    if (keys.length === 0) {
      expect(loadStoredFocusSession()).toBeNull();
      return;
    }

    const mod = (await (
      candidates[keys[0]] as () => Promise<Record<string, unknown>>
    )()) as Record<string, unknown>;
    const storeApi = mod.useFocusTimerStore as
      | { getState: () => Record<string, unknown> }
      | undefined;
    expect(storeApi, "useFocusTimerStore must be exported").toBeDefined();
    const state = storeApi!.getState();
    // Minimal contract: remaining-time readout + completion guard exist.
    expect(
      "remainingSeconds" in state ||
        "timeLeft" in state ||
        "endsAt" in state,
      "timer store must expose remaining-time state",
    ).toBe(true);
    expect(
      "hasCompleted" in state ||
        "completed" in state ||
        "status" in state,
      "timer store must expose completion state",
    ).toBe(true);
  });
});
