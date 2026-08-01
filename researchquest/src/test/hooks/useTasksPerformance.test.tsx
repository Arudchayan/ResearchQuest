import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTasks } from "../../hooks/useTasks";
import { useAppStore } from "../../store/appStore";
import { mockSupabaseClient } from "../mocks/supabase";

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
});
