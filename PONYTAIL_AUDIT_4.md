# ponytail-audit — ResearchQuest (pass 4, after iter-1 cuts)

Ranked, biggest cut first. Every finding verified by repo-wide grep during this
pass. Nothing applied.

- `delete:` openapi.fixture.yaml — 491-line hand-committed copy of a doc the contract test generates live (`getOpenApiDocument`); CI only runs `test -f` on it. Delete fixture + the 2-line CI step (ci.yml:64-65). Nothing. [-491] [supabase/functions/api/openapi.fixture.yaml]
- `delete:` AddIdeaDialog + its security test — sole importer of the dialog is its own test; IdeasBoard creates ideas inline (IdeasBoard.tsx:91). Nothing. [-142] [researchquest/src/components/ideas/AddIdeaDialog.tsx, researchquest/src/test/components/AddIdeaDialogSecurity.test.tsx]
- `delete:` ui/NotFound.tsx — both exports (`NotFound`, `ItemNotFound`) have zero importers; App renders its own inline 404 (App.tsx:305-330). Nothing. [-94] [researchquest/src/components/ui/NotFound.tsx]
- `delete:` useGamificationDashboard hook — zero importers; Dashboard reads the store directly (Dashboard.tsx:20). Nothing. [-80] [researchquest/src/hooks/useGamificationDashboard.ts]
- `delete:` Skeleton dead variants — EmptyStateSkeleton, EditorSkeleton, NoteCardSkeleton, TaskCardSkeleton, IdeaCardSkeleton all unimported (only PaperCardSkeleton is used; ListSkeleton reads CARD_SKELETON_CONFIG itself). Nothing. [-82] [researchquest/src/components/ui/Skeleton.tsx]
- `delete:` Dead gamification content — GOAL_CRUSHER + `complete_goal` branch (no emitter since goals were deleted), RESEARCH_HERO (never awarded), XP_REWARDS.ADD_PAPER_INSIGHTS/DAILY_TASK_COMPLETION (no call sites), unreachable `add_paper_insights` branch. Update award test keys in same change. Nothing. [-45] [researchquest/src/utils/gamification.ts]
- `yagni:` useEntityCrud knobs with ≤1 caller — zero-caller overrides `delete?:`, `restore?:`, `skipXpToast`; one-caller `afterCreate` (papers), `xpUpdate` (notes), `createVerb:"add"` (papers); identity-sort escape hatch in useIdeas.ts:43. Fold/delete into their single hooks; keep shared default path. [-38] [researchquest/src/hooks/useEntityCrud.ts, researchquest/src/hooks/useIdeas.ts:43]
- `yagni:` Edge-function helper triplication — fetch-paper, deep-research, create-admin-user each re-implement CORS parsing, rate limiting, fetchWithTimeout instead of importing `_shared`. Hoist _shared up one level and import. [-100] [supabase/functions/fetch-paper/index.ts, supabase/functions/deep-research/index.ts, supabase/functions/create-admin-user/index.ts]
- `yagni:` vite-plugin-source-identifier — serve-mode plugin whose only consumer is a build test asserting prod builds *lack* its markers; no app code references `data-matrix`. Cut plugin + config + assertions. Nothing; CI build already covers it. [-15, -1 dep] [researchquest/vite.config.ts:5,33-38, researchquest/src/test/viteProductionBuild.test.ts]
- `delete:` strict-gate canaries prove nothing — pass.ts/fail.fixture.ts referenced only as tsconfig excludes, `typecheck:strict` script invoked by nothing, and fail.fixture.ts is excluded from both tsconfigs so the gate can never bite by construction. Wire typecheck:strict into CI or delete dir + excludes + script line. [-26] [researchquest/src/strict-gate/, researchquest/tsconfig.app.json:46]
- `shrink:` App.tsx lazyView — helper + 10 near-identical lazy declarations (45 lines). Table-driven destructured tuple map keeps Vite chunking intact. [-25] [researchquest/src/App.tsx:28-73]
- `native:` rimraf dep for what scripts already do with rm -rf (Node 22 pinned in CI). `rm -rf node_modules/.vite-temp`. [-1 dep] [researchquest/package.json:8,9,14]
- `delete:` Stale ANALYZE stanza documenting rollup-plugin-visualizer, deleted in pass 1. Drop 3 lines from .env.example. Nothing. [-3] [researchquest/.env.example:33-35]
- `shrink:` pnpm-workspace.yaml allowlists builds for deno/supabase npm packages that aren't dependencies. Drop both entries. [-2] [researchquest/pnpm-workspace.yaml]
- `delete:` CardTitle/CardDescription/CardFooter in ui/card.tsx — zero importers (only Card/Header/Content used). Nothing. [-22] [researchquest/src/components/ui/card.tsx]
- `shrink:` auth.ts twin client factories getAnonBaseClient/getAnonClient differ only by Authorization header. One factory with optional jwt. [-12] [supabase/functions/api/_shared/auth.ts:38-61]
- `delete:` ENTITY_VIEWS export in router.ts — declared, never imported; selectEntityForRoute hardcodes its own switch. Nothing. [-8] [researchquest/src/lib/router.ts:28]
- `delete:` Dead hook-return refresh API — refreshNotes/refreshIdeas/refreshPapers/refreshTasks returned but never consumed by any component (incl. an owner/non-owner branch in useTasks serving only this). Nothing. [-18] [researchquest/src/hooks/useNotes.ts, useIdeas.ts, usePapers.ts, useTasks.ts]
- `delete:` logger.log() method — zero callers; warn has exactly 3 sites (alerts.ts). Keep just error/warn. [-8] [researchquest/src/utils/logger.ts:16-20]
- `stdlib/shrink:` estimateReadingTime duplicated — text.ts export has no production importer; useMarkdownEditor.ts:56-63 re-implements it verbatim inline. Keep one copy, consume it at the editor. [-9] [researchquest/src/utils/text.ts:10-18, researchquest/src/components/editor/hooks/useMarkdownEditor.ts:56-63]
- `delete:` xp-gain keyframe/animation in tailwind.config.js — grep finds no `animate-xp-gain` usage anywhere. Nothing. [-5] [researchquest/tailwind.config.js:204,222-225]

Kept deliberately: demoSupabase/demoData (~1,400 lines) behind VITE_DEMO_MODE is a documented README feature; openapi.ts is a table-driven generator, not a hand-written spec; fonts, tailwindcss-animate, typography plugin, autoprefixer/postcss all verified in use; pnpm.overrides range floors are real transitive-security floors (only the two exact @codemirror pins are redundant).

net: -1180 lines, -2 deps possible.
