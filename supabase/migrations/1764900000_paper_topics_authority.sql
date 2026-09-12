-- PR21 item 92: single data authority for paper<->topic links.
--
-- The `topic_papers` junction table is the authority. `papers.topic_ids`
-- is retained only as a read cache (consumed by the ResearchRadar view,
-- the edge API paper selects, and `search_papers`) and is kept in sync
-- by the trigger below. All writers must go through the junction:
--   - frontend: useTopics.attachTopicToEntity / detachTopicFromEntity
--   - edge API: POST /topics/{id}/attach, POST /topics/{id}/detach
--   - import: restores `topic_papers` rows (papers rows keep stale cache
--     until the trigger fires on the junction write)

-- 1) Backfill junction rows from legacy per-paper topic_ids arrays.
-- Only values that parse as UUIDs and reference a same-owner topic are
-- imported; anything else was already drift and is dropped from the cache
-- in step 2.
INSERT INTO public.topic_papers (user_id, topic_id, paper_id)
SELECT p.user_id, topic_id::uuid, p.id
FROM public.papers p
CROSS JOIN LATERAL unnest(COALESCE(p.topic_ids, '{}')) AS topic_id
JOIN public.topics t ON t.id = topic_id::uuid AND t.user_id = p.user_id
WHERE topic_id ~ '^[0-9a-fA-F-]{36}$'
ON CONFLICT (topic_id, paper_id) DO NOTHING;

-- 2) Rebuild the topic_ids read cache from the junction so orphans and
-- drift left by the old dual-write are removed.
UPDATE public.papers p
SET topic_ids = COALESCE(sub.topic_ids, '{}')
FROM (
  SELECT paper_id, array_agg(topic_id::text ORDER BY topic_id::text) AS topic_ids
  FROM public.topic_papers
  GROUP BY paper_id
) sub
WHERE sub.paper_id = p.id;

UPDATE public.papers
SET topic_ids = '{}'
WHERE topic_ids IS NULL
  AND id NOT IN (SELECT paper_id FROM public.topic_papers);

-- 3) Keep the cache in sync on every junction write.
CREATE OR REPLACE FUNCTION public.sync_paper_topic_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_paper_id UUID;
BEGIN
  affected_paper_id := COALESCE(NEW.paper_id, OLD.paper_id);
  UPDATE public.papers p
  SET topic_ids = COALESCE((
    SELECT array_agg(tp.topic_id::text ORDER BY tp.topic_id::text)
    FROM public.topic_papers tp
    WHERE tp.paper_id = affected_paper_id
  ), '{}')
  WHERE p.id = affected_paper_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_paper_topic_cache ON public.topic_papers;
CREATE TRIGGER sync_paper_topic_cache
  AFTER INSERT OR UPDATE OR DELETE ON public.topic_papers
  FOR EACH ROW EXECUTE FUNCTION public.sync_paper_topic_cache();

COMMENT ON COLUMN public.papers.topic_ids IS
  'Read cache of topic_papers membership. Authority is the topic_papers junction; do not write directly.';
