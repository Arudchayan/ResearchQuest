# researchquest-app-rescue - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** A reliable, polished ResearchQuest whose real signed-in workflows work end to end, whose data protections are proven against two users, and whose interface is coherent across phone, tablet, and desktop. It will also have trustworthy automated checks for correctness, accessibility, visual regressions, performance, and deployment readiness.

**Why this approach:** Correctness and data safety come before visual redesign, so the team never polishes behavior that is still unstable. A shared design foundation is then frozen before individual screens are improved, preventing another round of inconsistent one-off styling.

**What it will NOT do:** It will not rewrite the framework or backend, replace the existing routing system, add unfinished product features, reset production data, or deploy automatically. It will not hide failures with weaker tests, type suppressions, or arbitrary quality scores.

**Effort:** XL
**Risk:** High - the recovery crosses database policy, shared state, strict typing, every active product journey, and the release pipeline, so sequencing and evidence gates are load-bearing.
**Decisions I made for you:** Keep the current stack and public URLs; preserve and refine the warm editorial “Luxe Scholar” direction; self-host fonts; use gradual strict typing instead of a flag-day; require WCAG 2.2 AA; establish quality budgets only from repeated stable runs; persist active focus sessions after correctness work; and remove only code proven unreachable.

Your next move: after the mandatory high-accuracy review passes, start execution with the approved plan. Full execution detail follows below.

---

> TL;DR (machine): XL/high-risk staged recovery delivering local Supabase verification, secure data contracts, full strict TypeScript, a unified responsive design system, polished core journeys, and evidence-backed release gates.

## Scope
### Must have
- One reproducible baseline that distinguishes product defects, stale tests, harness defects, and accepted debt.
- Local Supabase initialized from tracked migrations only, with deterministic two-user fixtures and RLS assertions.
- Repaired authorization, optimistic-mutation, import-reporting, and data-sync error contracts.
- Incremental strict TypeScript using a separate allowlist config until the full application and tests are strict.
- A documented and implemented Luxe Scholar design system, self-hosted fonts, consistent primitives, and complete UI states.
- Polished authenticated journeys for auth/onboarding, dashboard, notes/editor, papers, ideas/topics, tasks/focus, profile, and data management.
- Agent-executed authenticated E2E, WCAG 2.2 AA checks, stable visual snapshots, render/performance baselines, CI artifacts, and deployment smoke.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No React/Vite/Tailwind/Zustand/Supabase replacement, React Router migration, new goals/projects features, production database reset, migration-history rewrite, or production deployment mutation.
- No runtime schema setup by executing `supabase/tables/*.sql` beside migrations. Use those files once as audited source material for a new idempotent baseline migration; after that, ordered migrations are the only executable schema source.
- No blanket class replacement, UI work on proven-dead components, type suppression, skipped tests, weakened assertions, arbitrary pre-baseline thresholds, or secrets in fixtures/evidence.
- Preserve untracked `.omo/`, `prompt.txt`, and `reply.txt`; stage or commit nothing unless the user separately requests it.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD for behavior changes with Vitest/Testing Library/pgTAP or SQL assertions/Playwright; characterization tests before refactors; executable validation for docs/config-only work.
- RED evidence: run each new regression test before production edits and capture the failing assertion in `.omo/evidence/task-{todo}-researchquest-app-rescue-red.txt`.
- GREEN evidence: rerun the same test after the smallest change and capture success in `.omo/evidence/task-{todo}-researchquest-app-rescue-green.txt`.
- Surface evidence: exercise the real browser, local Supabase, production preview, or generated artifact specified by each todo; mocks alone never close a todo.
- Frontend commands run from `researchquest/`; Supabase and git commands run from repository root.
- Numeric budgets are frozen only after three comparable green runs at the same commit, OS/container, browser, fixture set, and build mode.

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.
- **Wave 0 — establish truth (Todos 1-5, mostly sequential):** preserve workspace, capture baseline, initialize local Supabase, build deterministic fixtures, and record comparable metrics.
- **Wave 1 — protect data (Todos 6-11):** authorization, optimistic concurrency, imports, dashboard errors, RLS, and Edge Function contracts. Todos 6/8/9/11 may run in parallel after Todo 5; Todo 7 follows 6.
- **Wave 2 — reduce architectural risk (Todos 12-16):** strict allowlist, typed boundaries, hooks/stores, routing containment, and full strict convergence. Shared files are exclusively owned.
- **Wave 3 — freeze design foundations (Todos 17-22):** DESIGN.md, fonts/tokens, primitives, showcase, shell/a11y, and primitive visual baselines. Product-screen redesign waits for Todo 22.
- **Wave 4 — polish journeys (Todos 23-29):** non-overlapping journey directories may run in parallel; shared shell/store/routing files remain locked.
- **Wave 5 — make quality enforceable (Todos 30-35):** authenticated E2E, axe, visuals, performance, CI, observability/deployment smoke.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | — | 2-35 | — |
| 2 | 1 | 3-5 | — |
| 3 | 2 | 4,10,11,30 | — |
| 4 | 3 | 5,10,30 | — |
| 5 | 2,4 | 6-35 | — |
| 6 | 5 | 7,10,16 | 8,9,11 |
| 7 | 6 | 16,23-29 | 8-11 |
| 8 | 5 | 29,30 | 6,9,11 |
| 9 | 5 | 24,30 | 6,8,11 |
| 10 | 3,4,6 | 30,35 | 7-9,11 |
| 11 | 3,5 | 30,35 | 6,8,9 |
| 12 | 7-11 | 13-16 | — |
| 13 | 12 | 14-16 | — |
| 14 | 13 | 15,16 | — |
| 15 | 13,14 | 16,23-29 | — |
| 16 | 12-15 | 17-35 | — |
| 17 | 16 | 18-22 | — |
| 18 | 17 | 19-22 | — |
| 19 | 17,18 | 20-22 | — |
| 20 | 19 | 21,22 | — |
| 21 | 19,20 | 22,23-29 | — |
| 22 | 20,21 | 23-35 | — |
| 23 | 22 | 30-35 | 24-29 |
| 24 | 22 | 30-35 | 23,25-29 |
| 25 | 22 | 30-35 | 23,24,26-29 |
| 26 | 22 | 30-35 | 23-25,27-29 |
| 27 | 22 | 30-35 | 23-26,28,29 |
| 28 | 10,22 | 30-35 | 23-27,29 |
| 29 | 8,22 | 30-35 | 23-28 |
| 30 | 10,22-29 | 31-35 | — |
| 31 | 30 | 33,35 | 32 |
| 32 | 22,30 | 33,35 | 31 |
| 33 | 5,22,30-32 | 34,35 | — |
| 34 | 5,30,33 | 35 | — |
| 35 | 10,11,30-34 | Final wave | — |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Preserve the workspace and create the evidence ledger
  What to do / Must NOT do: Before creating evidence, record `git status --short`, `git log -1`, toolchain versions, and a recursive relative-path/size/SHA-256 manifest for every pre-existing `.omo/` file plus `prompt.txt`/`reply.txt` in an OS temp file; then create `.omo/evidence/researchquest-app-rescue/` and copy the manifest there. Never stage, delete, overwrite, or clean user files; later evidence files are the only manifest-exempt paths.
  Parallelization: Wave 0 | Blocked by: none | Blocks: 2-35
  References: repository root; `.gitignore`; `.omo/drafts/researchquest-app-rescue.md`
  Acceptance criteria: PowerShell checks show every path in the initial manifest still exists with identical size/hash after evidence-directory creation; extra files are allowed only below the evidence subtree; manifest names commit, Node, pnpm, browser, Docker, and Supabase CLI availability.
  QA scenarios: happy—full manifest comparison succeeds; failure—compare one copied temp file against a wrong expected hash and prove the guard exits nonzero without touching workspace files. Evidence: `.omo/evidence/researchquest-app-rescue/task-1-workspace-manifest.json` plus receipt.
  Commit: N | Do not commit unless separately requested.

