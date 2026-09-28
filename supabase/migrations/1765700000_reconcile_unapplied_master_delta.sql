-- Migration: reconcile unapplied master migrations as ONE hardened delta
-- Created at: 1765700000
--
-- WHY THIS FILE EXISTS
--   Master carries nine migration files (1764800000..1765300000) that are not
--   recorded in the live migration history of project zsjczlmzhyzewpehmngc.
--   Some of their objects were applied by hand, some are superseded by newer
--   live definitions (1765100000 / 1765200000), and some are broken or unsafe
--   as written. A read-only audit (2026-09-28) compared every object against
--   the live catalog. This file is the ONLY thing to apply live for that range.
--
--   HARD NO: repo files 1764800000..1765300000 must NOT be re-applied live
--   (no `supabase db push`, no apply_migration of the old files, no copy-paste).
--   Re-running them regresses topic_* RLS, re-creates an xp_events INSERT
--   policy, fails outright (1765003000 has a 42601 syntax error), or rewrites
--   hand-applied objects. Do not edit the old files either (append-only chain).
--
-- SUPERSEDES (per-file verdicts, accepted by the RQ Architect)
--   file                                          live status       verdict  what this file keeps
--   1764800000_security_perf_hardening            PARTIALLY LIVE    SKIP     nothing (topic RLS superseded by 1765100000/1765200000;
--                                                                            re-run regresses junction WITH CHECK; task index swap declined)
--   1764801000_round2_security_hardening          PARTIALLY LIVE    DELTA    section H: topic_quest + feed_item ownership triggers only
--                                                                            (save_idea_with_links left to live 1765000000 form / open PR 1765500000)
--   1764802000_update_with_check_hardening        FULLY LIVE (fn.)  SKIP     nothing
--   1764900000_api_keys_rls_intent                NOT LIVE          AS-IS    section J: table comments (schema-qualified)
--   1764910000_gamification_atomic_xp             NOT LIVE          DELTA    sections A-C: xp_events (no client INSERT policy,
--                                                                            partial unique, xp >= 0), profile UPDATE WITH CHECK,
--                                                                            total_xp monotonic trigger. 5-arg award_xp NOT kept.
--   1765001000_award_xp_rpc                       NOT LIVE          DELTA    section D: uq_research_achievements_user_type only
--                                                                            (full-width xp_events unique + 3-arg award_xp NOT kept)
--   1765002000_normalize_legacy_paper_dois        no-op (0 rows)    SKIP     nothing
--   1765003000_award_xp_caps_and_search_parity    NOT LIVE (broken) DELTA    sections E-G: 7-arg award_xp, award_achievement_xp,
--                                                                            global_search tasks/topics, all fixed + hardened
--   1765300000_batch3_checks_realtime_triggers    PARTIALLY LIVE    DELTA    section I: tasks_priority_check + papers_status_check only
--                                                                            (realtime adds skipped: no subscribers; triggers identical)
--   (addition, Architect request)                 n/a               NEW      section K: REVOKE MAINTAIN (PG17) FROM authenticated on the
--                                                                            7 public.atlas_* tables + xp_events (to_regclass-guarded)
--
-- FIXES vs master (bugs)
--   1. 1765003000 award_achievement_xp used one-argument NULLIF(...) -> 42601 at
--      CREATE time; the whole file cannot apply.
--   2. It also wrote NULL into research_achievements.title (NOT NULL) for a
--      blank title. Title/description now come from the server catalogue.
--   3. xp_events full-width UNIQUE(user_id, action, entity_id) collides for
--      every repeat no-entity award (entity_id = ''), so the 2nd create_note of
--      a user raised 23505. Now a partial unique index WHERE entity_id <> ''.
--   4. global_search (1765003000, same as repo 1765000000) fails on every call
--      with 42804 "structure of query does not match function result type":
--      notes.title / topics.name are VARCHAR but the OUT column is text.
--      Rewritten in the live subquery form with explicit ::text casts.
--   (+) award_xp read the daily-cap sum before taking the profile row lock, so
--      concurrent calls could over-credit a cap; the lock is now taken first.
--
-- FIXES vs master (XP farming holes)
--   1. award_xp: unknown action names fell to ELSE 200 (and 'generic' = 500) per
--      day each, i.e. unlimited XP via fresh action strings. Now ELSE 0 and no
--      'generic' entry; only the 15 actions the client/policy uses are capped.
--   2. award_achievement_xp trusted client p_achievement_type and p_xp (<= 500),
--      i.e. unlimited XP via fresh type strings. Now a server-owned catalogue
--      (mirrors ACHIEVEMENTS in researchquest/src/utils/gamification.ts); unknown
--      types raise 22023; p_xp/p_title/p_description are ignored.
--   3. 1764910000 granted authenticated INSERT on xp_events (own rows, any xp),
--      so a client could insert negative-xp rows and reset its daily caps. No
--      INSERT policy, table writes revoked, CHECK (xp >= 0).
--
-- KNOWN RESIDUALS (follow-ups, not in scope): the client still falls back to
-- direct user_profiles/research_achievements writes when an RPC errors, and the
-- user_profiles UPDATE policy still lets a user raise total_xp / count columns
-- directly. Close both by removing the client fallback and revoking UPDATE on
-- those columns from authenticated.
--
-- Rollback: see rollback.sql shipped with the PR (drafts/rq-drafts-reconcile).

