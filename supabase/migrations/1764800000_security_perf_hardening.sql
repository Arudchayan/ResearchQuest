-- Security and performance hardening for topics, topic links, and task indexes.

-- Defensively remove old permissive topics policies if they survived earlier migrations.
DROP POLICY IF EXISTS "Topics are viewable by everyone" ON public.topics;
DROP POLICY IF EXISTS "Users can insert topics" ON public.topics;
DROP POLICY IF EXISTS "Users can update topics" ON public.topics;
DROP POLICY IF EXISTS "Users can delete topics" ON public.topics;

-- Drop the legacy task indexes only when they are still the single-column variants.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indexrelid = to_regclass('public.idx_tasks_due_date')
      AND i.indrelid = 'public.tasks'::regclass
      AND i.indnkeyatts = 1
      AND pg_get_indexdef(i.indexrelid, 1, true) = 'due_date'
  ) THEN
    DROP INDEX public.idx_tasks_due_date;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_index i
    WHERE i.indexrelid = to_regclass('public.idx_tasks_completed')
      AND i.indrelid = 'public.tasks'::regclass
      AND i.indnkeyatts = 1
      AND pg_get_indexdef(i.indexrelid, 1, true) = 'completed'
  ) THEN
    DROP INDEX public.idx_tasks_completed;
  END IF;
END $$;

-- Recreate the intended composite task/topic indexes with collision-free names.
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_date_partial
  ON public.tasks(user_id, due_date)
  WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_completed
  ON public.tasks(user_id, completed);

CREATE INDEX IF NOT EXISTS idx_topics_user_updated_at
  ON public.topics(user_id, updated_at DESC);

-- Entity-side junction lookup indexes.
CREATE INDEX IF NOT EXISTS idx_topic_notes_note
  ON public.topic_notes(note_id, user_id);

CREATE INDEX IF NOT EXISTS idx_topic_papers_paper
  ON public.topic_papers(paper_id, user_id);

CREATE INDEX IF NOT EXISTS idx_topic_ideas_idea
  ON public.topic_ideas(idea_id, user_id);

-- Enforce that topic junction rows can only connect same-owner records.
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

DROP TRIGGER IF EXISTS validate_topic_notes_ownership ON public.topic_notes;
CREATE TRIGGER validate_topic_notes_ownership
  BEFORE INSERT OR UPDATE ON public.topic_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_topic_link_ownership();

DROP TRIGGER IF EXISTS validate_topic_papers_ownership ON public.topic_papers;
CREATE TRIGGER validate_topic_papers_ownership
  BEFORE INSERT OR UPDATE ON public.topic_papers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_topic_link_ownership();

DROP TRIGGER IF EXISTS validate_topic_ideas_ownership ON public.topic_ideas;
CREATE TRIGGER validate_topic_ideas_ownership
  BEFORE INSERT OR UPDATE ON public.topic_ideas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_topic_link_ownership();

-- Recreate owner-scoped RLS policies with initPlan-friendly auth.uid() calls.
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_quests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own topics" ON public.topics;
DROP POLICY IF EXISTS "Users insert own topics" ON public.topics;
DROP POLICY IF EXISTS "Users update own topics" ON public.topics;
DROP POLICY IF EXISTS "Users delete own topics" ON public.topics;

CREATE POLICY "Users view own topics"
  ON public.topics FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users insert own topics"
  ON public.topics FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users update own topics"
  ON public.topics FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users delete own topics"
  ON public.topics FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own topic_notes" ON public.topic_notes;
DROP POLICY IF EXISTS "Users manage own topic_papers" ON public.topic_papers;
DROP POLICY IF EXISTS "Users manage own topic_ideas" ON public.topic_ideas;
DROP POLICY IF EXISTS "Users manage own topic quests" ON public.topic_quests;

CREATE POLICY "Users manage own topic_notes"
  ON public.topic_notes
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users manage own topic_papers"
  ON public.topic_papers
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users manage own topic_ideas"
  ON public.topic_ideas
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users manage own topic quests"
  ON public.topic_quests
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
