-- Performance Indexes Migration
-- This migration adds comprehensive indexes to improve query performance across all tables

-- ============================================================================
-- NOTES TABLE INDEXES
-- ============================================================================

-- Basic user filtering (most common query)
CREATE INDEX IF NOT EXISTS idx_notes_user_id 
  ON notes(user_id);

-- Ordering by updated_at (for recent notes lists)
CREATE INDEX IF NOT EXISTS idx_notes_updated_at 
  ON notes(user_id, updated_at DESC);

-- Tag filtering (GIN index for array operations)
CREATE INDEX IF NOT EXISTS idx_notes_tags 
  ON notes USING GIN(tags);

-- Full-text search on note content and title
CREATE INDEX IF NOT EXISTS idx_notes_search 
  ON notes USING GIN(
    to_tsvector('english', 
      markdown_body || ' ' || COALESCE(title, '')
    )
  );

COMMENT ON INDEX idx_notes_user_id IS 'Speed up user notes queries';
COMMENT ON INDEX idx_notes_updated_at IS 'Speed up ordering by updated_at';
COMMENT ON INDEX idx_notes_tags IS 'Speed up tag filtering and array operations';
COMMENT ON INDEX idx_notes_search IS 'Enable full-text search on notes content';

-- ============================================================================
-- PAPERS TABLE INDEXES
-- ============================================================================

-- Basic user filtering
CREATE INDEX IF NOT EXISTS idx_papers_user_id 
  ON papers(user_id);

-- Ordering by updated_at
CREATE INDEX IF NOT EXISTS idx_papers_updated_at 
  ON papers(user_id, updated_at DESC);

-- Status filtering (for "To Read", "Reading", "Read" filters)
CREATE INDEX IF NOT EXISTS idx_papers_status 
  ON papers(user_id, status);

-- DOI lookup (partial index for non-null DOIs)
CREATE INDEX IF NOT EXISTS idx_papers_doi 
  ON papers(doi) 
  WHERE doi IS NOT NULL;

-- Publication date ordering
CREATE INDEX IF NOT EXISTS idx_papers_publication_date 
  ON papers(user_id, publication_date DESC NULLS LAST);

-- Full-text search on title and abstract
CREATE INDEX IF NOT EXISTS idx_papers_search 
  ON papers USING GIN(
    to_tsvector('english', 
      title || ' ' || COALESCE(abstract, '')
    )
  );

COMMENT ON INDEX idx_papers_user_id IS 'Speed up user papers queries';
COMMENT ON INDEX idx_papers_updated_at IS 'Speed up ordering by updated_at';
COMMENT ON INDEX idx_papers_status IS 'Speed up filtering by reading status';
COMMENT ON INDEX idx_papers_doi IS 'Speed up DOI lookups';
COMMENT ON INDEX idx_papers_search IS 'Enable full-text search on papers';

-- ============================================================================
-- IDEAS TABLE INDEXES
-- ============================================================================

-- Basic user filtering
CREATE INDEX IF NOT EXISTS idx_ideas_user_id 
  ON ideas(user_id);

-- Ordering by updated_at
CREATE INDEX IF NOT EXISTS idx_ideas_updated_at 
  ON ideas(user_id, updated_at DESC);

-- Stage filtering (Seed, Developing, Supported, Mature)
CREATE INDEX IF NOT EXISTS idx_ideas_stage 
  ON ideas(user_id, stage);

-- Full-text search on title and description
CREATE INDEX IF NOT EXISTS idx_ideas_search 
  ON ideas USING GIN(
    to_tsvector('english', 
      title || ' ' || COALESCE(description, '')
    )
  );

COMMENT ON INDEX idx_ideas_user_id IS 'Speed up user ideas queries';
COMMENT ON INDEX idx_ideas_updated_at IS 'Speed up ordering by updated_at';
COMMENT ON INDEX idx_ideas_stage IS 'Speed up filtering by idea stage';
COMMENT ON INDEX idx_ideas_search IS 'Enable full-text search on ideas';

-- ============================================================================
-- TASKS TABLE INDEXES
-- ============================================================================

-- Basic user filtering
CREATE INDEX IF NOT EXISTS idx_tasks_user_id 
  ON tasks(user_id);

-- Ordering by updated_at
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at 
  ON tasks(user_id, updated_at DESC);

