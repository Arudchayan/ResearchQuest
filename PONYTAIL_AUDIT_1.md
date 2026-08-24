# ponytail-audit — ResearchQuest

Ranked, biggest cut first. Every finding verified by import-graph scan (`grep -rln` across `researchquest/src`, tests excluded where noted). Nothing applied.

- `delete:` Unmounted analysis feature tree — AnalysisView, WorkspaceAuditDialog, AdversarialReviewPanel, adversarialAnalysis.ts, deepResearch.ts + their tests; no component imports any of them and `VALID_VIEWS`/App routes never render "analysis". Nothing replaces it (IdeaDetailView already invokes deep-research inline). [-1902 lines] [researchquest/src/components/analysis/, researchquest/src/utils/adversarialAnalysis.ts, researchquest/src/utils/deepResearch.ts]
- `delete:` Unmounted dashboard extras — SprintBoard, ResearchRadar, sprintStore, dailyMissionsStore + tests; none is mounted by Dashboard/App and nothing imports the stores outside their tests. Nothing. [-1110 lines] [researchquest/src/components/dashboard/SprintBoard.tsx, researchquest/src/components/dashboard/ResearchRadar.tsx, researchquest/src/store/sprintStore.ts, researchquest/src/store/dailyMissionsStore.ts]
- `delete:` Unreachable feeds feature — FeedsView/FeedsRail/FeedItemCard/useFeedItems + test; FeedsRail is mounted by nobody, `/feeds` isn't in VALID_VIEWS so pushState("/feeds") lands on the not-found page. Nothing. [-950 lines] [researchquest/src/components/feeds/, researchquest/src/hooks/useFeedItems.ts]
- `delete:` ApiKeysPanel never imported by any view/dialog (only its own test); the API-gateway edge function stays usable without this orphaned UI. Remove until something mounts it. [-624 lines] [researchquest/src/components/settings/ApiKeysPanel.tsx]
- `delete:` Committed agent-session journals and rescue-evidence artifacts (.omo plans, run-continuation JSONs, evidence txt) — 238 tracked files of scratch state. Git history, not the working tree. [/.omo/, researchquest/.omo/]
- `delete:` One-off Playwright tour scripts with hardcoded `C:\Users\DELL\...\Temp\opencode` paths checked into the repo. Nothing; they're scratch verification. [-356 lines] [researchquest/pm-tour.mjs, researchquest/pm-tour2.mjs]
- `native:` Six unused dependencies: `date-fns` (zero imports), `@types/react-router-dom` (react-router isn't even installed), `happy-dom` (vitest uses jsdom), `rollup-plugin-visualizer` (never imported in vite.config.ts; the documented ANALYZE env var is a no-op), `deno` npm pkg (CI uses setup-deno action), `supabase` CLI (no script or doc references it). Remove from package.json. [-6 deps] [researchquest/package.json]
- `delete:` Regenerated visual-QA snapshot PNGs (81 binaries) committed under e2e/snapshots; the spec only captures when RQ_VISUAL_QA=1, which CI never sets. Regenerate on demand; gitignore the directory. [researchquest/e2e/snapshots/redesign/]
- `yagni:` useEntityCrud is a 20-knob config object where `updateGuard`, `buildOptimisticEntity`, `onCreateNullData`, `onSnapshotMissing` each have exactly one caller (ideas/notes). Fold one-caller options into their single hook; keep the shared default path. [~-60 lines] [researchquest/src/hooks/useEntityCrud.ts]
- `shrink:` Hand-rolled O(N) insertion-sort `getTopN` ("PERFORMANCE OPTIMIZATION") for widget-sized lists. `[...items].filter(fn).sort(cmp).slice(0, limit)`. [~-25 lines] [researchquest/src/utils/collections.ts]
- `shrink:` Ten copy-pasted `lazy(() => import(X).then(m => ({default: m.X})))` blocks in App.tsx. Table-drive them: `{dashboard: Dashboard, ...}` mapped through one helper. [~-40 lines] [researchquest/src/App.tsx:28-86]
- `delete:` tsconfig.strict.json excludes six deleted files (LeftSidebar, SidebarNavTabs, FocusStudioWidget, useSidebarData, NoteList, IdeaList) that no longer exist. Drop the stale lines. [-8 lines] [researchquest/tsconfig.strict.json]
- `yagni:` Second demo-mode env flag `VITE_USE_DEMO` that nothing documents or sets alongside `VITE_DEMO_MODE`. Keep one flag. [-2 lines] [researchquest/src/lib/supabase.ts:8]

Kept deliberately: demoSupabase/demoData (~1500 lines) is a documented README feature; cmdk/radix/virtual/dompurify are all genuinely imported; tailwindcss-animate + typography plugins back classes in use.

net: -5000 lines, -6 deps possible.
