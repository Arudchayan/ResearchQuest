---
slug: researchquest-app-rescue
status: awaiting-approval
intent: unclear
review-required: true
pending-action: write a Docker-free hosted-Supabase replan and run dual high-accuracy review
approach: reconcile the dirty rescue work, verify the existing hosted Supabase safely through dedicated user-level test accounts, close concrete security and toolchain gaps, make evidence-led quality improvements, then complete only verified journey and release gates
---

# Draft: researchquest-app-rescue

## Components (topology ledger)
| id | outcome | status | evidence |
| --- | --- | --- | --- |
| C1 | Reproducible baseline with every current failure classified | active | `researchquest/package.json`, `.github/workflows/ci.yml` |
| C2 | Secure, race-safe data mutations and truthful import/error behavior | active | `src/hooks/*`, `src/utils/import.ts`, Supabase migrations |
| C3 | Incrementally strict TypeScript and explicit routing/state ownership contracts | active | `tsconfig.app.json`, `App.tsx`, stores/hooks |
| C4 | Documented Luxe Scholar system with consistent primitives and responsive shell | active | `index.css`, `tailwind.config.js`, `components/ui/*` |
| C5 | Polished authenticated product journeys with complete UI states | active | active screens/components |
| C6 | Local Supabase, authenticated E2E, axe, visual, performance, and deployment evidence | active | test/config/workflow surface |
| D1 | Goals/projects/milestones feature completion | deferred | schema-only/partial features |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
| --- | --- | --- | --- |
| Stack | Keep React 18/Vite 6/Tailwind 3/Zustand/Supabase | Rewrite risk exceeds rescue benefit | yes |
| Routing | Characterize/simplify current router; no React Router migration in this rescue | Avoid cross-cutting churn without proven need | yes |
| Visual direction | Refine existing Luxe Scholar editorial system | Strongest coherent system already present | yes |
| Fonts | Self-host selected fonts; no Google Fonts network calls | CSP/privacy/performance compatibility | yes |
| Type safety | Strict allowlist config expanded module by module | Avoid flag-day migration | yes |
| Accessibility | WCAG 2.2 AA; 24px minimum targets, 44px preferred for primary touch actions | Standards-correct | yes |
| QA thresholds | Capture three stable baselines before setting numeric budgets | Avoid arbitrary gates | yes |
| Focus timer | Persist active session after correctness work | High-value polish, not P0 | yes |
| Dead UI | Verify references, then remove dead LeftSidebar graph; never redesign it | Avoid wasted work | yes |

## Findings (cited - path:lines)
- `researchquest/tsconfig.app.json:28-37` disables strict app checks.
- `researchquest/src/App.tsx:90-399` centralizes auth, routing, selection hydration, and shell orchestration.
- `researchquest/src/components/dashboard/Dashboard.tsx:25-67` omits `dataSyncErrors` while rendering empty states.
- `researchquest/src/utils/import.ts:93-105` cannot truthfully distinguish attempted, imported, and duplicate-skipped rows.
- `researchquest/src/hooks/useDataSync.ts:248-401` owns notes/papers/ideas/focus realtime; `useTasks.ts` solely owns tasks. Duplicate ownership is rejected.
- `supabase/migrations/1762635000_topics_enhancements.sql:20-36` supersedes early open topics policies; deployed state is unverified.
- `researchquest/src/index.css:6-84`, `tailwind.config.js:28-144`, and active hardcoded OKLCH/slate/blue styles form divergent visual systems.
- `researchquest/playwright.config.ts:6-34` + `e2e/smoke-no-supabase.spec.ts` cover only desktop missing-config behavior.
- No `DESIGN.md`, local Supabase `config.toml`, authenticated E2E, axe gate, or visual regression exists.
- Dirty worktree before planning included `.omo/`, `prompt.txt`, and `reply.txt`; execution must preserve unrelated paths.

