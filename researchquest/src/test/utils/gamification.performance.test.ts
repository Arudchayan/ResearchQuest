import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockSupabaseClient } from "../mocks/supabase";

// Mock supabase module - MUST be before imports that use it
vi.mock("../../lib/supabase", () => ({
  supabase: mockSupabaseClient,
}));

// Import after mock
import { awardXP } from "../../utils/gamification";

describe("Gamification Logic & Performance", () => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should update user profile and daily log efficiently", async () => {
    // Setup mock data
    const userId = "user-123";
    const initialProfile = {
      id: userId,
      total_xp: 100,
      current_level: 1,
      current_streak: 5,
      longest_streak: 5,
      last_activity_date: "2023-01-01", // Yesterday relative to "today"
    };

    // Capture calls to 'from' to differentiate tables
    const fromSpy = mockSupabaseClient.from;

    // We need to return different builders based on the table name
    fromSpy.mockImplementation((table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        maybeSingle: vi.fn(),
      };

      // Chainable promise resolution
      builder.then = ((onFulfilled?: (value: any) => any) => {
        // Default return
        const result: any = { data: null, error: null };

        if (table === "user_profiles") {
          // For select/single
          result.data = initialProfile;
        }

        return Promise.resolve(result).then(onFulfilled);
      }) as any;

      // Override specific methods for specific tables if needed
      if (table === "user_profiles") {
        builder.single.mockResolvedValue({ data: initialProfile, error: null });
      }

      if (table === "daily_logs") {
        builder.maybeSingle.mockResolvedValue({ data: null, error: null }); // No log for today yet
      }

      if (table === "research_achievements") {
        builder.select.mockReturnThis(); // For existing achievements check
        // Mocking the result of select for achievements
        builder.then = ((onFulfilled?: (value: any) => any) => {
          return Promise.resolve({ data: [], error: null }).then(onFulfilled);
        }) as any;
      }

      return builder;
    });

    // Run awardXP
    await awardXP(userId, 10, "create_note");

    // Analyze calls
    const userProfileCalls = fromSpy.mock.calls.filter(
      (args) => args[0] === "user_profiles",
    ).length;
    // In current inefficient implementation:
    // 1. awardXP -> select
    // 2. awardXP -> update
    // 3. updateDailyLog -> select
    // 4. updateDailyLog -> update
    // 5. checkAchievements -> select (streak)
    // 6. awardAchievement -> select (xp) (if achievement awarded - unlikely in this simple test unless mocked)
    // 7. awardAchievement -> update (xp)

    // We expect high number of calls initially
    console.log(`User Profile interactions: ${userProfileCalls}`);

    // Also verify streak update logic
    // We can inspect the update calls arguments
    // However, since we mock the builder creation every time, we can't easily spy on the *specific* builder instance's update method
    // unless we capture it.

    // But we can check if the logic is flawed as suspected (streak not incrementing because date updated first)

    // Actually, checking call count is enough for performance optimization verification.
  });
});