-- Completion status filtering
CREATE INDEX IF NOT EXISTS idx_tasks_completed 
  ON tasks(user_id, completed);

-- Due date filtering and ordering (partial index for non-null due dates)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date 
  ON tasks(user_id, due_date) 
  WHERE due_date IS NOT NULL;

-- Priority filtering
CREATE INDEX IF NOT EXISTS idx_tasks_priority 
  ON tasks(user_id, priority);

-- Composite index for active tasks (not completed, ordered by due date)
CREATE INDEX IF NOT EXISTS idx_tasks_active_by_due_date 
  ON tasks(user_id, due_date) 
  WHERE completed = false AND due_date IS NOT NULL;

COMMENT ON INDEX idx_tasks_user_id IS 'Speed up user tasks queries';
COMMENT ON INDEX idx_tasks_updated_at IS 'Speed up ordering by updated_at';
COMMENT ON INDEX idx_tasks_completed IS 'Speed up filtering by completion status';
COMMENT ON INDEX idx_tasks_due_date IS 'Speed up due date queries';
COMMENT ON INDEX idx_tasks_priority IS 'Speed up priority filtering';
COMMENT ON INDEX idx_tasks_active_by_due_date IS 'Optimize active tasks with due dates';

-- ============================================================================
-- USER PROFILES TABLE INDEXES
-- ============================================================================

-- Leaderboard queries (ordering by total XP)
CREATE INDEX IF NOT EXISTS idx_user_profiles_total_xp 
  ON user_profiles(total_xp DESC);

-- Level-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_level 
  ON user_profiles(current_level DESC);

COMMENT ON INDEX idx_user_profiles_total_xp IS 'Speed up leaderboard queries';
COMMENT ON INDEX idx_user_profiles_level IS 'Speed up level-based queries';

-- ============================================================================
-- DAILY LOGS TABLE INDEXES
-- ============================================================================

-- User date lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date 
  ON daily_logs(user_id, date DESC);

-- Date range queries
CREATE INDEX IF NOT EXISTS idx_daily_logs_date 
  ON daily_logs(date DESC);

COMMENT ON INDEX idx_daily_logs_user_date IS 'Speed up user daily log queries';
COMMENT ON INDEX idx_daily_logs_date IS 'Speed up date range queries';

-- ============================================================================
-- LINKS TABLE INDEXES (if it exists)
-- ============================================================================

-- Source entity lookups
CREATE INDEX IF NOT EXISTS idx_links_source 
  ON links(source_type, source_id);

-- Target entity lookups
CREATE INDEX IF NOT EXISTS idx_links_target 
  ON links(target_type, target_id);

-- Bidirectional link queries
CREATE INDEX IF NOT EXISTS idx_links_bidirectional 
  ON links(source_id, target_id);

COMMENT ON INDEX idx_links_source IS 'Speed up source entity link queries';
COMMENT ON INDEX idx_links_target IS 'Speed up target entity link queries';
COMMENT ON INDEX idx_links_bidirectional IS 'Speed up bidirectional link lookups';

-- ============================================================================
-- TOPICS TABLE INDEXES (if it exists)
-- ============================================================================

-- User filtering
CREATE INDEX IF NOT EXISTS idx_topics_user_id 
  ON topics(user_id);

-- Name lookups
CREATE INDEX IF NOT EXISTS idx_topics_name 
  ON topics(user_id, name);

COMMENT ON INDEX idx_topics_user_id IS 'Speed up user topics queries';
COMMENT ON INDEX idx_topics_name IS 'Speed up topic name lookups';

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================
-- Update statistics for the query planner to use these indexes effectively

ANALYZE notes;
ANALYZE papers;
ANALYZE ideas;
ANALYZE tasks;
ANALYZE user_profiles;
ANALYZE daily_logs;
ANALYZE links;
ANALYZE topics;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries to verify indexes are being used:

-- EXPLAIN ANALYZE SELECT * FROM notes WHERE user_id = 'xxx' ORDER BY updated_at DESC;
-- EXPLAIN ANALYZE SELECT * FROM papers WHERE user_id = 'xxx' AND status = 'Reading';
-- EXPLAIN ANALYZE SELECT * FROM tasks WHERE user_id = 'xxx' AND completed = false AND due_date IS NOT NULL ORDER BY due_date;
