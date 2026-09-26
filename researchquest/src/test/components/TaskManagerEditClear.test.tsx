import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskManager } from "../../components/tasks/TaskManager";
import { useAppStore } from "../../store/appStore";
import type { Task } from "../../types/database";

const { taskState, createTaskMock, updateTaskMock } = vi.hoisted(() => ({
  taskState: { tasks: [] as Task[] },
  createTaskMock: vi.fn(async (input: Partial<Task>) => ({ id: "created-1", ...input })),
  updateTaskMock: vi.fn(async (_id: string, _updates: Partial<Task>) => true),
}));

vi.mock("../../hooks/useTasks", () => ({
  useTasks: () => ({
    tasks: taskState.tasks,
    loading: false,
    createTask: createTaskMock,
    updateTask: updateTaskMock,
    completeTask: vi.fn(async () => true),
    deleteTask: vi.fn(async () => true),
    restoreTask: vi.fn(async () => null),
  }),
}));

function fakeTask(overrides?: Partial<Task>): Task {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Write report",
    description: "Draft v1",
    priority: "medium",
    due_date: "2026-05-01",
    completed: false,
    category: "Research",
    project_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function resetApp(tasks: Task[]) {
  taskState.tasks = tasks;
  useAppStore.setState({
    tasks,
    tasksLoading: false,
    dataSyncErrors: { notes: null, papers: null, ideas: null, tasks: null, topics: null },
  } as never);
}

function submitDialogForm() {
  const form = document.querySelector("form");
  if (!form) throw new Error("dialog form not found");
  fireEvent.submit(form);
}

describe("TaskManager edit-clear", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/tasks");
  });

  it("persists cleared description and due date as null on update", async () => {
    resetApp([fakeTask()]);
    render(<TaskManager />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByText("Edit Task")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Description (Optional)"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Due Date"), {
      target: { value: "" },
    });
    submitDialogForm();

    expect(updateTaskMock).toHaveBeenCalledTimes(1);
    expect(updateTaskMock).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ description: null, due_date: null }),
    );
  });

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

  it("assigns and clears the project id from the task form", async () => {
    resetApp([fakeTask({ project_id: UUID_A })]);
    const { unmount } = render(<TaskManager />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const projectInput = (await screen.findByLabelText(
      "Project ID (Optional)",
    )) as HTMLInputElement;
    expect(projectInput.value).toBe(UUID_A);

    fireEvent.change(projectInput, { target: { value: "" } });
    submitDialogForm();
    expect(updateTaskMock).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ project_id: null }),
    );
    unmount();

    vi.clearAllMocks();
    resetApp([fakeTask()]);
    render(<TaskManager />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(await screen.findByLabelText("Project ID (Optional)"), {
      target: { value: UUID_B },
    });
    submitDialogForm();
    expect(updateTaskMock).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ project_id: UUID_B }),
    );
  });

  it("rejects a non-UUID project id with a field error and no save", async () => {
    resetApp([fakeTask()]);
    render(<TaskManager />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(await screen.findByLabelText("Project ID (Optional)"), {
      target: { value: "proj-1" },
    });
    submitDialogForm();
    expect(
      await screen.findByText("Project ID must be a valid UUID."),
    ).toBeInTheDocument();
    expect(updateTaskMock).not.toHaveBeenCalled();
  });

  it("hides the project filter when no project ids are in use", () => {
    resetApp([fakeTask()]);
    const { unmount } = render(<TaskManager />);
    expect(screen.queryByLabelText("Filter by project")).toBeNull();
    unmount();

    resetApp([fakeTask({ project_id: UUID_A })]);
    render(<TaskManager />);
    expect(screen.getByLabelText("Filter by project")).toBeInTheDocument();
  });
});
