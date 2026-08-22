# Ultrawork Notepad — ResearchQuest full UI/UX redesign
Started: 2026-08-04T00:00:00+05:30

## Plan (exhaustive, atomic)
1. [done] Codebase inventory (explore agent bg_7256427f)
2. [done] Read DESIGN.md (Luxe Scholar, extraction-type) + package.json
3. [in_progress] Visual audit: dev server w/ fake Supabase env + __TEST_USER__ bypass → screenshots of 7 routes + /showcase, light+dark @1280
4. Ask user: design direction fork (evolve Luxe Scholar vs new Layer B direction) + scope confirms
5. Plan agent → wave graph + scenario contract
6. Update DESIGN.md (prescriptive) — tokens, primitives, motion, a11y, accepted debt
7. Execute redesign in waves (visual-engineering category agents)
8. Verify: /visual-qa dual-oracle gate + responsive-layout e2e + vitest + build
9. Reviewer gate (ultrabrain) → unconditional approval

## Scenarios (the contract — draft, finalize with plan agent)
- S1 (happy): All 7 routes render on-token at 375/768/1280, light+dark, no horizontal overflow (playwright screenshots + responsive-layout.spec PASS)
- S2 (edge): Empty states, loading skeletons, error fallbacks render on-token; offline/no-supabase config screen intact (smoke-no-supabase.spec PASS)
- S3 (regression): Existing vitest suite green (DashboardRouting, AppShellA11y, v2/Sidebar, view tests) + `tsc -b` build exit 0
- S4 (primitives): /showcase renders every primitive on-token both themes (Playwright screenshot evidence)

## User decisions (locked)
- Direction: EVOLVE Luxe Scholar (no rebrand, no Layer B)
- Scope: 7 main views ONLY (+ in-view sub-components; OnboardingGuide token-alignment since it renders inside views). EXCLUDED: detail views, markdown editor, shell/dialogs/auth, quest UI
- UX depth: visual + interaction polish; IA and flows unchanged
- Loaded refs: frontend skill router + design/README.md + redesign-skill.md (Layer A). Gates: DESIGN.md-first tokens, Primitive Showcase Gate, /visual-qa at end

## Now
W0-D — build the dedicated redesign Playwright harness against the running :4199 server

## W0-B evidence
- Verified current `DESIGN.md`, `src/index.css`, `tailwind.config.js`, and `index.html` directly after delegation.
- Contract is now prescriptive for the seven views; stage/priority aliases exist in both theme blocks and Tailwind v3 mappings.
- `git diff --check` passed (only existing line-ending warnings). `tailwind.config.js` ESLint had no errors; LSP had no CSS diagnostics (Biome LSP unavailable/previously declined).
- Inherited `pnpm build` TypeScript failures remain unchanged and outside W0-B files.

## W0-C evidence
- Worker initially failed silently with no files; a same-scope retry completed the task.
- RED: targeted Vitest failed on the missing `@/components/ui/Badge` module as intended.
- GREEN: `src/test/components/ui/ViewPrimitives.test.tsx` passed 4/4 tests.
- Verified all five touched files directly; LSP diagnostics clean on all. Scoped ESLint: 0 errors, one existing Showcase max-lines warning. `git diff --check` passed.
- New primitives: `PageHeader`, static-map `Badge`, semantic `EmptyState`; Showcase now includes their states/test IDs.

## Baseline evidence
- `git status --short`: 76 tracked files modified plus untracked `.omo/`, `DESIGN.md`, showcase/test/hook/config assets, and other prior work; preserved unchanged.
- `git diff --check`: no whitespace errors; only LF→CRLF warnings from Git.
- `pnpm test:run`: exceeded the 600s tool timeout. Before termination, known failures were `src/test/components/layout/RightSidebarPerformance.test.tsx` (open-sidebar fetch expectation) and `src/test/components/NotesViewEmptyState.test.tsx` (detailed empty state); many other tests were green in the captured output.
- `pnpm build`: failed before Vite build on existing TypeScript unused-symbol/PromiseLike errors across App.tsx, AddPaperTabs, FocusWorkspace.bench.tsx, CommandPalette, Sidebar, Showcase, hooks, appStore, and gamification.ts.
- Scoped files exist: all seven view entry files, Showcase, and DESIGN.md.

