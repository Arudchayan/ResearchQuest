# Comprehensive System Evaluation Synthesis

Date: 2026-07-21  
Branch: `cursor/comprehensive-system-evaluation-c747`

## Executive summary

Five independent specialist reviews (optimizations, gaps, cost-benefit, SWOT, architecture) evaluated ResearchQuest end-to-end. They agree the product has a strong alpha foundation—entity coverage, Supabase sync, agent API, security journals, and broad unit tests—but the highest-risk gaps were security-boundary holes (topic-link ownership, permissive CORS, privileged admin bootstrap), performance traps (Command Palette task refetch, index name collisions, unbounded search rendering), and documentation/product-boundary drift. This pass implemented the highest-ROI, low-to-medium-risk remediations; larger refactors (god store split, server-side FTS wiring, atomic XP RPCs, distributed rate limits) remain sequenced as Do soon / Defer.

## Review round 1 — independent findings (condensed)

### Optimizations (top actionable)

| Sev | Finding | Status |
|-----|---------|--------|
| High | Index name collisions blocked composite task/topic indexes | Fixed (migration) |
| High | CommandPalette always called `useTasks` → fetch + realtime at startup | Fixed |
| High | Missing entity-side topic junction indexes | Fixed |
| Medium | Ideas sync skipped `setIdeas` when remote empty → stale UI | Fixed |
| Medium | Autosave wrote/awarded XP even when note unchanged | Fixed (skip no-op) |
| Medium | Unbounded Command Palette search rendering | Fixed (cap 50) |
| Medium | Auth clients recreated per request; rate-limit buckets never evicted | Fixed |
| Medium | RLS `auth.uid()` not initPlan form on topics/junctions | Fixed |
| High | Batch paper import / API `:batchCreate` N+1 | Deferred (larger change) |
| High | Always-on realtime across all domains | Deferred |
| Medium | Task mutations refetch full list after optimistic update | Deferred |
| Medium | Full-collection fetch of large bodies into Zustand | Deferred |

### Gaps (top actionable)

| Sev | Finding | Status |
|-----|---------|--------|
| Critical* | Topics permissive RLS (false positive if migrations applied in order; still hardened) | Defensive drop + recreate |
| High | Feed promotion bypassed http(s) URL validation | Fixed |
| High | `create-admin-user` wildcard CORS, any method, no rate limit | Fixed |
| High | No live RLS/E2E authenticated coverage | Deferred (needs Supabase env) |
| High | Feeds source/RSS UI incomplete | Documented as alpha boundary |
| Medium | Dead `AddPaperModal` duplicate | Deleted |
| Medium | AddPaperView tabs missing keyboard ARIA pattern | Fixed |
| Medium | AuthScreen hid password-strength errors | Fixed |
| Medium | Stale API README / root README metadata | Fixed |
| Medium | Markdown XSS tests over-mocked | Partially improved via autosave tests; deeper preview DOM test still Do soon |
| Low | Missing `focus_sessions` table doc file | Fixed |

\*Original critical finding assumed permissive policies remained; later migration already dropped them. Hardening migration still drops them defensively and recreates owner policies with `(select auth.uid())`.

### Cost-benefit — investment backlog (applied)

1. Dual lockfile removal — **Done**
2. Legacy layout retirement — **Deferred** (large test surface)
3. CORS / admin bootstrap lockdown — **Done**
4. RLS regression hardening — **Partial** (DB ownership triggers + policy refresh)
5. CSP / test-login hygiene — **Deferred**
6. Entity view consolidation — **Deferred**
7. Server-side XP RPCs — **Deferred**
8. Integration tests — **Deferred**
9. Feed ingest / Zotero — **Deferred** (product)
10. Editor splitting / FTS / CDN — **Deferred**

### SWOT — implied actions addressed this pass

- Fail-closed / safer CORS on edge functions
- Topic ownership invariants at DB boundary
- API docs aligned with implementation
- Search result capping + avoid spurious task fetch
- Clear Feeds alpha messaging

### Architecture — structural defects addressed vs deferred

| Issue | This pass |
|-------|-----------|
| Junction ownership only checked in API handlers | DB trigger ownership enforcement |
| Service-role gateway bypassing RLS | Deferred (repository layer) |
| Split sync ownership / god store | Deferred |
| Dual layout / duplicate list components | Deferred (AddPaperModal removed only) |
| Client-side denormalized counts / XP | Deferred |
| Contract/test architecture | Docs + Deno unit tests for feeds validation |

## Fixed this pass (commits)

1. `e88e7de` — docs: evaluation synthesis, API README rewrite, root README cleanup, delete `package-lock.json`
2. `8629a29` — migration `1764800000_security_perf_hardening.sql` + `focus_sessions.sql` table doc
3. `c1f5214` — frontend: ideas sync, CommandPalette, AuthScreen, autosave no-op, AddPaperView a11y, useRelatedItems user filter, delete AddPaperModal
4. `262713a` — edge: auth singletons, rate-limit eviction, feed URL validation, admin-user hardening, fetch-paper/deep-research CORS

## Remaining prioritized backlog

### Do soon

- Wire Notes/Papers/Command Palette to existing Postgres FTS RPCs
- Atomic XP / daily-log / focus completion RPCs
- Authenticated Playwright + local Supabase RLS contract tests
- Real markdown preview XSS DOM assertions (no heavy mocks)
- Retire deprecated `LeftSidebar` + migrate its tests to v2
- Batch import / `:batchCreate` bulk paths
- Feed source management UI + scheduled ingest (or keep agent-only)

### Defer

- Distributed rate limiting (Redis/Upstash)
- God-store split / React Query migration
- Offline/PWA, collaboration, PDF storage
- Full TypeScript `strict` enablement in one shot
- Next.js/SSR rewrite

## Review round 2

Second independent cycle (gaps/security, optimizations, architecture) verified Round-1 remediations and surfaced more High/Medium items.

### Fixed in Round 2

| Finding | Fix |
|---------|-----|
| Admin bootstrap XFF-spoofable rate limit | Global bucket; drop XFF from CORS headers |
| `fetch-paper` / `deep-research` no per-user limits | 30/min and 10/min in-memory limits → 429 |
| `topic_quests` / feed_items source ownership holes | Migration `1764801000_round2_security_hardening.sql` |
| `save_idea_with_links` / `evaluate_user_streaks` privileges | Fail-closed auth + REVOKE/GRANT hardening |
| Unsafe feed item URLs rendered as links | `FeedItemCard` validates before `<a href>` |
| Sync marks domain fetched before success | Markers moved to success path; retry works |
| Task mutations full-refetch after optimistic write | Removed success-path `fetchTasks()` |
| Focus session double-count today seconds | Removed local increment; realtime aggregate wins |
| Topic junction user_id omit race | Always include `user_id` on junction upserts |
| Import duplicate count / misleading UI copy | Count inserted rows; honest “skipped” messaging |
| Unbounded related-items hydration | Cap related links at 50 |
| Feed promote length limits bypassed | Title/body/abstract/description caps on promote |

### Remaining after Round 2 (intentionally deferred)

- Wire Postgres FTS into Notes/Papers/Command Palette
- Atomic XP / daily-log RPC
- Transactional feed promote + import
- Authenticated E2E + live RLS integration tests
- LeftSidebar / dual-layout retirement
- Full-collection pagination / view-scoped realtime
- `batchCreate` bulk inserts
- Distributed rate limiting
- Array-link ownership validation / topic_ids normalization

These require larger product or schema moves and are tracked as Do soon / Defer rather than blocking this evaluation PR.
