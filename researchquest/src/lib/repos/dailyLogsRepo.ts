import { supabase } from "../supabase";

/**
 * daily_logs queries for the gamification pipeline (PR15 item 39).
 * Return shapes are identical to the previously inlined calls in
 * `utils/gamification.ts`.
 */

/** Today's log row for the user, if one exists. */
export function getDailyLogForDate(userId: string, date: string) {
  return supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
}

export interface DailyLogPatch {
  xp_earned: number;
  streak_count: number;
}

/** Accumulate XP into today's existing log row. */
export function updateDailyLogRow(id: string, patch: DailyLogPatch) {
  return supabase.from("daily_logs").update(patch).eq("id", id);
}

export interface DailyLogInsert extends DailyLogPatch {
  user_id: string;
  date: string;
}

/** Create today's log row. */
export function insertDailyLogRow(row: DailyLogInsert) {
  return supabase.from("daily_logs").insert(row);
}
