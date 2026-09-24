-- Migration: topic_* junction parent-ownership WITH CHECK
-- Created at: 1765200000
--
-- Phase 2B P1: close IDOR on topic junction INSERT/UPDATE. After
-- 1765100000, live policies still only bind (select auth.uid()) = user_id.
-- A caller can therefore attach another user's topic_id (or note/paper/idea)
-- as long as the junction row itself is stamped with their user_id.
--
-- This stamp recreates the existing ALL policies (same names as live after
-- 1765100000) so WITH CHECK also requires:
--   1. junction user_id = (select auth.uid())           -- initPlan form
--   2. parent topics.user_id = (select auth.uid())
--   3. entity-side owner match when the junction has note_id / paper_id /
--      idea_id (topic_quests has no child entity FK)
-- USING stays owner-scoped; SELECT/DELETE are not weakened. No FORCE RLS,
-- no Auth settings, no Edge JWT, no save_idea_with_links rewrite.
--
-- Live apply: ONLY this stamp on project zsjczlmzhyzewpehmngc after Migration
-- Safety + Architect LGTM. Do NOT wholesale-apply tip 1764800000–1765000000.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY, DROP TRIGGER IF EXISTS,
-- to_regclass guards, CREATE OR REPLACE function.

-- Defense-in-depth: same-owner trigger from tip 1764800000 (absent on live
-- and not reintroduced by 1765100000). Narrowly scoped to the three entity
-- junctions; topic_quests is covered by RLS WITH CHECK below. Revoke
-- EXECUTE so the DEFINER helper cannot be called as an RPC.
CREATE OR REPLACE FUNCTION public.enforce_topic_link_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Topic link ownership violation: user_id is required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.topics
    WHERE id = NEW.topic_id
      AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Topic link ownership violation: topic % does not belong to user %', NEW.topic_id, NEW.user_id
      USING ERRCODE = '42501';
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'topic_notes' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.notes
        WHERE id = NEW.note_id
          AND user_id = NEW.user_id
      ) THEN
        RAISE EXCEPTION 'Topic link ownership violation: note % does not belong to user %', NEW.note_id, NEW.user_id
          USING ERRCODE = '42501';
      END IF;
    WHEN 'topic_papers' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.papers
        WHERE id = NEW.paper_id
          AND user_id = NEW.user_id
      ) THEN
        RAISE EXCEPTION 'Topic link ownership violation: paper % does not belong to user %', NEW.paper_id, NEW.user_id
          USING ERRCODE = '42501';
      END IF;
    WHEN 'topic_ideas' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.ideas
        WHERE id = NEW.idea_id
          AND user_id = NEW.user_id
      ) THEN
        RAISE EXCEPTION 'Topic link ownership violation: idea % does not belong to user %', NEW.idea_id, NEW.user_id
          USING ERRCODE = '42501';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unsupported topic link table: %', TG_TABLE_NAME
        USING ERRCODE = '42809';
  END CASE;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_topic_link_ownership() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_topic_link_ownership() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_topic_link_ownership() FROM authenticated;

DO $$
BEGIN
  IF to_regclass('public.topic_notes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS validate_topic_notes_ownership ON public.topic_notes;
    CREATE TRIGGER validate_topic_notes_ownership
      BEFORE INSERT OR UPDATE ON public.topic_notes
      FOR EACH ROW EXECUTE FUNCTION public.enforce_topic_link_ownership();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.topic_papers') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS validate_topic_papers_ownership ON public.topic_papers;
    CREATE TRIGGER validate_topic_papers_ownership
      BEFORE INSERT OR UPDATE ON public.topic_papers
      FOR EACH ROW EXECUTE FUNCTION public.enforce_topic_link_ownership();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.topic_ideas') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS validate_topic_ideas_ownership ON public.topic_ideas;
    CREATE TRIGGER validate_topic_ideas_ownership
      BEFORE INSERT OR UPDATE ON public.topic_ideas
      FOR EACH ROW EXECUTE FUNCTION public.enforce_topic_link_ownership();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.topic_notes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users manage own topic_notes" ON public.topic_notes;
    CREATE POLICY "Users manage own topic_notes"
      ON public.topic_notes
      USING ((select auth.uid()) = user_id)
      WITH CHECK (
        (select auth.uid()) = user_id
        AND EXISTS (
          SELECT 1 FROM public.topics t
          WHERE t.id = topic_id
            AND t.user_id = (select auth.uid())
        )
        AND EXISTS (
          SELECT 1 FROM public.notes n
          WHERE n.id = note_id
            AND n.user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.topic_papers') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users manage own topic_papers" ON public.topic_papers;
    CREATE POLICY "Users manage own topic_papers"
      ON public.topic_papers
      USING ((select auth.uid()) = user_id)
      WITH CHECK (
        (select auth.uid()) = user_id
        AND EXISTS (
          SELECT 1 FROM public.topics t
          WHERE t.id = topic_id
            AND t.user_id = (select auth.uid())
        )
        AND EXISTS (
          SELECT 1 FROM public.papers p
          WHERE p.id = paper_id
            AND p.user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.topic_ideas') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users manage own topic_ideas" ON public.topic_ideas;
    CREATE POLICY "Users manage own topic_ideas"
      ON public.topic_ideas
      USING ((select auth.uid()) = user_id)
      WITH CHECK (
        (select auth.uid()) = user_id
        AND EXISTS (
          SELECT 1 FROM public.topics t
          WHERE t.id = topic_id
            AND t.user_id = (select auth.uid())
        )
        AND EXISTS (
          SELECT 1 FROM public.ideas i
          WHERE i.id = idea_id
            AND i.user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.topic_quests') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users manage own topic quests" ON public.topic_quests;
    CREATE POLICY "Users manage own topic quests"
      ON public.topic_quests
      USING ((select auth.uid()) = user_id)
      WITH CHECK (
        (select auth.uid()) = user_id
        AND EXISTS (
          SELECT 1 FROM public.topics t
          WHERE t.id = topic_id
            AND t.user_id = (select auth.uid())
        )
      );
  END IF;
END $$;
