-- Full-Text Search Functions
-- This migration adds PostgreSQL full-text search functions

-- ============================================================================
-- SEARCH NOTES FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION search_notes(
  search_user_id UUID,
  search_query TEXT,
  limit_count INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title VARCHAR(255),
  markdown_body TEXT,
  tags TEXT[],
  linked_entity_ids TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rank REAL
)
LANGUAGE sql
STABLE
AS $$
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
    ) as rank
  FROM notes n
  WHERE 
    n.user_id = search_user_id
    AND to_tsvector('english', n.markdown_body || ' ' || COALESCE(n.title, ''))
        @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, n.updated_at DESC
  LIMIT limit_count;
$$;

COMMENT ON FUNCTION search_notes IS 'Full-text search across note content and titles';

-- ============================================================================
-- SEARCH PAPERS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION search_papers(
  search_user_id UUID,
  search_query TEXT,
  limit_count INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  authors TEXT[],
  doi TEXT,
  source_url TEXT,
  status VARCHAR(50),
  topic_ids TEXT[],
  abstract TEXT,
  publication_date TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rank REAL
)
LANGUAGE sql
STABLE
AS $$
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
      to_tsvector('english', 
        p.title || ' ' || 
        COALESCE(p.abstract, '') || ' ' || 
        array_to_string(p.authors, ' ')
      ),
      plainto_tsquery('english', search_query)
    ) as rank
  FROM papers p
  WHERE 
    p.user_id = search_user_id
    AND to_tsvector('english', 
          p.title || ' ' || 
          COALESCE(p.abstract, '') || ' ' || 
          array_to_string(p.authors, ' ')
        ) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, p.updated_at DESC
  LIMIT limit_count;
$$;

COMMENT ON FUNCTION search_papers IS 'Full-text search across paper titles, abstracts, and authors';

-- ============================================================================
-- SEARCH IDEAS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION search_ideas(
  search_user_id UUID,
  search_query TEXT,
  limit_count INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  stage VARCHAR(50),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rank REAL
)
LANGUAGE sql
STABLE
AS $$
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
    ) as rank
  FROM ideas i
  WHERE 
    i.user_id = search_user_id
    AND to_tsvector('english', i.title || ' ' || COALESCE(i.description, ''))
        @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC, i.updated_at DESC
  LIMIT limit_count;
$$;

COMMENT ON FUNCTION search_ideas IS 'Full-text search across idea titles and descriptions';

-- ============================================================================
-- GLOBAL SEARCH FUNCTION (across all entity types)
-- ============================================================================

CREATE OR REPLACE FUNCTION global_search(
  search_user_id UUID,
  search_query TEXT,
  limit_count INT DEFAULT 20
)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  title TEXT,
  snippet TEXT,
  rank REAL,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  -- Search notes
  SELECT 
    'note'::TEXT as entity_type,
    id as entity_id,
    COALESCE(title, 'Untitled') as title,
    LEFT(markdown_body, 200) as snippet,
    ts_rank(
      to_tsvector('english', markdown_body || ' ' || COALESCE(title, '')),
      plainto_tsquery('english', search_query)
    ) as rank,
    updated_at
  FROM notes
  WHERE 
    user_id = search_user_id
    AND to_tsvector('english', markdown_body || ' ' || COALESCE(title, ''))
        @@ plainto_tsquery('english', search_query)
  
  UNION ALL
  
  -- Search papers
  SELECT 
    'paper'::TEXT as entity_type,
    id as entity_id,
    title,
    LEFT(COALESCE(abstract, ''), 200) as snippet,
    ts_rank(
      to_tsvector('english', 
        title || ' ' || 
        COALESCE(abstract, '') || ' ' || 
        array_to_string(authors, ' ')
      ),
      plainto_tsquery('english', search_query)
    ) as rank,
    updated_at
  FROM papers
  WHERE 
    user_id = search_user_id
    AND to_tsvector('english', 
          title || ' ' || 
          COALESCE(abstract, '') || ' ' || 
          array_to_string(authors, ' ')
        ) @@ plainto_tsquery('english', search_query)
  
  UNION ALL
  
  -- Search ideas
  SELECT 
    'idea'::TEXT as entity_type,
    id as entity_id,
    title,
    LEFT(COALESCE(description, ''), 200) as snippet,
    ts_rank(
      to_tsvector('english', title || ' ' || COALESCE(description, '')),
      plainto_tsquery('english', search_query)
    ) as rank,
    updated_at
  FROM ideas
  WHERE 
    user_id = search_user_id
    AND to_tsvector('english', title || ' ' || COALESCE(description, ''))
        @@ plainto_tsquery('english', search_query)
  
  ORDER BY rank DESC, updated_at DESC
  LIMIT limit_count;
$$;

COMMENT ON FUNCTION global_search IS 'Search across all entity types (notes, papers, ideas)';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION search_notes TO authenticated;
GRANT EXECUTE ON FUNCTION search_papers TO authenticated;
GRANT EXECUTE ON FUNCTION search_ideas TO authenticated;
GRANT EXECUTE ON FUNCTION global_search TO authenticated;
