# Comprehensive System Evaluation Synthesis

Date: 2026-07-21

## Executive summary

Five independent reviews (optimizations, gaps, cost-benefit, SWOT, and architecture) converged on the same direction: ResearchQuest has a strong alpha foundation in the React/Supabase app, scoped agent API, and research-entity data model, but the highest-leverage work is now consistency, operational hardening, and closing the Feeds loop. The most actionable in-repo findings were documentation drift, package-manager ambiguity, inaccurate project metadata, and unclear alpha boundaries for API-oriented feed ingestion versus UI-supported triage. Larger architecture concerns, such as distributed rate limiting and scheduled ingest reliability, should be sequenced after the current docs and source-of-truth cleanup.

## Critical / High findings actionable in-repo

1. **Package manager source of truth was ambiguous**
   - Evaluation signal: dependency cleanup and CI reliability reviews flagged dual lockfiles as avoidable install drift.
   - Impact: agents, CI, and contributors could select npm despite the project scripts and README using pnpm.
   - Actionability: delete the stale npm lockfile and keep `pnpm-lock.yaml`.

2. **Agent API documentation lagged implemented routes**
   - Evaluation signal: architecture and gap reviews found the API README still described a foundation phase while runtime routes include entity CRUD, batch creation, topic linking, feeds, and discovery endpoints.
   - Impact: agents could target wrong payloads or miss shipped capabilities.
   - Actionability: rewrite the API README from `index.ts`, `routes/entities.ts`, and `_shared/feedRoutes.ts`; point `/explore` and `/openapi.json` out as the contract source of truth.

3. **Root README overstated or misidentified project facts**
   - Evaluation signal: gap and optimization reviews found metadata drift in table count and listed frontend libraries.
   - Impact: contributors get a misleading picture of schema scope and runtime dependencies.
   - Actionability: update the table count from `supabase/tables` and remove tech-stack entries absent from `researchquest/package.json`.

4. **Feeds capability boundary needed sharper alpha messaging**
   - Evaluation signal: SWOT and cost-benefit reviews identified Feeds as strategically important but only partially productized.
   - Impact: users may expect end-to-end RSS/source management and scheduled ingest in the UI when current support centers on triaging/promoting existing `feed_items` and agent/API ingestion.
   - Actionability: document current UI support separately from incomplete source/RSS management UI and scheduled ingest.

5. **Operational hardening remains alpha-grade**
   - Evaluation signal: architecture review called out in-memory rate limiting and isolate-local enforcement as acceptable for alpha but not production-grade.
   - Impact: limits are not globally coordinated and reset with isolate lifecycle.
   - Actionability: document the limitation now; defer distributed quota enforcement until usage warrants the cost.

## Prioritized remediation backlog

### Do now

- Remove stale package-manager artifacts so pnpm is the only lockfile path.
- Align API README with implemented gateway routes and examples.
- Make root README facts match the current schema and dependency graph.
- Add a persistent evaluation synthesis document for tracking follow-up work.
- Label Feeds as alpha: UI triage/promote works for `feed_items`; source/RSS UI and scheduled ingest remain incomplete.

### Do soon

- Add or expand API contract checks that compare documented examples against `/openapi.json` or route fixtures.
- Decide the user-facing design for feed source management, RSS configuration, and ingest scheduling.
- Add smoke coverage for the complete Feeds journey: ingest item, triage item, promote item.
- Review API key scope presets for common agent workflows so users do not over-grant permissions.
- Document deployment and operations expectations for the Edge Function gateway.

### Defer

- Replace isolate-local rate limiting with a distributed quota backend.
- Build generalized connector infrastructure beyond RSS/source management.
- Add advanced analytics or dashboards until core ingestion and triage flows are stable.
- Pursue larger architecture refactors unless they directly reduce reliability or security risk.

## In progress / Fixed this pass

> Replace the placeholders below with exact PR links and commit references during release notes or review handoff.

- **Package manager cleanup** — stale npm lockfile removed; pnpm remains the dependency source of truth. See PR: _TBD_.
- **API gateway documentation refresh** — endpoint table, scopes, examples, and alpha rate-limit note updated from implemented routes. See PR: _TBD_.
- **Root README cleanup** — table count, dependency-backed tech stack, Edge Function list, and Feeds alpha status updated. See PR: _TBD_.
- **Evaluation tracking** — this synthesis document added under `docs/evaluations/`. See PR: _TBD_.

## Review-specific synthesis

- **Optimizations review:** prioritize low-risk cleanup that reduces contributor and agent friction before adding new runtime behavior.
- **Gaps review:** close documentation and product-boundary gaps first; the most visible mismatch was Feeds and the agent API README.
- **Cost-benefit review:** defer distributed systems work until traffic justifies it; docs, lockfile cleanup, and focused tests have the best near-term return.
- **SWOT review:** preserve strengths in entity modeling, Supabase integration, and agent-oriented API discovery while reducing threats from stale docs and unclear alpha promises.
- **Architecture review:** keep `/explore` and `/openapi.json` as machine-readable contracts, and treat in-memory rate limiting plus feed scheduling as explicit alpha constraints.
