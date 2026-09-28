-- Migration: save_idea_with_links -> SECURITY INVOKER + linked-entity ownership
--
-- Security residual (advisor 0029 authenticated_security_definer_function_executable):
-- public.save_idea_with_links was SECURITY DEFINER and executable by
-- `authenticated`. It already bound the idea row to auth.uid(), but because it
-- ran as the owner (RLS bypassed) it stored caller-supplied
-- p_linked_note_ids / p_linked_paper_ids without proving the caller owns them.
--
-- This migration:
--  1. Re-creates the function as SECURITY INVOKER so the caller's RLS applies
--     (ideas/notes/papers policies are all (select auth.uid()) = user_id).
--  2. Keeps the signature, parameter defaults and RETURNS public.ideas
--     identical, so PostgREST callers (useIdeas.ts, edge api entities.ts) are
--     unaffected.
--  3. Still requires auth.uid(), rejects a spoofed p_user_id and writes
--     user_id := auth.uid() (never the caller-supplied id).
--  4. Rejects non-UUID-shaped link ids (22P02). UUID-shaped ids are FILTERED
--     to rows the caller owns (order preserved, de-duplicated) rather than
--     raising 42501. Notes and papers are hard-deleted and nothing prunes
--     ideas.linked_*_ids; useIdeas.update re-sends the full arrays, so a
--     raise would make the idea permanently uneditable after a linked note
--     or paper is deleted. Because the function is SECURITY INVOKER, another
--     user's rows are invisible under RLS. Treating foreign and deleted ids
--     the same (silently dropped) avoids an existence oracle and never
--     stores a foreign link. This still closes advisor 0029.
--  5. NULL link arrays on UPDATE keep the stored arrays, then those stored
--     ids are filtered to owned rows as well.
--  6. Pins search_path = '' (every relation/function is schema-qualified;
--     pg_catalog is always searched implicitly).
--  7. REVOKE EXECUTE from PUBLIC/anon; GRANT to authenticated + service_role.
--
-- Re-runnable: CREATE OR REPLACE + idempotent REVOKE/GRANT. No table DDL.
-- Does NOT touch migrations 1764800000..1765000000 or any edge function.

CREATE OR REPLACE FUNCTION public.save_idea_with_links(
  p_user_id uuid,
  p_idea_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_stage text DEFAULT 'Seed',
  p_linked_note_ids text[] DEFAULT NULL,
  p_linked_paper_ids text[] DEFAULT NULL
)
RETURNS public.ideas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  cleaned_title text;
  cleaned_description text;
  next_stage text;
  result public.ideas;
  existing_note_ids text[];
  existing_paper_ids text[];
  next_note_ids text[];
  next_paper_ids text[];
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'permission denied'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM caller THEN
    RAISE EXCEPTION 'permission denied'
      USING ERRCODE = '42501';
  END IF;

  cleaned_title := pg_catalog.btrim(coalesce(p_title, ''));
  IF cleaned_title = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;

  cleaned_description := nullif(pg_catalog.btrim(coalesce(p_description, '')), '');
  next_stage := coalesce(nullif(pg_catalog.btrim(coalesce(p_stage, '')), ''), 'Seed');

  IF next_stage NOT IN ('Seed', 'Developing', 'Supported', 'Mature') THEN
    RAISE EXCEPTION 'invalid idea stage: %', next_stage;
  END IF;

  IF p_idea_id IS NULL THEN
    next_note_ids := coalesce(p_linked_note_ids, '{}'::text[]);
    next_paper_ids := coalesce(p_linked_paper_ids, '{}'::text[]);
  ELSE
    SELECT i.linked_note_ids, i.linked_paper_ids
      INTO existing_note_ids, existing_paper_ids
    FROM public.ideas AS i
    WHERE i.id = p_idea_id
      AND i.user_id = caller;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Idea % not found for user %', p_idea_id, caller;
    END IF;

    -- NULL arrays on update keep stored links; those stored ids are
    -- filtered to owned rows below (dead links dropped).
    next_note_ids := coalesce(p_linked_note_ids, existing_note_ids, '{}'::text[]);
    next_paper_ids := coalesce(p_linked_paper_ids, existing_paper_ids, '{}'::text[]);
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.unnest(next_note_ids) AS t(v)
    WHERE t.v IS NULL OR t.v !~ uuid_re
  ) THEN
    RAISE EXCEPTION 'linked_note_ids must be an array of UUIDs'
      USING ERRCODE = '22P02';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.unnest(next_paper_ids) AS t(v)
    WHERE t.v IS NULL OR t.v !~ uuid_re
  ) THEN
    RAISE EXCEPTION 'linked_paper_ids must be an array of UUIDs'
      USING ERRCODE = '22P02';
  END IF;

  -- UUID-shaped ids: keep only rows the caller owns. Deleted and foreign
  -- ids are indistinguishable under INVOKER RLS, so both are dropped.
  -- Preserve first-seen order and de-duplicate.
  SELECT coalesce(pg_catalog.array_agg(s.x ORDER BY s.min_ord), '{}'::text[])
    INTO next_note_ids
  FROM (
    SELECT u.x, min(u.ord) AS min_ord
    FROM pg_catalog.unnest(next_note_ids) WITH ORDINALITY AS u(x, ord)
    WHERE EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = u.x::uuid AND n.user_id = caller
    )
    GROUP BY u.x
  ) AS s;

  SELECT coalesce(pg_catalog.array_agg(s.x ORDER BY s.min_ord), '{}'::text[])
    INTO next_paper_ids
  FROM (
    SELECT u.x, min(u.ord) AS min_ord
    FROM pg_catalog.unnest(next_paper_ids) WITH ORDINALITY AS u(x, ord)
    WHERE EXISTS (
      SELECT 1 FROM public.papers p
      WHERE p.id = u.x::uuid AND p.user_id = caller
    )
    GROUP BY u.x
  ) AS s;

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
      caller,
      cleaned_title,
      cleaned_description,
      next_stage,
      next_note_ids,
      next_paper_ids,
      pg_catalog.now()
    )
    RETURNING * INTO result;
  ELSE
    UPDATE public.ideas AS i
    SET
      title = cleaned_title,
      description = cleaned_description,
      stage = next_stage,
      linked_note_ids = next_note_ids,
      linked_paper_ids = next_paper_ids,
      updated_at = pg_catalog.now()
    WHERE i.id = p_idea_id
      AND i.user_id = caller
    RETURNING i.* INTO result;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Idea % not found for user %', p_idea_id, caller;
    END IF;
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[]) TO service_role;

COMMENT ON FUNCTION public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[])
  IS 'SECURITY INVOKER. Creates or updates an idea as auth.uid() only (RLS applies). p_user_id must match the caller. UUID-shaped linked note/paper ids are filtered to rows the caller owns (deleted and foreign ids dropped together so the function is not an existence oracle); non-UUID-shaped ids raise 22P02. NULL link arrays on update keep then filter stored ids.';
