-- Migration: add gamification metadata and automated streak evaluation
-- Created at: 1763005000

-- Extend user profile metadata
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS streak_freeze_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_boost JSONB,
  ADD COLUMN IF NOT EXISTS rest_days INTEGER DEFAULT 0;

UPDATE public.user_profiles
SET
  streak_freeze_tokens = COALESCE(streak_freeze_tokens, 0),
  rest_days = COALESCE(rest_days, 0)
WHERE streak_freeze_tokens IS NULL OR rest_days IS NULL;

-- Ensure new sign ups receive the metadata defaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    username,
    total_xp,
    current_level,
    current_streak,
    longest_streak,
    last_activity_date,
    streak_freeze_tokens,
    active_boost,
    rest_days
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Researcher'),
    0,
    1,
    0,
    0,
    NULL,
    0,
    NULL,
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper to compute boost expiration and streak resilience
CREATE OR REPLACE FUNCTION public.evaluate_user_streaks()
RETURNS void AS $$
DECLARE
  profile RECORD;
  latest_activity DATE;
  days_since_activity INTEGER;
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
    SELECT COALESCE(MAX(date), profile.last_activity_date)
      INTO latest_activity
    FROM public.daily_logs
    WHERE user_id = profile.id;

    IF latest_activity IS NULL THEN
      CONTINUE;
    END IF;

    days_since_activity := (CURRENT_DATE - latest_activity);

    IF days_since_activity <= 1 THEN
      CONTINUE;
    END IF;

    freeze_tokens := COALESCE(profile.streak_freeze_tokens, 0);
    rest_tokens := COALESCE(profile.rest_days, 0);

    IF days_since_activity = 2 AND (freeze_tokens > 0 OR rest_tokens > 0) THEN
      IF freeze_tokens > 0 THEN
        UPDATE public.user_profiles
        SET
          streak_freeze_tokens = freeze_tokens - 1,
          last_activity_date = CURRENT_DATE - 1
        WHERE id = profile.id;
      ELSE
        UPDATE public.user_profiles
        SET
          rest_days = rest_tokens - 1,
          last_activity_date = CURRENT_DATE - 1
        WHERE id = profile.id;
      END IF;
    ELSE
      UPDATE public.user_profiles
      SET
        current_streak = 0,
        last_activity_date = latest_activity
      WHERE id = profile.id;
    END IF;
  END LOOP;

  -- Expire boosts that have run out of time
  UPDATE public.user_profiles
  SET active_boost = NULL
  WHERE active_boost->>'expires_at' IS NOT NULL
    AND (active_boost->>'expires_at')::timestamptz <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure pg_cron is available for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the daily streak evaluation (runs at 5 minutes past midnight UTC)
DO $$
DECLARE
  existing_job_id INTEGER;
BEGIN
  SELECT jobid INTO existing_job_id FROM cron.job WHERE jobname = 'daily-streak-evaluation';
  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule('daily-streak-evaluation', '5 0 * * *', $$SELECT public.evaluate_user_streaks();$$);
END;
$$;
