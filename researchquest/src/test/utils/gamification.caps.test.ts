import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockSupabaseClient } from "../mocks/supabase";

// Mock supabase module - MUST be before imports that use it
vi.mock("../../lib/supabase", () => ({
  supabase: mockSupabaseClient,
}));

// Import after mock
import {
  awardXP,
  xpForFocusSession,
  XP_REWARDS,
  XP_DAILY_CAPS,
  FOCUS_MIN_SESSION_MINUTES,
  FOCUS_XP_DAILY_CAP,
  clearAchievementsCache,
} from "../../utils/gamification";
import { todayKey } from "../../utils/time";
import { useAppStore } from "../../store/appStore";
import { useGamificationStore } from "../../store/gamificationStore";

interface RpcCall {
  fn: string;
  params: Record<string, unknown>;
}

interface MockState {
  profile: Record<string, unknown>;
  profileUpdates: Record<string, any>[];
  achievementInserts: Record<string, any>[];
  rpcCalls: RpcCall[];
  awardXpRow: Record<string, unknown> | null;
  achievementRow: Record<string, unknown> | null;
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

const BASE_ACHIEVEMENT_ROW = {
  total_xp: 310,
  current_level: 1,
  xp_credited: 200,
  is_duplicate: false,
};

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
          : { data: null, error: null },
      );
    }
    if (fn === "award_achievement_xp") {
      return Promise.resolve(
        state.achievementRow
          ? { data: state.achievementRow, error: null }
          : { data: null, error: null },
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
    last_activity_date: "2026-01-01",
    streak_freeze_tokens: 0,
    rest_days: 0,
    active_boost: null,
    theme_preference: "auto" as const,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    notes_count: 49,
    papers_count: 0,
    tasks_completed_count: 0,
    papers_with_insights_count: 0,
    ...overrides,
  };
}

