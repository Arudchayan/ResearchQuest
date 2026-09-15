import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePapers } from "../../hooks/usePapers";
import { awardXpBulk } from "../../utils/gamificationSync";
import { notifyGamificationResult } from "../../utils/gamification";
import { mockSupabaseClient } from "../mocks/supabase";
import { useAppStore } from "../../store/appStore";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../utils/gamification", () => ({
  awardXP: vi.fn(),
  notifyGamificationResult: vi.fn(),
  XP_REWARDS: {
    CREATE_PAPER: 10,
    UPDATE_PAPER_STATUS: 5,
  },
}));

vi.mock("../../utils/gamificationSync", () => ({
  awardXpBulk: vi.fn(),
}));

function chainable(resolved: unknown) {
  const builder: any = {};
  for (const method of [
    "select",
    "eq",
    "insert",
    "update",
    "upsert",
    "order",
    "in",
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(resolved));
  builder.then = (onFulfilled?: (value: any) => any) =>
    Promise.resolve(resolved).then(onFulfilled);
  return builder;
}

describe("usePapers bulk import XP batching (PR15 item 37)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ papers: [], papersLoading: false });

    const profileBuilder = chainable({ data: null, error: null });
    profileBuilder.single = vi.fn().mockResolvedValue({
      data: { auto_create_reading_tasks: false },
      error: null,
    });

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === "user_profiles") return profileBuilder;
      const builder = chainable({ data: [], error: null });
      builder.in = vi.fn(() =>
        Promise.resolve({ data: [], error: null }),
      );
      builder.insert = vi.fn((rows: any[]) =>
        chainable({
          data: rows.map((row, index) => ({ ...row, id: `bulk-${index}` })),
          error: null,
        }),
      );
      return builder;
    });
  });

  it("imports N papers with one insert and one XP flush", async () => {
    vi.mocked(awardXpBulk).mockResolvedValue([
      { xpEarned: 10, level: 1, leveledUp: false, streak: 1, achievementsEarned: [] },
      { xpEarned: 10, level: 1, leveledUp: false, streak: 1, achievementsEarned: [] },
      { xpEarned: 10, level: 1, leveledUp: false, streak: 1, achievementsEarned: [] },
    ]);

    const { result } = renderHook(() => usePapers("test-user-id"));

    let created: unknown;
    await act(async () => {
      created = await result.current.createPapers([
        { title: "Paper A", authors: ["A. Uthor"], doi: "10.1/a" },
        { title: "Paper B", authors: ["B. Uthor"], doi: "10.1/b" },
        { title: "Paper C", authors: ["C. Uthor"], doi: "10.1/c" },
      ]);
    });

    expect((created as unknown[]).length).toBe(3);

    // One batched XP call for all three papers — not one call per paper.
    expect(awardXpBulk).toHaveBeenCalledTimes(1);
    expect(awardXpBulk).toHaveBeenCalledWith(
      "test-user-id",
      [
        { xpAmount: 10, action: "create_paper" },
        { xpAmount: 10, action: "create_paper" },
        { xpAmount: 10, action: "create_paper" },
      ],
    );

    // The single aggregated toast is preserved.
    expect(notifyGamificationResult).toHaveBeenCalledTimes(1);
    expect(notifyGamificationResult).toHaveBeenCalledWith({
      xpEarned: 30,
      level: 1,
      leveledUp: false,
      streak: 1,
      achievementsEarned: [],
    });
  });
});
