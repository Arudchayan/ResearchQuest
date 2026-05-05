# Launch Checklist (RQ-M6-06 / RQ-M6-07)

## Pre-Launch Gates

Check each item off when verified during the final gate review.

| Gate | Description | Status |
|------|-------------|--------|
| Fresh migration | `supabase db push` on a new project applies all 13 migrations without error | ⬜ |
| Auth | Sign-in, sign-up, password reset work end-to-end | ⬜ |
| Notes CRUD | Create, read, update, delete, undo-delete, restore work | ⬜ |
| Papers CRUD | Create, read, update, delete, undo-delete, restore work | ⬜ |
| Ideas CRUD | Create, read, update, delete (stage change), restore work | ⬜ |
| Tasks CRUD | Create, read, update, complete, delete, restore work | ⬜ |
| Topics CRUD | Create, read, update, delete, link entities work | ⬜ |
| Focus session | Start, complete session, XP updates | ⬜ |
| Deep links | `/notes/:id`, `/papers/:id`, `/ideas/:id`, `/tasks/:id`, `/topics/:id` all resolve on page reload | ⬜ |
| Export | JSON download contains all 8 required keys with correct data | ⬜ |
| Import | Round-trip restore succeeds with `imported > 0` | ⬜ |
| Mobile layouts | All 5 entity views are usable on 375 px viewport | ⬜ |
| Keyboard access | Command palette (Ctrl+K), Tab navigation, Escape on dialogs all work | ⬜ |
| RLS | All app-used tables have RLS enabled and per-user policies — see `docs/RLS_AUDIT.md` | ✅ |
| Bundle size | No chunk exceeds 1000 KB — see `docs/PERFORMANCE_NOTES.md` | ✅ |

## Known Issues

_Fill in during M6 QA. Each entry requires: ID, description, severity (P0/P1/P2), release-blocker (yes/no)._

| ID | Description | Severity | Release Blocker |
|----|-------------|----------|-----------------|
| KI-001 | Deep Research feature not implemented — UI absent or shows placeholder | P1 | No (accepted limitation — see `docs/DEEP_RESEARCH_DECISION.md`) |
| KI-002 | `skipped` count in import result always shows 0 — Supabase `ignoreDuplicates` does not expose skip count | P2 | No |
| KI-003 | Main JS chunk (~538 KB) slightly exceeds 500 KB soft target; within 1000 KB hard limit | P2 | No |

_Add additional issues found during smoke testing and gate review here._

## Go/No-Go Criteria

| Criterion | Requirement |
|-----------|-------------|
| P0 tasks | Zero open P0 tasks in roadmap |
| P1 tasks | Zero unaccepted open P1 tasks (each must have an explicit accepted-limitation entry in Known Issues) |
| Pre-launch gates | All gates checked ✅ |
| Build | `pnpm test:run`, `pnpm lint`, `pnpm build` all exit 0 |
| Smoke test | All 10 steps in `docs/BROWSER_SMOKE_TEST.md` pass |

## Go/No-Go Decision

**Decision:** _(fill in at gate review)_

**Date:** _______________

**Reviewed by:** _______________

**Notes:** _______________

---

_This document is part of the M6 release gate. See `docs/RELEASE_ROADMAP_6_MONTHS.md` for the full roadmap._
