-- Migration: XP integrity hardening
-- Created at: 1765800000
--
-- WHY THIS FILE EXISTS
--   1765700000 (reconcile delta) is live. QA reproduced remaining XP-integrity
--   abuses against that definition:
--     1. Day-window burst: p_local_day ±1 of UTC keys a separate daily cap, so
--        a user who hits today's cap can collect two more caps (and +2 streak /
--        backfill) in one real day.
--     2. Client-chosen p_delta is trusted up to the cap.
--     3. Direct UPDATE user_profiles.total_xp = total_xp + N succeeds (the
--        monotonic guard only blocks decreases). set_config('app.bypass_xp_guard')
--        is a user-settable GUC, so the guard is not a privilege boundary.
--     4. award_xp increments notes_count / papers_count / … even though those
--        counters are meant to reflect real tables (1764000000 only backfilled;
--        it did not add maintaining triggers).
--     5. award_achievement_xp awards any of the 5 types with no eligibility check.
--
--   HARD NO: do not re-apply repo files 1764800000..1765300000 (no db push).
--   Apply ONLY this file via apply_migration named xp_integrity_hardening.
--
-- COUNTS
--   1764000000_add_running_counts.sql added the *_count columns and a one-shot
--   backfill. It did not create triggers on notes/papers/tasks. This file
--   therefore stops writing those columns from award_xp (so XP calls cannot
--   inflate them) and returns live COUNT(*) from the real tables on the RPC
--   row so the client achievement checks still see current totals. The stored
--   *_count columns are left to a future trigger if product wants them kept
--   in sync; they are no longer grantable to authenticated.
--
-- Column UPDATE grants (authenticated): client profile/settings writes plus
-- the updated_at trigger. Preferences: username, theme_preference,
-- auto_create_reading_tasks, active_boost, streak_freeze_tokens, rest_days,
-- updated_at.
-- Excluded: total_xp, current_level, current_streak, longest_streak,
-- Excluded: total_xp, current_level, current_streak, longest_streak,
-- last_activity_date, streak_tz_lo_min, streak_tz_hi_min, streak_tz_set_at,
-- and all *_count.
--
-- Streak tz gate: 6h, union-widen on inconsistent credited claims. The gate
-- only exists to stop two advances at the same instant. Lifetime lead is
-- already bounded because every claimed local day maps to an offset in
-- [-720, 840] and consistent claims narrow the band, so the maximum lead
-- over real time is about +1 to +2 days total, not per window.

-- ===========================================================================
-- A. Rolling-window lookup
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_xp_events_user_action_created
  ON public.xp_events (user_id, action, created_at);

-- ===========================================================================
-- B. Column privileges replace the GUC-backed total_xp guard
-- ===========================================================================

DROP TRIGGER IF EXISTS lock_total_xp_monotonic ON public.user_profiles;
DROP FUNCTION IF EXISTS public.enforce_total_xp_monotonic();

REVOKE UPDATE ON TABLE public.user_profiles FROM PUBLIC;
REVOKE UPDATE ON TABLE public.user_profiles FROM anon;
REVOKE UPDATE ON TABLE public.user_profiles FROM authenticated;
REVOKE INSERT ON TABLE public.user_profiles FROM PUBLIC;
REVOKE INSERT ON TABLE public.user_profiles FROM anon;
REVOKE INSERT ON TABLE public.user_profiles FROM authenticated;
GRANT UPDATE (
  active_boost,
  streak_freeze_tokens,
  rest_days,
  updated_at,
  username,
  theme_preference,
  auto_create_reading_tasks
)
  ON TABLE public.user_profiles TO authenticated;

GRANT SELECT ON TABLE public.user_profiles TO authenticated;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS streak_tz_lo_min integer;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS streak_tz_hi_min integer;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS streak_tz_set_at timestamptz;

COMMENT ON COLUMN public.user_profiles.streak_tz_lo_min IS
  'Inclusive UTC-offset minutes consistent with recent credited streak claims. Written only by award_xp.';
COMMENT ON COLUMN public.user_profiles.streak_tz_hi_min IS
  'Inclusive UTC-offset minutes consistent with recent credited streak claims. Written only by award_xp.';
COMMENT ON COLUMN public.user_profiles.streak_tz_set_at IS
  'Server time when streak_tz_lo_min/hi_min last changed, or when the streak last advanced or the band last union-widened. Written only by award_xp.';

-- Test-replaceable clock. Production is clock_timestamp(); tests CREATE OR
-- REPLACE this function as table owner. Not a GUC. Authenticated cannot
-- replace it.
CREATE OR REPLACE FUNCTION public.xp_server_now()
RETURNS timestamptz
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$ SELECT clock_timestamp(); $$;

REVOKE ALL ON FUNCTION public.xp_server_now() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xp_server_now() FROM anon;
REVOKE ALL ON FUNCTION public.xp_server_now() FROM authenticated;
REVOKE ALL ON FUNCTION public.xp_server_now() FROM service_role;

COMMENT ON COLUMN public.user_profiles.total_xp IS
  'Canonical writers: award_xp / award_achievement_xp (SECURITY DEFINER, table owner). Authenticated has no UPDATE privilege on this column.';

-- Profiles are created by handle_new_user (DEFINER). Authenticated may
-- decrement freeze tokens / rest days (consumeFreeze / useRestDay) but must
-- not mint them. Role check, not a GUC, so owner-running DEFINER RPCs are
-- unaffected.
CREATE OR REPLACE FUNCTION public.enforce_freeze_rest_no_mint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (
       COALESCE(NEW.streak_freeze_tokens, 0) > COALESCE(OLD.streak_freeze_tokens, 0)
       OR COALESCE(NEW.rest_days, 0) > COALESCE(OLD.rest_days, 0)
     ) THEN
    RAISE EXCEPTION 'cannot mint streak freeze tokens or rest days'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_freeze_rest_no_mint() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_freeze_rest_no_mint() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_freeze_rest_no_mint() FROM authenticated;

DROP TRIGGER IF EXISTS lock_freeze_rest_no_mint ON public.user_profiles;
CREATE TRIGGER lock_freeze_rest_no_mint
  BEFORE UPDATE OF streak_freeze_tokens, rest_days ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_freeze_rest_no_mint();

UPDATE public.user_profiles
SET streak_freeze_tokens = 0
WHERE streak_freeze_tokens IS NULL OR streak_freeze_tokens < 0;
UPDATE public.user_profiles
SET rest_days = 0
WHERE rest_days IS NULL OR rest_days < 0;

ALTER TABLE public.user_profiles
  ALTER COLUMN streak_freeze_tokens SET DEFAULT 0,
  ALTER COLUMN rest_days SET DEFAULT 0;
