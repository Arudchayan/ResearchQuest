-- Migration: XP anti-farming caps + achievement RPC + global_search task/topic parity
-- Created at: 1765003000
--
-- Complements (does not edit) 1764910000_gamification_atomic_xp.sql (canonical
-- award_xp), 1765001000_award_xp_rpc.sql (3-arg overload + dedupe indexes),
-- and 1765000000_harden_rpc_security_definer.sql (production global_search).
--
-- 1. global_search parity: also return task and topic rows (title + snippet +
--    rank + updated_at, same contract as note/paper/idea branches) so server
--    results no longer drop tasks/topics. The client's union fallback in
--    CommandPalette.tsx is kept intact for demo mode / RPC failure.
-- 2. STREAK AUTHORITY: local calendar day. The client computes "today" with
--    todayKey() (device-local YYYY-MM-DD, see researchquest/src/utils/time.ts)
--    and passes it as p_local_day; the server validates it (sane range around
--    the server UTC date) and uses it for streak math and the daily_logs /
--    cap windows. NULL (old 3-arg overload callers) falls back to the UTC day.
--    Local-day wins because the existing UI contract (daily missions,
--    daily_logs DATE semantics, dashboard day math) is local-midnight based;
--    UTC would roll streaks over at the wrong local hour away from UTC.
-- 3. Anti-farming policy inside the award_xp RPC path (never client-only):
--      - update_note credits 0 XP (activity still counts toward the streak).
--      - complete_focus_session requires a >= 25 min session (via
--        p_duration_minutes; unknown duration credits 0) plus a cooldown
--        (300 s between focus awards) and a daily cap (240 XP).
--      - per-action daily caps (credited XP summed from xp_events over the
--        local-day window); requests above the remaining cap are clamped,
--        never rejected, so callers see xp_credited = 0 instead of an error.
--      - p_delta = 0 is accepted (no-op credit, streak still processed);
--        only NULL / negative / > 1000 deltas are rejected.
--    xp_events.xp now stores the CREDITED amount (was: requested) so cap
--    accounting sums what was actually granted. Count columns
--    (notes/papers/tasks/insights) still increment per action regardless of
--    credit: counts track entities created, achievements track counts.
-- 4. award_achievement_xp RPC: atomic achievement insert (ON CONFLICT DO
--    NOTHING against uq_research_achievements_user_type) + total_xp increment
--    in one transaction, so the client never writes total_xp directly for
--    achievements. Achievement XP is uncapped (one-time, deduped) and does
--    not touch streaks (matches the legacy client semantics).
--
-- Reversible: DROP FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT,
-- TEXT); DROP FUNCTION public.award_xp(INTEGER, TEXT, TEXT); DROP FUNCTION
-- public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER); re-apply
-- 1764910000 + 1765001000 + 1765000000 to restore the previous RPC bodies
-- (xp_events.xp values written by this version remain credited amounts).

