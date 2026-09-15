-- PR21 item 93: FTS trigram coverage + missing (user_id, updated_at) indexes.
--
-- Baseline verified in 1762624235_add_performance_indexes.sql: GIN
-- to_tsvector indexes cover notes (body+title), papers
-- (title+abstract+authors), and ideas (title+description), plus
-- (user_id, updated_at DESC) composites for notes/papers/ideas/tasks and
-- topics (via 1764800000 idx_topics_user_updated_at). This migration adds:
--   - pg_trgm so ILIKE/similarity fallback queries can use GIN trigram
--     indexes on the main title/name columns;
--   - the (user_id, updated_at DESC) composites missing for the feeds
--     tables (inbox lists filter by user and sort by recency);
--   - a user-scoped (user_id, published_at DESC) index matching the feeds
--     inbox ORDER BY (published_at, created_at).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_papers_title_trgm
  ON public.papers USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_notes_title_trgm
  ON public.notes USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ideas_title_trgm
  ON public.ideas USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_topics_name_trgm
  ON public.topics USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_feed_items_user_updated_at
  ON public.feed_items (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_sources_user_updated_at
  ON public.feed_sources (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_items_user_published_at
  ON public.feed_items (user_id, published_at DESC);

ANALYZE public.papers;
ANALYZE public.notes;
ANALYZE public.ideas;
ANALYZE public.topics;
ANALYZE public.feed_items;
ANALYZE public.feed_sources;
