import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockSupabaseClient } from "../mocks/supabase";

// Mock supabase module - MUST be before imports that use it
vi.mock("../../lib/supabase", () => ({
  supabase: mockSupabaseClient,
}));

// Import after mock
import {
  awardXP,
  XP_REWARDS,
  clearAchievementsCache,
} from "../../utils/gamification";
import { useAppStore } from "../../store/appStore";
import { useGamificationStore } from "../../store/gamificationStore";

const daysAgo = (n: number): string =>
  new Date(Date.now() - n * 86400000).toISOString().split("T")[0]!;

const futureISO = () => new Date(Date.now() + 3600000).toISOString();
const pastISO = () => new Date(Date.now() - 3600000).toISOString();

interface MockState {
  profile: Record<string, unknown>;
  profileUpdates: Record<string, any>[];
  achievementInserts: Record<string, any>[];
}

function setupSupabaseMock(state: MockState) {
  mockSupabaseClient.from.mockImplementation((table: string) => {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockImplementation((payload: any) => {
        if (table === "user_profiles") state.profileUpdates.push(payload);
        return builder;
      }),
      insert: vi.fn().mockImplementation((payload: any) => {
        if (table === "research_achievements") {
          state.achievementInserts.push(payload);
        }
        return builder;
      }),
      single: vi.fn().mockResolvedValue(
        table === "user_profiles"
          ? { data: state.profile, error: null }
          : { data: null, error: null },
      ),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: ((onFulfilled?: (value: any) => any) =>
        Promise.resolve(
          table === "research_achievements"
            ? { data: [], error: null }
            : { data: null, error: null },
        ).then(onFulfilled)) as any,
    };
    return builder;
  });
}

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-a",
    username: "test-user",
    total_xp: 100,
    current_level: 1,
    current_streak: 3,
    longest_streak: 5,
    last_activity_date: daysAgo(1),
    streak_freeze_tokens: 0,
    rest_days: 0,
    active_boost: null,
    theme_preference: "auto" as const,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    notes_count: 0,
    papers_count: 0,
    tasks_completed_count: 0,
    papers_with_insights_count: 0,
    ...overrides,
  };
}

