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
--   Apply this file and 1765900000_evaluate_user_streaks_local_day.sql back
--   to back in ONE session (apply_migration xp_integrity_hardening, then
--   apply_migration evaluate_user_streaks_local_day), and only after #826
--   and #827 are merged and each has the architect YES and a QA pass. Never
--   apply this file alone: the live nightly evaluate_user_streaks spends
--   tokens that this award_xp also spends on the return claim.
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
-- last_activity_date, streak_tz_lo_min, streak_tz_hi_min, streak_tz_set_at,
-- streak_credit_at, streak_inc_at, streak_prev_inc_at, streak_pending_date,
-- and all *_count.
--
-- Streak rules (round 10). Band = UTC-offset minutes [lo, hi] consistent with
-- recent claims (6h gate). An inconsistent claim that needs <= 60 min of
-- widening (DST shift, stale band, clock skew) and is not at the same
-- instant as streak_tz_set_at widens the band by 60 min each side (nudge);
-- a bigger move unions with the claim interval if the 6h gate is open, else
-- the award is XP only for the streak count and the band. Pending date
-- (r10): if that gate-closed claim is for local day D = COALESCE(pending,
-- last) + 1 and e < 48h (strict), it records streak_pending_date = D and
-- streak_credit_at = now (no +1; streak, last, band, set_at, rate clocks,
-- tokens and daily_logs unchanged). pending is only meaningful while it is
-- > last, and every date last + 1 .. pending was claimed (each step is
-- exactly + 1). g = p - last. e = now - streak_credit_at, where
-- streak_credit_at is the LATEST streak claim (same-day, HOLD and pending
-- claims refresh it while the chain is alive; a dead chain is never
-- refreshed, so a
-- break is remembered). margin = 1h (DST hour) unless the band was NULL or
-- the claim needed > 60 min of widening.
--   g <= 0: refresh only.
--   g = 1 and e < 48h + margin (or credit_at NULL, legacy): +1 or HOLD.
--   g >= 2, e < 48h (strict) and the skipped date is an offset artefact of
--     an eastward move (stored lo NULL, or under the stored band's west edge
--     shifted 60 min east the claim is still on local day last + 1; AND the
--     claim lies strictly east of the stored band, or e <= 24h * (g - 1) - 1h
--     so no fixed zone could have skipped a day), OR (r10) pending >= p - 1
--     (every skipped date was claimed, XP only, inside the 6h gate): bridge,
--     +1 or HOLD.
--   Otherwise (g >= 2 not bridged, or g = 1 on a dead chain) the token
--     path: m = GREATEST(1, g - 1) missed days; needs streak > 0,
--     freeze + rest_days >= m and e < 24h * (m + 2) + margin (credit_at
--     NULL: g >= 2 only). Spends m tokens, streak_freeze_tokens first then
--     rest_days, then counts the claim as a normal next day (+1 or HOLD).
--     Else reset to 1, tokens kept. N tokens buy N missed days; this is the
--     only place tokens are spent for a returning claim, so the nightly
--     cron must not spend them too (see #827).
-- Two rate clocks gate every +1 (else HOLD: last = p, credit_at = now):
--   burst  streak_prev_inc_at: NULL or now - it > 23h (at most two +1 in
--          any 23h window; 23h = 24h minus the DST hour).
--   lead   streak_inc_at = C: NULL or now > C - 1h; +1 sets C := C + 24h
--          (NULL -> now); start/reset sets C := now. C = reset time +
--          24h * (streak - 1), so streak - real days since the reset claim
--          stays below 2 + 1/24.

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
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS streak_credit_at timestamptz;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS streak_inc_at timestamptz;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS streak_prev_inc_at timestamptz;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS streak_pending_date date;

-- Server-owned (not in the GRANT UPDATE allowlist above; explicit revoke for
-- clarity and defence in depth, plus the lock_freeze_rest_no_mint trigger).
REVOKE UPDATE (streak_pending_date) ON TABLE public.user_profiles FROM PUBLIC;
REVOKE UPDATE (streak_pending_date) ON TABLE public.user_profiles FROM anon;
REVOKE UPDATE (streak_pending_date) ON TABLE public.user_profiles FROM authenticated;

COMMENT ON COLUMN public.user_profiles.streak_tz_lo_min IS
  'Inclusive UTC-offset minutes consistent with recent credited streak claims. Written only by award_xp.';
COMMENT ON COLUMN public.user_profiles.streak_tz_hi_min IS
  'Inclusive UTC-offset minutes consistent with recent credited streak claims. Written only by award_xp.';
COMMENT ON COLUMN public.user_profiles.streak_tz_set_at IS
  'Server time when streak_tz_lo_min/hi_min last changed or the streak last advanced, spent tokens or reset. Gates union widening (6h) and same-instant nudges. Written only by award_xp.';
COMMENT ON COLUMN public.user_profiles.streak_credit_at IS
  'xp_server_now() of the latest streak claim while the chain is alive (start, advance, hold, freeze, reset, and same-day or earlier-day refreshes). Liveness: e = now - this. NULL is legacy (one bounded first claim). Written only by award_xp.';
COMMENT ON COLUMN public.user_profiles.streak_inc_at IS
  'Lead clock C. An increment is allowed only if this is NULL or now > C - 1h; an increment sets C := C + 24h (NULL -> now); a start or reset sets C := now. Bounds streak - real days since the reset claim below 2 + 1/24. Written only by award_xp.';
COMMENT ON COLUMN public.user_profiles.streak_prev_inc_at IS
  'Burst clock. An increment is allowed only if this is NULL or now - this > 23h; an increment sets it to the previous streak_tz_set_at (>= the previous increment time); a start or reset sets NULL. Written only by award_xp.';
COMMENT ON COLUMN public.user_profiles.streak_pending_date IS
  'Latest local date claimed XP only (inconsistent claim inside the 6h band gate) on a live chain, advanced only one date at a time from GREATEST(last_activity_date, itself). Meaningful only while > last_activity_date; lets a g >= 2 claim bridge when every skipped date was claimed. Written only by award_xp.';

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
  IF current_user IN ('authenticated', 'anon') THEN
    IF COALESCE(NEW.streak_freeze_tokens, 0) > COALESCE(OLD.streak_freeze_tokens, 0)
       OR COALESCE(NEW.rest_days, 0) > COALESCE(OLD.rest_days, 0) THEN
      RAISE EXCEPTION 'cannot mint streak freeze tokens or rest days'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.streak_credit_at IS DISTINCT FROM OLD.streak_credit_at
       OR NEW.streak_inc_at IS DISTINCT FROM OLD.streak_inc_at
       OR NEW.streak_prev_inc_at IS DISTINCT FROM OLD.streak_prev_inc_at
       OR NEW.streak_pending_date IS DISTINCT FROM OLD.streak_pending_date THEN
      RAISE EXCEPTION 'cannot update locked streak columns'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_freeze_rest_no_mint() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_freeze_rest_no_mint() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_freeze_rest_no_mint() FROM authenticated;

DROP TRIGGER IF EXISTS lock_freeze_rest_no_mint ON public.user_profiles;
CREATE TRIGGER lock_freeze_rest_no_mint
  BEFORE UPDATE OF streak_freeze_tokens, rest_days,
    streak_credit_at, streak_inc_at, streak_prev_inc_at, streak_pending_date
  ON public.user_profiles
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
  v_credit_at TIMESTAMPTZ;
  v_inc_at TIMESTAMPTZ;
  v_prev_inc_at TIMESTAMPTZ;
  v_old_set_at TIMESTAMPTZ;
  v_gap INTEGER;
  v_band_null BOOLEAN;
  v_widen_min INTEGER;
  v_margin INTERVAL;
  v_alive BOOLEAN;
  v_rest INTEGER := 0;
  v_need INTEGER;
  v_use INTEGER;
  v_bridge_ok BOOLEAN;
  v_pending DATE;
  v_apply_pending BOOLEAN := FALSE;
  v_step BOOLEAN;
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
  v_credit_at := v_profile.streak_credit_at;
  v_inc_at := v_profile.streak_inc_at;
  v_prev_inc_at := v_profile.streak_prev_inc_at;
  v_old_set_at := v_tz_set_at;
  v_freeze := COALESCE(v_profile.streak_freeze_tokens, 0);
  v_rest := COALESCE(v_profile.rest_days, 0);
  v_last := v_profile.last_activity_date;
  v_new_streak := COALESCE(v_profile.current_streak, 0);
  v_pending := CASE
    WHEN v_profile.streak_pending_date > v_last THEN v_profile.streak_pending_date
    ELSE NULL
  END;

  -- Self-heal: no streak left to protect (streak 0 or last NULL). A
  -- feasible claim starts fresh. The start is a lead-clock cell.
  IF v_claim_lo <= v_claim_hi
     AND (
       v_new_streak = 0
       OR v_last IS NULL
     ) THEN
    v_tz_lo := v_claim_lo;
    v_tz_hi := v_claim_hi;
    v_tz_set_at := v_now;
    v_new_streak := 1;
    v_last := v_today;
    v_credit_at := v_now;
    v_inc_at := v_now;
    v_prev_inc_at := NULL;
    v_pending := NULL;
    v_apply_streak := TRUE;
  ELSIF v_claim_lo <= v_claim_hi THEN
    v_band_null := (v_tz_lo IS NULL OR v_tz_hi IS NULL);
    IF v_band_null THEN
      v_w_lo := -720;
      v_w_hi := 840;
    ELSE
      v_w_lo := v_tz_lo;
      v_w_hi := v_tz_hi;
    END IF;
    v_n_lo := GREATEST(v_w_lo, v_claim_lo);
    v_n_hi := LEAST(v_w_hi, v_claim_hi);
    v_widen_min := 0;

    -- Inconsistent claim (band is non-NULL here). v_widen_min = minutes of
    -- widening needed (>= 1).
    --   <= 60 and not the same instant as streak_tz_set_at: DST nudge, widen
    --     the band by 60 min on each side (DST shift, stale band, clock skew).
    --   else 6h gate open: union with the claim interval.
    --   else: XP only.
    IF v_n_lo > v_n_hi THEN
      v_widen_min := CASE
        WHEN v_claim_lo > v_tz_hi THEN v_claim_lo - v_tz_hi
        ELSE v_tz_lo - v_claim_hi
      END;
      v_gate_open := (
        v_tz_set_at IS NULL
        OR (v_now - v_tz_set_at) >= interval '6 hours'
      );
      IF v_widen_min <= 60
         AND (v_tz_set_at IS NULL OR v_now > v_tz_set_at) THEN
        v_tz_lo := GREATEST(-720, v_tz_lo - 60);
        v_tz_hi := LEAST(840, v_tz_hi + 60);
      ELSIF v_gate_open THEN
        v_tz_lo := GREATEST(-720, LEAST(v_tz_lo, v_claim_lo));
        v_tz_hi := LEAST(840, GREATEST(v_tz_hi, v_claim_hi));
      END IF;
      v_w_lo := v_tz_lo;
      v_w_hi := v_tz_hi;
      v_n_lo := GREATEST(v_tz_lo, v_claim_lo);
      v_n_hi := LEAST(v_tz_hi, v_claim_hi);
    END IF;

    IF v_n_lo <= v_n_hi THEN
      -- e = now - streak_credit_at (latest streak claim). DST margin: 1h on
      -- the g=1 48h rule and the 72h rule unless the band was NULL or the
      -- claim needed a widen of more than 60 min. g >= 2 bridges use a strict
      -- 48h (no margin).
      v_margin := CASE
        WHEN v_band_null OR v_widen_min > 60 THEN interval '0'
        ELSE interval '1 hour'
      END;
      v_alive := (
        v_credit_at IS NOT NULL
        AND (v_now - v_credit_at) < interval '48 hours' + v_margin
      );
      IF v_tz_lo IS DISTINCT FROM v_n_lo OR v_tz_hi IS DISTINCT FROM v_n_hi THEN
        v_tz_set_at := v_now;
      END IF;
      v_tz_lo := v_n_lo;
      v_tz_hi := v_n_hi;
      v_gap := v_today - v_last;

      IF v_today <= v_last THEN
        -- Same or earlier local day: liveness refresh only (never while
        -- the chain is already broken, so a break is remembered).
        IF v_credit_at IS NULL OR v_alive THEN
          v_credit_at := v_now;
        END IF;
      ELSE
        -- Bridge test for g >= 2: the skipped local date must be an offset
        -- artefact of an eastward move:
        --   (a) under the stored (pre-claim) band's west edge shifted 60 min
        --       east (DST tolerance) this claim is still on local day
        --       last + 1, and
        --   (b) there is evidence of the move: the claim interval lies
        --       strictly east of the stored band, or the skip is impossible
        --       for any fixed zone (e <= 24h * (g - 1) - 1h, the 1h being a
        --       23h spring-forward day).
        -- A fixed-zone user who really missed a local day is not bridged,
        -- including one whose stored band is wide (e.g. [-720, 840]).
        -- r10: or (c) every skipped date was already claimed XP only inside
        -- the 6h gate (streak_pending_date >= p - 1; pending advances one
        -- date per claim from last, so last + 1 .. pending were all claimed).
        v_bridge_ok := (
          v_gap >= 2
          AND (v_now - v_credit_at) < interval '48 hours'
          AND (
            (v_pending IS NOT NULL AND v_pending >= v_today - 1)
            OR (
              (
                v_profile.streak_tz_lo_min IS NULL
                OR ((v_now + make_interval(mins => LEAST(840, v_profile.streak_tz_lo_min + 60)))
                      AT TIME ZONE 'UTC')::date <= v_last + 1
              )
              AND (
                v_profile.streak_tz_hi_min IS NULL
                OR v_claim_lo > v_profile.streak_tz_hi_min
                OR (v_now - v_credit_at) <= make_interval(hours => 24 * (v_gap - 1) - 1)
              )
            )
          )
        );
        v_step := FALSE;
        IF (v_gap = 1 AND (v_alive OR v_credit_at IS NULL)) OR v_bridge_ok THEN
          -- g = 1 with the chain alive (or legacy NULL credit_at), or a
          -- bridged g >= 2 (strict 48h, no margin).
          v_step := TRUE;
        ELSE
          -- Token path: m = GREATEST(1, g - 1) missed local days (g = 1 here
          -- means a dead chain: one token for liveness). Needs m tokens,
          -- freeze first then rest days, and e < 24h * (m + 2) + margin
          -- (legacy NULL credit_at: any g >= 2). Then the claim counts as a
          -- normal next day (+1 or HOLD). Otherwise reset to 1, tokens kept.
          v_need := GREATEST(1, v_gap - 1);
          IF v_new_streak > 0
             AND v_freeze + v_rest >= v_need
             AND (
               (v_credit_at IS NULL AND v_gap >= 2)
               OR (v_credit_at IS NOT NULL
                   AND (v_now - v_credit_at) < make_interval(hours => 24 * (v_need + 2)) + v_margin)
             ) THEN
            v_use := LEAST(v_freeze, v_need);
            v_freeze := v_freeze - v_use;
            v_rest := v_rest - (v_need - v_use);
            v_tz_set_at := v_now;
            v_step := TRUE;
          ELSE
            v_new_streak := 1;
            v_last := v_today;
            v_credit_at := v_now;
            v_tz_set_at := v_now;
            v_inc_at := v_now;
            v_prev_inc_at := NULL;
            v_pending := NULL;
            IF v_widen_min > 0 THEN
              v_tz_lo := v_w_lo;
              v_tz_hi := v_w_hi;
            END IF;
          END IF;
        END IF;
        IF v_step THEN
          -- Two rate clocks gate every +1:
          --   burst: streak_prev_inc_at NULL or now - it > 23h
          --   lead:  streak_inc_at NULL or now > streak_inc_at - 1h
          IF (v_prev_inc_at IS NULL OR (v_now - v_prev_inc_at) > interval '23 hours')
             AND (v_inc_at IS NULL OR v_now > v_inc_at - interval '1 hour') THEN
            v_prev_inc_at := COALESCE(v_old_set_at, v_profile.streak_credit_at);
            v_inc_at := CASE
              WHEN v_inc_at IS NULL THEN v_now
              ELSE v_inc_at + interval '24 hours'
            END;
            v_new_streak := v_new_streak + 1;
            v_tz_set_at := v_now;
          END IF;
          -- +1 or HOLD: last and credit_at move forward either way.
          v_last := v_today;
          v_credit_at := v_now;
        END IF;
      END IF;
      v_apply_streak := TRUE;
    ELSIF v_credit_at IS NOT NULL
          AND (v_now - v_credit_at) < interval '48 hours'
          AND v_today = COALESCE(v_pending, v_last) + 1 THEN
      -- r10 pending date: inconsistent claim with the 6h gate closed on a
      -- live chain (strict 48h) for the next unclaimed local date. Record
      -- the date and refresh liveness only; no +1, and streak, last, band,
      -- set_at, rate clocks, tokens and daily_logs are unchanged.
      v_pending := v_today;
      v_credit_at := v_now;
      v_apply_pending := TRUE;
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
      rest_days = v_rest,
      streak_tz_lo_min = v_tz_lo,
      streak_tz_hi_min = v_tz_hi,
      streak_tz_set_at = v_tz_set_at,
      streak_credit_at = v_credit_at,
      streak_inc_at = v_inc_at,
      streak_prev_inc_at = v_prev_inc_at,
      streak_pending_date = CASE WHEN v_pending > v_last THEN v_pending ELSE NULL END
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
    -- No streak, last, freeze, daily_logs, or tz-band change. A pending-date
    -- claim (r10) also writes streak_pending_date and streak_credit_at.
    UPDATE public.user_profiles AS p
    SET
      total_xp = COALESCE(p.total_xp, 0) + v_credited,
      current_level = ((COALESCE(p.total_xp, 0) + v_credited) / 500) + 1,
      streak_pending_date = CASE WHEN v_apply_pending THEN v_pending ELSE p.streak_pending_date END,
      streak_credit_at = CASE WHEN v_apply_pending THEN v_credit_at ELSE p.streak_credit_at END
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
  'Atomic XP award for auth.uid() only. Credits least(p_delta, server XP_REWARDS mapping); unknown actions 0. Local-day ±1 plus rolling 24h cap. Streak updates on credited timezone-consistent awards. An inconsistent claim needing <= 60 min of widening (not at the same instant as streak_tz_set_at) widens the band by 60 min each side; a larger move unions with the claim interval when the 6h gate is open, else the award is XP only without touching the streak count or band; if that claim is for local date COALESCE(streak_pending_date, last) + 1 with e < 48h it records streak_pending_date = p and streak_credit_at = now. Liveness: e = now - streak_credit_at (latest streak claim; refreshed by same-day claims only while alive). margin = 1h unless the band was NULL or the widen exceeded 60 min. g=1 and e < 48h+margin (or credit_at NULL): +1; g>=2 with e < 48h, the skipped date an offset artefact under the stored band west edge shifted 60 min east, and evidence of an eastward move (claim strictly east of the stored band, or e <= 24h*(g-1)-1h), or g>=2 with e < 48h and streak_pending_date >= p - 1 (every skipped date claimed XP only): +1 (bridge); otherwise m = max(1, g-1) missed days are covered by m tokens (streak_freeze_tokens first, then rest_days) when e < 24h*(m+2)+margin, and the claim then counts as a normal next day; else reset to 1 with tokens kept. Every +1 needs the burst clock (streak_prev_inc_at NULL or > 23h ago) and the lead clock (streak_inc_at NULL or now > streak_inc_at - 1h), else HOLD (last = p, credit_at = now). A credited feasible claim self-heals to streak 1 when current_streak is 0 or last_activity_date is NULL. Does not write *_count columns.';

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
--     DROP COLUMN IF EXISTS streak_tz_set_at,
--     DROP COLUMN IF EXISTS streak_credit_at,
--     DROP COLUMN IF EXISTS streak_inc_at,
--     DROP COLUMN IF EXISTS streak_prev_inc_at,
--     DROP COLUMN IF EXISTS streak_pending_date;
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
