import { logger } from "./logger";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { useAppStore } from "../store/appStore";
import { useGamificationStore } from "../store/gamificationStore";
import { todayKey } from "./time";
import type { UserProfile } from "../types/database";

// XP rewards for different actions
export const XP_REWARDS = {
  CREATE_NOTE: 10,
  // UPDATE_NOTE is 0 by design: note saves are high-frequency, so crediting
  // them farms XP. The award_xp RPC hard-codes 0 for update_note; this
  // constant only mirrors the server policy so toasts stay honest.
  UPDATE_NOTE: 0,
  CREATE_PAPER: 15,
  UPDATE_PAPER_STATUS: 10,
  ADD_PAPER_INSIGHTS: 15,
  CREATE_IDEA: 20,
  ADVANCE_IDEA_STAGE: 25,
  CREATE_TASK: 5,
  COMPLETE_TASK: 20,
  DAILY_TASK_COMPLETION: 10,
  CREATE_TOPIC: 15,
  UPDATE_TOPIC: 8,
  TAG_ENTITY_WITH_TOPIC: 6,
  COMPLETE_TOPIC_QUEST: 30,
  FOCUS_SESSION_MINUTE: 2,
};

// Server-side anti-farming policy mirrors (authoritative enforcement lives in
// the award_xp RPC; these constants only keep the client honest about what
// the server will credit — never the other way around).
// Focus sessions shorter than this earn 0 XP, server-side.
export const FOCUS_MIN_SESSION_MINUTES = 25;
// Max focus XP the server credits per local day.
export const FOCUS_XP_DAILY_CAP = 240;
// Max credited XP per action per local day (update_note is 0 = no XP).
export const XP_DAILY_CAPS: Record<string, number> = {
  create_note: 100,
  update_note: 0,
  create_paper: 150,
  update_paper_status: 100,
  add_paper_insights: 150,
  create_idea: 200,
  advance_idea_stage: 250,
  create_task: 100,
  complete_task: 200,
  daily_task_completion: 100,
  create_topic: 150,
  update_topic: 80,
  tag_entity_with_topic: 60,
  complete_topic_quest: 300,
  complete_focus_session: 240,
  generic: 500,
};

// XP for a completed focus session of the given length. Sessions below
// FOCUS_MIN_SESSION_MINUTES credit 0 (mirrors the server gate).
export function xpForFocusSession(durationMinutes: number): number {
  if (!Number.isFinite(durationMinutes) || durationMinutes < FOCUS_MIN_SESSION_MINUTES) {
    return 0;
  }
  return Math.floor(durationMinutes) * XP_REWARDS.FOCUS_SESSION_MINUTE;
}

// Achievement types and rewards
export const ACHIEVEMENTS = {
  FIRST_PAPER: {
    type: "first_paper",
    title: "First Paper",
    description: "Added your first research paper",
    xp: 50,
  },
  RESEARCH_STREAK_7: {
    type: "research_streak_7",
    title: "Research Streak",
    description: "7 days consecutive research activity",
    xp: 100,
  },
  NOTE_MASTER: {
    type: "note_master",
    title: "Note Master",
    description: "Written 50 notes",
    xp: 200,
  },
  TASK_WARRIOR: {
    type: "task_warrior",
    title: "Task Warrior",
    description: "Completed 25 tasks",
    xp: 150,
  },
  INSIGHT_COLLECTOR: {
    type: "insight_collector",
    title: "Insight Collector",
    description: "Added insights from 10 papers",
    xp: 120,
  },
};

export type Achievement = (typeof ACHIEVEMENTS)[keyof typeof ACHIEVEMENTS];

// Research level titles
export const LEVEL_TITLES: { [key: number]: string } = {
  1: "Research Novice",
  2: "Research Apprentice",
  3: "Research Student",
  4: "Research Scholar",
  5: "Research Expert",
  6: "Research Guru",
  7: "Research Master",
  8: "Research Legend",
  9: "Research Pioneer",
  10: "Research Visionary",
};

export function getLevelTitle(level: number): string {
  if (level <= 10) {
    return LEVEL_TITLES[level] || `Research Level ${level}`;
  }
  return `Research Visionary (Lvl ${level})`;
}

// XP required per level (simple formula: level * 500)
export function getXPForLevel(level: number): number {
  return level * 500;
}

// Calculate level from total XP
export function getLevelFromXP(totalXP: number): number {
  // Optimization: O(1) mathematical calculation instead of O(N) while loop
  return Math.floor(totalXP / 500) + 1;
}

export interface GamificationResult {
  /** Actual XP credited (after boost multiplier). */
  xpEarned: number;
  level: number;
  leveledUp: boolean;
  streak: number;
  achievementsEarned: Achievement[];
}

interface AwardXpRpcRow {
  total_xp: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
  notes_count: number;
  papers_count: number;
  tasks_completed_count: number;
  papers_with_insights_count: number;
  streak_freeze_tokens: number;
  xp_credited: number;
  is_duplicate: boolean;
}

interface AwardAchievementRpcRow {
  total_xp: number;
  current_level: number;
  xp_credited: number;
  is_duplicate: boolean;
}

