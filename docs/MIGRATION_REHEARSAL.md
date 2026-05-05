# Migration Rehearsal Guide (RQ-M6-01)

This document describes how to perform a fresh Supabase migration rehearsal for ResearchQuest. Run this before any production release to verify the migration chain is clean.

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- A spare Supabase project (do **not** use production)
- `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` for the spare project

## Migration Files

All 13 migrations live at `supabase/migrations/` in the repository root. They are applied in timestamp order automatically.

| # | File | What It Does |
|---|------|-------------|
| 1 | `1762555347_enable_rls_and_policies.sql` | Creates notes, papers, ideas, tasks, topics, user_profiles tables; enables RLS; adds per-user SELECT/INSERT/UPDATE/DELETE policies |
| 2 | `1762555366_create_triggers_and_indexes.sql` | Triggers for `updated_at` columns; composite and single-column indexes |
| 3 | `1762557806_enhance_papers_and_rls.sql` | Adds research_goals, research_projects, research_milestones, research_achievements tables; RLS for tasks extended |
| 4 | `1762559748_enable_realtime_for_tasks.sql` | Adds tasks table to Supabase Realtime publication |
| 5 | `1762624235_add_performance_indexes.sql` | Additional performance indexes on `user_id`, `updated_at` columns |
| 6 | `1762624300_add_search_functions.sql` | Postgres full-text search helper functions |
| 7 | `1762635000_topics_enhancements.sql` | Adds `user_id` to topics; creates topic_notes, topic_papers, topic_ideas, topic_quests junction tables with `FOR ALL` RLS policies |
| 8 | `1763005000_add_gamification_metadata.sql` | Gamification metadata columns on user_profiles |
| 9 | `1763500000_save_idea_transaction.sql` | Stored procedure for transactional idea save |
| 10 | `1763600000_add_auto_task_preference.sql` | Adds `auto_task` preference column |
| 11 | `1764000000_add_running_counts.sql` | Running counts columns on topics |
| 12 | `1764100000_align_tasks_contract.sql` | Aligns tasks table schema to canonical contract |
| 13 | `1764300000_create_focus_sessions.sql` | Creates focus_sessions table with SELECT/INSERT/DELETE RLS |

## Rehearsal Steps

### 1. Link the spare project

```bash
supabase login
supabase link --project-ref <SPARE_PROJECT_REF>
```

### 2. Push all migrations

```bash
supabase db push
```

Expected output: 13 migrations applied, 0 errors.

### 3. Verify table existence

In the Supabase SQL editor on the spare project, run:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables (minimum): `daily_logs`, `focus_sessions`, `ideas`, `notes`, `papers`, `research_achievements`, `research_goals`, `research_milestones`, `research_projects`, `tasks`, `topic_ideas`, `topic_notes`, `topic_papers`, `topic_quests`, `topics`, `user_profiles`.

### 4. Verify RLS is enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected: `rowsecurity = true` for all app-used tables.

### 5. Verify policies exist

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Review that each app table has at least one policy. Junction tables (`topic_notes`, `topic_papers`, `topic_ideas`, `topic_quests`) should each show a single `FOR ALL` policy.

### 6. Sign up a test user and verify auth

Point the app's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at the spare project. Sign up a new user. Verify:

- `user_profiles` row created for the new user.
- Creating a note, paper, idea, task, and topic each succeed.
- Deep links (`/notes/<id>`, etc.) resolve correctly after page reload.

## Pass Criterion

All 13 migrations apply without error. All expected tables exist. RLS is enabled on all app-used tables. A test user can complete the basic CRUD workflow.

## Notes

- There is currently no `supabase/config.toml`, `seed.sql`, or package.json CLI script for migrations. The Supabase CLI `db push` command is the only supported path.
- The `supabase/` directory is at the repository root, **not** under `researchquest/`.