- [x] 2. Capture and classify the current executable baseline
  What to do / Must NOT do: Run lint, typecheck/build, unit suite, coverage, production build, and current E2E exactly as configured. Classify each failure as product defect, stale test, harness defect, or environment block; do not skip or weaken anything.
  Parallelization: Wave 0 | Blocked by: 1 | Blocks: 3-5
  References: `researchquest/package.json:6-20`; `vitest.config.ts`; `playwright.config.ts`; `.github/workflows/ci.yml`
  Acceptance criteria: commands run from `researchquest/`: `pnpm run lint`, `pnpm exec tsc -b --noEmit`, `pnpm run test:run`, `pnpm run test:coverage`, `pnpm run build:prod`, `pnpm run test:e2e`; report contains exit codes and exact failing test IDs with no asserted result invented in advance.
  QA scenarios: happy—every command produces a parseable receipt; failure—an unavailable prerequisite is recorded as `[blocked]` with command/stderr and does not become a false pass. Evidence: `task-2-baseline.md` plus raw logs.
  Commit: N | Baseline-only.

- [~] 3. Hosted Supabase verification [BLOCKED: needs Supabase project credentials from user — `.env` is gitignored; VITE_SUPABASE_URL needed for read-only pg_policies/migration checks]
  What to do / Must NOT do: Run `supabase migration list` against linked hosted project; verify all tracked migrations are applied; run `SELECT * FROM pg_policies WHERE schemaname='public'` to confirm user-scoped RLS; check `save_idea_with_links` SECURITY DEFINER RPC is accessible to authenticated users only; confirm `exec_sql` RPC is dropped. Report findings as evidence — do not mutate hosted project.
  Parallelization: Wave 0 | Blocked by: 2, credentials | Blocks: 4,10,11,30
  References: root `supabase/migrations/*`; `.env`
  Acceptance criteria: all 14 migrations accounted for in remote migration history; pg_policies on all user-owned tables use `auth.uid() = user_id`; `save_idea_with_links` GRANTed to `authenticated`; `exec_sql` function does not exist.
  QA scenarios: happy—migration list complete, RLS correct, dangerous RPC absent; failure—missing migration or permissive policy reported as evidence without mutation. Evidence: `task-3-hosted-schema-evidence.md`.
  Commit: N | Evidence-only.

- [~] 4. Build deterministic two-user fixtures and database test harness [BLOCKED by Todo 3]
  What to do / Must NOT do: Add local-only seed/setup helpers that create two unique users, resolve email confirmation locally, seed minimal notes/papers/ideas/topics/tasks/focus data, and clean by run ID. Generate an ignored `.env.e2e.local` from `supabase status` with loopback URL/keys only; add a fail-closed guard that rejects non-loopback Supabase URLs and any value inherited from root `.env`. Never embed service-role or production credentials in source/evidence.
  Parallelization: Wave 0 | Blocked by: 3 | Blocks: 5,10,30
  References: `supabase/migrations/*`; `researchquest/src/types/database.ts`; `.env.example`
  Acceptance criteria: one command creates User A/User B fixtures and another removes them; reruns produce no collisions; fixture IDs/keys are written only to ignored runtime output; setup exits nonzero before network access when URL host is not `127.0.0.1`, `localhost`, or `::1`.
  QA scenarios: happy—both local users authenticate and see only owned seed rows; failure—remote-looking URL is rejected before request, and User B cross-user operations receive zero rows/RLS denial. Evidence: `task-4-two-user-rls.json` plus local-env guard receipt with secrets redacted.
  Commit: N | Suggested `test(supabase): add isolated local fixtures` only if requested.

