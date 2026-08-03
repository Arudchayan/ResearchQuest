-- Migration: enable_realtime_for_library
-- Created at: 1764510000

-- PostgreSQL does not support ALTER PUBLICATION ... ADD TABLE IF NOT EXISTS,
-- so check publication membership before adding each table.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['notes', 'papers', 'ideas', 'focus_sessions']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END $$;
