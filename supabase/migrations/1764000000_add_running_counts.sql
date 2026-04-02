-- Add running counts to user_profiles table for gamification performance optimization
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS notes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS papers_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tasks_completed_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS papers_with_insights_count INTEGER DEFAULT 0;

-- Backfill counts for existing users
UPDATE public.user_profiles
SET
  notes_count = COALESCE((SELECT COUNT(*) FROM public.notes WHERE notes.user_id = user_profiles.id), 0),
  papers_count = COALESCE((SELECT COUNT(*) FROM public.papers WHERE papers.user_id = user_profiles.id), 0),
  tasks_completed_count = COALESCE((SELECT COUNT(*) FROM public.tasks WHERE tasks.user_id = user_profiles.id AND tasks.completed = true), 0),
  papers_with_insights_count = COALESCE((SELECT COUNT(*) FROM public.papers WHERE papers.user_id = user_profiles.id AND papers.key_insights IS NOT NULL), 0);
