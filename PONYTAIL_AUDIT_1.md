# ponytail-audit — ResearchQuest (round 1)

Whole-tree scan, ranked biggest cut first. Every "unused" claim verified by repo-wide grep against the current working tree (prior audit rounds' fixes already applied are excluded).

- `delete:` openapi.fixture.yaml (491 lines) — never read; CI only does `test -f`, the contract test generates the spec from `_shared/openapi.ts`. Generate at test time, drop the `test -f`. [-491] [supabase/functions/api/openapi.fixture.yaml]
- `delete:` Agent-session journals + eval snapshot tracked in git (.jules/*.md, docs/evaluations/2026-07-21-*). Git history keeps them. [-261] [/.jules/, /docs/evaluations/]
- `delete:` Redesign visual-QA rig — e2e/redesign-visual.spec.ts (122) + playwright.redesign.config.ts (32); gated on RQ_VISUAL_QA which no script/doc/CI ever sets, spec self-skips under the main config. Restore when someone runs it. [-154] [researchquest/e2e/redesign-visual.spec.ts, researchquest/playwright.redesign.config.ts]
- `shrink:` Rate limiter hand-rolled 3 more times — fetch-paper, deep-research, create-admin-user each copy the sliding-window limiter (+secureCompare in create-admin-user) instead of importing api/_shared/rateLimit.ts. Hoist _shared to supabase/functions/_shared and import. [~-100] [supabase/functions/fetch-paper/index.ts:51, deep-research/index.ts:57, create-admin-user/index.ts:12]
- `delete:` ui/NotFound.tsx (94) — both exports have zero importers; App renders its own inline not-found UI. Existing EmptyState covers the rest. [-94] [researchquest/src/components/ui/NotFound.tsx]
- `delete:` useGamificationDashboard hook (80) — zero importers repo-wide; Dashboard reads the store directly. Nothing. [-80] [researchquest/src/hooks/useGamificationDashboard.ts]
- `delete:` gamificationStore mutators activateBoost/consumeFreeze/useRestDay + BoostConfig — zero call sites (UI only displays tokens; awardXP consumes freezes internally). Keep hydrate/countdown. [~-70] [researchquest/src/store/gamificationStore.ts:113]
- `yagni:` usePaperSearchInternal.ts (70) — stateful wrapper with exactly one caller (AddPaperView). Fold into usePapers or the caller. [~-40] [researchquest/src/hooks/usePaperSearchInternal.ts]
- `delete:` dashboardLibrary slice in appStore — interface, empty-state factory, setter/loading/reset, zero consumers outside the store. Remove slice. [~-40] [researchquest/src/store/appStore.ts:32]
- `delete:` Dead gamification content — RESEARCH_HERO, GOAL_CRUSHER + `complete_goal` branch, `add_paper_insights` + INSIGHT_COLLECTOR branch, XP_REWARDS.ADD_PAPER_INSIGHTS/DAILY_TASK_COMPLETION: no emitter emits those actions. Prune to live actions. [~-35] [researchquest/src/utils/gamification.ts:14,41,53,384]
- `yagni:` vite-plugin-source-identifier — only consumer is the test asserting the plugin's own data-matrix markers. Cut plugin + vite.config block + marker assertions. [~-30, -1 dep] [researchquest/vite.config.ts:5, researchquest/src/test/viteProductionBuild.test.ts:15]
- `shrink:` Four SPA-fallback configs shipped for one deploy target — public/.htaccess (Apache), public/vercel.json (copied into dist; root vercel.json has no rewrites), public/404.html (GH-pages), _redirects (Netlify). Keep the real host's mechanism. [~-28] [researchquest/public/]
- `delete:` strict-gate canaries — fail.fixture.ts is excluded from BOTH tsconfigs (proves nothing even when typecheck:strict runs), pass.ts imported by nothing. Delete dir + 4 exclude lines. [-23] [researchquest/src/strict-gate/]
- `yagni:` Every pnpm script prepends `pnpm install --prefer-offline` + standalone install-deps script nobody calls. Run install once; let scripts be scripts. [~-10] [researchquest/package.json:7-14]
- `shrink:` Duplicate `AppView` union in appStore — redefines lib/router's and adds unreachable `"feeds"`/`"analysis"` after those views were deleted. Import from lib/router. [~-9] [researchquest/src/store/appStore.ts:14]
- `native:` @radix-ui/react-icons alongside lucide-react — 4 files import a handful of icons (HamburgerMenuIcon/Cross1Icon/EyeOpenIcon) all available in lucide. Swap, drop a lib. [-1 dep] [researchquest/src/components/layout/v2/AppShell.tsx, v2/Sidebar.tsx, auth/AuthScreen.tsx, dashboard/Dashboard.tsx]
- `delete:` mockTopic export in shared mocks — zero importers; topic tests define local fixtures. Delete. [-11] [researchquest/src/test/mocks/supabase.ts:112]
- `stdlib:` rimraf dep for `rm -rf` in three scripts. Shell builtin. [-1 dep] [researchquest/package.json:8,9,14]
- `delete:` Stale tsconfig.app.json excludes for 7 already-deleted files (LeftSidebar, SidebarNavTabs, FocusStudioWidget, useSidebarData, NoteList, IdeaList, PaperList). Drop lines. [-7] [researchquest/tsconfig.app.json:39]
- `delete:` demoSessionUser → DEMO_USER_EMAIL → DEMO_USER_PASSWORD dead chain — zero importers (demo accepts any email; test hardcodes literals). Delete all three. [-8] [researchquest/src/lib/demoSupabase.ts:797, researchquest/src/lib/demoData.ts:9]
- `delete:` logger.log() method — zero callers since the feeds removal. Delete. [-8] [researchquest/src/utils/logger.ts:16]
- `delete:` Stray screenshot auth-gate-mobile.png at repo root — referenced by no doc/code/workflow. Nothing. [/auth-gate-mobile.png]
- `delete:` 27 tracked .wt/* gitlink entries (mode 160000, no .gitmodules) — clone as empty dirs. Nothing. [/.wt/]
- `yagni:` xp-gain animation + keyframe in tailwind config — animate-xp-gain unused in src. Delete. [-5] [researchquest/tailwind.config.js:204]
- `delete:` CardTitle/CardDescription/CardFooter exports in ui/card.tsx — zero importers (Card/Header/Content stay). Delete. [-3] [researchquest/src/components/ui/card.tsx:76]
- `yagni:` pnpm-workspace.yaml onlyBuiltDependencies still lists `deno` + `supabase` — neither is in package.json anymore. Drop both. [-2] [researchquest/pnpm-workspace.yaml]

Kept deliberately: demo mode (README-documented), agent API gateway + agentExplore (documented surface with tests), useEntityCrud factory (4 live entity hooks), layout/v2 (live shell, not legacy duplication), cmdk/zustand/radix-primitives/virtual/dompurify/fonts (all imported).

net: -1530 lines, -3 deps possible.
