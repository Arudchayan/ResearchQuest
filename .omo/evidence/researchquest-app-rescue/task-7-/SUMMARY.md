# Task 7: Fix optimistic mutation rollback dedup in deleteNote

## Problem
In `src/hooks/useNotes.ts` lines 252-255, the `deleteNote` error recovery appended the deleted note to fresh store state without deduplication:
```typescript
setNotes(sortByUpdatedAt([...useAppStore.getState().notes, deletedNote]));
```
If a realtime subscription re-inserted the same note ID during the async gap (between optimistic remove and server response), this created a duplicate in the store.

## Fix
Changed to use existing `dedupeById` from `src/utils/collections.ts` (which keeps the last occurrence of duplicate IDs) — the deletedNote is prepended so that if the store already has the ID (from realtime), the store version wins:
```typescript
setNotes(sortByUpdatedAt(dedupeById([deletedNote, ...useAppStore.getState().notes])));
```

## Verification of other hooks
- **usePapers.ts** (updatePaper revert at ~line 551-562): ✅ SAFE — uses ID-scoped `.map()` replacing only the specific paper entry. No append, no duplication risk.
- **useIdeas.ts** (updateIdea revert at lines 295-301): ✅ SAFE — same ID-scoped `.map()` pattern.
- **useIdeas.ts** (deleteIdea revert at lines 378-380): ❌ Same bug pattern exists (`[deletedIdea, ...storeIdeas]`), but out of scope per task constraints.

## Test added
`src/test/hooks/useNotesSecurity.test.ts` — "Optimistic Delete Revert Dedup" suite:
- Uses deferred promise pattern to control the async gap between optimistic remove and server response
- Simulates realtime re-insertion of the same note ID during the gap
- Verifies: (1) only ONE instance of the note ID exists after recovery, (2) the realtime-updated version takes precedence over the stale snapshot, (3) `deleteNote` returns `false`

## Files changed
1. `src/hooks/useNotes.ts` — added `dedupeById` import + wrapped revert in `dedupeById`
2. `src/test/hooks/useNotesSecurity.test.ts` — added dedup test case

## Test results
All 25 tests pass across `useNotesSecurity.test.ts`, `usePapers.test.ts`, `useIdeasSecurity.test.ts`. No regressions.
