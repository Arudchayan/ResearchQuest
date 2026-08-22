# Task 13: Expand Strict TypeScript Allowlist

## Changes Made

### `tsconfig.strict.json`
- Added `src/vite-env.d.ts` for `import.meta.env` type declarations
- Added `src/types/database.ts` — pure type definitions (passed clean)
- Added `src/lib/supabase.ts` — Supabase client boundary
- Added all 17 `src/utils/*.ts` source files (excluding `.test.ts` files)

### Files Fixed for Strict Mode

**`src/utils/collections.ts`**
- Added null guard `if (!item) continue;` for `noUncheckedIndexedAccess` on array access

**`src/utils/citation.ts`**
- Added `!` non-null assertions on array/string index accesses in `parseAuthor`, `formatAuthorsAPA`, `formatAuthorsMLA`, `formatAuthorsChicago`, `formatAuthorsHarvard`, and `generateBibTeX` where guards already proved safety

**`src/utils/bibtexParser.ts`**
- Added `!` non-null assertions on regex match results and string char accesses where bounds checks already proved validity

**`src/utils/gamification.ts`**
- Added `!` on `.split("T")[0]` result (always defined per `String.split` contract)

**`src/utils/import.ts`**
- Changed `record.metadata` → `record["metadata"]` for `noPropertyAccessFromIndexSignature`
- Changed `meta.appName` → `meta["appName"]` for same reason
- Changed `r.id` → `r["id"]` for same reason

## Verification

- `tsc -p tsconfig.strict.json --noEmit` — **passes** (zero errors)
- `tsc -b --noEmit` — **passes** (zero errors)
- `vitest run` — **81 files, 317 tests passed** (1 skipped, same as before)
