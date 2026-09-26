import { beforeEach, describe, expect, it } from "vitest";
import {
  FOCUS_SESSION_STORAGE_KEY,
  loadStoredFocusSession,
  resolveFocusTitle,
  type FocusSessionSnapshot,
} from "../../components/focus/focusUtils";

describe("freeform focus targets", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("restores a freeform session and resolves its title", () => {
    const snapshot: FocusSessionSnapshot = {
      version: 1,
      selectedTarget: { type: "freeform", id: "freeform", title: "Gym" },
      sessionLength: 1500,
      isRunning: false,
      startedAt: null,
      timeLeft: 1500,
      hasCompletedSession: false,
      sessionCount: 1,
    };
    window.localStorage.setItem(
      FOCUS_SESSION_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
    expect(loadStoredFocusSession()?.selectedTarget).toEqual(
      snapshot.selectedTarget,
    );
    expect(resolveFocusTitle(snapshot.selectedTarget, null)).toBe("Gym");
  });
});
