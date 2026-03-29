import { logger } from "./logger";
import { supabase } from "../lib/supabase";
import type { UserProfile } from "../types/database";

// XP rewards for different actions
export const XP_REWARDS = {
  CREATE_NOTE: 10,
  UPDATE_NOTE: 5,
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
  CREATE_GOAL: 30,
  COMPLETE_GOAL: 100,
  COMPLETE_MILESTONE: 50,
  DAILY_LOGIN: 5,
  FOCUS_SESSION_MINUTE: 2,
};

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
  GOAL_CRUSHER: {
    type: "goal_crusher",
    title: "Goal Crusher",
    description: "Completed your first research goal",
    xp: 75,
  },
  NOTE_MASTER: {
    type: "note_master",
    title: "Note Master",
    description: "Written 50 notes",
    xp: 200,
  },
  RESEARCH_HERO: {
    type: "research_hero",
    title: "Research Hero",
    description: "Completed a major research milestone",
    xp: 300,
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
  let level = 1;
  let xpNeeded = getXPForLevel(level);

  while (totalXP >= xpNeeded) {
    level++;
    xpNeeded = getXPForLevel(level);
  }

  return level;
}

// Award XP and update user profile
export async function awardXP(
  userId: string,
  xpAmount: number,
  action: string,
): Promise<void> {
  // Get current profile
  const { data: profile, error: fetchError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (fetchError || !profile) {
    // Optimization: avoid logging the full error object to prevent sensitive data leakage
    // Only log the message if available
    logger.error(
      "Failed to fetch user profile:",
      fetchError?.message || "Profile not found",
    );
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  // Calculate new XP and Level
  const newTotalXP = profile.total_xp + xpAmount;
  const newLevel = getLevelFromXP(newTotalXP);

  // Calculate Streak
  // Logic moved here to avoid fetching profile again and to ensure correct calculation based on previous state
  let newStreak = 1;
  if (profile.last_activity_date) {
    const lastDate = new Date(profile.last_activity_date);
    const todayDate = new Date(today);
    const daysDiff = Math.floor(
      (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDiff === 0) {
      // Same day, keep current streak
      newStreak = profile.current_streak || 1;
    } else if (daysDiff === 1) {
      // Consecutive day, increment streak
      newStreak = (profile.current_streak || 0) + 1;
    }
    // If > 1 day, streak resets to 1 (already set)
  }

  const longestStreak = Math.max(newStreak, profile.longest_streak || 0);

  // Update profile with ALL changes in one go
  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({
      total_xp: newTotalXP,
      current_level: newLevel,
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_activity_date: today,
    })
    .eq("id", userId);

  if (updateError) {
    logger.error("Failed to update user profile", updateError);
    return;
  }

  // Update or create daily log (passing streak to avoid refetch)
  await updateDailyLog(userId, xpAmount, newStreak);

  // Check for achievements (passing streak to avoid refetch)
  await checkAchievements(userId, action, newStreak);
}

// Check and award achievements
async function checkAchievements(
  userId: string,
  action: string,
  currentStreak: number,
): Promise<void> {
  // Optimization: Use passed currentStreak instead of fetching profile

  // Check existing achievements
  const { data: existingAchievements } = await supabase
    .from("research_achievements")
    .select("achievement_type")
    .eq("user_id", userId);

  const earned = new Set(
    existingAchievements?.map((a) => a.achievement_type) || [],
  );

  // Check for 7-day streak
  if (currentStreak >= 7 && !earned.has(ACHIEVEMENTS.RESEARCH_STREAK_7.type)) {
    await awardAchievement(userId, ACHIEVEMENTS.RESEARCH_STREAK_7);
  }

  // Check for first paper
  if (action === "create_paper" && !earned.has(ACHIEVEMENTS.FIRST_PAPER.type)) {
    const { count } = await supabase
      .from("papers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (count === 1) {
      await awardAchievement(userId, ACHIEVEMENTS.FIRST_PAPER);
    }
  }

  // Check for 50 notes
  if (action === "create_note" && !earned.has(ACHIEVEMENTS.NOTE_MASTER.type)) {
    const { count } = await supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (count && count >= 50) {
      await awardAchievement(userId, ACHIEVEMENTS.NOTE_MASTER);
    }
  }

  // Check for 25 tasks completed
  if (
    action === "complete_task" &&
    !earned.has(ACHIEVEMENTS.TASK_WARRIOR.type)
  ) {
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("completed", true);

    if (count && count >= 25) {
      await awardAchievement(userId, ACHIEVEMENTS.TASK_WARRIOR);
    }
  }

  // Check for first goal completion
  if (
    action === "complete_goal" &&
    !earned.has(ACHIEVEMENTS.GOAL_CRUSHER.type)
  ) {
    await awardAchievement(userId, ACHIEVEMENTS.GOAL_CRUSHER);
  }

  // Check for 10 papers with insights
  if (
    action === "add_paper_insights" &&
    !earned.has(ACHIEVEMENTS.INSIGHT_COLLECTOR.type)
  ) {
    const { count } = await supabase
      .from("papers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("key_insights", "is", null);

    if (count && count >= 10) {
      await awardAchievement(userId, ACHIEVEMENTS.INSIGHT_COLLECTOR);
    }
  }
}

// Award an achievement
async function awardAchievement(
  userId: string,
  achievement: (typeof ACHIEVEMENTS)[keyof typeof ACHIEVEMENTS],
): Promise<void> {
  const { error: insertError } = await supabase
    .from("research_achievements")
    .insert({
      user_id: userId,
      achievement_type: achievement.type,
      title: achievement.title,
      description: achievement.description,
      xp_awarded: achievement.xp,
    });

  if (insertError) {
    logger.error("Failed to award achievement", insertError);
    return;
  }

  // Award XP for achievement (simplified to avoid double-counting)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("total_xp, current_level")
    .eq("id", userId)
    .single();

  if (profile) {
    const newTotalXP = profile.total_xp + achievement.xp;
    const newLevel = getLevelFromXP(newTotalXP);

    const { error: xpError } = await supabase
      .from("user_profiles")
      .update({
        total_xp: newTotalXP,
        current_level: newLevel,
      })
      .eq("id", userId);

    if (xpError) {
      logger.error("Failed to award achievement XP", xpError);
    }
  }
}

// Update daily log
async function updateDailyLog(
  userId: string,
  xpEarned: number,
  currentStreak: number,
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // Optimization: Removed redundant profile fetching and updating.
  // Streak is now calculated in awardXP and passed down.

  // Check if daily log exists for today
  const { data: existingLog } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (existingLog) {
    // Update existing log
    const { error: updateLogError } = await supabase
      .from("daily_logs")
      .update({
        xp_earned: existingLog.xp_earned + xpEarned,
        streak_count: currentStreak,
      })
      .eq("id", existingLog.id);

    if (updateLogError) {
      logger.error("Failed to update daily log", updateLogError);
    }
  } else {
    // Create new log
    const { error: insertLogError } = await supabase.from("daily_logs").insert({
      user_id: userId,
      date: today,
      xp_earned: xpEarned,
      streak_count: currentStreak,
    });

    if (insertLogError) {
      logger.error("Failed to create daily log", insertLogError);
    }
  }
}
