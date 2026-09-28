-- Migration: timezone-correct evaluate_user_streaks (local-day gap, no daily_logs)
-- Created at: 1765900000
--
-- WHY THIS FILE EXISTS
--   The pg_cron job `5 0 * * *` (00:05 UTC) runs public.evaluate_user_streaks().
--   The 1764802000 definition (latest in the repo; 1765800000 did not replace
--   it) compared UTC CURRENT_DATE to COALESCE(MAX(daily_logs.date),
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
--   local_today_min uses public.xp_server_now() (clock_timestamp() in
--   production; tests pin it to 00:05Z). Equivalent to now() for a short
--   cron run. Boost expiry still uses now(), matching 1764802000.
--
-- ROLLBACK
--   The pre-change body below is copied from
--   supabase/migrations/1764802000_update_with_check_hardening.sql (the
--   latest repo definition of evaluate_user_streaks). RQ Architect should
--   diff it against the live catalog before pasting it back. Paste the
--   following CREATE OR REPLACE (uncommented) to restore:
--
-- CREATE OR REPLACE FUNCTION public.evaluate_user_streaks()
-- RETURNS void AS $$
-- DECLARE
--   profile RECORD;
--   latest_activity DATE;
--   days_since_activity INTEGER;
--   freeze_tokens INTEGER;
--   rest_tokens INTEGER;
-- BEGIN
--   FOR profile IN
--     SELECT
--       id,
--       current_streak,
--       last_activity_date,
--       streak_freeze_tokens,
--       rest_days
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
--         SET
--           streak_freeze_tokens = freeze_tokens - 1,
--           last_activity_date = CURRENT_DATE - 1
--         WHERE id = profile.id;
--       ELSE
--         UPDATE public.user_profiles
--         SET
--           rest_days = rest_tokens - 1,
--           last_activity_date = CURRENT_DATE - 1
--         WHERE id = profile.id;
--       END IF;
--     ELSE
--       UPDATE public.user_profiles
--       SET
--         current_streak = 0,
--         last_activity_date = latest_activity
--       WHERE id = profile.id;
--     END IF;
--   END LOOP;
--
--   -- Expire boosts that have run out of time
--   UPDATE public.user_profiles
--   SET active_boost = NULL
--   WHERE active_boost->>'expires_at' IS NOT NULL
--     AND (active_boost->>'expires_at')::timestamptz <= now();
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
      rest_days,
      streak_tz_lo_min
    FROM public.user_profiles
  LOOP
    IF profile.last_activity_date IS NULL THEN
      CONTINUE;
    END IF;

    -- Spec: (now() AT TIME ZONE 'UTC' + make_interval(mins => COALESCE(streak_tz_lo_min, -720)))::date
    -- xp_server_now() is clock_timestamp() live; tests replace it.
    local_today_min := (
      public.xp_server_now() AT TIME ZONE 'UTC'
      + make_interval(mins => COALESCE(profile.streak_tz_lo_min, -720))
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
        WHERE id = profile.id;
      ELSE
        UPDATE public.user_profiles
        SET
          rest_days = rest_tokens - 1,
          last_activity_date = local_today_min - 1
        WHERE id = profile.id;
      END IF;
    ELSE
      UPDATE public.user_profiles
      SET
        current_streak = 0
      WHERE id = profile.id;
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
