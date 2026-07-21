-- Round 2 security hardening for ownership checks and privileged RPCs.

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

DO $$
BEGIN
  IF to_regclass('public.topics') IS NOT NULL
     AND to_regclass('public.topic_quests') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS validate_topic_quests_topic_ownership
      ON public.topic_quests;

    CREATE TRIGGER validate_topic_quests_topic_ownership
      BEFORE INSERT OR UPDATE ON public.topic_quests
      FOR EACH ROW EXECUTE FUNCTION public.enforce_topic_quest_topic_ownership();
  END IF;
END $$;

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

DO $$
BEGIN
  IF to_regclass('public.feed_sources') IS NOT NULL
     AND to_regclass('public.feed_items') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS validate_feed_item_source_ownership
      ON public.feed_items;

    CREATE TRIGGER validate_feed_item_source_ownership
      BEFORE INSERT OR UPDATE ON public.feed_items
      FOR EACH ROW EXECUTE FUNCTION public.enforce_feed_item_source_ownership();
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.save_idea_with_links(uuid,uuid,text,text,text,text[],text[])') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.save_idea_with_links(
        p_user_id uuid,
        p_idea_id uuid default null,
        p_title text default null,
        p_description text default null,
        p_stage text default 'Seed',
        p_linked_note_ids text[] default null,
        p_linked_paper_ids text[] default null
      )
      RETURNS public.ideas
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        cleaned_title text;
        cleaned_description text;
        next_stage text;
        result public.ideas;
      BEGIN
        IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
          RAISE EXCEPTION 'permission denied'
            USING ERRCODE = '42501';
        END IF;

        cleaned_title := trim(coalesce(p_title, ''));
        IF cleaned_title = '' THEN
          RAISE EXCEPTION 'title is required';
        END IF;

        cleaned_description := nullif(trim(coalesce(p_description, '')), '');
        next_stage := coalesce(nullif(trim(coalesce(p_stage, '')), ''), 'Seed');

        IF next_stage NOT IN ('Seed', 'Developing', 'Supported', 'Mature') THEN
          RAISE EXCEPTION 'invalid idea stage: %', next_stage;
        END IF;

        IF p_idea_id IS NULL THEN
          INSERT INTO public.ideas (
            user_id,
            title,
            description,
            stage,
            linked_note_ids,
            linked_paper_ids,
            updated_at
          )
          VALUES (
            p_user_id,
            cleaned_title,
            cleaned_description,
            next_stage,
            coalesce(p_linked_note_ids, '{}'),
            coalesce(p_linked_paper_ids, '{}'),
            now()
          )
          RETURNING * INTO result;
        ELSE
          UPDATE public.ideas
          SET
            title = cleaned_title,
            description = cleaned_description,
            stage = next_stage,
            linked_note_ids = coalesce(p_linked_note_ids, public.ideas.linked_note_ids),
            linked_paper_ids = coalesce(p_linked_paper_ids, public.ideas.linked_paper_ids),
            updated_at = now()
          WHERE id = p_idea_id
            AND user_id = p_user_id
          RETURNING * INTO result;

          IF NOT FOUND THEN
            RAISE EXCEPTION 'Idea % not found for user %', p_idea_id, p_user_id;
          END IF;
        END IF;

        RETURN result;
      END;
      $body$;
    $fn$;

    REVOKE EXECUTE ON FUNCTION public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[]) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[]) FROM anon;
    GRANT EXECUTE ON FUNCTION public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[]) TO authenticated;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.evaluate_user_streaks()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.evaluate_user_streaks() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.evaluate_user_streaks() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.evaluate_user_streaks() FROM authenticated;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      GRANT EXECUTE ON FUNCTION public.evaluate_user_streaks() TO service_role;
    END IF;
  END IF;
END $$;
