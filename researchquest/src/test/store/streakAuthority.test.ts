import { beforeEach, describe, expect, test } from "vitest";
import {
  useSprintStore,
  weekKeyFor,
} from "../../store/sprintStore";
import {
  useDailyMissionsStore,
  DAILY_MISSIONS,
} from "../../store/dailyMissionsStore";

function todayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

function todayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("streak authority (item 43)", () => {
  beforeEach(() => {
    useSprintStore.setState({
      weekKey: weekKeyFor(new Date()),
      days: {},
      goals: [],
    });
    useDailyMissionsStore.setState({
      date: todayLocal(),
      progress: {},
      completedToday: 0,
    });
  });

  test("sprint applyServerSnapshot overwrites today counters (server wins)", () => {
    useSprintStore.setState({
      days: {
        [todayUTC()]: {
          date: todayUTC(),
          label: "Today",
          minutes: 5,
          xp: 10,
          events: ["Note"],
        },
      },
    });

    useSprintStore.getState().applyServerSnapshot(60, 120);

    const day = useSprintStore.getState().days[todayUTC()];
    expect(day.minutes).toBe(60);
    expect(day.xp).toBe(120);
    // Local event trail and goals survive reconciliation.
    expect(day.events).toEqual(["Note"]);
  });

  test("sprint applyServerSnapshot preserves goals and creates today when missing", () => {
    useSprintStore.setState({
      goals: [
        {
          id: "goal-1",
          title: "Ship PR14",
          createdAt: new Date().toISOString(),
          status: "active",
        },
      ],
    });

    useSprintStore.getState().applyServerSnapshot(25, 30);

    expect(useSprintStore.getState().days[todayUTC()]).toMatchObject({
      minutes: 25,
      xp: 30,
    });
    expect(useSprintStore.getState().goals).toHaveLength(1);
  });

  test("daily missions applyServerSnapshot seeds focus_25 and completes it", () => {
    const target =
      DAILY_MISSIONS.find((mission) => mission.id === "focus_25")?.target ?? 25;

    useDailyMissionsStore.getState().applyServerSnapshot(10);
    expect(useDailyMissionsStore.getState().progress.focus_25).toBe(10);
    expect(useDailyMissionsStore.getState().completedToday).toBe(0);

    // Server minutes beyond the target cap at the target and complete it.
    useDailyMissionsStore.getState().applyServerSnapshot(target + 100);
    expect(useDailyMissionsStore.getState().progress.focus_25).toBe(target);
    expect(useDailyMissionsStore.getState().completedToday).toBe(1);

    // Re-applying the same snapshot is a no-op (no double count).
    useDailyMissionsStore.getState().applyServerSnapshot(target + 100);
    expect(useDailyMissionsStore.getState().completedToday).toBe(1);
  });

  test("daily missions applyServerSnapshot never touches other missions", () => {
    useDailyMissionsStore.setState({
      progress: { capture_note: 1 },
      completedToday: 1,
    });

    useDailyMissionsStore.getState().applyServerSnapshot(25);

    expect(useDailyMissionsStore.getState().progress.capture_note).toBe(1);
    expect(useDailyMissionsStore.getState().completedToday).toBe(2);
  });

  test("legacy unversioned sprint persists migrate safely", () => {
    const migrate = (
      useSprintStore as unknown as {
        persist: { getOptions: () => { migrate: (s: unknown) => unknown } };
      }
    ).persist.getOptions().migrate;

    const days = {
      "2026-09-12": {
        date: "2026-09-12",
        label: "Sat",
        minutes: 20,
        xp: 50,
        events: ["Focus"],
      },
    };
    const goals = [
      {
        id: "goal-9",
        title: "Legacy goal",
        createdAt: "2026-09-12T00:00:00Z",
        status: "active" as const,
      },
    ];
    expect(
      migrate({ weekKey: "2026-09-07", days, goals, unknownField: true }),
    ).toEqual({ weekKey: "2026-09-07", days, goals });
    expect(migrate(null)).toEqual({
      weekKey: weekKeyFor(new Date()),
      days: {},
      goals: [],
    });
    expect(migrate({})).toEqual({
      weekKey: weekKeyFor(new Date()),
      days: {},
      goals: [],
    });
  });

  test("legacy unversioned daily-missions persists migrate safely", () => {
    const migrate = (
      useDailyMissionsStore as unknown as {
        persist: { getOptions: () => { migrate: (s: unknown) => unknown } };
      }
    ).persist.getOptions().migrate;

    expect(
      migrate({
        date: "2026-09-12",
        progress: { focus_25: 10 },
        completedToday: 0,
        unknownField: true,
      }),
    ).toEqual({
      date: "2026-09-12",
      progress: { focus_25: 10 },
      completedToday: 0,
    });
    // Missing completion counts are recomputed from progress, not dropped.
    expect(migrate({ date: "2026-09-12", progress: { focus_25: 25 } })).toEqual(
      { date: "2026-09-12", progress: { focus_25: 25 }, completedToday: 1 },
    );
    expect(migrate(undefined)).toEqual({
      date: todayLocal(),
      progress: {},
      completedToday: 0,
    });
  });
});
