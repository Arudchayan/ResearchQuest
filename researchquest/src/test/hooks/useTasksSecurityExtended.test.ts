import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTasks } from "../../hooks/useTasks";
import { supabase } from "../../lib/supabase";
import { useAppStore } from "../../store/appStore";

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock gamification
vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn().mockResolvedValue(true),
  notifyGamificationResult: vi.fn(),
  XP_REWARDS: {
    CREATE_TASK: 10,
    COMPLETE_TASK: 20,
  },
}));

// Mock Supabase
vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    }),
  },
}));

describe("useTasks Security Extended", () => {
  const userId = "test-user-id";
  const taskId = "test-task-id";

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      tasks: [],
      tasksLoading: false,
    });
  });

  describe("Global task state", () => {
    it("syncs fetched tasks into the app store", async () => {
      const fetchedTask = {
        id: taskId,
        user_id: userId,
        title: "Canonical Task",
        description: "Visible in dashboard/export",
        priority: "medium",
        due_date: "2026-05-01",
        completed: false,
        category: "Research",
        project_id: "project-1",
        created_at: "2026-04-26T00:00:00Z",
        updated_at: "2026-04-26T00:00:00Z",
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi
              .fn()
              .mockResolvedValue({ data: [fetchedTask], error: null }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useTasks(userId));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.tasks).toEqual([fetchedTask]);
      expect(useAppStore.getState().tasks).toEqual([fetchedTask]);
      expect(useAppStore.getState().tasksLoading).toBe(false);
    });

  });

  describe("IDOR Prevention", () => {
    it("updateTask should include user_id filter", async () => {
      const updateEqMock = vi.fn().mockReturnThis();

      const updateChain = {
        eq: updateEqMock,
        select: vi.fn().mockReturnThis(), // Added select/single/etc just in case
        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      };

      const updateMock = vi.fn().mockReturnValue(updateChain);

      const defaultChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: updateMock,
        delete: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      };

      // Initial fetch setup
      vi.mocked(supabase.from).mockReturnValue({
        ...defaultChain,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi
              .fn()
              .mockResolvedValue({
                data: [{ id: taskId, user_id: userId, title: "Test Task" }],
                error: null,
              }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useTasks(userId));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Reset for updateTask
      vi.mocked(supabase.from).mockReturnValue(defaultChain as any);

      await act(async () => {
        await result.current.updateTask(taskId, { title: "Updated" });
      });

      expect(updateEqMock).toHaveBeenCalledWith("id", taskId);
      expect(updateEqMock).toHaveBeenCalledWith("user_id", userId);
    });

    it("deleteTask should include user_id filter", async () => {
      const deleteEqMock = vi.fn().mockReturnThis();

      const deleteChain = {
        eq: deleteEqMock,
      };

      const deleteMock = vi.fn().mockReturnValue(deleteChain);

      const defaultChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(), // For other calls
        order: vi.fn().mockReturnThis(),
        delete: deleteMock,
        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      };

      // Initial fetch setup
      vi.mocked(supabase.from).mockReturnValue({
        ...defaultChain,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi
              .fn()
              .mockResolvedValue({
                data: [{ id: taskId, user_id: userId, title: "Test Task" }],
                error: null,
              }),
          }),
        }),
      } as any);

      const { result } = renderHook(() => useTasks(userId));

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      vi.mocked(supabase.from).mockReturnValue(defaultChain as any);

      await act(async () => {
        await result.current.deleteTask(taskId);
      });

      expect(deleteEqMock).toHaveBeenCalledWith("id", taskId);
      expect(deleteEqMock).toHaveBeenCalledWith("user_id", userId);
    });
  });

  describe("Information Leakage", () => {
    it("should NOT expose error details or hints in state/toast", async () => {
      const sensitiveError = {
        // message is missing
        details: "Sensitive DB details",
        hint: "Sensitive Hint",
      };

      const createMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi
            .fn()
            .mockResolvedValue({ data: null, error: sensitiveError }),
        }),
      });

      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        insert: createMock,
      };

      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      const { result } = renderHook(() => useTasks(userId));

      await act(async () => {
        await result.current.createTask({ title: "New Task" });
      });

      // Check the error state
      // It should NOT contain 'Sensitive DB details' or 'Sensitive Hint'
      // Currently it WILL contain it because of the || fallback

      // This assertion expects the fix to be in place (i.e., NO leakage)
      expect(result.current.error).not.toContain("Sensitive DB details");
      expect(result.current.error).not.toContain("Sensitive Hint");
    });
  });
});
