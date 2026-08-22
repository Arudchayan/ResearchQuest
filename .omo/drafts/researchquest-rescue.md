# ResearchQuest rescue — planning draft

- intent: unclear
- review_required: true (automatic for unclear intent)
- classification: architecture-scale
- status: awaiting-approval
- pending_action: write `.omo/plans/researchquest-rescue.md`

## Outcome

Recover ResearchQuest into a reliable, coherent, responsive research workspace whose core authenticated journeys work against a reproducible Supabase environment, whose visual language is documented and consistently implemented, and whose release gates prove behavior rather than merely reporting green unit tests.

## Components ledger

1. **Baseline and triage** — capture current lint/type/test/build/runtime state; classify every failure as product defect, stale test, harness defect, or accepted debt; preserve evidence under `.omo/evidence/researchquest-rescue/`.
2. **Security and data integrity** — verify deployed/local RLS, repair note mutation authorization if reproduced, optimistic update/revert races, import conflict/reporting semantics, dashboard sync-error transparency, and Edge Function failure/rate-limit behavior.
3. **Architecture and type safety** — establish single ownership contracts for fetch/mutation/realtime state, incrementally migrate app and tests through a strict tsconfig allowlist, simplify `App.tsx`, characterize custom routing, and preserve the current router unless characterization proves migration is required.
4. **Design system and primitives** — extract the implicit Luxe Scholar system into `researchquest/DESIGN.md`, self-host the intended typefaces, unify CSS-variable/Tailwind/shadcn tokens, build a primitive/state showcase, and validate all states at 375/768/1280 before screens.
5. **Product journeys and polish** — repair and normalize auth/onboarding, shell/navigation, dashboard, notes/editor, papers, ideas, topics, tasks, focus, profile, and import/export; include loading, empty, partial-error, offline/network, destructive, and recovery states.
6. **QA, observability, and release confidence** — initialize local Supabase config/seed/tests, add authenticated E2E, axe, stable visual snapshots, render/performance baselines, production error reporting boundary, CI evidence artifacts, and deployed smoke checks.

## Verified evidence ledger

- `researchquest/tsconfig.app.json:28-37` explicitly disables strict app checking.
- `researchquest/src/App.tsx:90-399` owns auth, custom routing, deep-link hydration, selection, and shell orchestration in one module.
- `researchquest/src/components/dashboard/Dashboard.tsx` reads loading state but not `dataSyncErrors`, so failed loads can appear empty.
- `researchquest/src/utils/import.ts:93-105` reports every attempted row as imported while `ignoreDuplicates: true` may skip conflicts; actual imported/skipped counts are not known.
- `researchquest/src/hooks/useDataSync.ts` is the sole realtime owner for notes/papers/ideas/focus; `useTasks.ts` solely owns tasks. Duplicate subscriptions are rejected as a finding.
- Current migration history replaces the original permissive topics policies with user-scoped RLS in `supabase/migrations/1762635000_topics_enhancements.sql`; deployed state remains unverified.
- `researchquest/src/index.css` + `tailwind.config.js` define the strongest existing Luxe Scholar foundation, while active primitives/views also use disconnected hardcoded OKLCH/slate/blue styles.
- No `DESIGN.md` exists; declared Inter/JetBrains Mono/Playfair families are not loaded from local assets.
- `researchquest/playwright.config.ts` and `e2e/smoke-no-supabase.spec.ts` exercise only Desktop Chromium and the missing-config screen, not the authenticated product.
- Existing `.playwright-mcp` artifacts are unrelated ChatGPT captures and are not valid ResearchQuest visual evidence.
- Existing test/benchmark claims are untrusted until run; some tests contain stale “should fail” comments, skipped integration coverage, or non-gating assertions.
- Dirty-worktree risk: `.omo/`, `prompt.txt`, and `reply.txt` were untracked before planning; execution must not overwrite or stage unrelated paths.

## Adopted defaults (user may veto)