-- ===========================================================================
-- A. xp_events ledger (1764910000 delta, hardened)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  xp INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT,
  local_day DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reconcile environments that replayed master's 1764910000/1765001000
-- (local `supabase db reset`, branches). All no-ops on live (table is new).
ALTER TABLE public.xp_events ADD COLUMN IF NOT EXISTS local_day DATE;
UPDATE public.xp_events
SET local_day = (created_at AT TIME ZONE 'UTC')::DATE
WHERE local_day IS NULL;
ALTER TABLE public.xp_events ALTER COLUMN local_day SET NOT NULL;
ALTER TABLE public.xp_events DROP CONSTRAINT IF EXISTS xp_events_user_id_action_entity_id_key;
ALTER TABLE public.xp_events DROP CONSTRAINT IF EXISTS xp_events_idempotency_key_key;

DO $$
BEGIN
  -- Replace a full-width uq_xp_events_user_action_entity (1765001000) with the
  -- partial form below; keep it when it is already partial.
  IF EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'uq_xp_events_user_action_entity'
      AND i.indpred IS NULL
  ) THEN
    DROP INDEX public.uq_xp_events_user_action_entity;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'xp_events_user_idempotency_key_key'
      AND conrelid = 'public.xp_events'::regclass
  ) THEN
    ALTER TABLE public.xp_events
      ADD CONSTRAINT xp_events_user_idempotency_key_key
      UNIQUE (user_id, idempotency_key);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'xp_events_xp_nonnegative'
      AND conrelid = 'public.xp_events'::regclass
  ) THEN
    ALTER TABLE public.xp_events
      ADD CONSTRAINT xp_events_xp_nonnegative CHECK (xp >= 0);
  END IF;
END $$;

-- Entity-scoped dedupe only: no-entity awards (entity_id = '') must repeat.
CREATE UNIQUE INDEX IF NOT EXISTS uq_xp_events_user_action_entity
  ON public.xp_events (user_id, action, entity_id)
  WHERE entity_id <> '';

CREATE INDEX IF NOT EXISTS idx_xp_events_user_created
  ON public.xp_events (user_id, created_at DESC);

-- Daily-cap window lookup (award_xp sums credited XP per action per local day).
CREATE INDEX IF NOT EXISTS idx_xp_events_user_action_day
  ON public.xp_events (user_id, action, local_day);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

-- Read-only for owners. Writes happen only inside award_xp (SECURITY DEFINER).
DROP POLICY IF EXISTS "Users insert own xp events" ON public.xp_events;
DROP POLICY IF EXISTS "Users view own xp events" ON public.xp_events;
CREATE POLICY "Users view own xp events"
  ON public.xp_events FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

REVOKE ALL ON TABLE public.xp_events FROM PUBLIC;
REVOKE ALL ON TABLE public.xp_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.xp_events FROM authenticated;
GRANT SELECT ON TABLE public.xp_events TO authenticated;
GRANT ALL ON TABLE public.xp_events TO service_role;

COMMENT ON TABLE public.xp_events IS
  'XP award ledger (idempotency + daily-cap accounting). Written only by award_xp (SECURITY DEFINER); clients may SELECT their own rows. xp stores the CREDITED amount.';

