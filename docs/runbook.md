# ResearchQuest runbook

## Database types (PR21 item 94)

`researchquest/src/types/database.ts` mirrors the Supabase `public` schema.
Source of truth is `supabase/tables/*.sql` plus `supabase/migrations/*`.

- Regenerate from a live project (needs `SUPABASE_PROJECT_ID` and a logged-in
  `supabase` CLI):
  `SUPABASE_PROJECT_ID=<project-ref> pnpm db:types` (run in `researchquest/`).
- Offline drift check (no network, runs in CI on every PR):
  `pnpm db:types:check` (runs `scripts/check-db-types.mjs`).
- If the check fails: regenerate with `pnpm db:types`, or update the
  interface by hand to match the schema, then re-run the check. Tables with
  no TS equivalent are warnings — add the interface or extend
  `TABLE_INTERFACE_MAP` in the script.

## Paper ↔ topic authority (PR21 item 92)

- Authority: the `topic_papers` junction table.
- `papers.topic_ids` is a read-only cache maintained by the
  `sync_paper_topic_cache` trigger (migration `1764900000`) and consumed by
  ResearchRadar, the edge API paper selects, and `search_papers`.
- Never write `topic_ids` directly. Assign topics via the junction:
  frontend `useTopics.attachTopicToEntity` / `detachTopicFromEntity`, edge
  `POST /topics/{id}/attach` and `POST /topics/{id}/detach`. The edge papers
  validator strips caller-supplied `topic_ids`.

## Library indexes (PR21 item 93)

- Baseline FTS GIN (`to_tsvector`) indexes: migration `1762624235`.
- Trigram (`pg_trgm`) title/name indexes + missing
  `(user_id, updated_at DESC)` composites for feeds: migration `1764901000`.

## Feeds one-path (PR21 item 99)

- Promote targets papers only: `POST /feed-items/{id}/promote`
  `{ "target": "paper" }` → `201` (paper created, item `promoted`) or `200`
  (duplicate URL/DOI found, item `triaged`, existing paper returned).
- Triage/archive remain available for everything else. Deferred with explicit
  TODO stubs in `feedRoutes.ts`: RSS ingest UI, cron polling, deep-research
  orchestration.