ALTER TABLE public.user_profiles
  ALTER COLUMN streak_freeze_tokens SET NOT NULL,
  ALTER COLUMN rest_days SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_streak_freeze_tokens_nonnegative'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_streak_freeze_tokens_nonnegative
      CHECK (streak_freeze_tokens >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_rest_days_nonnegative'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_rest_days_nonnegative
      CHECK (rest_days >= 0) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.user_profiles
  VALIDATE CONSTRAINT user_profiles_streak_freeze_tokens_nonnegative;
ALTER TABLE public.user_profiles
  VALIDATE CONSTRAINT user_profiles_rest_days_nonnegative;

-- SELECT policies stay owner-scoped (1765700000 WITH CHECK on UPDATE remains
-- for the columns that are still grantable).
DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
    CREATE POLICY "Users can view own profile"
      ON public.user_profiles FOR SELECT
      USING ((select auth.uid()) = id);
  END IF;
END $$;

-- ===========================================================================
-- C. Ledger writes only inside DEFINER functions
-- ===========================================================================

DROP POLICY IF EXISTS "Users can insert own achievements" ON public.research_achievements;
DROP POLICY IF EXISTS "Users can update own achievements" ON public.research_achievements;
DROP POLICY IF EXISTS "Users can delete own achievements" ON public.research_achievements;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.research_achievements FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.research_achievements FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.research_achievements FROM authenticated;
GRANT SELECT ON TABLE public.research_achievements TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.xp_events FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.xp_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.xp_events FROM authenticated;
GRANT SELECT ON TABLE public.xp_events TO authenticated;

-- ===========================================================================
-- D. award_xp: server mapping, 24h cap, timezone-consistent streak, no count writes
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.award_xp(
  p_uid UUID,
  p_delta INTEGER,
  p_idempotency_key TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT '',
  p_local_day DATE DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL
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
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_now TIMESTAMPTZ := public.xp_server_now();
  v_utc_day DATE := (v_now AT TIME ZONE 'UTC')::DATE;
  v_today DATE;
  v_profile public.user_profiles%ROWTYPE;
  v_new_streak INTEGER := 0;
  v_freeze INTEGER := 0;
  v_longest INTEGER := 0;
  v_ledger_rows INTEGER := 0;
  v_key TEXT;
  v_action TEXT := COALESCE(NULLIF(trim(COALESCE(p_action, '')), ''), 'unknown');
  v_entity TEXT := COALESCE(p_entity_id, '');
  v_credited INTEGER;
  v_server_xp INTEGER;
  v_cap INTEGER;
  v_used_today INTEGER;
  v_used_24h INTEGER;
  v_duration INTEGER;
  v_last_award TIMESTAMPTZ;
  v_last DATE;
  v_p_start TIMESTAMPTZ;
  v_p_end TIMESTAMPTZ;
  v_raw_lo NUMERIC;
  v_raw_hi NUMERIC;
  v_claim_lo INTEGER;
  v_claim_hi INTEGER;
  v_w_lo INTEGER;
  v_w_hi INTEGER;
  v_n_lo INTEGER;
  v_n_hi INTEGER;
  v_tz_lo INTEGER;
  v_tz_hi INTEGER;
  v_tz_set_at TIMESTAMPTZ;
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
  v_apply_streak BOOLEAN := FALSE;
  v_gate_open BOOLEAN;
BEGIN
  IF v_uid IS NULL OR p_uid IS NULL OR p_uid <> v_uid THEN
    RAISE EXCEPTION 'permission denied'
      USING ERRCODE = '42501';
  END IF;

  IF p_delta IS NULL OR p_delta < 0 OR p_delta > 1000 THEN
    RAISE EXCEPTION 'invalid XP delta: %', p_delta
      USING ERRCODE = '22023';
  END IF;

  IF length(v_action) > 64 OR length(v_entity) > 256
     OR length(COALESCE(p_idempotency_key, '')) > 512 THEN
    RAISE EXCEPTION 'invalid award_xp argument length'
      USING ERRCODE = '22023';
  END IF;

  -- Keep ±1 local-day tolerance for timezones, but never treat a date
  -- outside that window as authoritative.
  IF p_local_day IS NOT NULL
     AND p_local_day >= v_utc_day - 1
     AND p_local_day <= v_utc_day + 1 THEN
    v_today := p_local_day;
  ELSE
    v_today := v_utc_day;
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found for user %', v_uid;
  END IF;

  -- Server-owned XP per action (mirrors XP_REWARDS). Unknown → 0.
  IF v_action = 'complete_focus_session' THEN
    IF p_duration_minutes IS NULL THEN
      v_server_xp := 0;
    ELSE
      v_duration := GREATEST(0, LEAST(p_duration_minutes, 1440));
      IF v_duration < 25 THEN
        v_server_xp := 0;
      ELSE
        v_server_xp := v_duration * 2;
      END IF;
    END IF;
  ELSE
    v_server_xp := CASE v_action
      WHEN 'create_note' THEN 10
      WHEN 'update_note' THEN 0
      WHEN 'create_paper' THEN 15
      WHEN 'update_paper_status' THEN 10
      WHEN 'add_paper_insights' THEN 15
      WHEN 'create_idea' THEN 20
      WHEN 'advance_idea_stage' THEN 25
      WHEN 'create_task' THEN 5
      WHEN 'complete_task' THEN 20
      WHEN 'daily_task_completion' THEN 10
      WHEN 'create_topic' THEN 15
      WHEN 'update_topic' THEN 8
      WHEN 'tag_entity_with_topic' THEN 6
      WHEN 'complete_topic_quest' THEN 30
      ELSE 0
    END;
  END IF;

  v_credited := GREATEST(0, LEAST(p_delta, v_server_xp));

  v_cap := CASE v_action
    WHEN 'create_note' THEN 100
    WHEN 'update_note' THEN 0
    WHEN 'create_paper' THEN 150
    WHEN 'update_paper_status' THEN 100
    WHEN 'add_paper_insights' THEN 150
    WHEN 'create_idea' THEN 200
    WHEN 'advance_idea_stage' THEN 250
    WHEN 'create_task' THEN 100
    WHEN 'complete_task' THEN 200
    WHEN 'daily_task_completion' THEN 100
    WHEN 'create_topic' THEN 150
    WHEN 'update_topic' THEN 80
    WHEN 'tag_entity_with_topic' THEN 60
    WHEN 'complete_topic_quest' THEN 300
    WHEN 'complete_focus_session' THEN 240
    ELSE 0
  END;

  SELECT COALESCE(SUM(e.xp), 0) INTO v_used_today
  FROM public.xp_events AS e
  WHERE e.user_id = v_uid
    AND e.action = v_action
    AND e.local_day = v_today;

  SELECT COALESCE(SUM(e.xp), 0) INTO v_used_24h
  FROM public.xp_events AS e
  WHERE e.user_id = v_uid
    AND e.action = v_action
    AND e.created_at > v_now - interval '24 hours';

  v_credited := GREATEST(
    0,
    LEAST(v_credited, v_cap - v_used_today, v_cap - v_used_24h)
  );

  IF v_action = 'complete_focus_session' AND v_credited > 0 THEN
    SELECT max(e.created_at) INTO v_last_award
    FROM public.xp_events AS e
    WHERE e.user_id = v_uid
      AND e.action = 'complete_focus_session'
      AND e.xp > 0;

    IF v_last_award IS NOT NULL
       AND EXTRACT(EPOCH FROM (v_now - v_last_award)) < 300 THEN
      v_credited := 0;
    END IF;
  END IF;

  IF NULLIF(p_idempotency_key, '') IS NOT NULL OR v_entity <> '' THEN
    v_key := COALESCE(
      NULLIF(p_idempotency_key, ''),
      'auto:' || v_uid::TEXT || ':' || v_action || ':' || v_entity
    );

    INSERT INTO public.xp_events (user_id, action, entity_id, xp, idempotency_key, local_day, created_at)
    VALUES (v_uid, v_action, v_entity, v_credited, v_key, v_today, v_now)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_ledger_rows = ROW_COUNT;

    IF v_ledger_rows = 0 THEN
      SELECT count(*)::integer INTO v_r_notes FROM public.notes AS n WHERE n.user_id = v_uid;
      SELECT count(*)::integer INTO v_r_papers FROM public.papers AS p WHERE p.user_id = v_uid;
      SELECT count(*)::integer INTO v_r_tasks FROM public.tasks AS t WHERE t.user_id = v_uid AND t.completed IS TRUE;
      SELECT count(*)::integer INTO v_r_insights FROM public.papers AS p WHERE p.user_id = v_uid AND NULLIF(btrim(p.key_insights), '') IS NOT NULL;

      total_xp := v_profile.total_xp;
      current_level := (COALESCE(v_profile.total_xp, 0) / 500) + 1;
      current_streak := v_profile.current_streak;
      longest_streak := v_profile.longest_streak;
      last_activity_date := v_profile.last_activity_date;
      notes_count := v_r_notes;
      papers_count := v_r_papers;
      tasks_completed_count := v_r_tasks;
      papers_with_insights_count := v_r_insights;
      streak_freeze_tokens := v_profile.streak_freeze_tokens;
      xp_credited := 0;
      is_duplicate := TRUE;
      RETURN NEXT;
      RETURN;
    END IF;
  ELSIF v_credited > 0 THEN
    INSERT INTO public.xp_events (user_id, action, entity_id, xp, idempotency_key, local_day, created_at)
    VALUES (v_uid, v_action, '', v_credited, NULL, v_today, v_now);
  END IF;

  SELECT count(*)::integer INTO v_r_notes FROM public.notes AS n WHERE n.user_id = v_uid;
  SELECT count(*)::integer INTO v_r_papers FROM public.papers AS p WHERE p.user_id = v_uid;
  SELECT count(*)::integer INTO v_r_tasks FROM public.tasks AS t WHERE t.user_id = v_uid AND t.completed IS TRUE;
  SELECT count(*)::integer INTO v_r_insights FROM public.papers AS p WHERE p.user_id = v_uid AND NULLIF(btrim(p.key_insights), '') IS NOT NULL;

  -- Zero-credit awards never touch streak, last_activity, freeze, or tz.
  IF v_credited <= 0 THEN
    total_xp := v_profile.total_xp;
    current_level := (COALESCE(v_profile.total_xp, 0) / 500) + 1;
    current_streak := v_profile.current_streak;
    longest_streak := v_profile.longest_streak;
    last_activity_date := v_profile.last_activity_date;
    notes_count := v_r_notes;
    papers_count := v_r_papers;
    tasks_completed_count := v_r_tasks;
    papers_with_insights_count := v_r_insights;
    streak_freeze_tokens := v_profile.streak_freeze_tokens;
    xp_credited := 0;
    is_duplicate := FALSE;
    RETURN NEXT;
    RETURN;
  END IF;

  v_p_start := v_today::timestamp AT TIME ZONE 'UTC';
  v_p_end := (v_today + 1)::timestamp AT TIME ZONE 'UTC';
  v_raw_lo := EXTRACT(EPOCH FROM (v_p_start - v_now)) / 60.0;
  v_raw_hi := EXTRACT(EPOCH FROM (v_p_end - v_now)) / 60.0;
  v_claim_lo := GREATEST(-720, CEILING(v_raw_lo)::integer);
  v_claim_hi := LEAST(840, FLOOR(v_raw_hi - 0.0000001)::integer);

  v_tz_lo := v_profile.streak_tz_lo_min;
  v_tz_hi := v_profile.streak_tz_hi_min;
  v_tz_set_at := v_profile.streak_tz_set_at;
  v_freeze := COALESCE(v_profile.streak_freeze_tokens, 0);
  v_last := v_profile.last_activity_date;
  v_new_streak := COALESCE(v_profile.current_streak, 0);

  -- Self-heal: no streak left to protect. A feasible claim starts fresh so a
  -- relocator or reset user cannot stay locked to a stale interval.
  IF v_claim_lo <= v_claim_hi
     AND (
       v_new_streak = 0
       OR v_last IS NULL
       OR v_last < v_today - 2
     ) THEN
    v_tz_lo := v_claim_lo;
    v_tz_hi := v_claim_hi;
    v_tz_set_at := v_now;
    v_new_streak := 1;
    v_last := v_today;
    v_apply_streak := TRUE;
  ELSE
    -- Gate exists only to stop two advances in the same instant. Lifetime
    -- lead is already bounded: every claimed local day maps to an offset in
    -- [-720, 840], and consistent claims narrow the band, so the maximum
    -- lead over real time is about +1 to +2 days total, not per window.
    -- A 9h flight in 13h is a normal move; do not magnitude-cap the widen.
    IF v_tz_lo IS NULL OR v_tz_hi IS NULL THEN
      v_w_lo := -720;
      v_w_hi := 840;
    ELSE
      v_w_lo := v_tz_lo;
      v_w_hi := v_tz_hi;
    END IF;

    v_n_lo := GREATEST(v_w_lo, v_claim_lo);
    v_n_hi := LEAST(v_w_hi, v_claim_hi);
    v_gate_open := (
      v_tz_set_at IS NULL
      OR (v_now - v_tz_set_at) >= interval '6 hours'
    );

    -- Credited inconsistent claim, gate open (>= 6h): union the stored band
    -- with this claim's interval, clamp, stamp set_at, then evaluate N
    -- against the widened band. Gate closed (< 6h): XP only, no widen, no
    -- advance, never reset.
    IF v_claim_lo <= v_claim_hi
       AND v_n_lo > v_n_hi
       AND v_tz_lo IS NOT NULL
       AND v_tz_hi IS NOT NULL
       AND v_gate_open THEN
      v_tz_lo := GREATEST(-720, LEAST(v_tz_lo, v_claim_lo));
      v_tz_hi := LEAST(840, GREATEST(v_tz_hi, v_claim_hi));
      v_tz_set_at := v_now;
      v_w_lo := v_tz_lo;
      v_w_hi := v_tz_hi;
      v_n_lo := GREATEST(v_w_lo, v_claim_lo);
      v_n_hi := LEAST(v_w_hi, v_claim_hi);
    END IF;

    -- Inclusive N: any overlap of 0 or more integer minutes (n_lo <= n_hi)
    -- is consistent, including a shared midnight minute (UTC+2 [30,120] at
    -- 22:00:30Z → N=[120,120]; UTC+14 [780,840] at 10:00:30Z → N=[840,840]).
    -- Same-instant adjacent local days still have n_lo > n_hi because claim
    -- windows are half-open, which is the burst cap (X1, 11:00 D-1/D/D+1,
    -- full-range D/D+1/D+2).
    IF v_claim_lo <= v_claim_hi AND v_n_lo <= v_n_hi THEN
      IF v_tz_lo IS DISTINCT FROM v_n_lo OR v_tz_hi IS DISTINCT FROM v_n_hi THEN
        v_tz_set_at := v_now;
      END IF;
      v_tz_lo := v_n_lo;
      v_tz_hi := v_n_hi;
      -- Stamp set_at on every advance (v_today > v_last), even when N equals
      -- the stored interval. Narrowing on advance makes a same-instant D+1
      -- claim empty, which is the burst cap (including after a union widen).
      IF v_last IS NULL THEN
        v_new_streak := 1;
        v_last := v_today;
        v_tz_set_at := v_now;
      ELSIF v_today < v_last THEN
        NULL;
      ELSIF v_today = v_last THEN
        NULL;
      ELSIF v_today = v_last + 1 THEN
        v_new_streak := v_new_streak + 1;
        v_last := v_today;
        v_tz_set_at := v_now;
      ELSIF v_freeze > 0 AND v_new_streak > 0 THEN
        v_freeze := v_freeze - 1;
        v_last := v_today;
        v_tz_set_at := v_now;
      ELSE
        v_new_streak := 1;
        v_last := v_today;
        v_tz_set_at := v_now;
      END IF;
      v_apply_streak := TRUE;
    END IF;
  END IF;

  IF v_apply_streak THEN
    IF v_new_streak % 7 = 0 AND v_new_streak > COALESCE(v_profile.current_streak, 0) THEN
      v_freeze := v_freeze + 1;
    END IF;

    v_longest := GREATEST(v_new_streak, COALESCE(v_profile.longest_streak, 0));

    UPDATE public.user_profiles AS p
    SET
      total_xp = COALESCE(p.total_xp, 0) + v_credited,
      current_level = ((COALESCE(p.total_xp, 0) + v_credited) / 500) + 1,
      current_streak = v_new_streak,
      longest_streak = v_longest,
      last_activity_date = v_last,
      streak_freeze_tokens = v_freeze,
      streak_tz_lo_min = v_tz_lo,
      streak_tz_hi_min = v_tz_hi,
      streak_tz_set_at = v_tz_set_at
    WHERE p.id = v_uid
    RETURNING
      p.total_xp, p.current_level, p.current_streak, p.longest_streak,
      p.last_activity_date, p.streak_freeze_tokens
    INTO
      v_r_total, v_r_level, v_r_streak,
      v_r_longest, v_r_last, v_r_freeze;

    INSERT INTO public.daily_logs AS d (user_id, date, xp_earned, streak_count)
    VALUES (v_uid, v_today, v_credited, v_new_streak)
    ON CONFLICT (user_id, date)
    DO UPDATE SET
      xp_earned = COALESCE(d.xp_earned, 0) + EXCLUDED.xp_earned,
      streak_count = EXCLUDED.streak_count;
  ELSE
    -- Empty or inconsistent N with the 6h gate closed: credit XP only.
    -- No streak, last, freeze, daily_logs, or tz-band change.
    UPDATE public.user_profiles AS p
    SET
      total_xp = COALESCE(p.total_xp, 0) + v_credited,
      current_level = ((COALESCE(p.total_xp, 0) + v_credited) / 500) + 1
    WHERE p.id = v_uid
    RETURNING
      p.total_xp, p.current_level, p.current_streak, p.longest_streak,
      p.last_activity_date, p.streak_freeze_tokens
    INTO
      v_r_total, v_r_level, v_r_streak,
      v_r_longest, v_r_last, v_r_freeze;
  END IF;

  SELECT count(*)::integer INTO v_r_notes FROM public.notes AS n WHERE n.user_id = v_uid;
  SELECT count(*)::integer INTO v_r_papers FROM public.papers AS p WHERE p.user_id = v_uid;
  SELECT count(*)::integer INTO v_r_tasks FROM public.tasks AS t WHERE t.user_id = v_uid AND t.completed IS TRUE;
  SELECT count(*)::integer INTO v_r_insights FROM public.papers AS p WHERE p.user_id = v_uid AND NULLIF(btrim(p.key_insights), '') IS NOT NULL;

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
  xp_credited := v_credited;
  is_duplicate := FALSE;
  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) TO service_role;

COMMENT ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) IS
  'Atomic XP award for auth.uid() only. Credits least(p_delta, server XP_REWARDS mapping); unknown actions 0. Local-day ±1 plus rolling 24h cap. Streak updates on credited timezone-consistent awards; empty or inconsistent N with the 6h gate closed credits XP without touching streak, last_activity_date, freeze, daily_logs, or the tz band. An inconsistent credited claim with the gate open (>= 6h, or set_at NULL) unions the stored band with the claim interval (clamped to [-720, 840]) and then applies normal streak rules. Consistent claims narrow the band. Streak advance and widen both refresh streak_tz_set_at. A credited feasible claim self-heals to streak 1 when current_streak is 0 or last_activity_date is NULL or more than 2 days before p. Does not write *_count columns.';