-- ===========================================================================
-- B. user_profiles UPDATE policy gains WITH CHECK (initPlan form)
-- ===========================================================================

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

-- ===========================================================================
-- C. total_xp may only go up outside the award RPCs
--    SECURITY INVOKER is enough for a trigger; EXECUTE revoked from clients.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.enforce_total_xp_monotonic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- award_xp / award_achievement_xp set this transaction-local flag around
  -- their own atomic increment and clear it right after.
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

REVOKE ALL ON FUNCTION public.enforce_total_xp_monotonic() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_total_xp_monotonic() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_total_xp_monotonic() FROM authenticated;

DROP TRIGGER IF EXISTS lock_total_xp_monotonic ON public.user_profiles;
CREATE TRIGGER lock_total_xp_monotonic
  BEFORE UPDATE OF total_xp ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_total_xp_monotonic();

COMMENT ON COLUMN public.user_profiles.total_xp IS
  'Canonical writers: award_xp / award_achievement_xp RPCs (atomic increment). Direct decreases are rejected by lock_total_xp_monotonic.';

-- ===========================================================================
-- D. research_achievements dedupe index (1765001000 delta)
--    Fails closed with a clear message if duplicate (user, type) rows exist.
-- ===========================================================================

DO $$
DECLARE
  v_dupes BIGINT;
BEGIN
  SELECT count(*) INTO v_dupes
  FROM (
    SELECT 1
    FROM public.research_achievements
    GROUP BY user_id, achievement_type
    HAVING count(*) > 1
  ) d;

  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'research_achievements has % duplicate (user_id, achievement_type) groups; dedupe before applying 1765700000', v_dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_research_achievements_user_type
  ON public.research_achievements (user_id, achievement_type);

-- ===========================================================================
-- E. award_xp: canonical 7-arg signature only (1765003000 delta, hardened)
--    Matches researchquest/src/utils/gamification.ts tryAwardXpRpc():
--    p_uid, p_delta, p_idempotency_key, p_action, p_entity_id, p_local_day,
--    p_duration_minutes. Older 3-/5-arg overloads are dropped (unused).
-- ===========================================================================

DROP FUNCTION IF EXISTS public.award_xp(INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER);

