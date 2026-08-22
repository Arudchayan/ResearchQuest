import { describe, expect, it, beforeEach } from "vitest";
import {
  sprintGoalsForWeek,
  useSprintStore,
  weekKeyFor,
} from "../../store/sprintStore";

describe("sprintStore", () => {
  beforeEach(() => {
    useSprintStore.setState({
      weekKey: weekKeyFor(new Date()),
      days: {},
      goals: [],
    });
    useSprintStore.getState().resetIfNeeded();
  });

  it("records activity events onto the current day", () => {
    const store = useSprintStore.getState();
    store.recordEvent("note", 10);
    store.recordEvent("paper", 15);
    store.recordEvent("focus", 40, 20);

    const days = useSprintStore.getState().days;
    const today = new Date().toISOString().split("T")[0];
    expect(days[today].xp).toBe(65);
    expect(days[today].minutes).toBe(20);
    expect(days[today].events).toContain("Note");
    expect(days[today].events).toContain("Paper");
    expect(days[today].events).toContain("Focus");
  });

  it("adds and completes goals", () => {
    const store = useSprintStore.getState();
    store.addGoal("Finish literature synthesis", "Synthesize the RAG cluster");
    const goal = useSprintStore.getState().goals[0];
    expect(goal.title).toBe("Finish literature synthesis");
    expect(goal.status).toBe("active");

    useSprintStore.getState().completeGoal(goal.id);
    expect(useSprintStore.getState().goals[0].status).toBe("done");
  });

  it("filters goals to the current week", () => {
    const store = useSprintStore.getState();
    store.addGoal("This week goal");
    useSprintStore.setState({
      goals: [
        ...useSprintStore.getState().goals,
        {
          id: "old-goal",
          title: "Old goal",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
          status: "active",
        },
      ],
    });

    const weekGoals = sprintGoalsForWeek(useSprintStore.getState().goals);
    expect(weekGoals).toHaveLength(1);
    expect(weekGoals[0].title).toBe("This week goal");
  });

  it("deletes goals", () => {
    const store = useSprintStore.getState();
    store.addGoal("Remove me");
    const goalId = useSprintStore.getState().goals[0].id;
    useSprintStore.getState().deleteGoal(goalId);
    expect(useSprintStore.getState().goals).toHaveLength(0);
  });

  it("builds seven sprint days", () => {
    const days = useSprintStore.getState().days;
    expect(Object.keys(days)).toHaveLength(7);
  });
});