describe("Gamification RPC policy (caps, achievements, streak authority)", () => {
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
      achievementRow: { ...BASE_ACHIEVEMENT_ROW },
    };
    setupMocks(state);
  });

  afterEach(() => {
    useGamificationStore.getState().clearBoostLocally();
    vi.restoreAllMocks();
  });

  it("credits achievement XP through the award_achievement_xp RPC without direct total_xp writes", async () => {
    // Server reports 50 notes after the base award -> NOTE_MASTER (200 XP).
    state.awardXpRow = { ...BASE_XP_ROW, notes_count: 50 };

    const result = await awardXP("user-a", 10, "create_note");

    const achievementCalls = state.rpcCalls.filter(
      (c) => c.fn === "award_achievement_xp",
    );
    expect(achievementCalls).toHaveLength(1);
    expect(achievementCalls[0]!.params).toMatchObject({
      p_achievement_type: "note_master",
      p_xp: 200,
    });
    // No client-side direct writes: no achievement insert, no total_xp update.
    expect(state.achievementInserts).toHaveLength(0);
    expect(state.profileUpdates).toHaveLength(0);

    expect(result).not.toBeNull();
    expect(result!.achievementsEarned.map((a) => a.type)).toEqual([
      "note_master",
    ]);
    expect(result!.xpEarned).toBe(10);
    // Hydrated store folds the RPC-credited achievement XP on top of the
    // (stale-by-achievement) base row: 110 + 200 = 310.
    expect(useAppStore.getState().user?.total_xp).toBe(310);
  });

  it("treats an already-awarded achievement as a duplicate without re-crediting", async () => {
    state.awardXpRow = { ...BASE_XP_ROW, notes_count: 50 };
    state.achievementRow = {
      ...BASE_ACHIEVEMENT_ROW,
      xp_credited: 0,
      is_duplicate: true,
    };

    const result = await awardXP("user-a", 10, "create_note");

    expect(
      state.rpcCalls.filter((c) => c.fn === "award_achievement_xp"),
    ).toHaveLength(1);
    expect(result!.achievementsEarned).toEqual([]);
    expect(state.achievementInserts).toHaveLength(0);
    expect(state.profileUpdates).toHaveLength(0);
    expect(useAppStore.getState().user?.total_xp).toBe(110);
  });

  it("keeps the legacy direct-write achievement fallback consistent when the RPC is unavailable", async () => {
    state.awardXpRow = { ...BASE_XP_ROW, notes_count: 50 };
    state.achievementRow = null; // achievement RPC unavailable

    const result = await awardXP("user-a", 10, "create_note");

    expect(result!.achievementsEarned.map((a) => a.type)).toEqual([
      "note_master",
    ]);
    // Legacy path: direct insert + total_xp update with the same 200 XP.
    expect(state.achievementInserts).toHaveLength(1);
    expect(state.achievementInserts[0]).toMatchObject({
      user_id: "user-a",
      achievement_type: "note_master",
      xp_awarded: 200,
    });
    const totalUpdates = state.profileUpdates.filter(
      (u) => typeof u.total_xp === "number",
    );
    expect(totalUpdates).toHaveLength(1);
    expect(totalUpdates[0]!.total_xp).toBe(100 + 200);
  });

  it("sends the local-day key and focus duration to the award_xp RPC", async () => {
    state.awardXpRow = { ...BASE_XP_ROW, xp_credited: 50, total_xp: 150 };

    const result = await awardXP("user-a", 50, "complete_focus_session", {
      durationMinutes: 25,
    });

    const awardCalls = state.rpcCalls.filter((c) => c.fn === "award_xp");
    expect(awardCalls).toHaveLength(1);
    expect(awardCalls[0]!.params).toMatchObject({
      p_uid: "user-a",
      p_delta: 50,
      p_action: "complete_focus_session",
      p_local_day: todayKey(),
      p_duration_minutes: 25,
    });
    expect(result!.xpEarned).toBe(50);
    expect(result!.achievementsEarned).toEqual([]);
  });

  it("mirrors the server zero-credit policy for update_note (RPC and legacy)", async () => {
    expect(XP_REWARDS.UPDATE_NOTE).toBe(0);

    // RPC path: server no-op row credits 0.
    state.awardXpRow = { ...BASE_XP_ROW, xp_credited: 0, total_xp: 100 };
    const viaRpc = await awardXP("user-a", 0, "update_note");
    expect(viaRpc!.xpEarned).toBe(0);
    expect(viaRpc!.achievementsEarned).toEqual([]);
    expect(state.profileUpdates).toHaveLength(0);

    // Legacy path: 0 XP keeps the stored total unchanged.
    state.awardXpRow = null;
    state.profileUpdates = [];
    const viaLegacy = await awardXP("user-a", 0, "update_note");
    expect(viaLegacy!.xpEarned).toBe(0);
    expect(state.profileUpdates[0]).toMatchObject({ total_xp: 100 });
  });

  it("mirrors the server focus gate: sessions below 25 minutes earn 0 XP", () => {
    expect(FOCUS_MIN_SESSION_MINUTES).toBe(25);
    expect(FOCUS_XP_DAILY_CAP).toBe(240);
    expect(xpForFocusSession(25)).toBe(50);
    expect(xpForFocusSession(30)).toBe(60);
    expect(xpForFocusSession(24)).toBe(0);
    expect(xpForFocusSession(15)).toBe(0);
    expect(xpForFocusSession(Number.NaN)).toBe(0);
  });

  it("mirrors the server per-action daily caps", () => {
    expect(XP_DAILY_CAPS.update_note).toBe(0);
    expect(XP_DAILY_CAPS.complete_focus_session).toBe(240);
    expect(XP_DAILY_CAPS.create_note).toBe(100);
    expect(XP_DAILY_CAPS.create_paper).toBe(150);
    expect(XP_DAILY_CAPS.complete_topic_quest).toBe(300);
    expect(XP_DAILY_CAPS.generic).toBe(500);
  });
});