-- ---------------------------------------------------------------------------
-- 1. global_search: add task + topic branches.
-- ---------------------------------------------------------------------------

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
  SELECT
    'note'::text AS entity_type,
    n.id AS entity_id,
    COALESCE(n.title, 'Untitled') AS title,
    LEFT(n.markdown_body, 200) AS snippet,
    ts_rank(
      to_tsvector('english', n.markdown_body || ' ' || COALESCE(n.title, '')),
      plainto_tsquery('english', search_query)
    ) AS rank,
    n.updated_at
  FROM notes n
  WHERE
    n.user_id = auth.uid()
    AND to_tsvector('english', n.markdown_body || ' ' || COALESCE(n.title, ''))
        @@ plainto_tsquery('english', search_query)

  UNION ALL

  SELECT
    'paper'::text,
    p.id,
    p.title,
    LEFT(COALESCE(p.abstract, ''), 200),
    ts_rank(
      to_tsvector(
        'english',
        p.title || ' ' || COALESCE(p.abstract, '') || ' ' || array_to_string(p.authors, ' ')
      ),
      plainto_tsquery('english', search_query)
    ),
    p.updated_at
  FROM papers p
  WHERE
    p.user_id = auth.uid()
    AND to_tsvector(
          'english',
          p.title || ' ' || COALESCE(p.abstract, '') || ' ' || array_to_string(p.authors, ' ')
        ) @@ plainto_tsquery('english', search_query)

  UNION ALL

  SELECT
    'idea'::text,
    i.id,
    i.title,
    LEFT(COALESCE(i.description, ''), 200),
    ts_rank(
      to_tsvector('english', i.title || ' ' || COALESCE(i.description, '')),
      plainto_tsquery('english', search_query)
    ),
    i.updated_at
  FROM ideas i
  WHERE
    i.user_id = auth.uid()
    AND to_tsvector('english', i.title || ' ' || COALESCE(i.description, ''))
        @@ plainto_tsquery('english', search_query)

  UNION ALL

  SELECT
    'task'::text,
    t.id,
    t.title,
    LEFT(COALESCE(t.description, ''), 200),
    ts_rank(
      to_tsvector('english', t.title || ' ' || COALESCE(t.description, '')),
      plainto_tsquery('english', search_query)
    ),
    t.updated_at
  FROM tasks t
  WHERE
    t.user_id = auth.uid()
    AND to_tsvector('english', t.title || ' ' || COALESCE(t.description, ''))
        @@ plainto_tsquery('english', search_query)

  UNION ALL

  SELECT
    'topic'::text,
    tp.id,
    tp.name,
    LEFT(COALESCE(tp.description, ''), 200),
    ts_rank(
      to_tsvector('english', tp.name || ' ' || COALESCE(tp.description, '')),
      plainto_tsquery('english', search_query)
    ),
    tp.updated_at
  FROM topics tp
  WHERE
    tp.user_id = auth.uid()
    AND to_tsvector('english', tp.name || ' ' || COALESCE(tp.description, ''))
        @@ plainto_tsquery('english', search_query)

  ORDER BY rank DESC, updated_at DESC
  LIMIT limit_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.global_search(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.global_search(uuid, text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.global_search(uuid, text, int) TO authenticated;

COMMENT ON FUNCTION public.global_search(uuid, text, int)
  IS 'Search notes/papers/ideas/tasks/topics for auth.uid() only. search_user_id must match the caller.';

-- ---------------------------------------------------------------------------
-- 2-4. award_xp with local-day streaks + server-side anti-farming policy,
--      plus the atomic award_achievement_xp RPC.
-- ---------------------------------------------------------------------------

-- The 3-arg overload delegates to the canonical 5-arg form, so drop it first,
-- then the canonical form, then recreate both (defaults keep every existing
-- call shape working).
--
-- Cap accounting is day-aligned: xp_events gains a local_day DATE stamped by
-- the writer (backfilled from created_at for older rows), so the per-action
-- daily window matches the streak day instead of a server-midnight
-- timestamptz range that skews for non-UTC users.
ALTER TABLE public.xp_events ADD COLUMN IF NOT EXISTS local_day DATE;
UPDATE public.xp_events SET local_day = (created_at AT TIME ZONE 'UTC')::DATE
WHERE local_day IS NULL;
DROP FUNCTION IF EXISTS public.award_xp(INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.award_xp(
  p_uid UUID,
  p_delta INTEGER,
  p_idempotency_key TEXT DEFAULT NULL,
  p_action TEXT DEFAULT 'generic',
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
  -- STREAK AUTHORITY: local calendar day (see header comment). p_local_day is
  -- the client's todayKey(); accept it when it is within +-1 day of the
  -- server UTC date (covers all timezones + mild clock skew), else fall back
  -- to the UTC day so a spoofed/far-future date can neither farm streaks nor
  -- break cap windows.
  v_utc_day DATE := (now() AT TIME ZONE 'UTC')::DATE;
  v_today DATE;
  v_profile public.user_profiles%ROWTYPE;
  v_days_diff INTEGER;
  v_new_streak INTEGER := 1;
  v_freeze INTEGER := 0;
  v_longest INTEGER := 0;
  v_ledger_rows INTEGER := 0;
  v_key TEXT;
  v_action TEXT := COALESCE(NULLIF(trim(COALESCE(p_action, '')), ''), 'generic');
  v_entity TEXT := COALESCE(p_entity_id, '');
  v_requested INTEGER := COALESCE(p_delta, -1);
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
  IF auth.uid() IS NULL OR auth.uid() <> p_uid THEN
    RAISE EXCEPTION 'permission denied'
      USING ERRCODE = '42501';
  END IF;

  -- 0 is a valid no-op credit (e.g. update_note); only NULL / negative /
  -- absurd deltas are rejected.
  IF p_delta IS NULL OR p_delta < 0 OR p_delta > 1000 THEN
    RAISE EXCEPTION 'invalid XP delta: %', p_delta;
  END IF;

  IF p_local_day IS NOT NULL
     AND p_local_day >= v_utc_day - 1
     AND p_local_day <= v_utc_day + 1 THEN
    v_today := p_local_day;
  ELSE
    v_today := v_utc_day;
  END IF;

  -- ---- Server-side anti-farming policy (authoritative; the client only
  -- mirrors these values for display, see utils/gamification.ts). ----
  v_credited := v_requested;

  -- update_note: 0 XP (blocks keystroke-save farming).
  IF v_action = 'update_note' THEN
    v_credited := 0;
  END IF;

  -- complete_focus_session: needs a >= 25 min session. p_duration_minutes is
  -- authoritative; when the caller omits it there is no trustworthy duration
  -- (p_delta may carry a boost multiplier), so credit 0.
  IF v_action = 'complete_focus_session' THEN
    IF p_duration_minutes IS NULL THEN
      v_credited := 0;
    ELSE
      v_duration := GREATEST(0, LEAST(COALESCE(p_duration_minutes, 0), 1440));
      IF v_duration < 25 THEN
        v_credited := 0;
      END IF;
    END IF;
  END IF;

  -- Per-action daily caps over the local-day window (xp_events.xp stores
  -- credited amounts, so this sums what was actually granted).
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
    WHEN 'generic' THEN 500
    ELSE 200
  END;

  SELECT COALESCE(SUM(xp), 0) INTO v_used_today
  FROM public.xp_events
  WHERE user_id = p_uid
    AND action = v_action
    AND local_day = v_today;

  v_credited := GREATEST(0, LEAST(v_credited, v_cap - v_used_today));

  -- Cooldowns (seconds since the last credited award of the same action).
  -- Only focus has one: sessions last >= 25 min, so a 300 s cooldown is
  -- invisible to legitimate use and stops double-submit / reload bursts
  -- (focus awards carry no entity id, so the ledger dedupe cannot catch them).
  IF v_action = 'complete_focus_session' AND v_credited > 0 THEN
    SELECT max(created_at) INTO v_last_award
    FROM public.xp_events
    WHERE user_id = p_uid
      AND action = 'complete_focus_session'
      AND xp > 0;

    IF v_last_award IS NOT NULL
       AND EXTRACT(EPOCH FROM (now() - v_last_award)) < 300 THEN
      v_credited := 0;
    END IF;
  END IF;

  -- Idempotency ledger: single INSERT with ON CONFLICT DO NOTHING covers both
  -- the UNIQUE(idempotency_key) and UNIQUE(user_id, action, entity_id) guards.
  -- Only ledgered when the caller supplies a key or an entity id; legacy
  -- fire-and-forget awards (no entity) skip the ledger to avoid false dupes.
  -- The ledger stores the CREDITED amount so daily caps sum granted XP.
  IF p_idempotency_key IS NOT NULL OR v_entity <> '' THEN
    v_key := COALESCE(
      NULLIF(p_idempotency_key, ''),
      'auto:' || p_uid::TEXT || ':' || v_action || ':' || v_entity
    );

    INSERT INTO public.xp_events (user_id, action, entity_id, xp, idempotency_key, local_day)
    VALUES (p_uid, v_action, v_entity, v_credited, v_key, v_today)
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
  ELSE
    -- No ledger row for fire-and-forget awards: still record the credited
    -- amount for cap accounting. The UNIQUE(user_id, action, entity_id) guard
    -- cannot apply (entity is ''), so stamp a unique auto key per call.
    -- Zero-credit awards (e.g. update_note) skip the ledger entirely: they
    -- would otherwise bloat xp_events with xp=0 rows on every keystroke-save
    -- while contributing nothing to cap sums.
    IF v_credited > 0 THEN
      INSERT INTO public.xp_events (user_id, action, entity_id, xp, idempotency_key, local_day)
      VALUES (
        p_uid, v_action, v_entity, v_credited,
        'auto:' || p_uid::TEXT || ':' || v_action || ':'
          || EXTRACT(EPOCH FROM clock_timestamp())::TEXT || ':' || gen_random_uuid()::TEXT,
        v_today
      );
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
    total_xp = p.total_xp + v_credited,
    current_level = ((p.total_xp + v_credited) / 500) + 1,
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

  -- Upsert the local-day daily log with the credited amount.
  INSERT INTO public.daily_logs (user_id, date, xp_earned, streak_count)
  VALUES (p_uid, v_today, v_credited, v_new_streak)
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
  xp_credited := v_credited;
  is_duplicate := FALSE;
  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER) IS
  'Atomic XP award: single UPDATE (no lost updates), LOCAL-day streaks via p_local_day (UTC fallback), idempotency via xp_events, server-side anti-farming caps/cooldowns (update_note 0 XP, focus >= 25 min + 300 s cooldown + daily caps). Canonical writer for user_profiles.total_xp.';

-- Convenience overload (unchanged contract): resolves the caller via
-- auth.uid() and delegates with NULL local day (UTC fallback) and NULL
-- duration (focus awards via this overload credit 0 — pass p_duration_minutes
-- through the canonical form instead).
CREATE OR REPLACE FUNCTION public.award_xp(
  p_delta INTEGER,
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
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.award_xp(
    v_uid,
    p_delta,
    NULL,
    COALESCE(NULLIF(trim(COALESCE(p_action, '')), ''), 'generic'),
    COALESCE(p_entity_id, ''),
    NULL,
    NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_xp(INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_xp(INTEGER, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_xp(INTEGER, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.award_xp(INTEGER, TEXT, TEXT) IS
  'Convenience overload: resolves the caller via auth.uid() and delegates to the canonical atomic award_xp(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER).';

-- ---------------------------------------------------------------------------
-- 4. award_achievement_xp: atomic achievement insert + XP credit.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.award_achievement_xp(
  p_achievement_type TEXT,
  p_xp INTEGER,
  p_title TEXT DEFAULT '',
  p_description TEXT DEFAULT ''
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
  v_type TEXT := NULLIF(trim(COALESCE(p_achievement_type, '')), '');
  v_rows INTEGER := 0;
BEGIN
  IF v_uid IS NULL OR v_type IS NULL THEN
    RAISE EXCEPTION 'permission denied'
      USING ERRCODE = '42501';
  END IF;

  IF p_xp IS NULL OR p_xp <= 0 OR p_xp > 500 THEN
    RAISE EXCEPTION 'invalid achievement XP: %', p_xp;
  END IF;

  -- Dedupe against uq_research_achievements_user_type (created in 1765001000).
  -- Explicit arbiter: bare ON CONFLICT would misreport unrelated PK
  -- conflicts as duplicates and silently lose dedupe out-of-order.
  INSERT INTO public.research_achievements (user_id, achievement_type, title, description, xp_awarded)
  VALUES (v_uid, v_type, NULLIF(trim(COALESCE(p_title, ''))), NULLIF(trim(COALESCE(p_description, ''))), p_xp)
  ON CONFLICT (user_id, achievement_type) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    SELECT t.total_xp, (t.total_xp / 500) + 1
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
    total_xp = p.total_xp + p_xp,
    current_level = ((p.total_xp + p_xp) / 500) + 1
  WHERE p.id = v_uid
  RETURNING p.total_xp, p.current_level
  INTO total_xp, current_level;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found for user %', v_uid;
  END IF;

  xp_credited := p_xp;
  is_duplicate := FALSE;
  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.award_achievement_xp(TEXT, INTEGER, TEXT, TEXT) IS
  'Atomic achievement award: deduped insert into research_achievements + total_xp increment in one transaction. Canonical writer for achievement XP (client must not write total_xp directly).';
