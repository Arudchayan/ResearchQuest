import { supabase, isDemoMode } from "../supabase";
import { logger } from "../../utils/logger";
import type { UserProfile } from "../../types/database";

/**
 * user_profiles queries for the gamification pipeline (PR15 item 39).
 * All return shapes are identical to the previously inlined
 * `supabase.from("user_profiles")...` calls in `utils/gamification.ts`.
 */

/** Column set the award pipeline needs (profile + running counts). */
export const PROFILE_XP_COLUMNS =
  "*, notes_count, papers_count, tasks_completed_count, papers_with_insights_count";

/** Full profile read for the award computation (boost/streak/counts). */
export function getProfileForXp(userId: string) {
  return supabase
    .from("user_profiles")
    .select(PROFILE_XP_COLUMNS)
    .eq("id", userId)
    .single();
}

/** Narrow totals read for the achievement-XP credit path. */
export function getProfileXpTotals(userId: string) {
  return supabase
    .from("user_profiles")
    .select("total_xp, current_level")
    .eq("id", userId)
    .single();
}

/** Direct profile update (achievement-XP credit + demo/RPC fallback). */
export function updateProfile(userId: string, payload: Partial<UserProfile>) {
  return supabase.from("user_profiles").update(payload).eq("id", userId);
}

export interface XpWriteResult {
  totalXp: number;
  level: number;
  streak: number;
}

interface IncrementXpRow {
  total_xp?: number;
  current_level?: number;
  current_streak?: number;
}

/**
 * Atomic XP write (PR15 item 36).
 *
 * Live mode: single `increment_xp` RPC — the increment and the folded
 * streak/count/token writes land in one atomic UPDATE, and the RETURNING
 * totals are authoritative for store hydration.
 *
 * Demo-mode fallback: the historical direct `update().eq()` (the demo engine
 * has no such RPC), preserving current demo XP behavior exactly. The same
 * legacy path is used fail-open if the RPC errors, so XP is never lost when
 * the migration has not been applied yet.
 */
export async function writeXpUpdate(
  userId: string,
  xpEarned: number,
  updatePayload: Partial<UserProfile>,
): Promise<XpWriteResult | null> {
  const fallbackTotals = (): XpWriteResult => ({
    totalXp: updatePayload.total_xp ?? 0,
    level: updatePayload.current_level ?? 1,
    streak: updatePayload.current_streak ?? 1,
  });

  if (!isDemoMode) {
    const { data, error } = await supabase.rpc("increment_xp", {
      p_user_id: userId,
      p_xp_earned: xpEarned,
      p_current_streak: updatePayload.current_streak ?? null,
      p_longest_streak: updatePayload.longest_streak ?? null,
      p_last_activity_date: updatePayload.last_activity_date ?? null,
      p_notes_count: updatePayload.notes_count ?? null,
      p_papers_count: updatePayload.papers_count ?? null,
      p_tasks_completed_count: updatePayload.tasks_completed_count ?? null,
      p_papers_with_insights_count:
        updatePayload.papers_with_insights_count ?? null,
      p_streak_freeze_tokens: updatePayload.streak_freeze_tokens ?? null,
    });
    const row = (Array.isArray(data) ? data[0] : data) as
      | IncrementXpRow
      | null
      | undefined;
    if (!error && row) {
      const fallback = fallbackTotals();
      return {
        totalXp: row.total_xp ?? fallback.totalXp,
        level: row.current_level ?? fallback.level,
        streak: row.current_streak ?? fallback.streak,
      };
    }
    logger.error(
      "increment_xp RPC failed, falling back to direct update",
      error,
    );
  }

  const { error: updateError } = await updateProfile(userId, updatePayload);
  if (updateError) {
    logger.error("Failed to update user profile", updateError);
    return null;
  }
  return fallbackTotals();
}
