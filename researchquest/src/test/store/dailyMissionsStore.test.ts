import { describe, expect, it, beforeEach } from "vitest";
import {
  DAILY_MISSIONS,
  useDailyMissionsStore,
} from "../../store/dailyMissionsStore";

describe("dailyMissionsStore", () => {
  beforeEach(() => {
    useDailyMissionsStore.setState({
      date: new Date().toISOString().split("T")[0],
      progress: {},
      completedToday: 0,
    });
  });

  it("tracks mission progress from events", () => {
    const store = useDailyMissionsStore.getState();
    store.recordEvent("note");
    store.recordEvent("paper");
    store.recordEvent("task_complete");

    const progress = useDailyMissionsStore.getState().progress;
    expect(progress.capture_note).toBe(1);
    expect(progress.add_paper).toBe(1);
    expect(progress.complete_task).toBe(1);
    expect(useDailyMissionsStore.getState().completedToday).toBe(3);
  });

  it("caps focus minutes at the mission target", () => {
    const store = useDailyMissionsStore.getState();
    store.recordEvent("focus_minute", 60);

    expect(useDailyMissionsStore.getState().progress.focus_25).toBe(25);
    expect(useDailyMissionsStore.getState().completedToday).toBe(1);
  });

  it("resets progress when the date changes", () => {
    const store = useDailyMissionsStore.getState();
    store.recordEvent("note");
    store.recordEvent("paper");
    expect(useDailyMissionsStore.getState().completedToday).toBe(2);

    useDailyMissionsStore.setState({
      date: "2099-01-01",
      progress: useDailyMissionsStore.getState().progress,
      completedToday: useDailyMissionsStore.getState().completedToday,
    });
    useDailyMissionsStore.getState().resetIfNeeded();

    expect(useDailyMissionsStore.getState().progress).toEqual({});
    expect(useDailyMissionsStore.getState().completedToday).toBe(0);
  });

  it("defines five completable missions", () => {
    expect(DAILY_MISSIONS).toHaveLength(5);
    DAILY_MISSIONS.forEach((mission) => {
      expect(mission.target).toBeGreaterThan(0);
      expect(mission.xp).toBeGreaterThan(0);
      expect(mission.label.length).toBeGreaterThan(0);
    });
  });
});