| Decision | Default | Rationale | Reversible |
|---|---|---|---|
| Recovery order | Correctness → architecture → design system → journeys → hardening | Prevents polishing unstable behavior | Yes |
| Product scope | Preserve all working core research features; no new goals/projects feature work | Recovery, not feature expansion | Yes |
| Stack | Keep React 18, Vite 6, Tailwind 3, Zustand, Supabase | Rewrite risk exceeds benefit | Yes |
| Routing | Characterize and simplify current routing; do not migrate to React Router during rescue unless tests expose an unfixable contract gap | Avoids unnecessary cross-cutting churn | Yes |
| Visual direction | Preserve and refine “Luxe Scholar”: warm editorial surfaces, sharp geometry, serif display + sans UI, restrained semantic color | Strongest coherent system already present | Yes |
| Fonts | Self-host the selected font files/packages; do not add Google Fonts network calls | Existing CSP/privacy/performance compatibility | Yes |
| Design infrastructure | Create `researchquest/DESIGN.md` and primitive showcase before screen redesign | Eliminates repeated ad-hoc styling | Yes |
| Accessibility | WCAG 2.2 AA mandatory; 24×24 CSS px minimum target, 44×44 preferred for primary touch controls | Standards-correct and usable | Yes |
| TypeScript | Add strict allowlist config and expand module-by-module; no flag-day `strict: true` | Keeps main green while increasing proof | Yes |
| Testing | TDD for every repaired behavior; no production fix without a reproducing test | Prevents regression and stale assumptions | Yes |
| Supabase | Local project/migration replay is prerequisite for authenticated E2E and RLS assertions | Mocks cannot prove database policy behavior | Yes |
| Metrics | Capture three clean baselines before setting coverage, bundle, Lighthouse, visual, or render budgets | Avoids arbitrary thresholds | Yes |
| Visual snapshots | Run in pinned Playwright container/OS; component/state snapshots first, selected full-route snapshots second | Limits rendering flake | Yes |
| Focus timer | Persist active sessions across navigation/reload as a polish requirement, but after data-safety work | High-value continuity, not P0 correctness | Yes |
| Dead UI | Remove proven-dead `LeftSidebar` graph only after reference verification; never redesign it | Reduces noise and avoids wasted polish | Yes |

## Must not have

- No framework rewrite, backend replacement, database reset, migration-history rewrite, or production deployment mutation during implementation.
- No blanket visual class replacement without rendered-state review.
- No `any`, `@ts-ignore`, non-null assertions, or skipped tests introduced to make gates green.
- No hardcoded quality thresholds before baseline evidence.
- No success claim based on grep, file existence, unit mocks, or a single screenshot.
- No edits to unrelated untracked user files.
- No secrets committed to fixtures, screenshots, traces, reports, or CI logs.

## Proposed execution topology

- **Wave 0 (sequential):** reproducible baseline, local Supabase bootstrap, current failure classification, evidence ledger.
- **Wave 1 (parallel where files do not overlap):** authorization/data-integrity regression tests and fixes; import semantics; dashboard/error recovery; Supabase migration/RLS/Edge Function tests.
- **Wave 2 (parallel module allowlist):** strict typing by utils/types → data adapters/hooks → stores → components/tests; routing and state-ownership characterization.
- **Wave 3 (sequential foundation):** DESIGN.md, self-hosted fonts, token bridge, primitives/state showcase, shell responsive/a11y contract.
- **Wave 4 (parallel by non-overlapping journey):** auth/dashboard; notes/editor; papers; ideas/topics; tasks/focus; profile/import-export. Each journey carries its tests and browser evidence.
- **Wave 5 (parallel verification lanes):** authenticated E2E, axe, visual snapshots, render/performance baselines, observability, CI/release smoke.
- **Final wave:** plan compliance, code quality/security, real-browser task walkthroughs, scope fidelity; all must approve.

## Approval gate

Approval authorizes generating the decision-complete plan artifact only. It does not authorize implementation. After approval: scaffold the plan, run Metis gap analysis, fill todos, then run both Momus and independent Oracle reviews until both unconditionally approve.