## Visual audit findings (screenshots in %TEMP%/rq-audit/, dev server :4199)
- Sidebar v2 renders on-token both themes; views render generic SaaS (pill buttons, rounded-xl cards, sans headings, native selects, hardcoded red error banners)
- Onboarding tip card renders inside every view (papers/ideas confirmed) — UX pattern to reconsider
- Showcase primitives are on-token (sharp inputs, serif headings) proving the system works — views just don't use it
- Dark mode works in both palettes but views use their own slate/dark scale vs shell's true-black/cream
- Audit quirk: fake user id isn't a uuid → views render InlineError banners (useful: error states visible in shots)

## Todo (remaining, ordered)
- Screenshots → user direction question → plan agent → DESIGN.md → waves → QA

## Findings (non-obvious facts with file:line refs)
- 4 primary views (Notes/Papers/Ideas/Topics) hardcode slate/blue, bypass tokens — DESIGN.md debt table lines 180-186
- v2 migration half-done: chrome in layout/v2/, overlays+RightSidebar still in layout/ root
- Dead: ui/NotFound.tsx (both exports unused); capture-baselines.temp.spec.ts; root vite-*.log files; empty .Jules/
- Topic quests: full backend (useTopics, XP_REWARDS.COMPLETE_TOPIC_QUEST=30) but ZERO UI rendering
- "500 XP per level" hardcoded in 3 places (Sidebar.tsx, ProfileDialog.tsx:70, Dashboard.tsx:86)
- index.html theme-color #0066FF contradicts monochrome palette
- Two icon libs mixed: @radix-ui/react-icons + lucide-react in same files
- CommandPalette.css = raw non-token CSS (122 lines)
- No Supabase creds; __TEST_USER__ bypass at App.tsx:154-156 enables no-backend rendering
- Dev 5173 / preview 4173 / e2e 4174; vitest jsdom; playwright chromium-only

## Learnings
- (fill as work progresses)

---

## W1 COMPLETE — Seven-View Redesign (Aug 5)

**W0-E Showcase gate:** PASS (dual Oracle) after fixing: Showcase blur, dialog serif headings, ErrorFallback support-link target, border-subtle 3:1 contrast, and vite fs allowlist narrowed to [__dirname, ...fontsourceAllowlist] (no repo-root escape). Font RED->GREEN proven; focused UI tests 13/13; Showcase Playwright 1/1.

**W1 view workers:** all seven views redesigned to Luxe Scholar contract (Dashboard, Notes+new NotesSidebar, Papers, Ideas+new ideaStages.ts, Tasks, Focus+FocusTargetAside, Topics). Each ran scoped tests green. Workers recovered after interruption via fresh inspect-and-complete agents; TaskCard syntax error and five primitive-import stragglers fixed.

**Type-mystery solved:** PageHeaderProps omitted only children from ComponentPropsWithoutRef<"header">, so native 	itle?: string intersected with 	itle: ReactNode -> misleading string & ReactPortal TS2322. Fix: Omit<ComponentPropsWithoutRef<"header">, "children" | "title">. Also fixed NotesSidebar Ref typing, IdeasBoard KeyboardEvent param, FocusWorkspace s any -> typed note/paper/task chain, IdeasBoard exhaustive-deps.

**W1 gate (T-0530c03d): PASS with documented baseline exceptions.**
- Typecheck: delta clean; only pre-existing baseline TS errors remain (App.tsx, AddPaperTabs, *.bench, Sidebar, useDataSync/useIdeas/useNotes.bench, appStore, gamification).
- Lint: 0 errors / 16 warnings (style-only) on all changed files.
- Unit: 84 files / 362 tests — 361 pass, 1 baseline fail (RightSidebarPerformance), 1 pre-existing skip (paperWorkflow DOI), 0 W1 regressions (useDataSync test mock gained maybeSingle).
- Build: blocked only by pre-existing baseline errors (unchanged).
- NotesViewEmptyState (documented baseline) now PASSES.

**Baseline debt (unchanged, out of W1 scope):** full pnpm build TS6133/TS2339 errors; RightSidebarPerformance test; full-suite runner is pathologically slow in group mode (use explicit single-file or <=3-parallel invocations; threads pool reliable).

**Next:** W2 cross-view token audit (T-6cd7a0dd) -> W3 visual QA (T-8bbbd236) -> W4 gate (T-b3ddb06d).
