import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTasks } from "../../hooks/useTasks";
import { supabase } from "../../lib/supabase";
import { useAppStore } from "../../store/appStore";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn().mockResolvedValue(true),
  XP_REWARDS: {
    CREATE_TASK: 10,
    COMPLETE_TASK: 20,
  },
}));

describe("useTasks realtime subscription", () => {
  const userId = "test-user-id";
  const channelOn = vi.fn().mockReturnThis();
  const channelSubscribe = vi.fn().mockReturnThis();
  const channelUnsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      tasks: [],
      tasksLoading: false,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    } as any);

    vi.mocked(supabase.channel).mockReturnValue({
      on: channelOn,
      subscribe: channelSubscribe,
      unsubscribe: channelUnsubscribe,
    } as any);
  });

  it("creates only one realtime channel when multiple hooks mount", async () => {
    const first = renderHook(() => useTasks(userId));
    const second = renderHook(() => useTasks(userId));

    await act(async () => {
      await Promise.resolve();
    });

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(supabase.channel).toHaveBeenCalledWith(`tasks_realtime_${userId}`);
    expect(channelOn).toHaveBeenCalledTimes(1);
    expect(channelSubscribe).toHaveBeenCalledTimes(1);

    first.unmount();
    expect(channelUnsubscribe).not.toHaveBeenCalled();

    second.unmount();
    expect(channelUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
