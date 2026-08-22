# Fix: Import skip counter bug + truthful conflict reporting

## Bug
`const skipped = 0` on line 93 of `src/utils/import.ts` could never be incremented. The `upsertOnId` function always counted `rows.length` as imported, ignoring the `ignoreDuplicates: true` behavior.

## Changes

### `src/utils/import.ts`
1. **Line 93**: `const skipped = 0` → `let skipped = 0`
2. **`upsertOnId`**: Added a count query before upsert (`SELECT count(*) WHERE id IN (...)`) to determine how many rows already exist. The actual imported count = `rows.length - existingCount`; skipped count = `existingCount`. Returns `{imported, skipped}` per table.
3. **Toast message**: Shows `(N skipped)` suffix when skipped > 0.
4. **Backward-compatible**: `ImportDataResult` type already had `skipped: number` in success case; `upsertOnId` return value is unused by callers (only closure variables matter for the public API).

### `src/test/mocks/supabase.ts`
- Changed `__count: null` to `__count: 0` so count queries return 0 by default (existing rows scenario).

### `src/test/utils/import.test.ts`
- Updated "should import data correctly" and "should handle supabase error" tests to use a proper mock builder (supporting `.select()`, `.in()`, `.upsert()`, `.then()`).
- Added **"should report skipped rows when duplicates exist"** test: sets `__count: 1` → all 5 rows are existing → `imported: 0, skipped: 5`.

## Verification
- All 6 tests pass (5 original + 1 new)
- LSP diagnostics clean on all changed files