## Decisions (with rationale)
- Order: baseline → security/data → strict contracts → design foundation → journeys → release hardening.
- TDD is mandatory for behavior changes; characterization tests precede refactors.
- Local Supabase migration replay and RLS tests precede authenticated browser flows.
- Visual primitives and states must pass 375/768/1280 QA before screen redesign.
- Active screen work is parallelized only after shared tokens/primitives stabilize.
- Metrics and visual baselines use pinned environments and cannot be declared from one run.

## Scope IN
- Baseline triage; current errors; security/data integrity; incremental strict typing; routing/state simplification; design system; active product journeys; responsive/a11y polish; local Supabase; authenticated E2E; observability; CI and deployment smoke.

## Scope OUT (Must NOT have)
- No framework/backend replacement, production mutation, database reset, migration-history rewrite, new feature expansion, blanket class codemod, new type suppressions, skipped tests, arbitrary pre-baseline thresholds, secret-bearing evidence, or unrelated file edits.

## Open questions
- None. User approved the announced defaults. Any discovered production-only state remains a blocked verification item rather than a guessed requirement.

## Approval gate
status: approved
approved-by-user: `approved ulw`
approval-authorizes: plan generation and review only; not implementation

## High-accuracy review receipts
- Round 1 Momus: session `ses_085e79810ffez0eKWs5XkF2gjA` — OKAY.
- Round 1 Oracle: session `ses_085e79748ffefZtl112S1T7NGq` — REJECT; blockers were missing base-table migration replay, unsafe remote-env inheritance, incomplete `.omo` manifesting, and underspecified focus idempotency.
- Corrections: added an idempotent earliest baseline migration strategy, loopback-only fail-closed E2E env, recursive pre-existing `.omo` manifest, and localStorage/BroadcastChannel focus continuity with idempotent completion RPC.
- Round 2 Momus: session `ses_085e37dfcffeGCjACqxIzwlLfm` — OKAY.
- Round 2 Oracle: session `ses_085e37e06ffeUPJmInqG7L4qqj` — APPROVE.
- Final verdict: dual unconditional approval; no unresolved review blocker.

## Hosted-Supabase replan — 2026-07-19

### Trigger and state reconciliation
- The user explicitly rejected Docker/local-stack setup for this personal project and accepted using the existing hosted Supabase project. This supersedes the old plan's Docker-only verification path; it does **not** authorize a remote reset, automatic migration push, function deployment, or production deployment.
- The canonical plan's Todo 6 is only partially evidenced; Todos 23-29 are marked complete without corresponding execution evidence; Todo 28 is internally contradictory. The replan will treat Todo 6 as incomplete, Todos 23-29 as not started, and all prior evidence as claims requiring current-command verification.
- The working tree is dirty (64 tracked modifications plus untracked rescue artifacts) on top of `f74b1dc4`. The replan must preserve every pre-existing dirty/untracked path and will neither stage nor commit.

### Revised components (topology ledger)
| id | outcome | status | evidence |
| --- | --- | --- | --- |
| H1 | Reconcile the existing rescue work, evidence, strict exclusions, and toolchain baseline without losing user changes | active | `.omo/plans/researchquest-app-rescue.md`; `.omo/boulder.json`; `git status --short` |
| H2 | Create a hosted-project safety contract and guarded two-user application test harness that never needs Docker or browser-visible elevated credentials | active | `researchquest/vite.config.ts:8-25`; `src/lib/supabase.ts`; Supabase official testing/key documentation |
| H3 | Prove hosted authorization/data integrity, especially the `save_idea_with_links` SECURITY DEFINER RPC, with read-only drift checks and isolated test data cleanup | active | `supabase/migrations/1762635000*`; `1763500000_save_idea_transaction.sql:1-79`; user-owned hooks |
| H4 | Make Edge Function behavior and integration tests safe by unit-testing provider paths and limiting hosted calls to auth/input rejection contracts | active | `supabase/functions/*`; provider calls in `deep-research` and `fetch-paper` |
| H5 | Reduce proven application maintainability/performance risk: realtime ownership, task dual state, unsafe runtime boundaries, duplicate helpers, and oversized modules | active | `useTasks.ts:22-47,117-170`; `RightSidebar.tsx:240-309`; `useSidebarData.ts:135-184`; `utils/errors.ts:1-51` |
| H6 | Make quality gates truthful and lean: side-effect-free scripts, aligned tooling, strict coverage scope, measured benchmarks, hosted E2E, accessibility, visual, CI, and preview smoke checks | active | `package.json:6-21`; `tsconfig.app.json:28-49`; `eslint.config.js:42-43`; `vitest.config.ts:14-35`; `.github/workflows/ci.yml` |
| H7 | Complete only the currently unverified product journeys after the shared data and quality contracts are stable | active | canonical plan Todos 23-29; current dirty component diffs |