CREATE FUNCTION public.award_xp(
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
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_utc_day DATE := (now() AT TIME ZONE 'UTC')::DATE;
  v_today DATE;
  v_profile public.user_profiles%ROWTYPE;
  v_days_diff INTEGER;
  v_new_streak INTEGER := 1;
  v_freeze INTEGER := 0;
  v_longest INTEGER := 0;
  v_ledger_rows INTEGER := 0;
  v_key TEXT;
  v_action TEXT := COALESCE(NULLIF(trim(COALESCE(p_action, '')), ''), 'unknown');
  v_entity TEXT := COALESCE(p_entity_id, '');
  v_credited INTEGER;
  v_cap INTEGER;
  v_used_today INTEGER;
  v_duration INTEGER;
  v_last_award TIMESTAMPTZ;
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
  -- Caller must be authenticated and may only award itself.
  IF v_uid IS NULL OR p_uid IS NULL OR p_uid <> v_uid THEN
    RAISE EXCEPTION 'permission denied'
      USING ERRCODE = '42501';
  END IF;

  -- 0 is a valid no-op credit (e.g. update_note); NULL / negative / absurd
  -- deltas are rejected.
  IF p_delta IS NULL OR p_delta < 0 OR p_delta > 1000 THEN
    RAISE EXCEPTION 'invalid XP delta: %', p_delta
      USING ERRCODE = '22023';
  END IF;

  IF length(v_action) > 64 OR length(v_entity) > 256
     OR length(COALESCE(p_idempotency_key, '')) > 512 THEN
    RAISE EXCEPTION 'invalid award_xp argument length'
      USING ERRCODE = '22023';
  END IF;

  -- STREAK AUTHORITY: local calendar day from the client's todayKey(),
  -- accepted within +-1 day of the server UTC date, else the UTC day.
  IF p_local_day IS NOT NULL
     AND p_local_day >= v_utc_day - 1
     AND p_local_day <= v_utc_day + 1 THEN
    v_today := p_local_day;
  ELSE
    v_today := v_utc_day;
  END IF;

  -- Serialize concurrent awards for this user BEFORE reading cap sums, so two
  -- parallel calls cannot both see the same remaining cap.
  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found for user %', v_uid;
  END IF;

  -- ---- Server-side anti-farming policy (authoritative; the client mirrors
  -- these values in XP_DAILY_CAPS for display only). ----
  v_credited := p_delta;

  IF v_action = 'update_note' THEN
    v_credited := 0;
  END IF;

  -- Focus: needs a trustworthy duration >= 25 min.
  IF v_action = 'complete_focus_session' THEN
    IF p_duration_minutes IS NULL THEN
      v_credited := 0;
    ELSE
      v_duration := GREATEST(0, LEAST(p_duration_minutes, 1440));
      IF v_duration < 25 THEN
        v_credited := 0;
      END IF;
    END IF;
  END IF;

  -- Per-action daily caps (mirror XP_DAILY_CAPS). Unknown actions credit 0.
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

  v_credited := GREATEST(0, LEAST(v_credited, v_cap - v_used_today));

  -- Focus cooldown: 300 s since the last credited focus award.
  IF v_action = 'complete_focus_session' AND v_credited > 0 THEN
    SELECT max(e.created_at) INTO v_last_award
    FROM public.xp_events AS e
    WHERE e.user_id = v_uid
      AND e.action = 'complete_focus_session'
      AND e.xp > 0;

    IF v_last_award IS NOT NULL
       AND EXTRACT(EPOCH FROM (now() - v_last_award)) < 300 THEN
      v_credited := 0;
    END IF;
  END IF;

  -- Ledger. Keyed / entity awards dedupe (ON CONFLICT covers the per-user key
  -- unique and the partial entity unique); no-entity awards never dedupe and
  -- are recorded only when they credit XP (cap accounting).
  IF NULLIF(p_idempotency_key, '') IS NOT NULL OR v_entity <> '' THEN
    v_key := COALESCE(
      NULLIF(p_idempotency_key, ''),
      'auto:' || v_uid::TEXT || ':' || v_action || ':' || v_entity
    );

    INSERT INTO public.xp_events (user_id, action, entity_id, xp, idempotency_key, local_day)
    VALUES (v_uid, v_action, v_entity, v_credited, v_key, v_today)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_ledger_rows = ROW_COUNT;

    IF v_ledger_rows = 0 THEN
      -- Duplicate delivery: report current totals, credit nothing.
      total_xp := v_profile.total_xp;
      current_level := (COALESCE(v_profile.total_xp, 0) / 500) + 1;
      current_streak := v_profile.current_streak;
      longest_streak := v_profile.longest_streak;
      last_activity_date := v_profile.last_activity_date;
      notes_count := v_profile.notes_count;
      papers_count := v_profile.papers_count;
      tasks_completed_count := v_profile.tasks_completed_count;
      papers_with_insights_count := v_profile.papers_with_insights_count;
      streak_freeze_tokens := v_profile.streak_freeze_tokens;
      xp_credited := 0;
      is_duplicate := TRUE;
      RETURN NEXT;
      RETURN;
    END IF;
  ELSIF v_credited > 0 THEN
    INSERT INTO public.xp_events (user_id, action, entity_id, xp, idempotency_key, local_day)
    VALUES (v_uid, v_action, '', v_credited, NULL, v_today);
  END IF;

  -- Streak math on the local day.
  v_freeze := COALESCE(v_profile.streak_freeze_tokens, 0);

  IF v_profile.last_activity_date IS NOT NULL THEN
    v_days_diff := v_today - v_profile.last_activity_date;

    IF v_days_diff <= 0 THEN
      v_new_streak := GREATEST(COALESCE(v_profile.current_streak, 1), 1);
    ELSIF v_days_diff = 1 THEN
      v_new_streak := COALESCE(v_profile.current_streak, 0) + 1;
    ELSIF v_freeze > 0 AND COALESCE(v_profile.current_streak, 0) > 0 THEN
      -- Preserve a nonzero streak by consuming one freeze token.
      v_freeze := v_freeze - 1;
      v_new_streak := v_profile.current_streak;
    ELSE
      v_new_streak := 1;
    END IF;
  END IF;

  IF v_new_streak % 7 = 0 AND v_new_streak > COALESCE(v_profile.current_streak, 0) THEN
    v_freeze := v_freeze + 1;
  END IF;

  v_longest := GREATEST(v_new_streak, COALESCE(v_profile.longest_streak, 0));

  -- Transaction-local bypass of lock_total_xp_monotonic for our own increment.
  PERFORM set_config('app.bypass_xp_guard', 'on', true);

  UPDATE public.user_profiles AS p
  SET
    total_xp = COALESCE(p.total_xp, 0) + v_credited,
    current_level = ((COALESCE(p.total_xp, 0) + v_credited) / 500) + 1,
    current_streak = v_new_streak,
    longest_streak = v_longest,
    last_activity_date = GREATEST(v_today, COALESCE(p.last_activity_date, v_today)),
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
  WHERE p.id = v_uid
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

  PERFORM set_config('app.bypass_xp_guard', 'off', true);

  -- Local-day daily log with the credited amount.
  INSERT INTO public.daily_logs AS d (user_id, date, xp_earned, streak_count)
  VALUES (v_uid, v_today, v_credited, v_new_streak)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    xp_earned = COALESCE(d.xp_earned, 0) + EXCLUDED.xp_earned,
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
  'Atomic XP award for auth.uid() only: row-locked single UPDATE, local-day streaks (p_local_day, +-1 day of UTC), xp_events idempotency (per-user key, entity-scoped partial unique), server-side caps (unknown actions 0 XP, update_note 0, focus >= 25 min + 300 s cooldown).';

-- ===========================================================================
-- F. award_achievement_xp: server-owned catalogue, fixed NULLIF / NOT NULL title
--    Signature kept (p_achievement_type, p_xp, p_title, p_description) because
--    the client calls it by those names; p_xp / p_title / p_description are
--    ignored in favour of the catalogue below (mirrors ACHIEVEMENTS).
-- ===========================================================================

DROP FUNCTION IF EXISTS public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT);

