-- Migration: atomic gamification XP award + profile UPDATE hardening
-- Created at: 1764910000
--
-- Gamification P0s:
--  1. Atomic award_xp RPC (SECURITY DEFINER) replaces client SELECT-then-UPDATE:
--     single UPDATE with SET total_xp = total_xp + delta (no lost updates),
--     UTC-day streak computation, idempotency ledger (xp_events) with
--     UNIQUE(user_id, action, entity_id) + UNIQUE(idempotency_key) guards.
--  2. user_profiles UPDATE policy gains WITH CHECK (auth.uid() = id) in the
--     initPlan-friendly (select auth.uid()) form, so a row cannot be moved to
--     another owner. total_xp is append-only via trigger (direct decreases
--     rejected; increments and the RPC path still work, preserving the client
--     fallback).
--
-- Reversible: DROP FUNCTION public.award_xp(...); DROP TABLE public.xp_events;
-- restore the USING-only "Users can update own profile" policy; drop the
-- lock_total_xp_monotonic trigger.

-- ---------------------------------------------------------------------------
-- 1. Idempotency ledger for XP awards.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  xp INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, action, entity_id),
  UNIQUE(idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_xp_events_user_created
  ON public.xp_events(user_id, created_at DESC);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own xp events" ON public.xp_events;
CREATE POLICY "Users view own xp events"
  ON public.xp_events FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own xp events" ON public.xp_events;
CREATE POLICY "Users insert own xp events"
  ON public.xp_events FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 2. Harden user_profiles UPDATE: add WITH CHECK so rows cannot change owner.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
    CREATE POLICY "Users can update own profile"
      ON public.user_profiles FOR UPDATE
      USING ((select auth.uid()) = id)
      WITH CHECK ((select auth.uid()) = id);
  END IF;
END $$;

COMMENT ON COLUMN public.user_profiles.total_xp IS
  'Canonical writer is the award_xp RPC (atomic increment). Direct client writes must be monotonic increments only; decreases are rejected by lock_total_xp_monotonic.';

-- ---------------------------------------------------------------------------
-- 3. Append-only lock on total_xp (allows increments + RPC, blocks rewrites).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_total_xp_monotonic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The award_xp RPC sets this flag for its own atomic increment.
  IF current_setting('app.bypass_xp_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.total_xp IS DISTINCT FROM OLD.total_xp THEN
    IF NEW.total_xp IS NULL OR NEW.total_xp < 0 THEN
      RAISE EXCEPTION 'total_xp must be non-negative'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.total_xp < OLD.total_xp THEN
      RAISE EXCEPTION 'total_xp is append-only: use the award_xp RPC'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_total_xp_monotonic ON public.user_profiles;
CREATE TRIGGER lock_total_xp_monotonic
  BEFORE UPDATE OF total_xp ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_total_xp_monotonic();

-- ---------------------------------------------------------------------------
-- 4. Atomic award_xp RPC.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.award_xp(
  p_uid UUID,
  p_delta INTEGER,
  p_idempotency_key TEXT DEFAULT NULL,
  p_action TEXT DEFAULT 'generic',
  p_entity_id TEXT DEFAULT ''
)
RETURNS TABLE (
  total_xp INTEGER,
  current_level INTEGER,
  current_streak INTEGER,
  longest_streak INTEGER,
  last_activity_date DATE,
  notes_count INTEGER,
  papers_count INTEGER,
  tasks_completed_count INTEGER,
  papers_with_insights_count INTEGER,
  streak_freeze_tokens INTEGER,
  xp_credited INTEGER,
  is_duplicate BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Streaks are computed on the UTC calendar day so concurrent clients in any
  -- timezone agree with each other and with the server cron.
  v_today DATE := (now() AT TIME ZONE 'UTC')::DATE;
  v_profile public.user_profiles%ROWTYPE;
  v_days_diff INTEGER;
  v_new_streak INTEGER := 1;
  v_freeze INTEGER := 0;
  v_longest INTEGER := 0;
  v_ledger_rows INTEGER := 0;
  v_key TEXT;
  v_action TEXT := COALESCE(NULLIF(trim(COALESCE(p_action, '')), ''), 'generic');
  v_entity TEXT := COALESCE(p_entity_id, '');
  v_r_total INTEGER;
  v_r_level INTEGER;
  v_r_streak INTEGER;
  v_r_longest INTEGER;
  v_r_last DATE;
  v_r_notes INTEGER;
  v_r_papers INTEGER;
  v_r_tasks INTEGER;
  v_r_insights INTEGER;
  v_r_freeze INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_uid THEN
    RAISE EXCEPTION 'permission denied'
      USING ERRCODE = '42501';
  END IF;

  IF p_delta IS NULL OR p_delta <= 0 OR p_delta > 1000 THEN
    RAISE EXCEPTION 'invalid XP delta: %', p_delta;
  END IF;

  -- Idempotency ledger: single INSERT with ON CONFLICT DO NOTHING covers both
  -- the UNIQUE(idempotency_key) and UNIQUE(user_id, action, entity_id) guards.
  -- Only ledgered when the caller supplies a key or an entity id; legacy
  -- fire-and-forget awards (no entity) skip the ledger to avoid false dupes.
  IF p_idempotency_key IS NOT NULL OR v_entity <> '' THEN
    v_key := COALESCE(
      NULLIF(p_idempotency_key, ''),
      'auto:' || p_uid::TEXT || ':' || v_action || ':' || v_entity
    );

    INSERT INTO public.xp_events (user_id, action, entity_id, xp, idempotency_key)
    VALUES (p_uid, v_action, v_entity, p_delta, v_key)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_ledger_rows = ROW_COUNT;

    IF v_ledger_rows = 0 THEN
      -- Duplicate delivery: return current totals without crediting again.
      SELECT
        t.total_xp, (t.total_xp / 500) + 1,
        t.current_streak, t.longest_streak, t.last_activity_date,
        t.notes_count, t.papers_count, t.tasks_completed_count,
        t.papers_with_insights_count, t.streak_freeze_tokens
      INTO
        v_r_total, v_r_level,
        v_r_streak, v_r_longest, v_r_last,
        v_r_notes, v_r_papers, v_r_tasks,
        v_r_insights, v_r_freeze
      FROM public.user_profiles AS t
      WHERE t.id = p_uid;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'profile not found for user %', p_uid;
      END IF;

      total_xp := v_r_total;
      current_level := v_r_level;
      current_streak := v_r_streak;
      longest_streak := v_r_longest;
      last_activity_date := v_r_last;
      notes_count := v_r_notes;
      papers_count := v_r_papers;
      tasks_completed_count := v_r_tasks;
      papers_with_insights_count := v_r_insights;
      streak_freeze_tokens := v_r_freeze;
      xp_credited := 0;
      is_duplicate := TRUE;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- Lock the profile row so concurrent awards serialize (no lost updates).
  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = p_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found for user %', p_uid;
  END IF;

  v_freeze := COALESCE(v_profile.streak_freeze_tokens, 0);

  IF v_profile.last_activity_date IS NOT NULL THEN
    v_days_diff := v_today - v_profile.last_activity_date;

    IF v_days_diff = 0 THEN
      v_new_streak := COALESCE(v_profile.current_streak, 1);
    ELSIF v_days_diff = 1 THEN
      v_new_streak := COALESCE(v_profile.current_streak, 0) + 1;
    ELSIF v_days_diff >= 2
      AND v_freeze > 0
      AND COALESCE(v_profile.current_streak, 0) > 0 THEN
      -- Preserve a nonzero streak by consuming one freeze token.
      v_freeze := v_freeze - 1;
      v_new_streak := v_profile.current_streak;
    ELSE
      v_new_streak := 1;
    END IF;
  END IF;

  -- Grant a freeze token on each new multiple-of-7 transition.
  IF v_new_streak % 7 = 0 AND v_new_streak > COALESCE(v_profile.current_streak, 0) THEN
    v_freeze := v_freeze + 1;
  END IF;

  v_longest := GREATEST(v_new_streak, COALESCE(v_profile.longest_streak, 0));

  -- Bypass the monotonic-write trigger for our own atomic increment.
  PERFORM set_config('app.bypass_xp_guard', 'on', true);

  UPDATE public.user_profiles AS p
  SET
    total_xp = p.total_xp + p_delta,
    current_level = ((p.total_xp + p_delta) / 500) + 1,
    current_streak = v_new_streak,
    longest_streak = v_longest,
    last_activity_date = v_today,
    streak_freeze_tokens = v_freeze,
    notes_count = CASE
      WHEN v_action = 'create_note' THEN COALESCE(p.notes_count, 0) + 1
      ELSE p.notes_count
    END,
    papers_count = CASE
      WHEN v_action = 'create_paper' THEN COALESCE(p.papers_count, 0) + 1
      ELSE p.papers_count
    END,
    tasks_completed_count = CASE
      WHEN v_action = 'complete_task' THEN COALESCE(p.tasks_completed_count, 0) + 1
      ELSE p.tasks_completed_count
    END,
    papers_with_insights_count = CASE
      WHEN v_action = 'add_paper_insights' THEN COALESCE(p.papers_with_insights_count, 0) + 1
      ELSE p.papers_with_insights_count
    END
  WHERE p.id = p_uid
  RETURNING
    p.total_xp, p.current_level, p.current_streak, p.longest_streak,
    p.last_activity_date, p.notes_count, p.papers_count,
    p.tasks_completed_count, p.papers_with_insights_count,
    p.streak_freeze_tokens
  INTO
    v_r_total, v_r_level, v_r_streak,
    v_r_longest, v_r_last, v_r_notes,
    v_r_papers, v_r_tasks,
    v_r_insights, v_r_freeze;

  -- Upsert today's UTC daily log.
  INSERT INTO public.daily_logs (user_id, date, xp_earned, streak_count)
  VALUES (p_uid, v_today, p_delta, v_new_streak)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    xp_earned = public.daily_logs.xp_earned + EXCLUDED.xp_earned,
    streak_count = EXCLUDED.streak_count;

  total_xp := v_r_total;
  current_level := v_r_level;
  current_streak := v_r_streak;
  longest_streak := v_r_longest;
  last_activity_date := v_r_last;
  notes_count := v_r_notes;
  papers_count := v_r_papers;
  tasks_completed_count := v_r_tasks;
  papers_with_insights_count := v_r_insights;
  streak_freeze_tokens := v_r_freeze;
  xp_credited := p_delta;
  is_duplicate := FALSE;
  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT) IS
  'Atomic XP award: single UPDATE (no lost updates), UTC-day streaks, idempotency via xp_events. Canonical writer for user_profiles.total_xp.';
