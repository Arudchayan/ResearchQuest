-- Migration: timezone-correct evaluate_user_streaks (local-day gap, no daily_logs)
-- Created at: 1765900000
--
-- WHY THIS FILE EXISTS
--   The pg_cron job `5 0 * * *` (00:05 UTC) runs public.evaluate_user_streaks().
--   The live body (migration 20260923163428 harden_rpc_security_definer)
--   compared UTC CURRENT_DATE to COALESCE(MAX(daily_logs.date),
--   last_activity_date). Two bugs on live:
--     1. Users west of UTC whose only activity is after ~19:05 local see UTC
--        gap = 2 at the 00:05Z run even though their local gap is 1, so the
--        job zeroes the streak or burns a freeze/rest token.
--     2. daily_logs.date is user-writable, so a future-dated row makes
--        MAX(date) look current and the streak is never evaluated.
--
--   HARD NO: do not apply this file (or any migration) to a live database
--   from this change. Leonidas applies it later. Must be applied AFTER
--   1765800000 (needs user_profiles.streak_tz_lo_min and xp_server_now()).
--
-- CLOCK
--   Miss detection uses public.xp_server_now() (clock_timestamp() in
--   production; tests pin it) at a fixed UTC-12 offset (-720 min), the
--   earliest civil date on Earth. streak_tz_lo_min is NOT used: a stored
--   lo that lags a westward DST fall-back or travel (Azores 2026-10-25,
--   Berlin→New York) would otherwise make gap=2 while the user's real
--   local day is still in progress. A miss is charged only after UTC-12
--   has finished the calendar day after last_activity_date. Eastern users
--   may wait up to ~22h for a real miss; award_xp enforces its own
--   liveness. Boost expiry still uses now(), matching the live body.
--
-- RACE
--   The FOR loop snapshots each profile row. award_xp can consume a freeze
--   and set last=D after that read. The three per-user UPDATEs therefore
--   no-op unless last_activity_date (and freeze/rest on those branches)
--   still match the snapshot.
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
  gap INTEGER;
  freeze_tokens INTEGER;
  rest_tokens INTEGER;
BEGIN
  FOR profile IN
    SELECT
      id,
      current_streak,
      last_activity_date,
      streak_freeze_tokens,
      rest_days
    FROM public.user_profiles
  LOOP
    IF profile.last_activity_date IS NULL THEN
      CONTINUE;
    END IF;

    -- Earliest civil date on Earth (UTC-12). Do not use streak_tz_lo_min:
    -- a westward DST/travel drop can leave lo east of the user's real offset.
    local_today_min := (
      public.xp_server_now() AT TIME ZONE 'UTC'
      + make_interval(mins => -720)
    )::date;

    gap := local_today_min - profile.last_activity_date;

    IF gap <= 1 THEN
      CONTINUE;
    END IF;

    freeze_tokens := COALESCE(profile.streak_freeze_tokens, 0);
    rest_tokens := COALESCE(profile.rest_days, 0);

    IF gap = 2 AND (freeze_tokens > 0 OR rest_tokens > 0) THEN
      IF freeze_tokens > 0 THEN
        UPDATE public.user_profiles
        SET
          streak_freeze_tokens = freeze_tokens - 1,
          last_activity_date = local_today_min - 1
        WHERE id = profile.id
          AND last_activity_date IS NOT DISTINCT FROM profile.last_activity_date
          AND streak_freeze_tokens = profile.streak_freeze_tokens;
      ELSE
        UPDATE public.user_profiles
        SET
          rest_days = rest_tokens - 1,
          last_activity_date = local_today_min - 1
        WHERE id = profile.id
          AND last_activity_date IS NOT DISTINCT FROM profile.last_activity_date
          AND rest_days = profile.rest_days;
      END IF;
    ELSE
      UPDATE public.user_profiles
      SET
        current_streak = 0
      WHERE id = profile.id
        AND last_activity_date IS NOT DISTINCT FROM profile.last_activity_date;
    END IF;
  END LOOP;

  -- Expire boosts that have run out of time
  UPDATE public.user_profiles
  SET active_boost = NULL
  WHERE active_boost->>'expires_at' IS NOT NULL
    AND (active_boost->>'expires_at')::timestamptz <= now();
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
