# Live migration history map

Live schema on project `zsjczlmzhyzewpehmngc` is **authoritative** for what has been applied. Repo files under `supabase/migrations/` are the source of the SQL, but MCP `apply_migration` stamps `supabase_migrations.schema_migrations` with **apply-time timestamps**, so live `version` values often do not match the numeric prefix in the filename.

This map is the team's record of that mismatch. Do **not** edit `supabase_migrations.schema_migrations` by hand.

## Rules

- **Banned** for this project: `supabase db push` and `supabase db push --include-all`.
- Live changes go in only via MCP `apply_migration`, **one named migration at a time**, applied by the release owner.
- Never re-apply a row marked `not applied / superseded`. Still-needed pieces from those files already landed via `1765700000`.

## Repo file → live version

Filenames are the files currently in `supabase/migrations/` on `master`, plus the three later files from PRs #807, #809, and #815 that were applied live on 2026-09-28.

| Repo file | Live version | PR |
| --- | --- | --- |
| `1762555347_enable_rls_and_policies.sql` | `20260427070621` | — |
| `1762555366_create_triggers_and_indexes.sql` | `20260427070645` | — |
| `1762557806_enhance_papers_and_rls.sql` | `20260427070757` | — |
| `1762559748_enable_realtime_for_tasks.sql` | `20260427070829` | — |
| `1762624235_add_performance_indexes.sql` | `20260427070943` | — |
| `1762624300_add_search_functions.sql` | `20260427071204` | — |
| `1762635000_topics_enhancements.sql` | `20260427071253` | — |
| `1763005000_add_gamification_metadata.sql` | `20260427071441` | — |
| `1763500000_save_idea_transaction.sql` | `20260427071518` | — |
| `1763600000_add_auto_task_preference.sql` | `20260427071551` | — |
| `1764000000_add_running_counts.sql` | `20260427071609` | — |
| `1764100000_align_tasks_contract.sql` | `20260427071626` | — |
| `1764300000_create_focus_sessions.sql` | `1764300000` | — |
| `1764410000_drop_exec_sql_rpc.sql` | `1764410000` | — |
| `1764500000_harden_rls_policies.sql` | `1764500000` | — |
| `1764510000_enable_realtime_for_library.sql` | `1764510000` | — |
| `1764600000_api_keys.sql` | `1764600000` | — |
| `1764700000_feeds.sql` | `1764700000` | — |
| `1764701000_enable_feed_items_realtime.sql` | `1764701000` | — |
| `1764800000_security_perf_hardening.sql` | not applied / superseded | — |
| `1764801000_round2_security_hardening.sql` | not applied / superseded | — |
| `1764802000_update_with_check_hardening.sql` | not applied / superseded | — |
| `1764900000_api_keys_rls_intent.sql` | not applied / superseded | — |
| `1764910000_gamification_atomic_xp.sql` | not applied / superseded | — |
| `1765000000_harden_rpc_security_definer.sql` | `20260923163428` | — |
| `1765001000_award_xp_rpc.sql` | not applied / superseded | — |
| `1765002000_normalize_legacy_paper_dois.sql` | not applied / superseded | — |
| `1765003000_award_xp_caps_and_search_parity.sql` | not applied / superseded | — |
| `1765100000_rls_initplan_and_topic_fk_indexes.sql` | `20260923192519`, `20260923192556` (recorded twice) | — |
| `1765200000_topic_junction_parent_with_check.sql` | `20260924203242` | — |
| `1765300000_batch3_checks_realtime_triggers.sql` | not applied / superseded | — |
| `1765500000_save_idea_with_links_invoker.sql` | `20260928102811` | [#807](https://github.com/Arudchayan/ResearchQuest/pull/807) |
| `1765600000_atlas_rls_consolidation.sql` | `20260928101832` | [#809](https://github.com/Arudchayan/ResearchQuest/pull/809) |
| `1765700000_reconcile_unapplied_master_delta.sql` | `20260928104309` | [#815](https://github.com/Arudchayan/ResearchQuest/pull/815) |

`1764800000`..`1765300000` were never applied wholesale. Exceptions that *did* land (with MCP timestamps, not the repo prefixes) are `1765000000`, `1765100000` (twice), and `1765200000`. Every other file in that range stays `not applied / superseded`; the still-needed parts were applied as `1765700000` (live `20260928104309`, PR #815). Do not `apply_migration` those superseded files.

Live apply order for the 2026-09-28 batch was `1765600000` then `1765500000` then `1765700000` (timestamps `20260928101832` < `20260928102811` < `20260928104309`), which is not filename order.

## Live-only (no repo file)

| Live version | Name |
| --- | --- |
| `20260427070555` | `create_base_schema` |
| `20260427171608` | `create_planner_tables` |
| `20260925084550` | `atlas_tables_phase1` |
| `20260925084601` | `atlas_rls_phase1` |
| `20260925084611` | `atlas_rls_policies_data` |
| `20260925084621` | `atlas_rls_policies_validation` |
| `20260925163547` | `phase2_enrolled_originals_bucket` |
| `20260925163557` | `phase2_atlas_link_checks` |

## How to add a row

After each live `apply_migration`:

1. Confirm the new row in `supabase_migrations.schema_migrations` (version + name).
2. Append a row to the **Repo file → live version** table: repo filename / version, the live version stamp, and the PR number.
3. If the apply has no matching file under `supabase/migrations/`, append it under **Live-only (no repo file)** instead.
4. Do not rewrite live `version` values to match the repo prefix.

## Live snapshot (2026-09-28)

Read-only dump of `supabase_migrations.schema_migrations` on `zsjczlmzhyzewpehmngc`, 2026-09-28 13:20 Berlin, versions `>= 1764300000`:

```
version          | name
-----------------|--------------------------------
1764300000       | create_focus_sessions
1764410000       | drop_exec_sql_rpc
1764500000       | harden_rls_policies
1764510000       | enable_realtime_for_library
1764600000       | api_keys
1764700000       | feeds
1764701000       | enable_feed_items_realtime
20260427070555   | create_base_schema
20260427070621   | enable_rls_and_policies
20260427070645   | create_triggers_and_indexes
20260427070757   | enhance_papers_and_rls
20260427070829   | enable_realtime_for_tasks
20260427070943   | add_performance_indexes
20260427071204   | add_search_functions
20260427071253   | topics_enhancements
20260427071441   | add_gamification_metadata
20260427071518   | save_idea_transaction
20260427071551   | add_auto_task_preference
20260427071609   | add_running_counts
20260427071626   | align_tasks_contract
20260427171608   | create_planner_tables
20260923163428   | harden_rpc_security_definer
20260923192519   | rls_initplan_and_topic_fk_indexes
20260923192556   | rls_initplan_and_topic_fk_indexes
20260924203242   | topic_junction_parent_with_check
20260925084550   | atlas_tables_phase1
20260925084601   | atlas_rls_phase1
20260925084611   | atlas_rls_policies_data
20260925084621   | atlas_rls_policies_validation
20260925163547   | phase2_enrolled_originals_bucket
20260925163557   | phase2_atlas_link_checks
20260928101832   | atlas_rls_consolidation
20260928102811   | save_idea_with_links_invoker
20260928104309   | reconcile_unapplied_master_delta
```
