import { supabase } from "../supabase";

/**
 * research_achievements queries for the gamification pipeline (PR15 item 39).
 * Return shapes are identical to the previously inlined calls in
 * `utils/gamification.ts`.
 */

/** Achievement types already earned by the user (cache-warm read). */
export function listEarnedAchievementTypes(userId: string) {
  return supabase
    .from("research_achievements")
    .select("achievement_type")
    .eq("user_id", userId);
}

export interface AchievementInsert {
  user_id: string;
  achievement_type: string;
  title: string;
  description: string;
  xp_awarded: number;
}

/** Record a newly earned achievement. */
export function insertAchievementRow(row: AchievementInsert) {
  return supabase.from("research_achievements").insert(row);
}