/**
 * Atomic XP award via the `award_xp` RPC (single UPDATE, LOCAL-day streaks,
 * idempotency guard, server-side anti-farming caps). Returns null when the
 * RPC is unavailable or fails — callers must not write XP themselves.
 * An idempotency key is only sent when the caller supplies one (or an entity
 * id) — repeat awards of the same action without an entity must NOT dedupe
 * each other.
 *
 * STREAK AUTHORITY: the local calendar day from todayKey() is passed as
 * p_local_day; the server validates and uses it for streak math. The client
 * never computes streak transitions itself on this path.
 */
async function tryAwardXpRpc(
  userId: string,
  xpEarned: number,
  action: string,
  options?: {
    entityId?: string;
    idempotencyKey?: string;
    durationMinutes?: number;
  },
): Promise<AwardXpRpcRow | null> {
  try {
    const { data, error } = await supabase.rpc("award_xp", {
      p_uid: userId,
      p_delta: xpEarned,
      p_idempotency_key:
        options?.idempotencyKey ??
        (options?.entityId ? `${userId}:${action}:${options.entityId}` : null),
      p_action: action,
      p_entity_id: options?.entityId ?? "",
      p_local_day: todayKey(),
      p_duration_minutes: options?.durationMinutes ?? null,
    });
    if (error) {
      logger.error("award_xp RPC failed", error.message);
      return null;
    }
    if (!data) {
      logger.error("award_xp RPC failed", "empty response");
      return null;
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | AwardXpRpcRow
      | undefined;
    if (!row || typeof row.total_xp !== "number") {
      logger.error("award_xp RPC failed", "malformed response");
      return null;
    }
    return row;
  } catch (error) {
    logger.error("award_xp RPC failed", error);
    return null;
  }
}

/**
 * Atomic achievement credit via the `award_achievement_xp` RPC (deduped
 * insert + total_xp increment in one transaction). Returns null when the RPC
 * is unavailable or fails — callers must not write achievements or XP
 * themselves. A duplicate (already awarded) resolves to a row with
 * is_duplicate = true.
 */
async function tryAwardAchievementRpc(
  achievement: Achievement,
): Promise<AwardAchievementRpcRow | null> {
  try {
    const { data, error } = await supabase.rpc("award_achievement_xp", {
      p_achievement_type: achievement.type,
      p_xp: achievement.xp,
      p_title: achievement.title,
      p_description: achievement.description,
    });
    if (error) {
      logger.error("award_achievement_xp RPC failed", error.message);
      return null;
    }
    if (!data) {
      logger.error("award_achievement_xp RPC failed", "empty response");
      return null;
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | AwardAchievementRpcRow
      | undefined;
    if (!row || typeof row.total_xp !== "number") {
      logger.error("award_achievement_xp RPC failed", "malformed response");
      return null;
    }
    return row;
  } catch (error) {
    logger.error("award_achievement_xp RPC failed", error);
    return null;
  }
}

/**
 * Fire sonner celebrations for a completed awardXP.
 * `skipXpToast` opts out of the "+N XP" toast when the caller already
 * announces the XP itself (e.g. FocusWorkspace's completion toast).
 */
export function notifyGamificationResult(
  result: GamificationResult | null | undefined,
  options?: { skipXpToast?: boolean },
): void {
  if (!result || typeof result !== "object") return;

  if (result.xpEarned > 0 && !options?.skipXpToast) {
    toast.success(`+${result.xpEarned} XP`);
  }

  if (result.leveledUp) {
    toast.success(`Level up! You're now Level ${result.level}`);
  }

  const achievements = Array.isArray(result.achievementsEarned)
    ? result.achievementsEarned
    : [];
  for (const achievement of achievements) {
    toast.success(
      `Achievement unlocked: ${achievement.title} (+${achievement.xp} XP)`,
    );
  }
}

// Award XP through the award_xp RPC only. On RPC failure, log and return
// null — never write total_xp, counts, or ledger rows from the client.
export async function awardXP(
  userId: string,
  xpAmount: number,
  action: string,
  options?: {
    entityId?: string;
    idempotencyKey?: string;
    durationMinutes?: number;
  },
): Promise<GamificationResult | null> {
  const { data: profile, error: fetchError } = await supabase
    .from("user_profiles")
    .select("*, notes_count, papers_count, tasks_completed_count, papers_with_insights_count")
    .eq("id", userId)
    .single();

  if (fetchError || !profile) {
    logger.error(
      "Failed to fetch user profile:",
      fetchError?.message || "Profile not found",
    );
    return null;
  }

  const boost = profile.active_boost as
    | { multiplier?: number; expires_at: string }
    | null
    | undefined;
  const boostActive =
    boost?.multiplier &&
    boost.expires_at &&
    new Date(boost.expires_at).getTime() > Date.now();
  const xpEarned = Math.round(
    xpAmount * (boostActive && boost.multiplier ? boost.multiplier : 1),
  );

  const rpcRow = await tryAwardXpRpc(userId, xpEarned, action, options);
  if (!rpcRow) {
    return null;
  }
  if (rpcRow.is_duplicate) {
    return {
      xpEarned: 0,
      level: rpcRow.current_level,
      leveledUp: false,
      streak: rpcRow.current_streak,
      achievementsEarned: [],
    };
  }

  const rpcCounts = {
    notes_count: rpcRow.notes_count || 0,
    papers_count: rpcRow.papers_count || 0,
    tasks_completed_count: rpcRow.tasks_completed_count || 0,
    papers_with_insights_count: rpcRow.papers_with_insights_count || 0,
  };
  const achievementsEarned = await checkAchievements(
    userId,
    action,
    rpcRow.current_streak,
    rpcCounts,
  );
  const achievementXp = achievementsEarned.reduce(
    (sum, achievement) => sum + achievement.xp,
    0,
  );
  const finalTotal = rpcRow.total_xp + achievementXp;
  const finalLevel = getLevelFromXP(finalTotal);
  const updatedProfile: UserProfile = {
    ...(profile as UserProfile),
    total_xp: finalTotal,
    current_level: finalLevel,
    current_streak: rpcRow.current_streak,
    longest_streak: rpcRow.longest_streak,
    last_activity_date: rpcRow.last_activity_date,
    streak_freeze_tokens: rpcRow.streak_freeze_tokens,
    ...rpcCounts,
  };
  useAppStore.getState().setUser(updatedProfile);
  useGamificationStore.getState().hydrateFromProfile(updatedProfile);
  return {
    xpEarned: rpcRow.xp_credited,
    level: finalLevel,
    leveledUp: finalLevel > (profile.current_level || 1),
    streak: rpcRow.current_streak,
    achievementsEarned,
  };
}

// Cache for user achievements to prevent N+1 queries
const achievementsCache = new Map<string, Set<string>>();

export function clearAchievementsCache(userId?: string) {
  if (userId) {
    achievementsCache.delete(userId);
  } else {
    achievementsCache.clear();
  }
}

// Check and award achievements
async function checkAchievements(
  userId: string,
  action: string,
  currentStreak: number,
  counts: {
    notes_count: number;
    papers_count: number;
    tasks_completed_count: number;
    papers_with_insights_count: number;
  },
): Promise<Achievement[]> {
  // Optimization: Use passed currentStreak and counts instead of fetching from tables
  const earnedAchievements: Achievement[] = [];

  // Check existing achievements
  let earned = achievementsCache.get(userId);
  if (!earned) {
    const { data: existingAchievements } = await supabase
      .from("research_achievements")
      .select("achievement_type")
      .eq("user_id", userId);

    earned = new Set(existingAchievements?.map((a) => a.achievement_type) || []);
    achievementsCache.set(userId, earned);
  }

  // Check for 7-day streak
  if (currentStreak >= 7 && !earned.has(ACHIEVEMENTS.RESEARCH_STREAK_7.type)) {
    const awarded = await awardAchievement(
      userId,
      ACHIEVEMENTS.RESEARCH_STREAK_7,
    );
    if (awarded) earnedAchievements.push(awarded);
  }

  // Check for first paper
  if (action === "create_paper" && !earned.has(ACHIEVEMENTS.FIRST_PAPER.type)) {
    if (counts.papers_count === 1) {
      const awarded = await awardAchievement(userId, ACHIEVEMENTS.FIRST_PAPER);
      if (awarded) earnedAchievements.push(awarded);
    }
  }

  // Check for 50 notes
  if (action === "create_note" && !earned.has(ACHIEVEMENTS.NOTE_MASTER.type)) {
    if (counts.notes_count >= 50) {
      const awarded = await awardAchievement(userId, ACHIEVEMENTS.NOTE_MASTER);
      if (awarded) earnedAchievements.push(awarded);
    }
  }

  // Check for 25 tasks completed
  if (
    action === "complete_task" &&
    !earned.has(ACHIEVEMENTS.TASK_WARRIOR.type)
  ) {
    if (counts.tasks_completed_count >= 25) {
      const awarded = await awardAchievement(userId, ACHIEVEMENTS.TASK_WARRIOR);
      if (awarded) earnedAchievements.push(awarded);
    }
  }

  // Check for 10 papers with insights
  if (
    action === "add_paper_insights" &&
    !earned.has(ACHIEVEMENTS.INSIGHT_COLLECTOR.type)
  ) {
    if (counts.papers_with_insights_count >= 10) {
      const awarded = await awardAchievement(
        userId,
        ACHIEVEMENTS.INSIGHT_COLLECTOR,
      );
      if (awarded) earnedAchievements.push(awarded);
    }
  }

  return earnedAchievements;
}

// Award an achievement through award_achievement_xp only. On RPC failure,
// log and return null — never insert research_achievements or write total_xp.
async function awardAchievement(
  userId: string,
  achievement: Achievement,
): Promise<Achievement | null> {
  const rpcRow = await tryAwardAchievementRpc(achievement);
  if (!rpcRow) {
    return null;
  }
  const cacheEarned = achievementsCache.get(userId);
  if (cacheEarned) {
    cacheEarned.add(achievement.type);
  }
  return rpcRow.is_duplicate ? null : achievement;
}
