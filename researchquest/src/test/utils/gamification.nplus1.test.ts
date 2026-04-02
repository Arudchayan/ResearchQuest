import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockSupabaseClient } from "../mocks/supabase";

vi.mock("../../lib/supabase", () => ({
  supabase: mockSupabaseClient,
}));

import { awardXP } from "../../utils/gamification";

describe("Gamification N+1 Optimization", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should benchmark achievement checking count queries", async () => {
    const userId = "user-123";
    const fromSpy = mockSupabaseClient.from;

    fromSpy.mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: userId, total_xp: 0, current_level: 1, current_streak: 1 }, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      builder.then = ((onFulfilled?: (value: any) => any) => {
        return Promise.resolve({ data: [], error: null, count: 0 }).then(onFulfilled);
      }) as any;

      return builder;
    });

    const start = performance.now();

    // Simulate actions that trigger the slow checks
    await awardXP(userId, 10, "create_note");
    await awardXP(userId, 10, "create_paper");
    await awardXP(userId, 10, "complete_task");
    await awardXP(userId, 10, "add_paper_insights");

    const end = performance.now();
    console.log(`Execution time for 4 achievement checks: ${end - start}ms`);

    // Count how many queries were made to each table
    const tableQueries: Record<string, number> = {};
    for (const call of fromSpy.mock.calls) {
      const table = call[0];
      tableQueries[table] = (tableQueries[table] || 0) + 1;
    }

    console.log("Table query counts:", tableQueries);
  });
});
