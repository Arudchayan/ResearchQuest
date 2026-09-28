import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockSupabaseClient } from "../mocks/supabase";

vi.mock("../../lib/supabase", () => ({
  supabase: mockSupabaseClient,
}));

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

interface RpcCall {
  fn: string;
  params: Record<string, unknown>;
}

interface MockState {
  profile: Record<string, unknown>;
  profileUpdates: Record<string, unknown>[];
  achievementInserts: Record<string, unknown>[];
  rpcCalls: RpcCall[];
  awardXpRow: Record<string, unknown> | null;
  achievementRow: Record<string, unknown> | null;
}

function setupMocks(state: MockState) {
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

  mockSupabaseClient.rpc.mockImplementation((fn: string, params: any) => {
    state.rpcCalls.push({ fn, params });
    if (fn === "award_xp") {
      return Promise.resolve(
        state.awardXpRow
          ? { data: state.awardXpRow, error: null }
          : { data: null, error: { message: "rpc unavailable" } },
      );
    }
    if (fn === "award_achievement_xp") {
      return Promise.resolve(
        state.achievementRow
          ? { data: state.achievementRow, error: null }
          : { data: null, error: { message: "rpc unavailable" } },
      );
    }
    return Promise.resolve({ data: null, error: null });
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

const BASE_XP_ROW = {
  total_xp: 110,
  current_level: 1,
  current_streak: 4,
  longest_streak: 5,
  last_activity_date: "2026-01-02",
  notes_count: 0,
  papers_count: 0,
  tasks_completed_count: 0,
  papers_with_insights_count: 0,
  streak_freeze_tokens: 0,
  xp_credited: 10,
  is_duplicate: false,
};

describe("Gamification Award Pipeline (RPC-only)", () => {
  let state: MockState;
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
    clearAchievementsCache();
    useAppStore.setState({ user: null });
    useGamificationStore.getState().hydrateFromProfile({
      streak_freeze_tokens: 0,
      rest_days: 0,
      active_boost: null,
    });
    state = {
      profile: makeProfile(),
      profileUpdates: [],
      achievementInserts: [],
      rpcCalls: [],
      awardXpRow: { ...BASE_XP_ROW },
      achievementRow: null,
    };
    setupMocks(state);
  });

  afterEach(() => {
    useGamificationStore.getState().clearBoostLocally();
    vi.restoreAllMocks();
  });

  it("sends the raw xp amount as p_delta and does not write total_xp", async () => {
    state.profile = makeProfile({
      active_boost: { type: "xp", multiplier: 2, expires_at: futureISO() },
    });
    state.awardXpRow = { ...BASE_XP_ROW, xp_credited: 10, total_xp: 110 };

    const result = await awardXP("user-a", 10, "create_note");

    expect(result?.xpEarned).toBe(10);
    expect(state.rpcCalls[0]?.params.p_delta).toBe(10);
    expect(state.profileUpdates).toHaveLength(0);
  });

  it("does not apply a client-side boost multiplier to p_delta", async () => {
    state.profile = makeProfile({
      active_boost: { type: "xp", multiplier: 1.5, expires_at: futureISO() },
    });

    await awardXP("user-a", 7, "create_note");

    expect(state.rpcCalls[0]?.params.p_delta).toBe(7);
    expect(state.profileUpdates).toHaveLength(0);
  });

  it("hydrates streak from the RPC row without a client profile write", async () => {
    state.awardXpRow = { ...BASE_XP_ROW, current_streak: 12, xp_credited: 10 };

    const result = await awardXP("user-a", 10, "create_note");

    expect(result?.streak).toBe(12);
    expect(useAppStore.getState().user?.current_streak).toBe(12);
    expect(state.profileUpdates).toHaveLength(0);
  });

  it("returns the result shape and reports level-ups from the RPC totals", async () => {
    const result = await awardXP("user-a", 10, "create_note");

    expect(result).toEqual({
      xpEarned: 10,
      level: 1,
      leveledUp: false,
      streak: 4,
      achievementsEarned: [],
    });

    state.profile = makeProfile({ total_xp: 490, current_level: 1 });
    state.awardXpRow = {
      ...BASE_XP_ROW,
      total_xp: 510,
      current_level: 2,
      xp_credited: 20,
    };
    const leveled = await awardXP("user-a", XP_REWARDS.CREATE_IDEA, "create_idea");
    expect(leveled?.xpEarned).toBe(20);
    expect(leveled?.level).toBe(2);
    expect(leveled?.leveledUp).toBe(true);
  });

  it("on RPC failure logs and writes nothing", async () => {
    state.awardXpRow = null;

    const result = await awardXP("user-a", 10, "create_note");

    expect(result).toBeNull();
    expect(state.profileUpdates).toHaveLength(0);
    expect(state.achievementInserts).toHaveLength(0);
    expect(useAppStore.getState().user).toBeNull();
  });

  it("credits first-paper through award_achievement_xp without ledger inserts", async () => {
    state.profile = makeProfile({ papers_count: 0 });
    state.awardXpRow = {
      ...BASE_XP_ROW,
      papers_count: 1,
      xp_credited: 15,
      total_xp: 115,
    };
    state.achievementRow = {
      total_xp: 165,
      current_level: 1,
      xp_credited: 50,
      is_duplicate: false,
    };

    const result = await awardXP("user-a", 15, "create_paper");

    expect(result?.achievementsEarned).toHaveLength(1);
    expect(result?.achievementsEarned[0]?.title).toBe("First Paper");
    expect(state.achievementInserts).toHaveLength(0);
    expect(state.profileUpdates).toHaveLength(0);
    expect(useAppStore.getState().user?.total_xp).toBe(165);
  });

  it("re-hydrates the profile into the app store after a successful RPC", async () => {
    state.awardXpRow = {
      ...BASE_XP_ROW,
      current_streak: 7,
      streak_freeze_tokens: 1,
      notes_count: 1,
      total_xp: 110,
    };

    const result = await awardXP("user-a", 10, "create_note");

    const hydrated = useAppStore.getState().user;
    expect(result?.streak).toBe(7);
    expect(hydrated).not.toBeNull();
    expect(hydrated?.total_xp).toBe(110);
    expect(hydrated?.current_streak).toBe(7);
    expect(hydrated?.streak_freeze_tokens).toBe(1);
    expect(hydrated?.username).toBe("test-user");
    expect(hydrated?.notes_count).toBe(1);
    expect(useGamificationStore.getState().streakFreezeTokens).toBe(1);
    expect(state.profileUpdates).toHaveLength(0);
  });

  it("keeps the anti-N+1 guarantee: one profile fetch and no profile update per award", async () => {
    await awardXP("user-a", 10, "create_note");
    await awardXP("user-b", 10, "create_note");

    const userProfileCalls = mockSupabaseClient.from.mock.calls.filter(
      (call) => call[0] === "user_profiles",
    );

    expect(userProfileCalls).toHaveLength(2);
    expect(state.profileUpdates).toHaveLength(0);
    expect(state.rpcCalls.filter((c) => c.fn === "award_xp")).toHaveLength(2);
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