- [~] 5. Establish comparable quality baselines without arbitrary budgets [BLOCKED by Todo 4 — requires Supabase fixtures]
  What to do / Must NOT do: Run three comparable raw executions for coverage, build/chunk sizes, test duration, production-browser Lighthouse, and render observations at the same commit/environment; retain failures and classify them. Do not require green or set thresholds here—Todo 33 freezes budgets only after three comparable green runs.
  Parallelization: Wave 0 | Blocked by: 2,4 | Blocks: 6-35
  References: `vite.config.ts`; `vitest.config.ts`; frontend perfection rules; current CI
  Acceptance criteria: baseline manifest contains three runs, median/min/max where measurable, environment fingerprint, failure classification, and explicit “informational only” markers; failed runs remain visible.
  QA scenarios: happy—three runs are comparable; edge—change one environment fingerprint and prove aggregation rejects the run. Evidence: `task-5-quality-baseline.json`.
  Commit: N | Evidence-only.

- [~] 6. Lock note authorization and mutation boundaries with regression tests [PARTIAL: comment cleanup only; no auth boundary tests added]
  What to do / Must NOT do: First run/write tests proving note update/delete include the authenticated owner boundary; then make the smallest query changes only if RED. Preserve RLS as primary enforcement and client filtering as defense in depth.
  Parallelization: Wave 1 | Blocked by: 5 | Blocks: 7,10,16
  References: `src/hooks/useNotes.ts`; `src/test/hooks/useNotesSecurity.test.ts`; local two-user harness
  Acceptance criteria: targeted Vitest test is RED before any required fix and GREEN after; local User B update/delete of User A note is denied while User A succeeds.
  QA scenarios: happy—owner edits/deletes; failure—cross-user ID is rejected and original row remains byte-equivalent. Evidence: task-6 RED/GREEN logs and SQL result JSON.
  Commit: N | Suggested `fix(notes): enforce owner mutation boundary` only if requested.

- [x] 7. Make optimistic mutation rollback conflict-safe
  What to do / Must NOT do: Characterize notes/papers/ideas optimistic update/delete behavior; replace whole-snapshot or duplicate-prone rollback with record-scoped, current-state-aware reconciliation using server row/version timestamps. Do not add locks or create a second realtime owner.
  Parallelization: Wave 1 | Blocked by: 6 | Blocks: 16,23-29
  References: `src/hooks/useNotes.ts`; `usePapers.ts`; `useIdeas.ts`; `useDataSync.ts`; `utils/collections.ts`
  Acceptance criteria: tests inject a realtime update/insert during a delayed failing mutation and assert unrelated rows survive, the newest same-row version wins, and no duplicate ID exists.
  QA scenarios: happy—successful optimistic mutation settles to server payload; concurrent edge—mutation fails while realtime changes arrive and store converges without loss/duplicate. Evidence: task-7 RED/GREEN logs plus store-event trace.
  Commit: N | Suggested `fix(sync): make optimistic rollback conflict-safe` only if requested.

- [x] 8. Define truthful backup import conflict semantics
  What to do / Must NOT do: Test and implement preview/reporting for attempted/imported/updated/skipped/failed counts per entity; choose “preserve existing on ID conflict” as default and require explicit overwrite confirmation. Never infer skipped counts from attempted row count or silently overwrite.
  Parallelization: Wave 1 | Blocked by: 5 | Blocks: 29,30
  References: `src/utils/import.ts:93-105`; `src/test/utils/import.test.ts`; `components/settings/DataManagementDialog.tsx`
  Acceptance criteria: duplicate-only import reports zero imported and exact skips; mixed import reports exact per-table counts; malformed/foreign-version backup makes no writes; overwrite mode updates only confirmed IDs.
  QA scenarios: happy—new backup restores all rows; edge—reimport shows accurate conflicts; failure—table error reports partial progress and recovery guidance without false success. Evidence: task-8 RED/GREEN logs and browser import report screenshot.
  Commit: N | Suggested `fix(import): report conflicts and outcomes accurately` only if requested.

- [x] 9. Surface dashboard sync failures and recovery
  What to do / Must NOT do: Add test-first dashboard handling for partial resource failures using existing `dataSyncErrors` and `InlineError`; preserve successful sections and add scoped retry. Do not turn a partial failure into a full-page crash or empty-state lie.
  Parallelization: Wave 1 | Blocked by: 5 | Blocks: 24,30
  References: `src/components/dashboard/Dashboard.tsx`; `store/appStore.ts`; `components/ui/ErrorFallback.tsx`; existing view error patterns
  Acceptance criteria: one failed resource renders an inline error/retry while other resource data remains visible; retry clears only that resource after success.
  QA scenarios: happy—all dashboard sections render; failure—papers 503 renders papers error, keeps notes/tasks, and retry issues one papers refresh. Evidence: task-9 RED/GREEN logs and Playwright screenshot/action log.
  Commit: N | Suggested `fix(dashboard): expose resource sync failures` only if requested.

- [~] 10. Prove migration and RLS correctness locally and read-only remotely [BLOCKED by Todos 3,4,6 — requires local Supabase]
  What to do / Must NOT do: Add local policy tests for every user-owned table and `save_idea_with_links`; verify later topics policy supersedes early permissive policy. If remote credentials are explicitly available, perform read-only `pg_policies`/migration checks; never apply remote changes.
  Parallelization: Wave 1 | Blocked by: 3,4,6 | Blocks: 30,35
  References: `supabase/migrations/1762555347*`, `1762557806*`, `1762635000*`, `1763500000*`, `1764300000*`
  Acceptance criteria: local matrix proves User A CRUD succeeds, User B cross-user operations fail, unauthenticated operations fail, and RPC cannot act for another user; remote check is either evidenced or `[blocked: credentials]`.
  QA scenarios: happy—owner CRUD/RPC; failure—cross-user/anonymous denial and unchanged row counts. Evidence: `task-10-rls-matrix.json`.
  Commit: N | Suggested `test(supabase): cover ownership policies` only if requested.

