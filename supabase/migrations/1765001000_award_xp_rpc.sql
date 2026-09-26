-- Migration: award_xp 3-arg convenience overload (Gamification P0 follow-up)
-- Created at: 1765000000
--
-- Complements 1764910000_gamification_atomic_xp.sql (canonical RPC, kept as-is):
--   public.award_xp(p_uid UUID, p_delta INTEGER, p_idempotency_key TEXT,
--                   p_action TEXT, p_entity_id TEXT)
-- performs the atomic UPDATE user_profiles SET total_xp = total_xp + p_delta
-- (single UPDATE, no lost updates) with the UNIQUE(user_id, action, entity_id)
-- idempotency guard on public.xp_events plus UNIQUE(idempotency_key).
--
-- This file adds ONLY:
--   1. a thin 3-arg overload award_xp(p_delta INT, p_action TEXT, p_entity_id TEXT)
--      for callers that already run as the authenticated user (resolves the
--      caller via auth.uid() and delegates to the canonical 5-arg RPC, so all
--      writes stay atomic through the single canonical path);
--   2. the research_achievements dedupe index backing the
--      INSERT INTO research_achievements ... ON CONFLICT DO NOTHING pattern
--      used by the achievement path (UNIQUE(user_id, achievement_type)).
--
-- Reversible: DROP FUNCTION public.award_xp(INTEGER, TEXT, TEXT);
-- DROP INDEX IF EXISTS public.uq_research_achievements_user_type;

-- ---------------------------------------------------------------------------
-- 1. Backing unique indexes for the ON CONFLICT DO NOTHING guards.
-- ---------------------------------------------------------------------------

-- Idempotency ledger guard (created in 1764910000); re-asserted idempotently.
CREATE UNIQUE INDEX IF NOT EXISTS uq_xp_events_user_action_entity
  ON public.xp_events (user_id, action, entity_id);

-- Achievement dedupe guard: allows
--   INSERT INTO research_achievements (user_id, achievement_type, ...)
--   ON CONFLICT DO NOTHING
-- without double-awarding.
CREATE UNIQUE INDEX IF NOT EXISTS uq_research_achievements_user_type
  ON public.research_achievements (user_id, achievement_type);

-- ---------------------------------------------------------------------------
-- 2. Convenience overload: award_xp(p_delta INT, p_action TEXT, p_entity_id TEXT)
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so it can delegate to the canonical RPC; pins search_path
-- per the RLS audit (every effective SECURITY DEFINER function must pin it).
-- Atomicity note: this wrapper performs no direct writes itself — the
-- canonical 5-arg award_xp() performs the atomic
-- UPDATE user_profiles SET total_xp = total_xp + p_delta in one statement.

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
    COALESCE(p_entity_id, '')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_xp(INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.award_xp(INTEGER, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_xp(INTEGER, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.award_xp(INTEGER, TEXT, TEXT) IS
  'Convenience overload: resolves the caller via auth.uid() and delegates to the canonical atomic award_xp(UUID, INTEGER, TEXT, TEXT, TEXT).';