-- ===========================================================================
-- E. award_achievement_xp: catalogue XP + real-table eligibility
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.award_achievement_xp(
  p_achievement_type TEXT,
  p_xp INTEGER DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_xp INTEGER,
  current_level INTEGER,
  xp_credited INTEGER,
  is_duplicate BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_type TEXT := trim(COALESCE(p_achievement_type, ''));
  v_xp INTEGER;
  v_title TEXT;
  v_description TEXT;
  v_rows INTEGER := 0;
  v_eligible BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'permission denied'
      USING ERRCODE = '42501';
  END IF;

  CASE v_type
    WHEN 'first_paper' THEN
      v_xp := 50;  v_title := 'First Paper';       v_description := 'Added your first research paper';
    WHEN 'research_streak_7' THEN
      v_xp := 100; v_title := 'Research Streak';   v_description := '7 days consecutive research activity';
    WHEN 'note_master' THEN
      v_xp := 200; v_title := 'Note Master';       v_description := 'Written 50 notes';
    WHEN 'task_warrior' THEN
      v_xp := 150; v_title := 'Task Warrior';      v_description := 'Completed 25 tasks';
    WHEN 'insight_collector' THEN
      v_xp := 120; v_title := 'Insight Collector'; v_description := 'Added insights from 10 papers';
    ELSE
      RAISE EXCEPTION 'unknown achievement type: %', left(v_type, 64)
        USING ERRCODE = '22023';
  END CASE;

  IF EXISTS (
    SELECT 1
    FROM public.research_achievements AS ra
    WHERE ra.user_id = v_uid AND ra.achievement_type = v_type
  ) THEN
    SELECT t.total_xp, (COALESCE(t.total_xp, 0) / 500) + 1
    INTO total_xp, current_level
    FROM public.user_profiles AS t
    WHERE t.id = v_uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'profile not found for user %', v_uid;
    END IF;

    xp_credited := 0;
    is_duplicate := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;

  v_eligible := CASE v_type
    WHEN 'first_paper' THEN
      EXISTS (SELECT 1 FROM public.papers AS p WHERE p.user_id = v_uid)
    WHEN 'research_streak_7' THEN
      COALESCE((SELECT p.current_streak FROM public.user_profiles AS p WHERE p.id = v_uid), 0) >= 7
    WHEN 'note_master' THEN
      (SELECT count(*) FROM public.notes AS n WHERE n.user_id = v_uid) >= 50
    WHEN 'task_warrior' THEN
      (SELECT count(*) FROM public.tasks AS t WHERE t.user_id = v_uid AND t.completed IS TRUE) >= 25
    WHEN 'insight_collector' THEN
      (SELECT count(*) FROM public.papers AS p WHERE p.user_id = v_uid AND NULLIF(btrim(p.key_insights), '') IS NOT NULL) >= 10
    ELSE
      FALSE
  END;

  IF NOT v_eligible THEN
    RAISE EXCEPTION 'achievement eligibility not met: %', v_type
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.research_achievements AS ra
    (user_id, achievement_type, title, description, xp_awarded)
  VALUES (v_uid, v_type, v_title, v_description, v_xp)
  ON CONFLICT (user_id, achievement_type) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    SELECT t.total_xp, (COALESCE(t.total_xp, 0) / 500) + 1
    INTO total_xp, current_level
    FROM public.user_profiles AS t
    WHERE t.id = v_uid;

    xp_credited := 0;
    is_duplicate := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.user_profiles AS p
  SET
    total_xp = COALESCE(p.total_xp, 0) + v_xp,
    current_level = ((COALESCE(p.total_xp, 0) + v_xp) / 500) + 1
  WHERE p.id = v_uid
  RETURNING p.total_xp, p.current_level
  INTO total_xp, current_level;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found for user %', v_uid;
  END IF;

  xp_credited := v_xp;
  is_duplicate := FALSE;
  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) IS
  'Atomic one-time achievement award for auth.uid(): server catalogue XP (p_xp ignored), eligibility from notes/papers/tasks/streak, one row per (user, type).';