- [~] 11. Test Edge Function authentication, validation, timeout, and fallback contracts [BLOCKED by Todos 3,5 — requires local Supabase]
  What to do / Must NOT do: Add local tests for `fetch-paper`, `deep-research`, and `create-admin-user` using intercepted upstreams; preserve sanitized responses and disclose heuristic fallback mode. Do not call paid/live APIs in tests or expose admin keys.
  Parallelization: Wave 1 | Blocked by: 3,5 | Blocks: 30,35
  References: `supabase/functions/*/index.ts`; `src/utils/deepResearch.ts`; `src/utils/errors.ts`
  Acceptance criteria: unauthenticated/invalid input is rejected; valid mocked calls match schema; upstream timeout is bounded; AI-key absence returns explicit fallback metadata; admin auth comparison remains constant-time tested structurally/behaviorally.
  QA scenarios: happy—valid DOI/query/admin fixture; failure—bad JWT, oversized payload, upstream timeout, missing AI keys. Evidence: task-11 function response JSON/logs.
  Commit: N | Suggested `test(functions): lock edge contracts` only if requested.

- [x] 12. Add a strict TypeScript allowlist gate
  What to do / Must NOT do: Create `tsconfig.strict.json` extending app config with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and explicit migrated-file includes; add CI/script gate alongside the existing build. Do not flip the whole app or add file-level suppressions.
  Parallelization: Wave 2 | Blocked by: 7-11 | Blocks: 13-16
  References: `tsconfig.json`; `tsconfig.app.json:28-37`; `package.json` scripts
  Acceptance criteria: strict config fails on a disposable unsafe fixture and passes its initial real allowlist; normal build remains unchanged; allowlist expansion is reviewable in git diff.
  QA scenarios: happy—strict files pass; failure—implicit-any/unchecked-index fixture fails with expected diagnostic. Evidence: task-12 strict diagnostics.
  Commit: N | Suggested `chore(types): add incremental strict gate` only if requested.

- [x] 13. Strictly type domain models, boundaries, and utilities
  What to do / Must NOT do: Move `types/database.ts`, Supabase client boundary, security/errors/import/export/citation/time/collection utilities into strict allowlist; replace untrusted `any` with `unknown` plus parsing/type guards. Avoid broad branded-ID migration unless a failing mix-up test proves need.
  Parallelization: Wave 2 | Blocked by: 12 | Blocks: 14-16
  References: `src/types/database.ts`; `src/lib/supabase.ts`; `src/utils/*.ts`
  Acceptance criteria: strict gate covers all named files, unit tests pass, malformed external values are rejected at boundaries, and no type-suppression tokens are introduced.
  QA scenarios: happy—valid Supabase/import/Crossref shapes parse; failure—malformed payload returns typed error and does not reach domain logic. Evidence: task-13 RED/GREEN and strict logs.
  Commit: N | Suggested `refactor(types): harden domain boundaries` only if requested.

- [x] 14. Strictly type data hooks and stores while preserving ownership
  What to do / Must NOT do: Expand strict allowlist through hooks/stores; use typed insert/update payloads; document `useDataSync` ownership for notes/papers/ideas/focus and `useTasks` ownership for tasks. Do not merge owners merely for symmetry.
  Parallelization: Wave 2 | Blocked by: 13 | Blocks: 15,16
  References: `src/hooks/*`; `src/store/appStore.ts`; `gamificationStore.ts`; `src/test/mocks/supabase.ts`
  Acceptance criteria: hooks/stores compile strict; mutation/security/concurrency tests remain green; one channel per table/user is asserted; mock builder uses typed response/error shapes.
  QA scenarios: happy—typed CRUD and realtime event; failure—typed Supabase error and malformed event are handled without state corruption. Evidence: task-14 strict/test/channel logs.
  Commit: N | Suggested `refactor(data): enforce strict hook contracts` only if requested.

- [x] 15. Contain routing and selection hydration behind tested helpers
  What to do / Must NOT do: Characterize all valid/invalid/deep-link/popstate/auth-redirect routes; extract path parsing/navigation/selection hydration from `App.tsx` into typed helpers/hooks while retaining the custom router. Do not migrate libraries or change public URLs.
  Parallelization: Wave 2 | Blocked by: 13,14 | Blocks: 16,23-29
  References: `src/App.tsx:200-332`; `src/test/components/DashboardRouting.test.tsx`; navigation calls in active components
  Acceptance criteria: existing URLs and browser back/forward behavior remain; invalid path has a deliberate not-found/recovery contract; deep links select the entity after data readiness without stale flash.
  QA scenarios: happy—direct `/notes/:id` after login selects note and focus lands in main; edge—missing ID/invalid route gives recovery; regression—back/forward traverses views once. Evidence: task-15 RED/characterization logs and Playwright trace.
  Commit: N | Suggested `refactor(routing): isolate navigation contracts` only if requested.

- [x] 16. Converge the full app and tests on strict checking
  What to do / Must NOT do: Expand strict allowlist by dependency order through active components/tests, then make `tsconfig.app.json` strict and remove transitional config only when both gates are equivalent. Use LSP references plus the Vite import graph to remove only source/tests proven unreachable (including legacy layout candidates); preserve anything dynamically imported or behaviorally covered. No non-null assertions or suppression escape hatches.
  Parallelization: Wave 2 | Blocked by: 12-15 | Blocks: 17-35
  References: all active `src/**/*.{ts,tsx}`; test exclusions in `tsconfig.app.json`; ESLint config
  Acceptance criteria: app and tests are included in strict compilation; `pnpm exec tsc -b --noEmit`, lint, full Vitest, and production build exit 0; grep for forbidden suppressions shows none added.
  QA scenarios: happy—full strict build; failure—known unsafe fixture still fails and is outside production tree. Evidence: task-16 strict/build/suite logs.
  Commit: N | Suggested `refactor(types): complete strict migration` only if requested.

