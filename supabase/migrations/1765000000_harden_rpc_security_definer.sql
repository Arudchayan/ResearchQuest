-- Mirror of production `harden_rpc_security_definer` (project researchquest /
-- zsjczlmzhyzewpehmngc). Safe to re-apply: CREATE OR REPLACE + targeted
-- REVOKE/GRANT. Does not rewrite user data.
--
-- 1. save_idea_with_links: require auth.uid(), reject spoofed p_user_id,
--    insert/update as the caller only (SECURITY DEFINER IDOR).
-- 2. search_notes / search_papers / search_ideas / global_search: require
--    auth and bind to auth.uid(); search_user_id is kept for compatibility
--    but must equal the caller.
-- 3. Revoke EXECUTE on ensure_user_id, handle_new_user, evaluate_user_streaks
--    from PUBLIC / anon / authenticated (streaks rewrote every profile).
-- 4. Revoke anon EXECUTE on save_idea + search RPCs; grant authenticated only.
-- 5. Pin search_path=public on those functions and update_updated_at_column.

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
AS $$
DECLARE
  caller uuid := auth.uid();
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
      caller,
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
      AND user_id = caller
    RETURNING * INTO result;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Idea % not found for user %', p_idea_id, caller;
    END IF;
  END IF;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_notes(
  search_user_id uuid,
  search_query text,
  limit_count int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title varchar(255),
  markdown_body text,
  tags text[],
  linked_entity_ids text[],
  created_at timestamptz,
  updated_at timestamptz,
  rank real
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
    n.id,
    n.user_id,
    n.title,
    n.markdown_body,
    n.tags,
    n.linked_entity_ids,
    n.created_at,
    n.updated_at,
    ts_rank(
      to_tsvector('english', n.markdown_body || ' ' || COALESCE(n.title, '')),
      plainto_tsquery('english', search_query)
    ) AS rank
  FROM notes n
  WHERE
    n.user_id = auth.uid()
    AND to_tsvector('english', n.markdown_body || ' ' || COALESCE(n.title, ''))
        @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, n.updated_at DESC
  LIMIT limit_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_papers(
  search_user_id uuid,
  search_query text,
  limit_count int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  authors text[],
  doi text,
  source_url text,
  status varchar(50),
  topic_ids text[],
  abstract text,
  publication_date text,
  created_at timestamptz,
  updated_at timestamptz,
  rank real
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
    p.id,
    p.user_id,
    p.title,
    p.authors,
    p.doi,
    p.source_url,
    p.status,
    p.topic_ids,
    p.abstract,
    p.publication_date,
    p.created_at,
    p.updated_at,
    ts_rank(
      to_tsvector(
        'english',
        p.title || ' ' || COALESCE(p.abstract, '') || ' ' || array_to_string(p.authors, ' ')
      ),
      plainto_tsquery('english', search_query)
    ) AS rank
  FROM papers p
  WHERE
    p.user_id = auth.uid()
    AND to_tsvector(
          'english',
          p.title || ' ' || COALESCE(p.abstract, '') || ' ' || array_to_string(p.authors, ' ')
        ) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, p.updated_at DESC
  LIMIT limit_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_ideas(
  search_user_id uuid,
  search_query text,
  limit_count int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  description text,
  stage varchar(50),
  created_at timestamptz,
  updated_at timestamptz,
  rank real
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
    i.id,
    i.user_id,
    i.title,
    i.description,
    i.stage,
    i.created_at,
    i.updated_at,
    ts_rank(
      to_tsvector('english', i.title || ' ' || COALESCE(i.description, '')),
      plainto_tsquery('english', search_query)
    ) AS rank
  FROM ideas i
  WHERE
    i.user_id = auth.uid()
    AND to_tsvector('english', i.title || ' ' || COALESCE(i.description, ''))
        @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, i.updated_at DESC
  LIMIT limit_count;
END;
$$;

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

  ORDER BY rank DESC, updated_at DESC
  LIMIT limit_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_notes(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_notes(uuid, text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_notes(uuid, text, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.search_papers(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_papers(uuid, text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_papers(uuid, text, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.search_ideas(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_ideas(uuid, text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_ideas(uuid, text, int) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.global_search(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.global_search(uuid, text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.global_search(uuid, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.ensure_user_id()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.ensure_user_id() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.ensure_user_id() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.ensure_user_id() FROM authenticated;
  END IF;

  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
  END IF;

  IF to_regprocedure('public.evaluate_user_streaks()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.evaluate_user_streaks() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.evaluate_user_streaks() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.evaluate_user_streaks() FROM authenticated;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      GRANT EXECUTE ON FUNCTION public.evaluate_user_streaks() TO service_role;
    END IF;
  END IF;
END $$;

COMMENT ON FUNCTION public.save_idea_with_links(uuid, uuid, text, text, text, text[], text[])
  IS 'Creates or updates an idea as auth.uid() only. p_user_id must match the caller.';

COMMENT ON FUNCTION public.global_search(uuid, text, int)
  IS 'Search notes/papers/ideas for auth.uid() only. search_user_id must match the caller.';