-- Defence-in-depth: TRUNCATE ignores RLS. MAINTAIN (PG17+) lets a client
-- LOCK TABLE in any mode, VACUUM, or REINDEX; revoking it removes those.
-- A role with UPDATE or DELETE can still take row-exclusive locks; that
-- path is not reachable through PostgREST. Client and edge only
-- SELECT/UPDATE user_profiles; account deletion is auth.users CASCADE /
-- DEFINER, not a client DELETE on this table.
REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;
REVOKE DELETE ON TABLE public.user_profiles FROM anon, authenticated;

DO $$
DECLARE
  v_owner name;
BEGIN
  SELECT pg_get_userbyid(c.relowner) INTO v_owner
  FROM pg_class AS c
  WHERE c.oid = 'public.user_profiles'::regclass;
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public '
    || 'REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLES FROM anon, authenticated',
    v_owner
  );
END $$;

-- Rollback (manual, do not run in this file). Self-contained restore of the
-- 1765700000 definitions this migration replaced. Apply as a single script.
-- Does not re-apply the rest of 1765700000.
--
-- Tighter than pre-migration on purpose: this rollback does not GRANT
-- INSERT/UPDATE on user_profiles or research_achievements to anon.
--
-- Do not GRANT INSERT/UPDATE/DELETE on public.xp_events to authenticated.
-- 1765700000 already left that table SELECT-only; restoring writes would
-- reopen ledger forgery.
--
-- MAINTAIN is a PG17+ privilege keyword (live is 17.6). Revoking it
-- removes LOCK TABLE-via-MAINTAIN, VACUUM, and REINDEX. A role with
-- UPDATE or DELETE can still take row-exclusive locks; that is not
-- reachable through PostgREST. The per-table GRANT below is version-
-- guarded like 1765700000 section K. ALTER DEFAULT PRIVILEGES keeps
-- MAINTAIN as written (postgres-owned new tables).
--
--   DROP TRIGGER IF EXISTS lock_freeze_rest_no_mint ON public.user_profiles;
--   DROP FUNCTION IF EXISTS public.enforce_freeze_rest_no_mint();
--   ALTER TABLE public.user_profiles
--     DROP CONSTRAINT IF EXISTS user_profiles_streak_freeze_tokens_nonnegative;
--   ALTER TABLE public.user_profiles
--     DROP CONSTRAINT IF EXISTS user_profiles_rest_days_nonnegative;
--
--   GRANT UPDATE ON TABLE public.user_profiles TO authenticated;
--   GRANT INSERT ON TABLE public.user_profiles TO authenticated;
--   GRANT DELETE ON TABLE public.user_profiles TO anon, authenticated;
--
--   GRANT INSERT, UPDATE, DELETE ON TABLE public.research_achievements TO authenticated;
--
--   DROP POLICY IF EXISTS "Users can insert own achievements" ON public.research_achievements;
--   CREATE POLICY "Users can insert own achievements"
--     ON public.research_achievements FOR INSERT
--     WITH CHECK ((select auth.uid()) = user_id);
--   DROP POLICY IF EXISTS "Users can update own achievements" ON public.research_achievements;
--   CREATE POLICY "Users can update own achievements"
--     ON public.research_achievements FOR UPDATE
--     USING ((select auth.uid()) = user_id)
--     WITH CHECK ((select auth.uid()) = user_id);
--   DROP POLICY IF EXISTS "Users can delete own achievements" ON public.research_achievements;
--   CREATE POLICY "Users can delete own achievements"
--     ON public.research_achievements FOR DELETE
--     USING ((select auth.uid()) = user_id);
--
--   -- Inverse of the ALL-tables TRUNCATE/TRIGGER/REFERENCES/MAINTAIN revoke,
--   -- omitting public.xp_events and the 7 atlas_* tables. Before this
--   -- migration: anon has no privileges on those; authenticated has only
--   -- SELECT on xp_events; authenticated has only SELECT/INSERT/UPDATE/DELETE
--   -- on atlas_* (no TRUNCATE/TRIGGER/REFERENCES/MAINTAIN).
--   DO $rb$
--   DECLARE
--     t text;
--     privs text := 'TRUNCATE, TRIGGER, REFERENCES';
--   BEGIN
--     IF current_setting('server_version_num')::integer >= 170000 THEN
--       privs := privs || ', MAINTAIN';
--     END IF;
--     FOR t IN
--       SELECT c.relname
--       FROM pg_class AS c
--       JOIN pg_namespace AS n ON n.oid = c.relnamespace
--       WHERE n.nspname = 'public'
--         AND c.relkind = 'r'
--         AND c.relname NOT IN (
--           'xp_events',
--           'atlas_identities',
--           'atlas_progress_snapshots',
--           'atlas_proof_drafts',
--           'atlas_fresh_check_attempts',
--           'atlas_validation_sessions',
--           'atlas_validation_scores',
--           'atlas_link_checks'
--         )
--     LOOP
--       EXECUTE format(
--         'GRANT %s ON TABLE public.%I TO anon, authenticated',
--         privs, t
--       );
--     END LOOP;
--   END
--   $rb$;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLES TO anon, authenticated;
--
--   ALTER TABLE public.user_profiles
--     DROP COLUMN IF EXISTS streak_tz_lo_min,
--     DROP COLUMN IF EXISTS streak_tz_hi_min,
--     DROP COLUMN IF EXISTS streak_tz_set_at;
--   DROP FUNCTION IF EXISTS public.xp_server_now();
--
--   DROP INDEX IF EXISTS public.idx_xp_events_user_action_created;
--
-- 1765700000 enforce_total_xp_monotonic (restore GUC-backed trigger):
--   CREATE OR REPLACE FUNCTION public.enforce_total_xp_monotonic()
--   RETURNS TRIGGER
--   LANGUAGE plpgsql
--   SECURITY INVOKER
--   SET search_path = public
--   AS $$
--   BEGIN
--     -- award_xp / award_achievement_xp set this transaction-local flag around
--     -- their own atomic increment and clear it right after.
--     IF current_setting('app.bypass_xp_guard', true) = 'on' THEN
--       RETURN NEW;
--     END IF;
--
--     IF NEW.total_xp IS DISTINCT FROM OLD.total_xp THEN
--       IF NEW.total_xp IS NULL OR NEW.total_xp < 0 THEN
--         RAISE EXCEPTION 'total_xp must be non-negative'
--           USING ERRCODE = '42501';
--       END IF;
--       IF NEW.total_xp < OLD.total_xp THEN
--         RAISE EXCEPTION 'total_xp is append-only: use the award_xp RPC'
--           USING ERRCODE = '42501';
--       END IF;
--     END IF;
--
--     RETURN NEW;
--   END;
--   $$;
--
--   REVOKE ALL ON FUNCTION public.enforce_total_xp_monotonic() FROM PUBLIC;
--   REVOKE ALL ON FUNCTION public.enforce_total_xp_monotonic() FROM anon;
--   REVOKE ALL ON FUNCTION public.enforce_total_xp_monotonic() FROM authenticated;
--   DROP TRIGGER IF EXISTS lock_total_xp_monotonic ON public.user_profiles;
--   CREATE TRIGGER lock_total_xp_monotonic
--     BEFORE UPDATE OF total_xp ON public.user_profiles
--     FOR EACH ROW EXECUTE FUNCTION public.enforce_total_xp_monotonic();
--
--   COMMENT ON COLUMN public.user_profiles.total_xp IS
--     'Canonical writers: award_xp / award_achievement_xp RPCs (atomic increment). Direct decreases are rejected by lock_total_xp_monotonic.';
--
-- 1765700000 award_xp body (CREATE OR REPLACE; signature/return types match):
--   CREATE OR REPLACE FUNCTION public.award_xp(
--     p_uid UUID,
--     p_delta INTEGER,
--     p_idempotency_key TEXT DEFAULT NULL,
--     p_action TEXT DEFAULT NULL,
--     p_entity_id TEXT DEFAULT '',
--     p_local_day DATE DEFAULT NULL,
--     p_duration_minutes INTEGER DEFAULT NULL
--   )
--   RETURNS TABLE (
--     total_xp INTEGER,
--     current_level INTEGER,
--     current_streak INTEGER,
--     longest_streak INTEGER,
--     last_activity_date DATE,
--     notes_count INTEGER,
--     papers_count INTEGER,
--     tasks_completed_count INTEGER,
--     papers_with_insights_count INTEGER,
--     streak_freeze_tokens INTEGER,
--     xp_credited INTEGER,
--     is_duplicate BOOLEAN
--   )
--   LANGUAGE plpgsql
--   SECURITY DEFINER
--   SET search_path = public
--   AS $$
--   DECLARE
--     v_uid UUID := auth.uid();
--     v_utc_day DATE := (now() AT TIME ZONE 'UTC')::DATE;
--     v_today DATE;
--     v_profile public.user_profiles%ROWTYPE;
--     v_days_diff INTEGER;
--     v_new_streak INTEGER := 1;
--     v_freeze INTEGER := 0;
--     v_longest INTEGER := 0;
--     v_ledger_rows INTEGER := 0;
--     v_key TEXT;
--     v_action TEXT := COALESCE(NULLIF(trim(COALESCE(p_action, '')), ''), 'unknown');
--     v_entity TEXT := COALESCE(p_entity_id, '');
--     v_credited INTEGER;
--     v_cap INTEGER;
--     v_used_today INTEGER;
--     v_duration INTEGER;
--     v_last_award TIMESTAMPTZ;
--     v_r_total INTEGER;
--     v_r_level INTEGER;
--     v_r_streak INTEGER;
--     v_r_longest INTEGER;
--     v_r_last DATE;
--     v_r_notes INTEGER;
--     v_r_papers INTEGER;
--     v_r_tasks INTEGER;
--     v_r_insights INTEGER;
--     v_r_freeze INTEGER;
--   BEGIN
--     -- Caller must be authenticated and may only award itself.
--     IF v_uid IS NULL OR p_uid IS NULL OR p_uid <> v_uid THEN
--       RAISE EXCEPTION 'permission denied'
--         USING ERRCODE = '42501';
--     END IF;
--
--     -- 0 is a valid no-op credit (e.g. update_note); NULL / negative / absurd
--     -- deltas are rejected.
--     IF p_delta IS NULL OR p_delta < 0 OR p_delta > 1000 THEN
--       RAISE EXCEPTION 'invalid XP delta: %', p_delta
--         USING ERRCODE = '22023';
--     END IF;
--
--     IF length(v_action) > 64 OR length(v_entity) > 256
--        OR length(COALESCE(p_idempotency_key, '')) > 512 THEN
--       RAISE EXCEPTION 'invalid award_xp argument length'
--         USING ERRCODE = '22023';
--     END IF;
--
--     -- STREAK AUTHORITY: local calendar day from the client's todayKey(),
--     -- accepted within +-1 day of the server UTC date, else the UTC day.
--     IF p_local_day IS NOT NULL
--        AND p_local_day >= v_utc_day - 1
--        AND p_local_day <= v_utc_day + 1 THEN
--       v_today := p_local_day;
--     ELSE
--       v_today := v_utc_day;
--     END IF;
--
--     -- Serialize concurrent awards for this user BEFORE reading cap sums, so two
--     -- parallel calls cannot both see the same remaining cap.
--     SELECT * INTO v_profile
--     FROM public.user_profiles
--     WHERE id = v_uid
--     FOR UPDATE;
--
--     IF NOT FOUND THEN
--       RAISE EXCEPTION 'profile not found for user %', v_uid;
--     END IF;
--
--     -- ---- Server-side anti-farming policy (authoritative; the client mirrors
--     -- these values in XP_DAILY_CAPS for display only). ----
--     v_credited := p_delta;
--
--     IF v_action = 'update_note' THEN
--       v_credited := 0;
--     END IF;
--
--     -- Focus: needs a trustworthy duration >= 25 min.
--     IF v_action = 'complete_focus_session' THEN
--       IF p_duration_minutes IS NULL THEN
--         v_credited := 0;
--       ELSE
--         v_duration := GREATEST(0, LEAST(p_duration_minutes, 1440));
--         IF v_duration < 25 THEN
--           v_credited := 0;
--         END IF;
--       END IF;
--     END IF;
--
--     -- Per-action daily caps (mirror XP_DAILY_CAPS). Unknown actions credit 0.
--     v_cap := CASE v_action
--       WHEN 'create_note' THEN 100
--       WHEN 'update_note' THEN 0
--       WHEN 'create_paper' THEN 150
--       WHEN 'update_paper_status' THEN 100
--       WHEN 'add_paper_insights' THEN 150
--       WHEN 'create_idea' THEN 200
--       WHEN 'advance_idea_stage' THEN 250
--       WHEN 'create_task' THEN 100
--       WHEN 'complete_task' THEN 200
--       WHEN 'daily_task_completion' THEN 100
--       WHEN 'create_topic' THEN 150
--       WHEN 'update_topic' THEN 80
--       WHEN 'tag_entity_with_topic' THEN 60
--       WHEN 'complete_topic_quest' THEN 300
--       WHEN 'complete_focus_session' THEN 240
--       ELSE 0
--     END;
--
--     SELECT COALESCE(SUM(e.xp), 0) INTO v_used_today
--     FROM public.xp_events AS e
--     WHERE e.user_id = v_uid
--       AND e.action = v_action
--       AND e.local_day = v_today;
--
--     v_credited := GREATEST(0, LEAST(v_credited, v_cap - v_used_today));
--
--     -- Focus cooldown: 300 s since the last credited focus award.
--     IF v_action = 'complete_focus_session' AND v_credited > 0 THEN
--       SELECT max(e.created_at) INTO v_last_award
--       FROM public.xp_events AS e
--       WHERE e.user_id = v_uid
--         AND e.action = 'complete_focus_session'
--         AND e.xp > 0;
--
--       IF v_last_award IS NOT NULL
--          AND EXTRACT(EPOCH FROM (now() - v_last_award)) < 300 THEN
--         v_credited := 0;
--       END IF;
--     END IF;
--
--     -- Ledger. Keyed / entity awards dedupe (ON CONFLICT covers the per-user key
--     -- unique and the partial entity unique); no-entity awards never dedupe and
--     -- are recorded only when they credit XP (cap accounting).
--     IF NULLIF(p_idempotency_key, '') IS NOT NULL OR v_entity <> '' THEN
--       v_key := COALESCE(
--         NULLIF(p_idempotency_key, ''),
--         'auto:' || v_uid::TEXT || ':' || v_action || ':' || v_entity
--       );
--
--       INSERT INTO public.xp_events (user_id, action, entity_id, xp, idempotency_key, local_day)
--       VALUES (v_uid, v_action, v_entity, v_credited, v_key, v_today)
--       ON CONFLICT DO NOTHING;
--
--       GET DIAGNOSTICS v_ledger_rows = ROW_COUNT;
--
--       IF v_ledger_rows = 0 THEN
--         -- Duplicate delivery: report current totals, credit nothing.
--         total_xp := v_profile.total_xp;
--         current_level := (COALESCE(v_profile.total_xp, 0) / 500) + 1;
--         current_streak := v_profile.current_streak;
--         longest_streak := v_profile.longest_streak;
--         last_activity_date := v_profile.last_activity_date;
--         notes_count := v_profile.notes_count;
--         papers_count := v_profile.papers_count;
--         tasks_completed_count := v_profile.tasks_completed_count;
--         papers_with_insights_count := v_profile.papers_with_insights_count;
--         streak_freeze_tokens := v_profile.streak_freeze_tokens;
--         xp_credited := 0;
--         is_duplicate := TRUE;
--         RETURN NEXT;
--         RETURN;
--       END IF;
--     ELSIF v_credited > 0 THEN
--       INSERT INTO public.xp_events (user_id, action, entity_id, xp, idempotency_key, local_day)
--       VALUES (v_uid, v_action, '', v_credited, NULL, v_today);
--     END IF;
--
--     -- Streak math on the local day.
--     v_freeze := COALESCE(v_profile.streak_freeze_tokens, 0);
--
--     IF v_profile.last_activity_date IS NOT NULL THEN
--       v_days_diff := v_today - v_profile.last_activity_date;
--
--       IF v_days_diff <= 0 THEN
--         v_new_streak := GREATEST(COALESCE(v_profile.current_streak, 1), 1);
--       ELSIF v_days_diff = 1 THEN
--         v_new_streak := COALESCE(v_profile.current_streak, 0) + 1;
--       ELSIF v_freeze > 0 AND COALESCE(v_profile.current_streak, 0) > 0 THEN
--         -- Preserve a nonzero streak by consuming one freeze token.
--         v_freeze := v_freeze - 1;
--         v_new_streak := v_profile.current_streak;
--       ELSE
--         v_new_streak := 1;
--       END IF;
--     END IF;
--
--     IF v_new_streak % 7 = 0 AND v_new_streak > COALESCE(v_profile.current_streak, 0) THEN
--       v_freeze := v_freeze + 1;
--     END IF;
--
--     v_longest := GREATEST(v_new_streak, COALESCE(v_profile.longest_streak, 0));
--
--     -- Transaction-local bypass of lock_total_xp_monotonic for our own increment.
--     PERFORM set_config('app.bypass_xp_guard', 'on', true);
--
--     UPDATE public.user_profiles AS p
--     SET
--       total_xp = COALESCE(p.total_xp, 0) + v_credited,
--       current_level = ((COALESCE(p.total_xp, 0) + v_credited) / 500) + 1,
--       current_streak = v_new_streak,
--       longest_streak = v_longest,
--       last_activity_date = GREATEST(v_today, COALESCE(p.last_activity_date, v_today)),
--       streak_freeze_tokens = v_freeze,
--       notes_count = CASE
--         WHEN v_action = 'create_note' THEN COALESCE(p.notes_count, 0) + 1
--         ELSE p.notes_count
--       END,
--       papers_count = CASE
--         WHEN v_action = 'create_paper' THEN COALESCE(p.papers_count, 0) + 1
--         ELSE p.papers_count
--       END,
--       tasks_completed_count = CASE
--         WHEN v_action = 'complete_task' THEN COALESCE(p.tasks_completed_count, 0) + 1
--         ELSE p.tasks_completed_count
--       END,
--       papers_with_insights_count = CASE
--         WHEN v_action = 'add_paper_insights' THEN COALESCE(p.papers_with_insights_count, 0) + 1
--         ELSE p.papers_with_insights_count
--       END
--     WHERE p.id = v_uid
--     RETURNING
--       p.total_xp, p.current_level, p.current_streak, p.longest_streak,
--       p.last_activity_date, p.notes_count, p.papers_count,
--       p.tasks_completed_count, p.papers_with_insights_count,
--       p.streak_freeze_tokens
--     INTO
--       v_r_total, v_r_level, v_r_streak,
--       v_r_longest, v_r_last, v_r_notes,
--       v_r_papers, v_r_tasks,
--       v_r_insights, v_r_freeze;
--
--     PERFORM set_config('app.bypass_xp_guard', 'off', true);
--
--     -- Local-day daily log with the credited amount.
--     INSERT INTO public.daily_logs AS d (user_id, date, xp_earned, streak_count)
--     VALUES (v_uid, v_today, v_credited, v_new_streak)
--     ON CONFLICT (user_id, date)
--     DO UPDATE SET
--       xp_earned = COALESCE(d.xp_earned, 0) + EXCLUDED.xp_earned,
--       streak_count = EXCLUDED.streak_count;
--
--     total_xp := v_r_total;
--     current_level := v_r_level;
--     current_streak := v_r_streak;
--     longest_streak := v_r_longest;
--     last_activity_date := v_r_last;
--     notes_count := v_r_notes;
--     papers_count := v_r_papers;
--     tasks_completed_count := v_r_tasks;
--     papers_with_insights_count := v_r_insights;
--     streak_freeze_tokens := v_r_freeze;
--     xp_credited := v_credited;
--     is_duplicate := FALSE;
--     RETURN NEXT;
--     RETURN;
--   END;
--   $$;
--
--   REVOKE ALL ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) FROM PUBLIC;
--   REVOKE ALL ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) FROM anon;
--   GRANT EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) TO service_role;
--
-- 1765700000 award_achievement_xp body (CREATE OR REPLACE; signature/return types match):
--   CREATE OR REPLACE FUNCTION public.award_achievement_xp(
--     p_achievement_type TEXT,
--     p_xp INTEGER DEFAULT NULL,
--     p_title TEXT DEFAULT NULL,
--     p_description TEXT DEFAULT NULL
--   )
--   RETURNS TABLE (
--     total_xp INTEGER,
--     current_level INTEGER,
--     xp_credited INTEGER,
--     is_duplicate BOOLEAN
--   )
--   LANGUAGE plpgsql
--   SECURITY DEFINER
--   SET search_path = public
--   AS $$
--   DECLARE
--     v_uid UUID := auth.uid();
--     v_type TEXT := trim(COALESCE(p_achievement_type, ''));
--     v_xp INTEGER;
--     v_title TEXT;
--     v_description TEXT;
--     v_rows INTEGER := 0;
--   BEGIN
--     IF v_uid IS NULL THEN
--       RAISE EXCEPTION 'permission denied'
--         USING ERRCODE = '42501';
--     END IF;
--
--     CASE v_type
--       WHEN 'first_paper' THEN
--         v_xp := 50;  v_title := 'First Paper';       v_description := 'Added your first research paper';
--       WHEN 'research_streak_7' THEN
--         v_xp := 100; v_title := 'Research Streak';   v_description := '7 days consecutive research activity';
--       WHEN 'note_master' THEN
--         v_xp := 200; v_title := 'Note Master';       v_description := 'Written 50 notes';
--       WHEN 'task_warrior' THEN
--         v_xp := 150; v_title := 'Task Warrior';      v_description := 'Completed 25 tasks';
--       WHEN 'insight_collector' THEN
--         v_xp := 120; v_title := 'Insight Collector'; v_description := 'Added insights from 10 papers';
--       ELSE
--         RAISE EXCEPTION 'unknown achievement type: %', left(v_type, 64)
--           USING ERRCODE = '22023';
--     END CASE;
--
--     INSERT INTO public.research_achievements AS ra
--       (user_id, achievement_type, title, description, xp_awarded)
--     VALUES (v_uid, v_type, v_title, v_description, v_xp)
--     ON CONFLICT (user_id, achievement_type) DO NOTHING;
--
--     GET DIAGNOSTICS v_rows = ROW_COUNT;
--
--     IF v_rows = 0 THEN
--       SELECT t.total_xp, (COALESCE(t.total_xp, 0) / 500) + 1
--       INTO total_xp, current_level
--       FROM public.user_profiles AS t
--       WHERE t.id = v_uid;
--
--       IF NOT FOUND THEN
--         RAISE EXCEPTION 'profile not found for user %', v_uid;
--       END IF;
--
--       xp_credited := 0;
--       is_duplicate := TRUE;
--       RETURN NEXT;
--       RETURN;
--     END IF;
--
--     PERFORM set_config('app.bypass_xp_guard', 'on', true);
--
--     UPDATE public.user_profiles AS p
--     SET
--       total_xp = COALESCE(p.total_xp, 0) + v_xp,
--       current_level = ((COALESCE(p.total_xp, 0) + v_xp) / 500) + 1
--     WHERE p.id = v_uid
--     RETURNING p.total_xp, p.current_level
--     INTO total_xp, current_level;
--
--     PERFORM set_config('app.bypass_xp_guard', 'off', true);
--
--     IF NOT FOUND THEN
--       RAISE EXCEPTION 'profile not found for user %', v_uid;
--     END IF;
--
--     xp_credited := v_xp;
--     is_duplicate := FALSE;
--     RETURN NEXT;
--     RETURN;
--   END;
--   $$;
--
--   REVOKE ALL ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC;
--   REVOKE ALL ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) FROM anon;
--   GRANT EXECUTE ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) TO service_role;
