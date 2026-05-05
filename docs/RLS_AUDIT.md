# Row-Level Security Audit (RQ-M6-02)

Last audited: 2026-05-05. Covers all 13 migrations in `supabase/migrations/`.

## Summary

All app-used tables have RLS enabled with per-user isolation policies. No gaps found during the M6 audit. No new migration was required.

## Table-by-Table Findings

### Core entity tables

| Table | RLS | Policies | Notes |
|-------|-----|----------|-------|
| `notes` | ✅ | SELECT, INSERT, UPDATE, DELETE (user_id match) | Set in migration 1 |
| `papers` | ✅ | SELECT, INSERT, UPDATE, DELETE (user_id match) | Set in migration 1 |
| `ideas` | ✅ | SELECT, INSERT, UPDATE, DELETE (user_id match) | Set in migration 1 |
| `tasks` | ✅ | SELECT, INSERT, UPDATE, DELETE (user_id match) | Set in migrations 1 + 3 |
| `topics` | ✅ | SELECT, INSERT, UPDATE, DELETE (user_id match) | Set in migration 1 |
| `user_profiles` | ✅ | SELECT, INSERT, UPDATE (no DELETE — intentional; profiles persist) | Set in migration 1 |
| `focus_sessions` | ✅ | SELECT, INSERT, DELETE (no UPDATE — sessions are immutable) | Set in migration 13 |

### Junction tables

Junction tables use a single permissive `FOR ALL` policy which covers SELECT, INSERT, UPDATE, and **DELETE**. No explicit `FOR DELETE` clause is needed — the `FOR ALL` form without an operation qualifier applies to all operations.

| Table | RLS | Policy |
|-------|-----|--------|
| `topic_notes` | ✅ | `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` |
| `topic_papers` | ✅ | `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` |
| `topic_ideas` | ✅ | `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` |
| `topic_quests` | ✅ | `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` |

### Auxiliary tables

| Table | RLS | Notes |
|-------|-----|-------|
| `research_goals` | ✅ | Set in migration 3 |
| `research_projects` | ✅ | Set in migration 3 |
| `research_milestones` | ✅ | Set in migration 3 |
| `research_achievements` | ✅ | Set in migration 3 |

### Tables not directly accessed by the application

`daily_logs`, `links` — created by migrations but not used in the current app surface. RLS status should be verified at next audit if usage is added.

## Policy Design Notes

1. **All user-owned rows use `auth.uid() = user_id`** — no server-side service role bypass is required for normal app operations.
2. **Immutable tables** (`focus_sessions`) omit UPDATE by design; immutability is enforced at the policy layer.
3. **Persistent tables** (`user_profiles`) omit DELETE by design; profiles are retained for audit and recovery purposes.
4. **Junction tables** use `FOR ALL` rather than four explicit operation policies for conciseness. This is functionally equivalent.

## Verification Query

Run on the target Supabase project to confirm no gaps:

```sql
SELECT
  t.tablename,
  t.rowsecurity,
  COUNT(p.policyname) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
```

Any row with `rowsecurity = false` or `policy_count = 0` for an app-used table is a finding that must be resolved before release.

## Re-Audit Trigger

Re-run this audit whenever:
- A new table is added to `supabase/migrations/`.
- A new Supabase function is deployed that accesses tables directly.
- The app surface expands to previously unused tables.