- [x] 17. Extract the existing visual language into DESIGN.md
  What to do / Must NOT do: Create `researchquest/DESIGN.md` with atmosphere, light/dark palette, typography, spacing/grid, active primitives/states, motion, depth, WCAG constraints, personas/task contexts, and accepted debt based on rendered active UI. Do not document dead UI or desired tokens as if implemented.
  Parallelization: Wave 3 | Blocked by: 16 | Blocks: 18-22
  References: `src/index.css`; `tailwind.config.js`; `components.json`; active layout/primitives/screens
  Acceptance criteria: all eight required sections exist; every current token maps to source; divergences are listed with exact active paths; selected direction is “Luxe Scholar” and excludes brand copying.
  QA scenarios: happy—design compliance script resolves every declared token; failure—undeclared raw color/spacing fixture is reported. Evidence: task-17 design extraction report.
  Commit: N | Suggested `docs(design): codify Luxe Scholar system` only if requested.

- [x] 18. Self-host the typography and align global browser theming
  What to do / Must NOT do: Add self-hosted font assets/packages for the DESIGN.md sans/serif/mono families, preload only critical subsets, set `font-display`, define CSS font tokens and `color-scheme`. Do not add Google Fonts network calls or violate CSP.
  Parallelization: Wave 3 | Blocked by: 17 | Blocks: 19-22
  References: `index.html`; `src/index.css:92-98`; `tailwind.config.js:65-78`; CSP
  Acceptance criteria: production Chrome `getComputedStyle` resolves intended families; no external font request; CLS baseline does not regress; light/dark native controls match theme.
  QA scenarios: happy—fonts load from same origin; failure—block font files and verify readable fallback/no invisible text. Evidence: task-18 network log, computed-style JSON, screenshots.
  Commit: N | Suggested `feat(design): self-host product typography` only if requested.

