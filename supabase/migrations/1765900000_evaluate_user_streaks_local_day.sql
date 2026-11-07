-- Migration: timezone-correct evaluate_user_streaks (lazy UTC-12 zeroing)
-- Created at: 1765900000
--
-- WHY THIS FILE EXISTS
--   The pg_cron job `5 0 * * *` (00:05 UTC) runs public.evaluate_user_streaks().
--   The live body (migration 20260923163428 harden_rpc_security_definer)
--   compared UTC CURRENT_DATE to COALESCE(MAX(daily_logs.date),
--   last_activity_date). Bugs on live:
--     1. Users west of UTC whose only activity is after ~19:05 local see UTC
--        gap = 2 at 00:05Z even though their local gap is 1, so the job
--        zeroes the streak or burns a freeze/rest token.
--     2. daily_logs.date is user-writable, so a future-dated row makes
--        MAX(date) look current and the streak is never evaluated.
--     3. A cron that spends tokens races award_xp: the same missed days are
--        charged twice, or a token is burned on a streak that then resets,
--        and the result depends on whether the cron or the claim ran first.
--
--   HARD NO: do not apply this file (or any migration) to a live database
--   from this change. Leonidas applies it later. Must be applied AFTER
--   1765800000 (needs user_profiles.streak_tz_lo_min and xp_server_now()).
--   #826 round 11 makes award_xp spend tokens on the return claim
--   (freeze first, then rest; m = GREATEST(1, p - GREATEST(last, pending)
--   - 1), counted from the last CLAIMED date). This job must not.
--
-- CLOCK
--   ZEROING uses public.xp_server_now() (clock_timestamp() in production;
--   tests pin it) at a fixed UTC-12 offset (-720 min), the earliest civil
--   date on Earth. streak_tz_lo_min is NOT used: a stored lo that lags a
--   westward DST fall-back or travel (Azores 2026-10-25, Berlin→New York)
--   would otherwise make missed look positive while the user's real local
--   day is still in progress. Eastern users may wait up to ~22h for a real
--   miss to ZERO; award_xp enforces its own liveness. Boost expiry still
--   uses now(), matching the live body.
--
-- LAZY CRON (RQ Architect)
--   Loop only rows with last_activity_date NOT NULL and current_streak > 0.
--     base   := GREATEST(last_activity_date, streak_pending_date)
--               (v2: streak_pending_date counts only when > last, exactly
--               as award_xp reads it; GREATEST ignores NULL, and a stale
--               pending <= last gives base = last)
--     missed := (UTC-12 date) - base - 1
--   Set current_streak = 0 only when
--     missed > freeze + rest
--     AND (streak_credit_at IS NULL OR now - credit_at >= 48h).
--   v2: award_xp (#826 r11) counts missed days from the last CLAIMED date,
--   so a pending date (claimed XP only) is not missed. A last-based count
--   here zeroed west-of-UTC users at e >= 48h whom the return claim would
--   still rescue with their tokens.
--   The UPDATE is guarded on last_activity_date, streak_credit_at and
--   streak_pending_date still matching the snapshot, so a concurrent
--   award_xp claim is not overwritten.
--   This function NEVER spends streak_freeze_tokens / rest_days and NEVER
--   moves last_activity_date, streak_credit_at or streak_pending_date.
--   award_xp spends tokens on the return claim. A cron that spends
--   (need-rule or one-token-per-run) burns tokens on streaks that then reset and is order-dependent with
--   the claim.
--
-- ROLLBACK
--   Source: 20260923163428 harden_rpc_security_definer (live). Paste the
--   following CREATE OR REPLACE (uncommented) to restore the live body.
--
-- CREATE OR REPLACE FUNCTION public.evaluate_user_streaks()
--  RETURNS void
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public'
-- AS $function$
-- DECLARE
--   profile RECORD;
--   latest_activity DATE;
--   days_since_activity INTEGER;
--   freeze_tokens INTEGER;
--   rest_tokens INTEGER;
-- BEGIN
--   -- Only service_role / postgres should call this (EXECUTE revoked from anon/authenticated below)
--   FOR profile IN
--     SELECT id, current_streak, last_activity_date, streak_freeze_tokens, rest_days
--     FROM public.user_profiles
--   LOOP
--     SELECT COALESCE(MAX(date), profile.last_activity_date)
--       INTO latest_activity
--     FROM public.daily_logs
--     WHERE user_id = profile.id;
--
--     IF latest_activity IS NULL THEN
--       CONTINUE;
--     END IF;
--
--     days_since_activity := (CURRENT_DATE - latest_activity);
--
--     IF days_since_activity <= 1 THEN
--       CONTINUE;
--     END IF;
--
--     freeze_tokens := COALESCE(profile.streak_freeze_tokens, 0);
--     rest_tokens := COALESCE(profile.rest_days, 0);
--
--     IF days_since_activity = 2 AND (freeze_tokens > 0 OR rest_tokens > 0) THEN
--       IF freeze_tokens > 0 THEN
--         UPDATE public.user_profiles
--         SET streak_freeze_tokens = freeze_tokens - 1, last_activity_date = CURRENT_DATE - 1
--         WHERE id = profile.id;
--       ELSE
--         UPDATE public.user_profiles
--         SET rest_days = rest_tokens - 1, last_activity_date = CURRENT_DATE - 1
--         WHERE id = profile.id;
--       END IF;
--     ELSE
--       UPDATE public.user_profiles
--       SET current_streak = 0, last_activity_date = latest_activity
--       WHERE id = profile.id;
--     END IF;
--   END LOOP;
--
--   UPDATE public.user_profiles
--   SET active_boost = NULL
--   WHERE active_boost->>'expires_at' IS NOT NULL
--     AND (active_boost->>'expires_at')::timestamptz <= now();
-- END;
-- $function$;

CREATE OR REPLACE FUNCTION public.evaluate_user_streaks()
RETURNS void AS $$
DECLARE
  profile RECORD;
  local_today_min DATE;
  missed INTEGER;
BEGIN
  -- Display-only zeroing. Never spends streak_freeze_tokens / rest_days and
  -- never moves last_activity_date, streak_credit_at or streak_pending_date:
  -- award_xp spends tokens on the return claim (m = GREATEST(1, p -
  -- GREATEST(last, pending) - 1) missed local days).
  -- Zero only when that return claim can no longer be saved:
  --   missed = (earliest civil date on Earth, UTC-12) - GREATEST(last,
  --   pending) - 1 is a lower bound on the missed local days of any future
  --   claim, so missed > freeze + rest means award_xp would reset (and
  --   missed >= 1 puts every future claim at p >= GREATEST(last, pending)
  --   + 2, out of reach of the pending bridge's pending >= p - 1); and
  --   now - streak_credit_at >= 48h rules out every award_xp bridge (e < 48h).
  FOR profile IN
    SELECT id, current_streak, last_activity_date, streak_freeze_tokens, rest_days, streak_credit_at,
           streak_pending_date
    FROM public.user_profiles
    WHERE last_activity_date IS NOT NULL AND COALESCE(current_streak, 0) > 0
  LOOP
    local_today_min := (public.xp_server_now() AT TIME ZONE 'UTC' + make_interval(mins => -720))::date;
    missed := local_today_min
              - GREATEST(profile.last_activity_date, profile.streak_pending_date) - 1;
    IF missed > COALESCE(profile.streak_freeze_tokens, 0) + COALESCE(profile.rest_days, 0)
       AND (profile.streak_credit_at IS NULL
            OR public.xp_server_now() - profile.streak_credit_at >= interval '48 hours') THEN
      UPDATE public.user_profiles
      SET current_streak = 0
      WHERE id = profile.id
        AND last_activity_date IS NOT DISTINCT FROM profile.last_activity_date
        AND streak_credit_at IS NOT DISTINCT FROM profile.streak_credit_at
        AND streak_pending_date IS NOT DISTINCT FROM profile.streak_pending_date;
    END IF;
  END LOOP;
  UPDATE public.user_profiles SET active_boost = NULL
  WHERE active_boost->>'expires_at' IS NOT NULL AND (active_boost->>'expires_at')::timestamptz <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.evaluate_user_streaks() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_user_streaks() FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_user_streaks() FROM authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.evaluate_user_streaks() TO service_role;
  END IF;
END $$;
