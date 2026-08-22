import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTasks } from "../../hooks/useTasks";
import { useAppStore } from "../../store/appStore";
import { mockSupabaseClient } from "../mocks/supabase";
import type { Task } from "../../types/database";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn().mockResolvedValue(undefined),
  XP_REWARDS: {
    CREATE_TASK: 10,
    COMPLETE_TASK: 20,
  },
}));

describe("useTasks performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ tasks: [], tasksLoading: false });

    const fetchSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "task-1",
            user_id: "test-user-id",
            title: "New task",
            completed: false,
            priority: "medium",
          },
          error: null,
        }),
      }),
    });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "tasks") {
        return {
          select: fetchSelect,
          insert,
        };
      }

      return {};
    });
  });

  it("does not refetch the full task list after a successful create", async () => {
    const { result } = renderHook(() => useTasks("test-user-id"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      mockSupabaseClient.from.mock.results[0]?.value.select,
    ).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.createTask({ title: "New task" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      mockSupabaseClient.from.mock.results[0]?.value.select,
    ).toHaveBeenCalledTimes(1);
  });

  it("refetches tasks when retryDataSync is called after a failure", async () => {
    let response: { data: Task[] | null; error: { message: string } | null } = {
      data: null,
      error: { message: "tasks down" },
    };
    const order = vi.fn().mockImplementation(() => Promise.resolve(response));
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });

    mockSupabaseClient.from.mockImplementation((table: string) =>
      table === "tasks" ? { select } : {},
    );
    useAppStore.getState().clearDataSyncError("tasks");

    const { result } = renderHook(() => useTasks("test-user-id"));

    await waitFor(() => {
      expect(useAppStore.getState().dataSyncErrors.tasks).not.toBeNull();
    });

    const recoveredTask: Task = {
      id: "task-recovered",
      user_id: "test-user-id",
      title: "Recovered task",
      description: null,
      priority: "medium",
      due_date: null,
      completed: false,
      category: null,
      project_id: null,
      created_at: "2026-04-26T00:00:00Z",
      updated_at: "2026-04-26T00:00:00Z",
    };
    response = { data: [recoveredTask], error: null };

    act(() => {
      useAppStore.getState().retryDataSync("tasks");
    });

    await waitFor(() => {
      expect(result.current.tasks).toEqual([recoveredTask]);
    });
    expect(useAppStore.getState().dataSyncErrors.tasks).toBeNull();
  });

  it("keeps canonical tasks when an unmounted consumer has no user ID", async () => {
    const canonicalTask: Task = {
      id: "canonical-task",
      user_id: "test-user-id",
      title: "Canonical task",
      description: null,
      priority: "medium",
      due_date: null,
      completed: false,
      category: null,
      project_id: null,
      created_at: "2026-04-26T00:00:00Z",
      updated_at: "2026-04-26T00:00:00Z",
    };
    useAppStore.setState({ tasks: [canonicalTask], tasksLoading: false });

    const { result } = renderHook(() =>
      useTasks(undefined, { owner: false }),
    );

    expect(result.current.tasks).toEqual([canonicalTask]);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await Promise.resolve();
    });

    expect(useAppStore.getState().tasks).toEqual([canonicalTask]);
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it("lets the App owner handle retry while consumers share its task lifecycle", async () => {
    const recoveredTask: Task = {
      id: "owner-task",
      user_id: "test-user-id",
      title: "Owner task",
      description: null,
      priority: "medium",
      due_date: null,
      completed: false,
      category: null,
      project_id: null,
      created_at: "2026-04-26T00:00:00Z",
      updated_at: "2026-04-26T00:00:00Z",
    };
    let response: { data: Task[] | null; error: { message: string } | null } = {
      data: [],
      error: null,
    };
    const order = vi.fn().mockImplementation(() => Promise.resolve(response));
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseClient.from.mockImplementation((table: string) =>
      table === "tasks" ? { select } : {},
    );

    const owner = renderHook(() => useTasks("test-user-id", { owner: true }));
    const consumer = renderHook(() =>
      useTasks("test-user-id", { owner: false }),
    );

    await waitFor(() => {
      expect(owner.result.current.loading).toBe(false);
    });
    expect(order).toHaveBeenCalledTimes(1);
    expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(1);

    response = { data: [recoveredTask], error: null };
    act(() => {
      useAppStore.getState().retryDataSync("tasks");
    });

    await waitFor(() => {
      expect(consumer.result.current.tasks).toEqual([recoveredTask]);
    });
    expect(order).toHaveBeenCalledTimes(2);
    expect(mockSupabaseClient.channel).toHaveBeenCalledTimes(1);
  });
});