### Adopted defaults (the user can veto any of these at approval)
| decision | adopted default | rationale | reversible? |
| --- | --- | --- | --- |
| Hosted test identity | Two permanent, manually created, non-personal test accounts; no account creation/deletion API and no service-role key in browser, source, artifacts, or normal test runtime | Lowest-risk approach for one hosted personal project; keeps cleanup limited to user-owned test records | yes |
| Hosted test isolation | Unique per-run prefix/UUID and an allowlisted cleanup manifest; tests refuse to start unless both configured test-account identities and the approved project host match | Prevents test writes/deletes from reaching personal rows or another project | yes |
| Remote mutation | No automatic `db push`, migration repair, `db reset --linked`, function deployment, secret update, or Dashboard mutation; first collect migration-list/dry-run and policy/RPC evidence | Hosted workflow tests live behavior but must not silently mutate personal infrastructure | yes |
| Schema replay | Defer clean-slate migration replay to a future Supabase branch or dedicated test project; do not claim live hosted tests prove fresh-schema replay | Existing hosted project must not be reset; Docker is intentionally out of scope | yes |
| External/paid functions | Unit-test provider behavior with intercepted fetch; hosted checks cover only safe authentication and invalid-input paths | Avoids spend, rate limits, email, and AI-provider side effects | yes |
| CI | Hosted mutation stays manual/serialized and opt-in until an isolated branch/test environment exists; ordinary PR CI remains non-mutating | A shared personal database is unsafe for parallel PR test data | yes |
| Optimization | Fix only measured regressions or proven duplication; capture baselines before budgets; no framework migration or speculative micro-optimization | Keeps the project lean and preserves established UX | yes |
| Quality strictness | Block on application TypeScript/lint/test/build quality first; extend strict test/E2E compilation only after exclusions are audited or removed | Avoids overstating the existing strict gate while still tightening active product code | yes |

### Evidence-backed replan findings
- Vite merges root and app environment files and accepts legacy aliases (`researchquest/vite.config.ts:8-25`), so hosted test configuration must explicitly reject fallback environment inheritance rather than rely on filename conventions.
- `useTasks` maintains local tasks plus a mirrored Zustand copy (`useTasks.ts:22-47`), while the sidebar subscribes independently to `tasks` (`RightSidebar.tsx:288-302`, `useSidebarData.ts:168-182`); the replan will characterize current behavior before consolidating ownership.
- `save_idea_with_links` is `SECURITY DEFINER` and trusts caller-supplied `p_user_id` for inserts (`1763500000_save_idea_transaction.sql:12,37-56`), making a real User-B-with-User-A-ID denial test a first hosted security gate.
- Tool commands currently embed `pnpm install` side effects (`researchquest/package.json:7-12`); app compilation excludes active source files and disables unused/fallthrough checks (`tsconfig.app.json:28-48`); lint disables `no-explicit-any` and unused-variable reporting (`eslint.config.js:42-43`); coverage excludes neither all benchmarks nor establishes thresholds (`vitest.config.ts:24-35`).
- The current CI validates only a missing-configuration browser path after build (`.github/workflows/ci.yml:35-48`), so hosted authenticated checks must be separately guarded and must not run by default on arbitrary pull requests.

### Approval gate
status: awaiting-approval
approval-authorizes: scaffold and write one new hosted-Supabase rescue plan under `.omo/plans/`, then run Momus and Oracle review; it does not authorize implementation, remote Supabase mutation, secret rotation, commits, or deployment.
