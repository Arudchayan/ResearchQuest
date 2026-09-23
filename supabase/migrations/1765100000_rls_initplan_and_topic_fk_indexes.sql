-- Migration: wrap RLS auth helpers for initPlan + topic junction FK indexes
-- Created at: 1765100000
--
-- Clears Supabase advisors:
--   WARN auth_rls_initplan (lint 0003): policies re-evaluate auth.uid() per row.
--     Rewrite as (select auth.uid()) so Postgres can use an initPlan.
--     https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
--   INFO unindexed_foreign_keys on topic_* junction tables: covering indexes
--     for user_id (RLS) and entity FKs listed by the advisor.
--
-- Semantics are unchanged: same policy names, roles (default PUBLIC), commands,
-- and USING / WITH CHECK predicates. Only the evaluation form of auth.uid()
-- changes. planner_catalog (USING (true)) is left as-is. FORCE RLS, Auth
-- settings, and SECURITY DEFINER RPCs are not touched.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY, CREATE INDEX IF NOT EXISTS,
-- guarded by to_regclass so partial restores (e.g. planner_state) are safe.

DO $$
BEGIN
  IF to_regclass('public.api_keys') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own api keys" ON public.api_keys;
    CREATE POLICY "Users can view own api keys"
      ON public.api_keys FOR SELECT
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.api_key_audit') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own api key audit" ON public.api_key_audit;
    CREATE POLICY "Users can view own api key audit"
      ON public.api_key_audit FOR SELECT
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.daily_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own daily logs" ON public.daily_logs;
    CREATE POLICY "Users can view own daily logs"
      ON public.daily_logs FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert own daily logs" ON public.daily_logs;
    CREATE POLICY "Users can insert own daily logs"
      ON public.daily_logs FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own daily logs" ON public.daily_logs;
    CREATE POLICY "Users can update own daily logs"
      ON public.daily_logs FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own daily logs" ON public.daily_logs;
    CREATE POLICY "Users can delete own daily logs"
      ON public.daily_logs FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.feed_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own feed items" ON public.feed_items;
    CREATE POLICY "Users can view own feed items"
      ON public.feed_items FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert own feed items" ON public.feed_items;
    CREATE POLICY "Users can insert own feed items"
      ON public.feed_items FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own feed items" ON public.feed_items;
    CREATE POLICY "Users can update own feed items"
      ON public.feed_items FOR UPDATE
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own feed items" ON public.feed_items;
    CREATE POLICY "Users can delete own feed items"
      ON public.feed_items FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.feed_sources') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own feed sources" ON public.feed_sources;
    CREATE POLICY "Users can view own feed sources"
      ON public.feed_sources FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert own feed sources" ON public.feed_sources;
    CREATE POLICY "Users can insert own feed sources"
      ON public.feed_sources FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own feed sources" ON public.feed_sources;
    CREATE POLICY "Users can update own feed sources"
      ON public.feed_sources FOR UPDATE
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own feed sources" ON public.feed_sources;
    CREATE POLICY "Users can delete own feed sources"
      ON public.feed_sources FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.focus_sessions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users select own focus_sessions" ON public.focus_sessions;
    CREATE POLICY "Users select own focus_sessions"
      ON public.focus_sessions FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users insert own focus_sessions" ON public.focus_sessions;
    CREATE POLICY "Users insert own focus_sessions"
      ON public.focus_sessions FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users update own focus_sessions" ON public.focus_sessions;
    CREATE POLICY "Users update own focus_sessions"
      ON public.focus_sessions FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users delete own focus_sessions" ON public.focus_sessions;
    CREATE POLICY "Users delete own focus_sessions"
      ON public.focus_sessions FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.ideas') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own ideas" ON public.ideas;
    CREATE POLICY "Users can view own ideas"
      ON public.ideas FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert own ideas" ON public.ideas;
    CREATE POLICY "Users can insert own ideas"
      ON public.ideas FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own ideas" ON public.ideas;
    CREATE POLICY "Users can update own ideas"
      ON public.ideas FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own ideas" ON public.ideas;
    CREATE POLICY "Users can delete own ideas"
      ON public.ideas FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.links') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own links" ON public.links;
    CREATE POLICY "Users can view own links"
      ON public.links FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert own links" ON public.links;
    CREATE POLICY "Users can insert own links"
      ON public.links FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own links" ON public.links;
    CREATE POLICY "Users can update own links"
      ON public.links FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own links" ON public.links;
    CREATE POLICY "Users can delete own links"
      ON public.links FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.notes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
    CREATE POLICY "Users can view own notes"
      ON public.notes FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
    CREATE POLICY "Users can insert own notes"
      ON public.notes FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
    CREATE POLICY "Users can update own notes"
      ON public.notes FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
    CREATE POLICY "Users can delete own notes"
      ON public.notes FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.papers') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own papers" ON public.papers;
    CREATE POLICY "Users can view own papers"
      ON public.papers FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert own papers" ON public.papers;
    CREATE POLICY "Users can insert own papers"
      ON public.papers FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own papers" ON public.papers;
    CREATE POLICY "Users can update own papers"
      ON public.papers FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own papers" ON public.papers;
    CREATE POLICY "Users can delete own papers"
      ON public.papers FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.planner_state') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view their planner state" ON public.planner_state;
    CREATE POLICY "Users can view their planner state"
      ON public.planner_state FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert their planner state" ON public.planner_state;
    CREATE POLICY "Users can insert their planner state"
      ON public.planner_state FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update their planner state" ON public.planner_state;
    CREATE POLICY "Users can update their planner state"
      ON public.planner_state FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete their planner state" ON public.planner_state;
    CREATE POLICY "Users can delete their planner state"
      ON public.planner_state FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.research_achievements') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own achievements" ON public.research_achievements;
    CREATE POLICY "Users can view own achievements"
      ON public.research_achievements FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert own achievements" ON public.research_achievements;
    CREATE POLICY "Users can insert own achievements"
      ON public.research_achievements FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own achievements" ON public.research_achievements;
    CREATE POLICY "Users can update own achievements"
      ON public.research_achievements FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own achievements" ON public.research_achievements;
    CREATE POLICY "Users can delete own achievements"
      ON public.research_achievements FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.research_goals') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own goals" ON public.research_goals;
    CREATE POLICY "Users can view own goals"
      ON public.research_goals FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert own goals" ON public.research_goals;
    CREATE POLICY "Users can insert own goals"
      ON public.research_goals FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own goals" ON public.research_goals;
    CREATE POLICY "Users can update own goals"
      ON public.research_goals FOR UPDATE
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own goals" ON public.research_goals;
    CREATE POLICY "Users can delete own goals"
      ON public.research_goals FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.research_milestones') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own milestones" ON public.research_milestones;
    CREATE POLICY "Users can view own milestones"
      ON public.research_milestones FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert own milestones" ON public.research_milestones;
    CREATE POLICY "Users can insert own milestones"
      ON public.research_milestones FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own milestones" ON public.research_milestones;
    CREATE POLICY "Users can update own milestones"
      ON public.research_milestones FOR UPDATE
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own milestones" ON public.research_milestones;
    CREATE POLICY "Users can delete own milestones"
      ON public.research_milestones FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.research_projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own projects" ON public.research_projects;
    CREATE POLICY "Users can view own projects"
      ON public.research_projects FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert own projects" ON public.research_projects;
    CREATE POLICY "Users can insert own projects"
      ON public.research_projects FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own projects" ON public.research_projects;
    CREATE POLICY "Users can update own projects"
      ON public.research_projects FOR UPDATE
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own projects" ON public.research_projects;
    CREATE POLICY "Users can delete own projects"
      ON public.research_projects FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
    CREATE POLICY "Users can view own tasks"
      ON public.tasks FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
    CREATE POLICY "Users can insert own tasks"
      ON public.tasks FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
    CREATE POLICY "Users can update own tasks"
      ON public.tasks FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
    CREATE POLICY "Users can delete own tasks"
      ON public.tasks FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.topics') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users view own topics" ON public.topics;
    CREATE POLICY "Users view own topics"
      ON public.topics FOR SELECT
      USING ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users insert own topics" ON public.topics;
    CREATE POLICY "Users insert own topics"
      ON public.topics FOR INSERT
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users update own topics" ON public.topics;
    CREATE POLICY "Users update own topics"
      ON public.topics FOR UPDATE
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);

    DROP POLICY IF EXISTS "Users delete own topics" ON public.topics;
    CREATE POLICY "Users delete own topics"
      ON public.topics FOR DELETE
      USING ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.topic_notes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users manage own topic_notes" ON public.topic_notes;
    CREATE POLICY "Users manage own topic_notes"
      ON public.topic_notes
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.topic_papers') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users manage own topic_papers" ON public.topic_papers;
    CREATE POLICY "Users manage own topic_papers"
      ON public.topic_papers
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.topic_ideas') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users manage own topic_ideas" ON public.topic_ideas;
    CREATE POLICY "Users manage own topic_ideas"
      ON public.topic_ideas
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.topic_quests') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users manage own topic quests" ON public.topic_quests;
    CREATE POLICY "Users manage own topic quests"
      ON public.topic_quests
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
    CREATE POLICY "Users can view own profile"
      ON public.user_profiles FOR SELECT
      USING ((select auth.uid()) = id);

    DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
    CREATE POLICY "Users can insert own profile"
      ON public.user_profiles FOR INSERT
      WITH CHECK ((select auth.uid()) = id);

    DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
    CREATE POLICY "Users can update own profile"
      ON public.user_profiles FOR UPDATE
      USING ((select auth.uid()) = id);
  END IF;
END $$;

-- Covering indexes for topic_* FKs flagged by unindexed_foreign_keys.
-- Entity-side composites also help RLS owner filters (user_id as second key).
CREATE INDEX IF NOT EXISTS idx_topic_ideas_idea
  ON public.topic_ideas(idea_id, user_id);

CREATE INDEX IF NOT EXISTS idx_topic_notes_note
  ON public.topic_notes(note_id, user_id);

CREATE INDEX IF NOT EXISTS idx_topic_papers_paper
  ON public.topic_papers(paper_id, user_id);

CREATE INDEX IF NOT EXISTS idx_topic_ideas_user_id
  ON public.topic_ideas(user_id);

CREATE INDEX IF NOT EXISTS idx_topic_notes_user_id
  ON public.topic_notes(user_id);

CREATE INDEX IF NOT EXISTS idx_topic_papers_user_id
  ON public.topic_papers(user_id);

CREATE INDEX IF NOT EXISTS idx_topic_quests_topic
  ON public.topic_quests(topic_id);