CREATE FUNCTION public.award_achievement_xp(
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
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_type TEXT := trim(COALESCE(p_achievement_type, ''));
  v_xp INTEGER;
  v_title TEXT;
  v_description TEXT;
  v_rows INTEGER := 0;
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

    IF NOT FOUND THEN
      RAISE EXCEPTION 'profile not found for user %', v_uid;
    END IF;

    xp_credited := 0;
    is_duplicate := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;

  PERFORM set_config('app.bypass_xp_guard', 'on', true);

  UPDATE public.user_profiles AS p
  SET
    total_xp = COALESCE(p.total_xp, 0) + v_xp,
    current_level = ((COALESCE(p.total_xp, 0) + v_xp) / 500) + 1
  WHERE p.id = v_uid
  RETURNING p.total_xp, p.current_level
  INTO total_xp, current_level;

  PERFORM set_config('app.bypass_xp_guard', 'off', true);

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
  'Atomic one-time achievement award for auth.uid(): server-owned catalogue (type -> xp/title/description; unknown types raise 22023), deduped via uq_research_achievements_user_type, total_xp increment in the same transaction. p_xp/p_title/p_description are ignored.';

-- ===========================================================================
-- G. global_search: live subquery form + task/topic branches (INVOKER, RLS)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.global_search(
  search_user_id uuid,
  search_query text,
  limit_count int DEFAULT 20
)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  title text,
  snippet text,
  rank real,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR search_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'permission denied'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.entity_type, s.entity_id, s.title, s.snippet, s.rank, s.updated_at
  FROM (
    SELECT
      'note'::text AS entity_type,
      n.id AS entity_id,
      COALESCE(n.title, 'Untitled')::text AS title,
      LEFT(n.markdown_body, 200)::text AS snippet,
      ts_rank(
        to_tsvector('english', n.markdown_body || ' ' || COALESCE(n.title, '')),
        plainto_tsquery('english', search_query)
      ) AS rank,
      n.updated_at AS updated_at
    FROM public.notes n
    WHERE n.user_id = auth.uid()
      AND to_tsvector('english', n.markdown_body || ' ' || COALESCE(n.title, ''))
          @@ plainto_tsquery('english', search_query)

    UNION ALL

    SELECT
      'paper'::text,
      p.id,
      p.title::text,
      LEFT(COALESCE(p.abstract, ''), 200)::text,
      ts_rank(
        to_tsvector(
          'english',
          p.title || ' ' || COALESCE(p.abstract, '') || ' ' || COALESCE(array_to_string(p.authors, ' '), '')
        ),
        plainto_tsquery('english', search_query)
      ),
      p.updated_at
    FROM public.papers p
    WHERE p.user_id = auth.uid()
      AND to_tsvector(
            'english',
            p.title || ' ' || COALESCE(p.abstract, '') || ' ' || COALESCE(array_to_string(p.authors, ' '), '')
          ) @@ plainto_tsquery('english', search_query)

    UNION ALL

    SELECT
      'idea'::text,
      i.id,
      i.title::text,
      LEFT(COALESCE(i.description, ''), 200)::text,
      ts_rank(
        to_tsvector('english', i.title || ' ' || COALESCE(i.description, '')),
        plainto_tsquery('english', search_query)
      ),
      i.updated_at
    FROM public.ideas i
    WHERE i.user_id = auth.uid()
      AND to_tsvector('english', i.title || ' ' || COALESCE(i.description, ''))
          @@ plainto_tsquery('english', search_query)

    UNION ALL

    SELECT
      'task'::text,
      t.id,
      t.title::text,
      LEFT(COALESCE(t.description, ''), 200)::text,
      ts_rank(
        to_tsvector('english', t.title || ' ' || COALESCE(t.description, '')),
        plainto_tsquery('english', search_query)
      ),
      t.updated_at
    FROM public.tasks t
    WHERE t.user_id = auth.uid()
      AND to_tsvector('english', t.title || ' ' || COALESCE(t.description, ''))
          @@ plainto_tsquery('english', search_query)

    UNION ALL

    SELECT
      'topic'::text,
      tp.id,
      tp.name::text,
      LEFT(COALESCE(tp.description, ''), 200)::text,
      ts_rank(
        to_tsvector('english', tp.name || ' ' || COALESCE(tp.description, '')),
        plainto_tsquery('english', search_query)
      ),
      tp.updated_at
    FROM public.topics tp
    WHERE tp.user_id = auth.uid()
      AND to_tsvector('english', tp.name || ' ' || COALESCE(tp.description, ''))
          @@ plainto_tsquery('english', search_query)
  ) AS s
  ORDER BY s.rank DESC, s.updated_at DESC
  LIMIT limit_count;
END;
$$;

REVOKE ALL ON FUNCTION public.global_search(uuid, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.global_search(uuid, text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.global_search(uuid, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.global_search(uuid, text, int) TO service_role;

COMMENT ON FUNCTION public.global_search(uuid, text, int)
  IS 'Search notes/papers/ideas/tasks/topics for auth.uid() only. search_user_id must match the caller.';

-- ===========================================================================
-- H. Ownership triggers (1764801000 delta). SECURITY DEFINER so the owner
--    lookup is not hidden by RLS; EXECUTE revoked like live
--    enforce_topic_link_ownership (triggers still fire).
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.enforce_topic_quest_topic_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Topic quest ownership violation: user_id is required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.topics
    WHERE id = NEW.topic_id
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Topic quest ownership violation: topic % does not belong to user %', NEW.topic_id, NEW.user_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_topic_quest_topic_ownership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_topic_quest_topic_ownership() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_topic_quest_topic_ownership() FROM authenticated;

CREATE OR REPLACE FUNCTION public.enforce_feed_item_source_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Feed item source ownership violation: user_id is required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.feed_sources
    WHERE id = NEW.source_id
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Feed item source ownership violation: source % does not belong to user %', NEW.source_id, NEW.user_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_feed_item_source_ownership() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_feed_item_source_ownership() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_feed_item_source_ownership() FROM authenticated;

DO $$
DECLARE
  v_bad BIGINT;
BEGIN
  IF to_regclass('public.topics') IS NOT NULL
     AND to_regclass('public.topic_quests') IS NOT NULL THEN
    -- Existing violators are not rewritten; they would only block their own
    -- future UPDATEs. Report them so the operator sees the number.
    SELECT count(*) INTO v_bad
    FROM public.topic_quests q
    WHERE q.user_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.topics t
                      WHERE t.id = q.topic_id AND t.user_id = q.user_id);
    RAISE NOTICE '1765700000: topic_quests rows violating topic ownership: %', v_bad;

    DROP TRIGGER IF EXISTS validate_topic_quests_topic_ownership ON public.topic_quests;
    CREATE TRIGGER validate_topic_quests_topic_ownership
      BEFORE INSERT OR UPDATE ON public.topic_quests
      FOR EACH ROW EXECUTE FUNCTION public.enforce_topic_quest_topic_ownership();
  END IF;

  IF to_regclass('public.feed_sources') IS NOT NULL
     AND to_regclass('public.feed_items') IS NOT NULL THEN
    SELECT count(*) INTO v_bad
    FROM public.feed_items f
    WHERE f.source_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.feed_sources s
                      WHERE s.id = f.source_id AND s.user_id = f.user_id);
    RAISE NOTICE '1765700000: feed_items rows violating source ownership: %', v_bad;

    DROP TRIGGER IF EXISTS validate_feed_item_source_ownership ON public.feed_items;
    CREATE TRIGGER validate_feed_item_source_ownership
      BEFORE INSERT OR UPDATE ON public.feed_items
      FOR EACH ROW EXECUTE FUNCTION public.enforce_feed_item_source_ownership();
  END IF;
END $$;

-- ===========================================================================
-- I. CHECK constraints (1765300000 delta). No data rewrite: fails closed with
--    a count if a legacy row violates the allowed set.
-- ===========================================================================

DO $$
DECLARE
  v_bad BIGINT;
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint
                     WHERE conname = 'tasks_priority_check'
                       AND conrelid = 'public.tasks'::regclass) THEN
    SELECT count(*) INTO v_bad FROM public.tasks
    WHERE priority IS NULL OR priority NOT IN ('high', 'medium', 'low');
    IF v_bad > 0 THEN
      RAISE EXCEPTION '1765700000: % tasks rows violate tasks_priority_check; normalize first', v_bad;
    END IF;
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_priority_check
      CHECK (priority IN ('high', 'medium', 'low'));
  END IF;

  IF to_regclass('public.papers') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint
                     WHERE conname = 'papers_status_check'
                       AND conrelid = 'public.papers'::regclass) THEN
    SELECT count(*) INTO v_bad FROM public.papers
    WHERE status IS NOT NULL AND status NOT IN ('To Read', 'Reading', 'Read');
    IF v_bad > 0 THEN
      RAISE EXCEPTION '1765700000: % papers rows violate papers_status_check; normalize first', v_bad;
    END IF;
    ALTER TABLE public.papers
      ADD CONSTRAINT papers_status_check
      CHECK (status IN ('To Read', 'Reading', 'Read'));
  END IF;
