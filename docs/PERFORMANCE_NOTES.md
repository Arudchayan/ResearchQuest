# Performance Notes (RQ-M6-05)

Last measured: 2026-05-05. Run `pnpm build` in `researchquest/` to reproduce.

## Bundle Size Report

Build configuration: `vite.config.ts` with `manualChunks` splitting. `chunkSizeWarningLimit: 1000` (1000 KB). **No chunk exceeds the limit.**

### Chunk breakdown (approximate, post-gzip varies)

| Chunk | Approx. Size | Contents |
|-------|-------------|----------|
| `editor-*.js` | ~727 KB | Rich text editor (TipTap / ProseMirror) |
| `index-*.js` (main) | ~538 KB | App shell, store, routing, hooks |
| `NotesView-*.js` | ~370 KB | Notes detail/list views |
| `PapersView-*.js` | ~200 KB | Papers detail/list views |
| `react-vendor-*.js` | Shared vendor | React, ReactDOM |
| `supabase-*.js` | Shared vendor | Supabase JS client |
| `ui-*.js` | Shared vendor | Radix UI primitives |

### Budget thresholds

| Budget | Limit | Status |
|--------|-------|--------|
| Any single chunk | 1000 KB | ✅ No chunk exceeds limit |
| Main chunk (`index-*.js`) | 500 KB (soft target) | ⚠️ ~538 KB — slightly over soft target |
| Editor chunk | Excluded from main budget | Accepted: editor is lazy-loadable |

### Main chunk note

The main chunk at ~538 KB slightly exceeds the 500 KB soft target from RQ-M4-08. This is within the hard 1000 KB limit and is acceptable for beta. If further splitting is needed, candidates are:

1. Move `RightSidebar` and `CommandPalette` into a deferred chunk.
2. Lazy-load `DataManagementDialog` (heavy, not on critical path).

These optimisations are P2 and are deferred to post-beta.

## Build Status

`pnpm build` exits with code 0. 63 pre-existing TypeScript/ESLint warnings (no errors). Zero new warnings introduced by M3–M6 changes.

## Runtime Performance Guidance

### Lighthouse

- Run Lighthouse on the **authenticated dashboard** in Chrome (incognito mode, throttled 4G).
- Target: Performance score ≥ 70.
- Main expected hit: editor bundle lazy-load time on first note open.
- If score is below 70, document in `docs/LAUNCH_CHECKLIST.md` with severity P2.

### Known Performance Work Done

| Item | Status |
|------|--------|
| `manualChunks` code splitting (react-vendor, supabase, editor, ui) | ✅ Done (RQ-M4-08) |
| Dashboard task stats — removed duplicate O(N) calculation | ✅ Done (PR #377) |
| TopicsView fast-path render (early return on unchanged sortOption) | ✅ Done (PR #383) |
| Performance indexes on `user_id`, `updated_at` in Supabase | ✅ Done (migration 5) |
| Full-text search functions in Postgres | ✅ Done (migration 6) |

### Post-Beta Candidates

- Virtualise long lists (Notes, Papers, Ideas) if user data grows beyond ~500 rows per entity.
- `React.memo` on entity card components if profiling shows re-render cost.
- Service worker / offline caching (currently no PWA manifest).

## Zero Console Errors

On a clean page load (hard reload, authenticated user), the browser console should show zero red errors. Any `[RQ]` prefixed errors are tagged by the app's logger for easy filtering — these indicate a backend/Supabase failure, not a code defect.

Verify with: `pnpm dev` → hard reload → DevTools Console → filter for `error` level. Pass criterion: no red errors.
