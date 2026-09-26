import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "../../components/dashboard/Dashboard";
import { useAppStore } from "../../store/appStore";
import { useTodayPlanStore } from "../../store/todayPlanStore";
import { todayKey } from "../../utils/time";
import type { Task } from "../../types/database";

const { fakeTask } = vi.hoisted(() => {
  function fakeTask(overrides?: Partial<Task>): Task {
    const id = overrides?.id ?? "task-1";
    return {
      id,
      user_id: "user-1",
      title: `Task ${id}`,
      description: null,
      priority: "medium",
      due_date: null,
      completed: false,
      category: null,
      project_id: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }
  return { fakeTask };
});

const localDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
};

vi.mock("../../hooks/useTasks", () => ({
  useTasks: () => ({
    createTask: async (data: Partial<Task>) => {
      const task = fakeTask({
        id: `created-${data.title}`,
        title: data.title,
        due_date: data.due_date ?? null,
        priority: data.priority ?? "medium",
      });
      useAppStore.setState({
        tasks: [...useAppStore.getState().tasks, task],
      });
      return task;
    },
    completeTask: async (id: string) => {
      useAppStore.setState({
        tasks: useAppStore.getState().tasks.map((task) =>
          task.id === id ? { ...task, completed: true } : task,
        ),
      });
      return true;
    },
  }),
}));

function resetStore(overrides?: Record<string, unknown>) {
  useAppStore.setState({
    currentView: "dashboard",
    user: {
      id: "user-1",
      username: "Scholar",
      total_xp: 100,
      current_level: 1,
      current_streak: 0,
      longest_streak: 0,
      streak_freeze_tokens: 0,
      rest_days: 0,
      active_boost: null,
      theme_preference: "light",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    notes: [],
    papers: [],
    ideas: [],
    topics: {},
    tasks: [],
    notesLoading: false,
    papersLoading: false,
    ideasLoading: false,
    tasksLoading: false,
    topicsLoading: false,
    dataSyncErrors: {
      notes: null,
      papers: null,
      ideas: null,
      tasks: null,
      topics: null,
    },
    ...overrides,
  });
}

describe("Dashboard Today plan", () => {
  beforeEach(() => {
    resetStore();
    useTodayPlanStore.setState({
      dayKey: todayKey(),
      orderedIds: [],
      pendingFocusTaskId: null,
    });
    window.history.replaceState(null, "", "/");
  });

  it("lists due-today tasks and keeps overdue items in Needs attention", () => {
    resetStore({
      tasks: [
        fakeTask({
          id: "t-overdue",
          title: "Finish literature review",
          due_date: dateOffset(-5),
        }),
        fakeTask({
          id: "t-today",
          title: "Submit abstract",
          due_date: dateOffset(0),
        }),
        fakeTask({
          id: "t-future",
          title: "Future task",
          due_date: dateOffset(3),
        }),
        fakeTask({
          id: "t-done",
          title: "Done task",
          due_date: dateOffset(0),
          completed: true,
        }),
      ],
    });

    render(<Dashboard />);

    const deck = screen.getByRole("region", { name: "Today" });
    expect(screen.getByRole("heading", { name: "Today" }).tagName).toBe("H2");
    expect(
      within(deck).getByRole("button", { name: "Open task: Submit abstract" }),
    ).toBeInTheDocument();
    expect(
      within(deck).queryByRole("button", { name: "Open task: Finish literature review" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Open overdue task: Finish literature review" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open task: Future task" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Open task: Done task" }),
    ).toBeNull();
  });

  it("quick-adds a task onto Today without implicitly pinning due-today rows", async () => {
    resetStore({
      tasks: [
        fakeTask({ id: "t-today", title: "Submit abstract", due_date: dateOffset(0) }),
      ],
    });

    render(<Dashboard />);

    fireEvent.change(screen.getByLabelText("Add what you will do today"), {
      target: { value: "Gym" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(
      await screen.findByRole("button", { name: "Open task: Gym" }),
    ).toBeInTheDocument();

    // Pinned quick-add sorts before pure due-today rows.
    const openButtons = screen.getAllByRole("button", { name: /^Open task:/ });
    expect(openButtons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Open task: Gym",
      "Open task: Submit abstract",
    ]);

    // Reordering across the pinned/due-today boundary must not pin the
    // due-today row into the persisted order.
    fireEvent.click(screen.getByRole("button", { name: "Move Gym down" }));
    expect(useTodayPlanStore.getState().orderedIds).toEqual(["created-Gym"]);
  });

  it("offers an explicit unpin control per pinned row", () => {
    resetStore({
      tasks: [
        fakeTask({ id: "t-today", title: "Submit abstract", due_date: dateOffset(0) }),
        fakeTask({ id: "t-pinned", title: "Read inbox" }),
      ],
    });
    useTodayPlanStore.setState({ dayKey: todayKey(), orderedIds: ["t-pinned"], pendingFocusTaskId: null });

    render(<Dashboard />);

    // Only the pinned row gets a remove control; pure due-today rows don't.
    expect(
      screen.getByRole("button", { name: "Remove Read inbox from Today" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove Submit abstract from Today" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Remove Read inbox from Today" }));

    expect(useTodayPlanStore.getState().orderedIds).toEqual([]);
    expect(
      screen.queryByRole("button", { name: "Open task: Read inbox" }),
    ).toBeNull();
    // The due-today row stays.
    expect(
      screen.getByRole("button", { name: "Open task: Submit abstract" }),
    ).toBeInTheDocument();
  });

  it("shows the empty prompt when nothing is planned", () => {
    render(<Dashboard />);

    const deck = screen.getByRole("region", { name: "Today" });
    expect(within(deck).getByText(/Add what you'll do today/)).toBeInTheDocument();
  });

  it("renders a skeleton while tasks are loading", () => {
    resetStore({ tasksLoading: true });
    render(<Dashboard />);

    const deck = screen.getByRole("region", { name: "Today" });
    expect(within(deck).getByRole("status")).toBeInTheDocument();
  });

  it("starts Focus from a Today row", () => {
    resetStore({
      tasks: [
        fakeTask({ id: "t-today", title: "Submit abstract", due_date: dateOffset(0) }),
      ],
    });

    render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Start focus: Submit abstract" }));

    expect(window.location.pathname).toBe("/focus");
    expect(useAppStore.getState().currentView).toBe("focus");
    expect(useTodayPlanStore.getState().pendingFocusTaskId).toBe("t-today");
  });
});