describe("Gamification Award Pipeline (trust)", () => {
  let state: MockState;
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
    clearAchievementsCache();
    useAppStore.setState({ user: null });
    useGamificationStore
      .getState()
      .hydrateFromProfile({
        streak_freeze_tokens: 0,
        rest_days: 0,
        active_boost: null,
      });
    state = {
      profile: makeProfile(),
      profileUpdates: [],
      achievementInserts: [],
    };
    setupSupabaseMock(state);
  });

  afterEach(() => {
    useGamificationStore.getState().clearBoostLocally();
    vi.restoreAllMocks();
  });

  it("applies the active boost multiplier to awarded XP", async () => {
    state.profile = makeProfile({
      active_boost: { type: "xp", multiplier: 2, expires_at: futureISO() },
    });

    const result = await awardXP("user-a", 10, "create_note");

    expect(result?.xpEarned).toBe(20);
    expect(state.profileUpdates[0]?.total_xp).toBe(120);
  });

  it("rounds fractional multiplied XP to the nearest integer", async () => {
    state.profile = makeProfile({
      active_boost: { type: "xp", multiplier: 1.5, expires_at: futureISO() },
    });

    const result = await awardXP("user-a", 7, "create_note");

    expect(result?.xpEarned).toBe(11);
    expect(state.profileUpdates[0]?.total_xp).toBe(111);
  });

  it("ignores an expired boost multiplier", async () => {
    state.profile = makeProfile({
      active_boost: { type: "xp", multiplier: 2, expires_at: pastISO() },
    });

    const result = await awardXP("user-a", 10, "create_note");

    expect(result?.xpEarned).toBe(10);
    expect(state.profileUpdates[0]?.total_xp).toBe(110);
  });

  it("preserves the streak by consuming one freeze token on a multi-day gap", async () => {
    state.profile = makeProfile({
      last_activity_date: daysAgo(3),
      current_streak: 12,
      longest_streak: 12,
      streak_freeze_tokens: 1,
    });

    const result = await awardXP("user-a", 10, "create_note");

    expect(result?.streak).toBe(12);
    expect(state.profileUpdates[0]?.current_streak).toBe(12);
    expect(state.profileUpdates[0]?.streak_freeze_tokens).toBe(0);
  });

  it("resets the streak on a multi-day gap when no freeze tokens remain", async () => {
    state.profile = makeProfile({
      last_activity_date: daysAgo(3),
      current_streak: 12,
      streak_freeze_tokens: 0,
    });

    const result = await awardXP("user-a", 10, "create_note");

    expect(result?.streak).toBe(1);
    expect(state.profileUpdates[0]?.current_streak).toBe(1);
    expect(state.profileUpdates[0]).not.toHaveProperty("streak_freeze_tokens");
  });

  it("grants a freeze token when the streak reaches a multiple of 7 (6 -> 7)", async () => {
    state.profile = makeProfile({
      last_activity_date: daysAgo(1),
      current_streak: 6,
      streak_freeze_tokens: 0,
    });

    const result = await awardXP("user-a", 10, "create_note");

    expect(result?.streak).toBe(7);
    expect(state.profileUpdates[0]?.streak_freeze_tokens).toBe(1);
  });

  it("grants a freeze token at every new multiple of 7 (13 -> 14)", async () => {
    state.profile = makeProfile({
      last_activity_date: daysAgo(1),
      current_streak: 13,
      streak_freeze_tokens: 1,
    });

    const result = await awardXP("user-a", 10, "create_note");

    expect(result?.streak).toBe(14);
    expect(state.profileUpdates[0]?.streak_freeze_tokens).toBe(2);
  });

  it("does not grant a token when the streak merely rests on a multiple of 7", async () => {
    state.profile = makeProfile({
      last_activity_date: daysAgo(3),
      current_streak: 14,
      streak_freeze_tokens: 2,
    });

    const result = await awardXP("user-a", 10, "create_note");

    expect(result?.streak).toBe(14);
    expect(state.profileUpdates[0]?.streak_freeze_tokens).toBe(1);
  });

  it("returns the result shape and reports level-ups", async () => {
    const result = await awardXP("user-a", 10, "create_note");

    expect(result).toEqual({
      xpEarned: 10,
      level: 1,
      leveledUp: false,
      streak: 4,
      achievementsEarned: [],
    });

    state.profile = makeProfile({ total_xp: 490, current_level: 1 });
    const leveled = await awardXP("user-a", XP_REWARDS.CREATE_IDEA, "create_idea");
    expect(leveled?.xpEarned).toBe(20);
    expect(leveled?.level).toBe(2);
    expect(leveled?.leveledUp).toBe(true);
  });

  it("returns earned achievements in the result", async () => {
    state.profile = makeProfile({ papers_count: 0 });

    const result = await awardXP("user-a", 15, "create_paper");

    expect(result?.achievementsEarned).toHaveLength(1);
    expect(result?.achievementsEarned[0]?.title).toBe("First Paper");
    expect(state.achievementInserts[0]?.xp_awarded).toBe(50);
  });

  it("re-hydrates the profile into the app store after a successful update", async () => {
    state.profile = makeProfile({
      last_activity_date: daysAgo(1),
      current_streak: 6,
      streak_freeze_tokens: 0,
    });

    const result = await awardXP("user-a", 10, "create_note");

    // Streak 6->7 also earns the Research Streak achievement (+100 XP),
    // which is folded into the hydrated profile
    expect(result?.achievementsEarned[0]?.title).toBe("Research Streak");
    const hydrated = useAppStore.getState().user;
    expect(hydrated).not.toBeNull();
    expect(hydrated?.total_xp).toBe(210);
    expect(hydrated?.current_streak).toBe(result?.streak);
    expect(hydrated?.streak_freeze_tokens).toBe(1);
    expect(hydrated?.username).toBe("test-user");
    expect(hydrated?.notes_count).toBe(1);
    expect(useGamificationStore.getState().streakFreezeTokens).toBe(1);
  });

  it("keeps the anti-N+1 guarantee: one profile fetch, one profile update per award", async () => {
    await awardXP("user-a", 10, "create_note");
    await awardXP("user-b", 10, "create_note");

    const userProfileCalls = mockSupabaseClient.from.mock.calls.filter(
      (call) => call[0] === "user_profiles",
    );

    expect(userProfileCalls).toHaveLength(4); // 2 awards x (1 select + 1 update)
    expect(state.profileUpdates).toHaveLength(2);
  });

  it("purges dead XP reward constants", () => {
    expect(XP_REWARDS).not.toHaveProperty("DAILY_LOGIN");
    expect(XP_REWARDS).not.toHaveProperty("CREATE_GOAL");
    expect(XP_REWARDS).not.toHaveProperty("COMPLETE_GOAL");
    expect(XP_REWARDS).not.toHaveProperty("COMPLETE_MILESTONE");
    expect(XP_REWARDS).toHaveProperty("CREATE_NOTE");
    expect(XP_REWARDS).toHaveProperty("FOCUS_SESSION_MINUTE");
  });
});
