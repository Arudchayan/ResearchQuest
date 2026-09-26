import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FOCUS_SESSION_STORAGE_KEY,
  legacyImportForStore,
  persistPausedFocusSession,
  remainingSecondsOnRestore,
  restoredSessionNeedsContinue,
  rewriteStoredFocusSessionPaused,
  isFocusDocumentReload,
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

  it("derives remaining from the startedAt anchor when no deadline is stored", () => {
    const snapshot = runningSnapshot();
    expect(remainingSecondsOnRestore(snapshot)).toBe(23 * 60);
    expect(restoredSessionNeedsContinue(snapshot)).toBe(true);
  });

  it("still completes a session whose wall-clock remaining is already 0", () => {
    const snapshot = runningSnapshot({
      startedAt: Date.now() - 30 * 60 * 1000,
      timeLeft: 20 * 60,
    });
    expect(remainingSecondsOnRestore(snapshot)).toBe(0);
  });

  it("persist writes a live run through with isRunning true and its deadline", () => {
    const startedAt = Date.now() - 56 * 1000;
    const deadline = startedAt + 25 * 60 * 1000;
    persistPausedFocusSession({
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      liveIsRunning: true,
      liveStartedAt: startedAt,
      deadline,
      timeLeft: 24 * 60 + 4,
      hasCompletedSession: false,
      sessionCount: 1,
      keepAlive: false,
    });
    const stored = JSON.parse(
      window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)!,
    ) as FocusSessionSnapshot;
    expect(stored.isRunning).toBe(true);
    expect(stored.timeLeft).toBe(24 * 60 + 4);
    expect(stored.startedAt).toBe(startedAt);
    expect(stored.deadline).toBe(deadline);
  });

  it("persist writes last painted timeLeft, not wall-clock since a Continue startedAt", () => {
    persistPausedFocusSession({
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      liveIsRunning: false,
      liveStartedAt: null,
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
    expect(stored.deadline).toBeNull();
  });

  it("deadline snapshots restore deadline-derived remaining, not last painted", () => {
    const now = Date.now();
    const live = runningSnapshot({
      startedAt: now - 2 * 60 * 1000,
      deadline: now - 2 * 60 * 1000 + 25 * 60 * 1000,
      timeLeft: 25 * 60,
    });
    expect(remainingSecondsOnRestore(live, now)).toBe(23 * 60);
    expect(restoredSessionNeedsContinue(live)).toBe(true);

    const expired = runningSnapshot({
      startedAt: now - 30 * 60 * 1000,
      deadline: now - 30 * 60 * 1000 + 25 * 60 * 1000,
      timeLeft: 20 * 60,
    });
    expect(remainingSecondsOnRestore(expired, now)).toBe(0);
  });

  it("legacyImportForStore resumes anchored snapshots live and freezes anchorless ones paused", () => {
    const now = Date.now();
    const liveImport = legacyImportForStore(
      runningSnapshot({
        startedAt: now - 2 * 60 * 1000,
        deadline: now - 2 * 60 * 1000 + 25 * 60 * 1000,
        timeLeft: 25 * 60,
      }),
      now,
    );
    expect(liveImport?.status).toBe("running");
    expect(liveImport?.deadlineMs).toBe(now - 2 * 60 * 1000 + 25 * 60 * 1000);
    expect(liveImport?.remainingSec).toBe(23 * 60);
    expect(liveImport?.runId).not.toBeNull();

    // Pre-fix snapshot without a deadline but with a startedAt anchor resumes
    // live against the reconstructed deadline (startedAt + sessionLength).
    const legacyImport = legacyImportForStore(runningSnapshot(), now);
    expect(legacyImport?.status).toBe("running");
    expect(legacyImport?.remainingSec).toBe(23 * 60);
    expect(legacyImport?.runId).not.toBeNull();

    // Anchorless snapshot (explicit pause) restores as a paused Continue-hold.
    const pausedImport = legacyImportForStore(
      runningSnapshot({ isRunning: false, startedAt: null }),
      now,
    );
    expect(pausedImport?.status).toBe("paused");
    expect(pausedImport?.deadlineMs).toBeNull();
    expect(pausedImport?.remainingSec).toBe(24 * 60 + 4);

    expect(legacyImportForStore(null, now)).toBeNull();
  });

  it("saveFocusSession running crash snapshot restores deadline-derived", () => {
    const snapshot = runningSnapshot();
    saveFocusSession(snapshot);
    expect(restoredSessionNeedsContinue(snapshot)).toBe(true);
    expect(remainingSecondsOnRestore(snapshot)).toBe(23 * 60);
  });

  it("boot rewrite of a live Pause snapshot is paused Continue-hold, empty stays empty", () => {
    expect(rewriteStoredFocusSessionPaused()).toBeNull();
    expect(window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)).toBeNull();

    saveFocusSession(runningSnapshot({ timeLeft: 24 * 60 + 55 }));
    const rewritten = rewriteStoredFocusSessionPaused();
    expect(rewritten).not.toBeNull();
    expect(rewritten?.isRunning).toBe(false);
    expect(rewritten?.timeLeft).toBe(24 * 60 + 55);
    expect(restoredSessionNeedsContinue(rewritten)).toBe(true);
    expect(remainingSecondsOnRestore(rewritten!)).toBe(24 * 60 + 55);
  });

  it("empty / never-started snapshot stays Start-only and does not persist", () => {
    expect(restoredSessionNeedsContinue(null)).toBe(false);
    persistPausedFocusSession({
      selectedTarget: { type: "note", id: "note-1" },
      sessionLength: 25 * 60,
      liveIsRunning: false,
      liveStartedAt: null,
      timeLeft: 25 * 60,
      hasCompletedSession: false,
      sessionCount: 0,
      keepAlive: false,
    });
    expect(window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)).toBeNull();
    expect(
      restoredSessionNeedsContinue({
        version: 1,
        selectedTarget: { type: "note", id: "note-1" },
        sessionLength: 25 * 60,
        isRunning: false,
        startedAt: null,
        timeLeft: 25 * 60,
        hasCompletedSession: false,
        sessionCount: 0,
      }),
    ).toBe(false);
  });

  it("isFocusDocumentReload is true only for navigation type=reload", () => {
    expect(isFocusDocumentReload()).toBe(false);

    const spy = vi
      .spyOn(performance, "getEntriesByType")
      .mockImplementation((type) => {
        if (type === "navigation") {
          return [{ type: "navigate" } as PerformanceNavigationTiming];
        }
        return [];
      });
    expect(isFocusDocumentReload()).toBe(false);

    spy.mockImplementation((type) => {
      if (type === "navigation") {
        return [{ type: "reload" } as PerformanceNavigationTiming];
      }
      return [];
    });
    expect(isFocusDocumentReload()).toBe(true);
    spy.mockRestore();
  });
});
