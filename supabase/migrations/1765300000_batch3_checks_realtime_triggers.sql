-- Migration: batch3 data hardening — CHECKs, guarded realtime, idempotent triggers
--
-- P1 Batch 3. NEVER edit existing migrations; every statement below is
-- re-runnable (pg_constraint / pg_publication_tables / to_regclass guards,
-- DROP TRIGGER IF EXISTS).
--
-- 1. CHECK constraints matching the gateway copyEnum values enforced in
--    supabase/functions/api/routes/entities.ts (validateEntityPayload):
--      tasks.priority: ["high", "medium", "low"]
--      papers.status:  ["To Read", "Reading", "Read"]
--    tasks has NO status column (it uses the completed boolean), so only the
--    priority CHECK applies. topics.name needs no CHECK: the column is
--    VARCHAR(255) (length enforced by the type) while the 50-char limit is
--    gateway-only validation in entities.ts. daily_logs.user_id NOT NULL is
--    already enforced by 1762635000 (guarded) — skipped here.
--
-- 2. Guarded realtime membership. The bare `ALTER PUBLICATION ... ADD TABLE`
--    statements in 1762559748 / 1764701000 fail on re-run and 1762635000
--    already covers the topics set; this loop re-states all of them guarded,
--    so it is a no-op for current members and a backfill for the rest.
--
-- 3. Trigger idempotency. 1762555366 and 1764700000 create updated_at triggers
--    with bare CREATE TRIGGER (no DROP IF EXISTS); the blocks below make them
--    re-runnable. Triggers already carrying DROP IF EXISTS (1762635000,
--    1765200000) are untouched.

-- --- 1a. Normalize legacy rows, then CHECK tasks.priority ---
DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'tasks'
                   AND column_name = 'priority') THEN
    EXECUTE $norm$
      UPDATE public.tasks SET priority = 'medium'
      WHERE priority IS NULL OR priority NOT IN ('high', 'medium', 'low')
    $norm$;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'tasks_priority_check'
                     AND conrelid = 'public.tasks'::regclass) THEN
      EXECUTE $chk$
        ALTER TABLE public.tasks
        ADD CONSTRAINT tasks_priority_check
        CHECK (priority IN ('high', 'medium', 'low'))
      $chk$;
    END IF;
  END IF;
END $$;

-- --- 1b. Normalize legacy rows, then CHECK papers.status ---
DO $$
BEGIN
  IF to_regclass('public.papers') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'papers'
                   AND column_name = 'status') THEN
    EXECUTE $norm$
      UPDATE public.papers SET status = 'To Read'
      WHERE status IS NULL OR status NOT IN ('To Read', 'Reading', 'Read')
    $norm$;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'papers_status_check'
                     AND conrelid = 'public.papers'::regclass) THEN
      EXECUTE $chk$
        ALTER TABLE public.papers
        ADD CONSTRAINT papers_status_check
        CHECK (status IN ('To Read', 'Reading', 'Read'))
      $chk$;
    END IF;
  END IF;
END $$;

-- --- 2. Guarded realtime membership (covers bare ADD TABLEs + topics set) ---
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'topics', 'topic_notes', 'topic_papers', 'topic_ideas', 'topic_quests',
    'tasks', 'user_profiles', 'daily_logs', 'feed_items'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = table_name
       ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name
      );
    END IF;
  END LOOP;
END $$;

-- --- 3a. Idempotent updated_at triggers for bare-CREATE tables (1762555366) ---
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'topics', 'papers', 'notes', 'ideas', 'user_profiles'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', t, t);
      EXECUTE format(
        'CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t
      );
    END IF;
  END LOOP;
END $$;

-- --- 3b. Idempotent updated_at triggers for feed tables (1764700000) ---
DO $$
BEGIN
  IF to_regclass('public.feed_sources') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_feed_sources_updated_at ON public.feed_sources;
    CREATE TRIGGER update_feed_sources_updated_at BEFORE UPDATE ON public.feed_sources
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF to_regclass('public.feed_items') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_feed_items_updated_at ON public.feed_items;
    CREATE TRIGGER update_feed_items_updated_at BEFORE UPDATE ON public.feed_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
