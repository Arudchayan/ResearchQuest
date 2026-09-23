import { beforeEach, describe, expect, it } from "vitest";
import {
  resolveTodayTasks,
  useTodayPlanStore,
} from "../../store/todayPlanStore";
import { todayKey } from "../../utils/time";
import type { Task } from "../../types/database";
import {
  tipForView,
  useOnboardingTipsStore,
} from "../../store/onboardingTipsStore";

function task(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    user_id: "user-1",
    title: "Task",
    priority: "medium",
    completed: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("todayPlanStore", () => {
  beforeEach(() => {
    useTodayPlanStore.setState({
      dayKey: todayKey(),
      orderedIds: [],
      pendingFocusTaskId: null,
    });
    useOnboardingTipsStore.setState({ doneIds: [] });
  });

  it("includes due-today and pinned incomplete tasks in pin order", () => {
    useTodayPlanStore.getState().pin("pinned");
    const tasks = [
      task({ id: "due", title: "Due", due_date: todayKey() }),
      task({ id: "pinned", title: "Pinned" }),
      task({ id: "done", title: "Done", due_date: todayKey(), completed: true }),
    ];
    expect(resolveTodayTasks(tasks).map((item) => item.id)).toEqual([
      "pinned",
      "due",
    ]);
    expect(tipForView("dashboard")).toBeNull();
  });

  it("clears order when the calendar day rolls", () => {
    useTodayPlanStore.setState({ dayKey: "1999-01-01", orderedIds: ["old"] });
    useTodayPlanStore.getState().ensureDay();
    expect(useTodayPlanStore.getState().dayKey).toBe(todayKey());
    expect(useTodayPlanStore.getState().orderedIds).toEqual([]);
  });

  it("moves pinned ids and consumes a pending focus target once", () => {
    const store = useTodayPlanStore.getState();
    store.pin("a");
    store.pin("b");
    store.move("b", -1);
    expect(useTodayPlanStore.getState().orderedIds).toEqual(["b", "a"]);

    store.setPendingFocusTaskId("b");
    expect(useTodayPlanStore.getState().consumePendingFocusTaskId()).toBe("b");
    expect(useTodayPlanStore.getState().pendingFocusTaskId).toBeNull();
    expect(useTodayPlanStore.getState().consumePendingFocusTaskId()).toBeNull();
  });
});
