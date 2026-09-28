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
--  4. Rejects non-UUID link ids (22P02) and any linked note/paper id that is
--     not a row owned by auth.uid() (42501) - same semantics as the gateway's
--     verifyIdeaLinkOwnership for the API-key path.
--  5. Pins search_path = '' (every relation/function is schema-qualified;
--     pg_catalog is always searched implicitly).
--  6. REVOKE EXECUTE from PUBLIC/anon; GRANT to authenticated + service_role.
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

  -- Linked notes: UUID-shaped and owned by the caller.
  IF p_linked_note_ids IS NOT NULL AND pg_catalog.cardinality(p_linked_note_ids) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM pg_catalog.unnest(p_linked_note_ids) AS t(v)
      WHERE t.v IS NULL OR t.v !~ uuid_re
    ) THEN
      RAISE EXCEPTION 'linked_note_ids must be an array of UUIDs'
        USING ERRCODE = '22P02';
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_catalog.unnest(p_linked_note_ids) AS t(v)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notes n
        WHERE n.id = t.v::uuid AND n.user_id = caller
      )
    ) THEN
      RAISE EXCEPTION 'permission denied: linked note not owned by caller'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Linked papers: UUID-shaped and owned by the caller.
  IF p_linked_paper_ids IS NOT NULL AND pg_catalog.cardinality(p_linked_paper_ids) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM pg_catalog.unnest(p_linked_paper_ids) AS t(v)
      WHERE t.v IS NULL OR t.v !~ uuid_re
    ) THEN
      RAISE EXCEPTION 'linked_paper_ids must be an array of UUIDs'
        USING ERRCODE = '22P02';
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_catalog.unnest(p_linked_paper_ids) AS t(v)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.papers p
        WHERE p.id = t.v::uuid AND p.user_id = caller
      )
    ) THEN
      RAISE EXCEPTION 'permission denied: linked paper not owned by caller'
        USING ERRCODE = '42501';
    END IF;
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
      caller,
      cleaned_title,
      cleaned_description,
      next_stage,
      coalesce(p_linked_note_ids, '{}'::text[]),
      coalesce(p_linked_paper_ids, '{}'::text[]),
      pg_catalog.now()
    )
    RETURNING * INTO result;
  ELSE
    UPDATE public.ideas AS i
    SET
      title = cleaned_title,
      description = cleaned_description,
      stage = next_stage,
      linked_note_ids = coalesce(p_linked_note_ids, i.linked_note_ids),
      linked_paper_ids = coalesce(p_linked_paper_ids, i.linked_paper_ids),
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
  IS 'SECURITY INVOKER. Creates or updates an idea as auth.uid() only (RLS applies). p_user_id must match the caller; every linked note/paper id must be owned by the caller.';
