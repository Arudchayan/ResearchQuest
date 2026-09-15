import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useDataSync } from "../../hooks/useDataSync";
import { useAppStore } from "../../store/appStore";
import { useSprintStore, weekKeyFor } from "../../store/sprintStore";
import { useDailyMissionsStore } from "../../store/dailyMissionsStore";
import { mockSupabaseClient } from "../mocks/supabase";

function todayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tableBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn().mockReturnValue(builder);
  builder.gte = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
  builder.maybeSingle = vi.fn().mockResolvedValue(
    table === "daily_logs"
      ? { data: { xp_earned: 40 }, error: null }
      : { data: null, error: null },
  );
  const rows =
    table === "focus_sessions" ? [{ duration_seconds: 3600 }] : [];
  builder.then = (onFulfilled?: (value: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(onFulfilled);
  return builder;
}

describe("useDataSync streak reconcile (item 43)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.from.mockImplementation((table: string) =>
      tableBuilder(table),
    );
    useAppStore.setState({
      notes: [],
      papers: [],
      ideas: [],
      notesLoading: false,
      papersLoading: false,
      ideasLoading: false,
      dataSyncErrors: { notes: null, papers: null, ideas: null },
      focusSessionSecondsToday: 0,
      todayXP: 0,
    });
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

  test("seeds local sprint/daily-missions from server daily_logs/focus_sessions", async () => {
    renderHook(() => useDataSync("user-1"));

    await waitFor(() => {
      expect(useAppStore.getState().focusSessionSecondsToday).toBe(3600);
    });
    expect(useAppStore.getState().todayXP).toBe(40);

    // Server wins: 3600s -> 60 focus minutes, 40 XP land in the sprint day…
    const todayUTC = new Date().toISOString().split("T")[0];
    await waitFor(() => {
      expect(useSprintStore.getState().days[todayUTC]).toMatchObject({
        minutes: 60,
        xp: 40,
      });
    });
    // …and the focus mission is seeded (capped at its 25-minute target).
    expect(useDailyMissionsStore.getState().progress.focus_25).toBe(25);
    expect(useDailyMissionsStore.getState().completedToday).toBe(1);
  });
});
