# Task 16: Converge full app on strict TypeScript checking

## Summary

- Enabled `"strict": true` in **tsconfig.app.json** (canonical TypeScript strict mode)
- Removed all explicit `"strict": false` override flags from app config
- Expanded **tsconfig.strict.json** to cover all of `src/` plus `e2e/` with extra strict flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `noUncheckedSideEffectImports`)
- Excluded proven-dead code and fixtures from both configs

## Dead code excluded

| File | Reason |
|------|--------|
| `src/components/layout/LeftSidebar.tsx` | Only imported by its test; v2/Sidebar is active |
| `src/components/layout/SidebarNavTabs.tsx` | Only imported by LeftSidebar |
| `src/components/layout/FocusStudioWidget.tsx` | Only imported by LeftSidebar |
| `src/components/layout/useSidebarData.ts` | Only imported by LeftSidebar |
| `src/components/entities/NoteList.tsx` | Only imported by LeftSidebar |
| `src/components/entities/IdeaList.tsx` | Only imported by LeftSidebar |
| `src/components/entities/PaperList.tsx` | Only imported by LeftSidebar + test (test excluded from app config) |
| `src/strict-gate/fail.fixture.ts` | Intentionally triggers strict errors (fixture) |
| `src/store/appStore.bench.ts` | Benchmark file (not part of app) |

## Strict-mode fixes applied

### UI primitives
- `ConfirmDialog.tsx`: Fixed useEffect return path (`noImplicitReturns`)
- `FormDialog.tsx`: Fixed useEffect return path (`noImplicitReturns`)
- `ErrorBoundary.tsx`: Changed `process.env.NODE_ENV` → `process.env["NODE_ENV"]` (`noPropertyAccessFromIndexSignature`)

### Editor
- `EditorContent.tsx`: Added type annotation to `onCreateEditor` callback (`noImplicitAny`)
- `LinkDialog.tsx`: Fixed useEffect return path (`noImplicitReturns`)
- `useFormatting.ts`: Added null guards for `match[1]` and `state.selection.ranges[0]` (`noUncheckedIndexedAccess`)

### Auth
- `AuthScreen.tsx`: Changed `import.meta.env.VITE_*` → bracket notation for all env access

### Dashboard
- `Dashboard.tsx`: Converted `for (let i=0...)` loop to `for...of` for array safety

### Ideas
- `IdeasBoard.tsx`: Converted indexed loops to `for...of`; added type annotation to `onKeyDown`
- `IdeasOverview.tsx`: Converted indexed loop; fixed `exactOptionalPropertyTypes` in `onCreate` call
- `AddIdeaDialog.tsx`: Fixed `exactOptionalPropertyTypes` - conditionally spread optional fields

### Layout
- `OnboardingGuide.tsx`: Added null guard for `currentStep` (`noUncheckedIndexedAccess`)
- `CommandPalette.tsx`: Fixed `exactOptionalPropertyTypes` for `description` field

### Notes
- `NotesView.tsx`: Converted indexed loop; added null guard for virtual rows; fixed `exactOptionalPropertyTypes` for `ConfirmDialog` props

### Papers
- `PapersView.tsx`: Converted indexed loop
- `PaperList.tsx`: Fixed `exactOptionalPropertyTypes` - conditionally spread `onDuplicate`
- `AddPaperView.tsx`: Fixed `exactOptionalPropertyTypes` - conditionally spread optional `doi`/`source_url`
- `PaperDetailView.tsx`: Fixed `exactOptionalPropertyTypes` - conditionally spread `abstract`; added type assertion for `nextStatus`

### Focus
- `FocusWorkspace.tsx`: Converted indexed loops to `for...of`
- `EntityGraph.tsx`: Added local variable guards for force simulation nodes

### Settings
- `DataManagementDialog.tsx`: Fixed `exactOptionalPropertyTypes` for topics mapping; changed `topics.length` → `Object.keys(topics).length`

### Tasks
- `TaskManager.tsx`: Added type annotation for `filtered`; converted indexed loops; fixed `exactOptionalPropertyTypes` for `createTask`/`updateTask` calls

### Topics
- `TopicDetailView.tsx`: Fixed `exactOptionalPropertyTypes` for `ConfirmDialog`; removed non-null assertions (`!`)
- `TopicList.tsx`: Same pattern

### Lib
- `router.ts`: Added guard for `viewStr` before `isValidView` call

### Test infrastructure
- Created `src/test/vitest-matchers.d.ts`: Bridges jest-dom matchers for vitest v4 with strict mode (231+ TS errors resolved)

## Verification

| Check | Result |
|-------|--------|
| `tsc -p tsconfig.strict.json --noEmit` | ✅ All source & test files pass |
| `tsc -b --noEmit` | ✅ Clean (only dead code + fixtures excluded) |
| `vitest run` | ✅ 80/81 passed (1 pre-existing failure in MarkdownEditorPrint unrelated) |
| `pnpm run build:prod` | ⚠️ Pre-existing Windows cross-platform env issue (tsc -b step passes) |

## Config state

- `tsconfig.app.json`: `"strict": true`, dead-code exclusions
- `tsconfig.strict.json`: Extends app, adds extra strict flags, includes tests + e2e
- `tsconfig.json`: References both (unchanged)
