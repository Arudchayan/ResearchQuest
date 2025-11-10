-- Migration: topics_enhancements
-- Adds user scoped topics, association tables, quests, and indexes

-- Ensure topics has user ownership
ALTER TABLE topics ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill existing rows with the first available user if possible
DO $$
DECLARE
  fallback_user UUID;
BEGIN
  SELECT id INTO fallback_user FROM auth.users LIMIT 1;
  IF fallback_user IS NOT NULL THEN
    UPDATE topics SET user_id = fallback_user WHERE user_id IS NULL;
  END IF;
END $$;

ALTER TABLE topics ALTER COLUMN user_id SET NOT NULL;

-- Drop permissive global policies and replace with user scoped ones
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'topics'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.topics', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own topics" ON topics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own topics" ON topics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own topics" ON topics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own topics" ON topics FOR DELETE USING (auth.uid() = user_id);

-- Association tables
CREATE TABLE IF NOT EXISTS topic_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (topic_id, note_id)
);

CREATE TABLE IF NOT EXISTS topic_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (topic_id, paper_id)
);

CREATE TABLE IF NOT EXISTS topic_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    idea_id UUID NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (topic_id, idea_id)
);

-- Topic quests table
CREATE TABLE IF NOT EXISTS topic_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    objective TEXT NOT NULL,
    target_count INTEGER NOT NULL DEFAULT 1,
    progress_count INTEGER NOT NULL DEFAULT 0,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Shared helper to stamp user id when missing
CREATE OR REPLACE FUNCTION public.ensure_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers for ownership
CREATE TRIGGER set_topics_user_id BEFORE INSERT ON topics
  FOR EACH ROW EXECUTE FUNCTION public.ensure_user_id();
CREATE TRIGGER set_topic_notes_user_id BEFORE INSERT ON topic_notes
  FOR EACH ROW EXECUTE FUNCTION public.ensure_user_id();
CREATE TRIGGER set_topic_papers_user_id BEFORE INSERT ON topic_papers
  FOR EACH ROW EXECUTE FUNCTION public.ensure_user_id();
CREATE TRIGGER set_topic_ideas_user_id BEFORE INSERT ON topic_ideas
  FOR EACH ROW EXECUTE FUNCTION public.ensure_user_id();
CREATE TRIGGER set_topic_quests_user_id BEFORE INSERT ON topic_quests
  FOR EACH ROW EXECUTE FUNCTION public.ensure_user_id();

-- Updated_at triggers leveraging existing helper
CREATE TRIGGER update_topic_notes_updated_at BEFORE UPDATE ON topic_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_topic_papers_updated_at BEFORE UPDATE ON topic_papers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_topic_ideas_updated_at BEFORE UPDATE ON topic_ideas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_topic_quests_updated_at BEFORE UPDATE ON topic_quests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies for association tables
ALTER TABLE topic_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own topic_notes" ON topic_notes
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own topic_papers" ON topic_papers
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own topic_ideas" ON topic_ideas
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own topic quests" ON topic_quests
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_topics_user_id ON topics(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_notes_topic ON topic_notes(topic_id, user_id);
CREATE INDEX IF NOT EXISTS idx_topic_papers_topic ON topic_papers(topic_id, user_id);
CREATE INDEX IF NOT EXISTS idx_topic_ideas_topic ON topic_ideas(topic_id, user_id);
CREATE INDEX IF NOT EXISTS idx_topic_quests_user_status ON topic_quests(user_id, status, due_date);
