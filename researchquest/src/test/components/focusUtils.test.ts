import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FOCUS_SESSION_STORAGE_KEY,
  persistPausedFocusSession,
  remainingSecondsOnRestore,
  restoredSessionNeedsContinue,
  saveFocusSession,
  type FocusSessionSnapshot,
} from "../../components/focus/focusUtils";

const runningSnapshot = (
  overrides: Partial<FocusSessionSnapshot> = {},
): FocusSessionSnapshot => ({
  version: 1,
  selectedTarget: { type: "note", id: "note-1" },
  sessionLength: 25 * 60,
  isRunning: true,
  startedAt: Date.now() - 2 * 60 * 1000,
  timeLeft: 24 * 60 + 4,
  hasCompletedSession: false,
  sessionCount: 1,
  ...overrides,
});

describe("focus session hydrate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not keep ticking from startedAt on remount; uses last painted timeLeft", () => {
    const snapshot = runningSnapshot();
    expect(remainingSecondsOnRestore(snapshot)).toBe(24 * 60 + 4);
    expect(restoredSessionNeedsContinue(snapshot)).toBe(true);
  });

  it("still completes a session whose wall-clock remaining is already 0", () => {
    const snapshot = runningSnapshot({
      startedAt: Date.now() - 30 * 60 * 1000,
      timeLeft: 20 * 60,
    });
    expect(remainingSecondsOnRestore(snapshot)).toBe(0);
  });

  it("persist never writes isRunning true, even while live running", () => {
    persistPausedFocusSession({
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      liveIsRunning: true,
      liveStartedAt: Date.now() - 56 * 1000,
      timeLeft: 24 * 60 + 4,
      hasCompletedSession: false,
      sessionCount: 1,
      keepAlive: false,
    });
    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    ) as FocusSessionSnapshot;
    expect(stored.isRunning).toBe(false);
    expect(stored.timeLeft).toBe(24 * 60 + 4);
  });

  it("persist writes last painted timeLeft, not wall-clock since a Continue startedAt", () => {
    persistPausedFocusSession({
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      liveIsRunning: true,
      liveStartedAt: Date.now() - 2 * 1000,
      timeLeft: 24 * 60 + 41,
      hasCompletedSession: false,
      sessionCount: 1,
      keepAlive: true,
    });
    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    ) as FocusSessionSnapshot;
    expect(stored.isRunning).toBe(false);
    expect(stored.timeLeft).toBe(24 * 60 + 41);
  });

  it("saveFocusSession running crash snapshot still hydrates as Continue-hold", () => {
    const snapshot = runningSnapshot();
    saveFocusSession(snapshot);
    expect(restoredSessionNeedsContinue(snapshot)).toBe(true);
    expect(remainingSecondsOnRestore(snapshot)).toBe(snapshot.timeLeft);
  });
});