END $$;

-- ===========================================================================
-- J. api_keys / api_key_audit RLS intent (1764900000 as-is, schema-qualified)
-- ===========================================================================

DO $$
BEGIN
  IF to_regclass('public.api_keys') IS NOT NULL THEN
    COMMENT ON TABLE public.api_keys IS
      'Hashed per-user API keys for ResearchQuest agent REST gateway. SELECT-only RLS by design; mint/revoke writes are Edge (service-role) only.';
  END IF;
  IF to_regclass('public.api_key_audit') IS NOT NULL THEN
    COMMENT ON TABLE public.api_key_audit IS
      'Audit log for API key usage and lifecycle events. SELECT-only RLS by design; inserts are Edge (service-role) only.';
  END IF;
END $$;

-- ===========================================================================
-- K. Revoke PG17 MAINTAIN from authenticated (atlas_* tables + xp_events)
--    Supabase default privileges GRANT ALL on new public tables, which on
--    PG17 includes MAINTAIN (VACUUM / ANALYZE / REINDEX / CLUSTER / REFRESH /
--    LOCK TABLE). API clients never need it. Guarded per table with
--    to_regclass (no-op when a table is absent) and by server version
--    (MAINTAIN is not a privilege keyword before PG17).
-- ===========================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  IF current_setting('server_version_num')::INT < 170000 THEN
    RAISE NOTICE '1765700000: server < PG17, MAINTAIN privilege does not exist; section K skipped';
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'atlas_identities',
    'atlas_progress_snapshots',
    'atlas_proof_drafts',
    'atlas_fresh_check_attempts',
    'atlas_validation_sessions',
    'atlas_validation_scores',
    'atlas_link_checks',
    'xp_events'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('REVOKE MAINTAIN ON TABLE public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;