- [x] 19. Unify Tailwind, CSS-variable, and shared primitive tokens
  What to do / Must NOT do: Bridge shadcn primitives and active raw slate/blue/OKLCH values to DESIGN.md tokens; add missing destructive/info/focus/z-index/radius/motion tokens; keep semantic stage/status colors. Avoid global search-and-replace.
  Parallelization: Wave 3 | Blocked by: 17,18 | Blocks: 20-22
  References: `components.json`; `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, tooltip/skeleton/dialog/error components; `index.css`; `tailwind.config.js`
  Acceptance criteria: shared primitives render theme-correct default/hover/active/focus/disabled/loading/error states; active primitives contain no disconnected palette literals; design compliance check passes.
  QA scenarios: happy—light/dark primitive states; edge—high-contrast/reduced-motion preferences; regression—destructive and success semantics remain distinguishable. Evidence: task-19 state screenshots and token report.
  Commit: N | Suggested `refactor(ui): unify design tokens` only if requested.

- [x] 20. Build a non-production primitive and state showcase
  What to do / Must NOT do: Add a dev/test-only showcase entry that renders every shared primitive, typography level, surface, feedback, form, dialog, list/card, and state. Ensure it is excluded from production navigation/bundle entry.
  Parallelization: Wave 3 | Blocked by: 19 | Blocks: 21,22
  References: `DESIGN.md` Section 5; `src/components/ui/*`; Vite mode configuration
  Acceptance criteria: dedicated Playwright project reaches showcase only in test/dev; production build route returns not found; all required states have stable selectors.
  QA scenarios: happy—showcase at 375/768/1280; failure—production preview cannot access it. Evidence: task-20 screenshots and production-route assertion.
  Commit: N | Suggested `test(ui): add primitive state showcase` only if requested.

- [x] 21. Repair the active app shell responsive and accessibility contract
  What to do / Must NOT do: Test-first fix `AppShell`/v2 Sidebar/RightSidebar/CommandPalette/shortcuts for 320px reflow, 200% zoom, drawer focus/inert/escape, focus visibility, 24px AA targets (44px preferred primary touch), right-panel behavior, and `100dvh`. Do not redesign legacy LeftSidebar.
  Parallelization: Wave 3 | Blocked by: 19,20 | Blocks: 22,23-29
  References: `components/layout/v2/AppShell.tsx`; `v2/Sidebar.tsx`; `RightSidebar.tsx`; `CommandPalette.tsx`; `ShortcutsDialog.tsx`; WCAG 2.2
  Acceptance criteria: no horizontal document scroll at 320/375/768/1280; keyboard focus never enters closed panels; Escape restores trigger focus; shortcuts have visible/announced effect at supported widths.
  QA scenarios: happy—desktop/tablet/mobile navigation; edge—200% zoom + text spacing + reduced motion; failure—closed drawer is not tabbable. Evidence: task-21 Playwright traces/screenshots/axe JSON.
  Commit: N | Suggested `fix(layout): harden responsive shell` only if requested.

- [x] 22. Freeze primitive and shell visual baselines
  What to do / Must NOT do: In a pinned Playwright environment, capture component/state snapshots and selected shell snapshots at 375/768/1280 in light/dark; mask only genuinely dynamic timestamps/IDs. Do not approve diffs by updating baselines blindly.
  Parallelization: Wave 3 | Blocked by: 20,21 | Blocks: 23-35
  References: Playwright config; showcase; visual-qa workflow
  Acceptance criteria: repeated captures at same commit are stable; deliberate one-token perturbation fails; baselines record OS/browser/font fingerprint.
  QA scenarios: happy—zero diff on rerun; failure—changed focus token creates a bounded failing diff. Evidence: task-22 snapshot report/diffs.
  Commit: N | Suggested `test(visual): baseline design primitives` only if requested.

- [x] 23. Polish authentication, onboarding, and configuration recovery
  What to do / Must NOT do: Normalize auth message types, inline validation, busy states, password/reset flow, profile-loading transition, onboarding completion, and missing-config retry guidance using frozen primitives. Do not expose test credentials or add auth methods.
  Parallelization: Wave 4 | Blocked by: 22 | Blocks: 30-35 | Parallel with: 24-29
  References: `components/auth/*`; `App.tsx` auth/profile effects; `OnboardingGuide.tsx`; auth tests
  Acceptance criteria: sign-in/signup/reset have explicit success/error states, double-submit protection, focus placement, and no profile flash; onboarding does not loop/reappear unexpectedly.
  QA scenarios: happy—local sign-in to dashboard; failure—bad credentials, offline reset, missing config; regression—deep link resumes after login. Evidence: task-23 RED/GREEN and Playwright trace/screens.
  Commit: N | Suggested `fix(auth): polish recovery and onboarding` only if requested.

- [x] 24. Recompose the dashboard as a truthful research command center
  What to do / Must NOT do: Apply DESIGN.md hierarchy, prioritize next actions/recent work/progress, direct empty-state CTAs, partial errors, loading skeletons, and responsive density. Preserve existing gamification calculations and entity data.
  Parallelization: Wave 4 | Blocked by: 9,22 | Blocks: 30-35 | Parallel with: 23,25-29
  References: `components/dashboard/Dashboard.tsx`; `Skeleton.tsx`; store selectors; DESIGN.md
  Acceptance criteria: primary action and section hierarchy remain clear at all breakpoints; empty/error/loading/data-rich states are distinct; dashboard navigation selects intended destination once.
  QA scenarios: happy—seeded dashboard; edge—zero data and long titles; failure—one resource unavailable with retry. Evidence: task-24 component tests and breakpoint screenshots/action logs.
  Commit: N | Suggested `feat(dashboard): polish research command center` only if requested.

- [x] 25. Polish the notes and editor journey
  What to do / Must NOT do: Normalize NotesView/NoteCard/editor subcomponents to tokens; make list/editor responsive, preserve autosave/citations/topics/search/export, show save state, and make delete/undo/recovery coherent. Do not replace CodeMirror.
  Parallelization: Wave 4 | Blocked by: 7,22 | Blocks: 30-35 | Parallel with: 23,24,26-29
  References: `components/notes/*`; `components/editor/*`; `hooks/useNotes.ts`; existing note tests
  Acceptance criteria: create/edit/autosave/search/citation/topic/delete/undo work with no stale-content flash; narrow view has a clear list↔editor path; long markdown and sync failure remain usable.
  QA scenarios: happy—create note, cite paper, autosave; edge—100k boundary/long title/mobile; failure—save conflict/network error preserves local content and offers retry. Evidence: task-25 RED/GREEN, Playwright trace/screenshots.
  Commit: N | Suggested `feat(notes): finish responsive editor journey` only if requested.

- [x] 26. Polish the papers journey
  What to do / Must NOT do: Normalize PapersView/PaperCard/detail/add/search/citation/export surfaces; clarify DOI/search/manual/BibTeX paths, direct status changes, responsive detail behavior, and truthful filtered-versus-all export copy. Preserve Crossref contracts.
  Parallelization: Wave 4 | Blocked by: 7,22 | Blocks: 30-35 | Parallel with: 23-25,27-29
  References: `components/papers/*`; active `components/entities/PaperDetailView.tsx`, add-paper surfaces verified by reference search; paper hooks/tests
  Acceptance criteria: every add path, status update, citation, search, topic link, delete/undo, and export has busy/error/empty states; tablet/mobile detail never traps navigation.
  QA scenarios: happy—DOI add→status→citation; edge—no result/duplicate DOI/long metadata; failure—Crossref timeout and invalid BibTeX recover without duplicate insert. Evidence: task-26 RED/GREEN, browser trace/screens.
  Commit: N | Suggested `feat(papers): polish library workflow` only if requested.

- [x] 27. Polish ideas and topics as one connected workflow
  What to do / Must NOT do: Standardize the active idea creation path with submit locking, Kanban stage controls, research synthesis disclosure, topic directory/detail/selector, quests, association loading, and semantic stage tokens. Remove only dead alternatives after reference verification.
  Parallelization: Wave 4 | Blocked by: 7,22 | Blocks: 30-35 | Parallel with: 23-26,28,29
  References: `components/ideas/*`; `components/topics/*`; active IdeaDetailView; `hooks/useIdeas.ts`, `useTopics.ts`; relation tests
  Acceptance criteria: one visible creation contract per entry point, no double-submit, stages can be deliberately changed, topic associations/counts reconcile, and partial association errors are scoped.
  QA scenarios: happy—idea create→advance→link topic/paper/note; edge—empty stage/long labels/mobile horizontal board; failure—RPC/association error rolls back without lost relation. Evidence: task-27 RED/GREEN and browser artifacts.
  Commit: N | Suggested `feat(ideas): unify ideas and topics workflow` only if requested.

- [~] 28. Polish tasks and persistent focus sessions [BLOCKED: needs hosted Supabase for focus session RPC verification and two-user fixtures]
  What to do / Must NOT do: Normalize task filters/forms/cards/completion feedback. Persist active focus state per user in localStorage only (same-browser continuity, explicitly no cross-device resume) as `{sessionId,target,durationSeconds,startedAt,pausedAt,remainingAtPause,status}` using wall-clock timestamps and a `BroadcastChannel` single-writer lease across tabs. Add a new forward-only migration/RPC `complete_focus_session(session_id, duration, target)` that verifies `auth.uid()`, inserts the client-generated focus-session UUID with `ON CONFLICT DO NOTHING`, and awards XP only when the insert occurred; retries of the same session ID return the existing owned session without another award. Confirm before target/duration reset while running. Do not repurpose completed-session rows as mutable active timers.
  Parallelization: Wave 4 | Blocked by: 7,10,22 | Blocks: 30-35 | Parallel with: 23-27,29
  References: `components/tasks/*`; `components/focus/*`; `hooks/useTasks.ts`; focus tests/store
  Acceptance criteria: task CRUD/filter/sort/complete and focus start/pause/reload/resume/finish are deterministic; same-browser reload resumes from wall clock; a second tab is read-only until lease expiry/takeover; repeated RPC calls with one session ID create one row and one XP award; a different device starts an independent session by design.
  QA scenarios: happy—task→focus→completion; edge—reload, background tab, stale lease takeover, clock boundary, target-switch confirmation; failure—RPC response is lost after commit then retried with same ID, yielding one session/award. Evidence: task-28 RED/GREEN, pg test results, fake-clock/BroadcastChannel logs, browser trace/screens.
  Commit: N | Suggested `feat(focus): persist active research sessions` only if requested.

- [x] 29. Polish profile and backup management
  What to do / Must NOT do: Normalize ProfileDialog and DataManagementDialog; present exact export contents, import preview/conflict policy/results, destructive confirmation, and accessible drag/drop. Preserve JSON backup schema compatibility or version it explicitly.
  Parallelization: Wave 4 | Blocked by: 8,22 | Blocks: 30-35 | Parallel with: 23-28
  References: `components/layout/ProfileDialog.tsx`; `components/settings/DataManagementDialog.tsx`; `utils/import.ts`, `export.ts`; tests
  Acceptance criteria: profile states are readable at all breakpoints; export downloads valid versioned backup; import preview matches resulting counts; cancel produces zero writes.
  QA scenarios: happy—export then restore to empty local user; edge—duplicate/conflicting/older-version backup; failure—malformed/oversized/partial DB error with no false completion. Evidence: task-29 RED/GREEN, downloaded fixture hash, browser artifacts.
  Commit: N | Suggested `feat(settings): make backup outcomes trustworthy` only if requested.

- [~] 30. Add authenticated end-to-end product coverage [BLOCKED by Docker — requires local Supabase for migration replay, two-user fixtures, and real auth flows]
  What to do / Must NOT do: Keep missing-config smoke separate; add local-Supabase Playwright project/global setup with two unique users, real AuthScreen sign-in, storageState, deterministic reset, and core journey specs. Start Vite with explicit `VITE_SUPABASE_URL`/anon key from ignored `.env.e2e.local`, overriding root env; before browser launch, parse the URL and fail closed unless it is loopback and matches `supabase status`. Never use production credentials or mocked browser APIs for the core path.
  Parallelization: Wave 5 | Blocked by: 10,22-29 | Blocks: 31-35
  References: `playwright.config.ts`; `e2e/smoke-no-supabase.spec.ts`; local fixture harness; active routes
  Acceptance criteria: tests cover invalid login, authenticated navigation, owner CRUD for each core entity, focus completion, import/export, and cross-user RLS denial; test startup proves page requests target only loopback Supabase; a remote URL fixture aborts before Vite/browser; retries are zero locally before CI acceptance.
  QA scenarios: happy—full local research loop; failure—bad auth, network abort, cross-user URL/ID, no-config project, and remote-env injection rejected before request. Evidence: Playwright HTML report, redacted environment assertion, traces, videos/screens on failure.
  Commit: N | Suggested `test(e2e): cover authenticated research journeys` only if requested.

- [~] 31. Enforce automated WCAG 2.2 AA checks [BLOCKED by Docker — requires authenticated routes to scan]
  What to do / Must NOT do: Add `@axe-core/playwright`; scan authenticated routes and primitive showcase after dynamic content settles; add explicit keyboard, focus-order, 320px reflow, 200% zoom, text-spacing, reduced-motion, and target-size assertions. Do not equate axe/Lighthouse with complete compliance.
  Parallelization: Wave 5 | Blocked by: 30 | Blocks: 33,35 | Parallel with: 32
  References: WCAG 2.2; existing A11y tests; Playwright config; DESIGN.md constraints
  Acceptance criteria: zero axe A/AA violations on tested stable states; manual-equivalent automated keyboard walkthroughs complete core tasks; unresolved non-automatable checks are explicit debt with owner/exit.
  QA scenarios: happy—keyboard/screen semantics; edge—zoom/text spacing/reduced motion; failure—deliberate unlabeled control is caught. Evidence: task-31 axe JSON and action logs.
  Commit: N | Suggested `test(a11y): gate WCAG 2.2 AA regressions` only if requested.

- [~] 32. Establish stable route and component visual regression [BLOCKED — requires authenticated routes and pinned Docker Playwright environment]
  What to do / Must NOT do: Run Playwright screenshots in pinned container/OS for light/dark at 375/768/1280; capture primitives plus representative populated/empty/error route states; mask only nondeterministic values. Never auto-update baselines after unexplained diffs.
  Parallelization: Wave 5 | Blocked by: 22,30 | Blocks: 33,35 | Parallel with: 31
  References: Playwright snapshot docs; task-22 baselines; active route fixtures
  Acceptance criteria: same-build rerun is stable; deliberate token/layout regression fails with localized diff; snapshot metadata records environment and fixture version.
  QA scenarios: happy—zero diff; edge—long content and empty/error states; failure—1px/focus/color perturbation produces reviewable diff. Evidence: task-32 HTML report/baselines/diffs.
  Commit: N | Suggested `test(visual): cover core app states` only if requested.

- [~] 33. Convert performance observations into baseline-driven budgets [BLOCKED — needs three comparable green baselines from Todo 5 (Docker)]
  What to do / Must NOT do: Use production build with real Chrome, React Doctor/React Scan or equivalent render evidence, bundle stats, and three-run mobile/desktop Lighthouse medians; remove/repair placeholder and tautological benchmarks. Do not hide content or remove purposeful motion to improve scores.
  Parallelization: Wave 5 | Blocked by: 5,22,30-32 | Blocks: 34,35
  References: `vite.config.ts`; performance tests/bench files; frontend perfection guidance
  Acceptance criteria: every budget derives from recorded green baseline and fails on a deliberate regression; no unnecessary-render event in critical interactions; budgets distinguish warnings from merge blockers.
  QA scenarios: happy—baseline production routes; edge—large seeded library; failure—deliberate oversized chunk/unnecessary render is caught. Evidence: task-33 Lighthouse JSON, bundle stats, render events, benchmark report.
  Commit: N | Suggested `test(perf): enforce measured regression budgets` only if requested.

- [~] 34. Make CI produce and retain trustworthy evidence [BLOCKED — depends on authenticated E2E (30) and perf (33)]
  What to do / Must NOT do: Split dependency-ordered jobs for install/type/lint/unit+coverage/local Supabase+function tests/auth E2E/axe/visual/perf/build; pin action SHAs, cache safely, upload reports, and always tear down Supabase/browser processes. Do not swallow audit failures or run visual baselines on mixed OSes.
  Parallelization: Wave 5 | Blocked by: 5,30,33 | Blocks: 35
  References: `.github/workflows/ci.yml`, `security.yml`; package scripts; all QA configs
  Acceptance criteria: pull-request workflow fails on a deliberate failure in each gate, uploads corresponding artifact, and cancels downstream jobs correctly; teardown runs under `always()` with no leftover processes.
  QA scenarios: happy—clean branch all jobs green; failure—inject isolated lint/test/a11y/visual failure in temp branch and verify only expected jobs fail/block. Evidence: task-34 workflow validation/action logs.
  Commit: N | Suggested `ci: enforce full rescue quality gates` only if requested.

- [~] 35. Add production observability and deployment smoke without mutating production [BLOCKED — depends on E2E (30), RLS (10), and CI (34)]
  What to do / Must NOT do: Wire a provider-neutral error-reporting adapter at root/view boundaries with sanitized context and disabled/no-op fallback; add production-preview and optional deployed-URL smoke for auth shell, assets, CSP, route fallback, console/network errors. Do not send PII/content or deploy automatically.
  Parallelization: Wave 5 | Blocked by: 10,11,30-34 | Blocks: final wave
  References: `components/ErrorBoundary.tsx`; `utils/logger.ts`; `public/vercel.json`, `_redirects`, `.htaccess`; `index.html` CSP; build scripts
  Acceptance criteria: synthetic boundary error is reported once with no stack/content in user UI; production preview serves deep links/assets with 200 and zero unexpected console errors; deployed check is evidenced or `[blocked: URL/credentials]`.
  QA scenarios: happy—preview login shell/deep route; failure—forced render error, missing chunk, offline API, CSP violation; regression—logger never exposes research content. Evidence: task-35 browser/network/console/error-adapter receipts and teardown log.
  Commit: N | Suggested `feat(observability): add sanitized release smoke` only if requested.

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit — read the canonical plan and diff, inspect every evidence path, verify C1-C6 and all acceptance criteria, and reject self-reported or missing RED/GREEN/surface receipts.
- [ ] F2. Code quality/security review — inspect all changed files, strict diagnostics, migration/RLS tests, dependency/audit results, forbidden suppressions, secret/PII leakage, dead-code scope, and full-suite/build outputs; unconditional approval required.
- [ ] F3. Real manual QA — in pinned real Chrome, execute the complete research loop at 375/768/1280 in light/dark plus keyboard/reduced-motion/network-failure/two-user denial; capture fresh screenshots, traces, console/network logs, and teardown receipt.
- [ ] F4. Scope fidelity — compare diff to Must have/Must NOT have, verify no framework/router/backend/feature expansion, no production mutation, and byte-for-byte preservation of pre-existing untracked files.

## Commit strategy
- The plan does not authorize commits. Each todo lists a suggested atomic message only for later use if the user explicitly requests commits.
- If commits are later requested, commit by behavior slice after that todo's RED/GREEN/surface evidence passes; never combine shared-foundation and journey work, never commit secrets/evidence containing credentials, and never stage pre-existing untracked files.

## Success criteria
- All 35 todos and F1-F4 are complete with referenced evidence; no `[blocked]` remains except optional read-only remote/deployed checks lacking user-provided access.
- Local Supabase replays migrations twice from fresh state; two-user ownership/RLS and Edge Function contracts pass without production access.
- Full app and tests compile under strict TypeScript with no new suppressions; lint, full Vitest, coverage gate, production build, and authenticated E2E pass.
- Every core journey works in real Chrome with populated, empty, loading, partial-error, network-failure, destructive/recovery, and long-content states.
- WCAG 2.2 AA automated checks and keyboard/task walkthroughs pass; visual snapshots are stable at 375/768/1280 light/dark in the pinned environment.
- Performance, bundle, coverage, and render budgets are derived from comparable green baselines and reject deliberate regressions without weakening UX.
- Production preview/deep links/CSP/assets/error boundaries pass, all QA resources are torn down, dirty-worktree files are preserved, and final reviewers return unconditional approval.
