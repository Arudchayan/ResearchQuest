-- Migration: backfill WITH CHECK on UPDATE policies + search_path hardening
-- Created at: 1764802000
--
-- Plan items 81 + 88 (PR3-rls).
--
-- (a) Item 81: UPDATE policies created before 1764800000_security_perf_hardening
--     only declare USING, so an UPDATE could move a row to a different user_id
--     without violating the policy's check. Recreate the six owner-scoped UPDATE
--     policies (tasks/papers/notes/ideas/daily_logs/links) with the
--     initPlan-friendly (select auth.uid()) USING + WITH CHECK form used by
--     1764800000 for topics. Each block touches only its own named policy
--     (targeted DROP + CREATE, no blanket drops).
--
-- (b) Item 88 support: legacy SECURITY DEFINER functions that were created
--     without SET search_path are redefined with byte-identical bodies plus
--     SET search_path = public, so the static RLS audit
--     (researchquest/src/test/supabase/rlsMigrationAudit.test.ts) observes a
--     hardened effective schema after all migrations are applied.
--
-- Reversible: roll back by re-running the original statements from
-- 1762555347_enable_rls_and_policies.sql (USING-only UPDATE policies),
-- 1762557806_enhance_papers_and_rls.sql (tasks USING-only UPDATE policy),
-- 1762555366_create_triggers_and_indexes.sql (handle_new_user without
-- search_path), 1762635000_topics_enhancements.sql (ensure_user_id without
-- search_path), and 1763005000_add_gamification_metadata.sql (handle_new_user
-- and evaluate_user_streaks without search_path).

-- ---------------------------------------------------------------------------
-- (a) WITH CHECK backfill for owner-scoped UPDATE policies.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
    CREATE POLICY "Users can update own tasks"
      ON public.tasks FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.papers') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can update own papers" ON public.papers;
    CREATE POLICY "Users can update own papers"
      ON public.papers FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.notes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
    CREATE POLICY "Users can update own notes"
      ON public.notes FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.ideas') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can update own ideas" ON public.ideas;
    CREATE POLICY "Users can update own ideas"
      ON public.ideas FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.daily_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can update own daily logs" ON public.daily_logs;
    CREATE POLICY "Users can update own daily logs"
      ON public.daily_logs FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.links') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can update own links" ON public.links;
    CREATE POLICY "Users can update own links"
      ON public.links FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- (b) SET search_path remediation for legacy SECURITY DEFINER functions.
-- Bodies are verbatim copies of the latest prior definitions; only
-- SET search_path = public is added.
-- ---------------------------------------------------------------------------

-- Latest prior definition: 1763005000_add_gamification_metadata.sql
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Latest prior definition: 1763005000_add_gamification_metadata.sql
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Latest prior definition: 1762635000_topics_enhancements.sql
CREATE OR REPLACE FUNCTION public.ensure_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
