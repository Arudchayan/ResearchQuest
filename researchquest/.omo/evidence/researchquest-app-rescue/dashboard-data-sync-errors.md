# Dashboard Data Sync Errors

## Change Summary

Added data-sync error display for each resource section in `Dashboard.tsx` using the existing `InlineError` component and `dataSyncErrors` from the store.

## What Changed

**File:** `src/components/dashboard/Dashboard.tsx`

1. **Import** `InlineError` from `src/components/ui/ErrorFallback.tsx`
2. **Added store selectors:** `dataSyncErrors` and `clearDataSyncError`
3. **Extracted resource errors:** `notesSyncError`, `papersSyncError`, `ideasSyncError`, `tasksSyncError`, `topicsSyncError` from `dataSyncErrors`
4. **Added error display** with retry buttons in each section:
   - Notes error → above Recent Notes list
   - Ideas error → above Active Ideas list
   - Topics error → above Active Topics list
   - Papers error → above Reading List
   - Tasks error → above Tasks Due Soon list

## Pattern Followed

Matches the existing pattern used in `NotesView`, `PapersView`, `IdeasBoard`, `TaskManager`, and `TopicsView`:
- Reads `dataSyncErrors?.<resource> ?? null` from the store
- Shows `InlineError` with `message` when error exists
- Places error near the relevant section (not a full-page overlay)
- Adds `onRetry` that calls `clearDataSyncError(resource)` to dismiss the error and allow fresh data on next view switch

## Testing

- `DashboardRouting.test.tsx` — 1 test passed
- `NotesViewResponsive.test.tsx` — 2 tests passed
- `PapersView.test.tsx` — 3 tests passed
- `IdeasBoardA11y.test.tsx` — 7 tests passed
- Total: 13 tests passed, 0 failures, no regressions
- LSP diagnostics: clean (no errors)
