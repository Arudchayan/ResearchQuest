# Stale Comments Cleaned — useNotesSecurity.test.ts

## Summary
Updated two stale `// This should fail currently` comments in `src/test/hooks/useNotesSecurity.test.ts` to reflect that production code now includes the `user_id` filter.

## Changes
| Line | Before | After |
|------|--------|-------|
| 91 | `expect(hasUserIdCheck).toBe(true); // This should fail currently` | `expect(hasUserIdCheck).toBe(true); // Confirmed: user_id filter is included in deleteNote` |
| 129 | `expect(hasUserIdCheck).toBe(true); // This should fail currently` | `expect(hasUserIdCheck).toBe(true); // Confirmed: user_id filter is included in updateNote` |

## Verification
- Production `src/hooks/useNotes.ts` line 179: `.eq("user_id", userId)` in `updateNote` ✓
- Production `src/hooks/useNotes.ts` line 244: `.eq("user_id", userId)` in `deleteNote` ✓
- `pnpm exec vitest run src/test/hooks/useNotesSecurity.test.ts` — **7/7 tests passed** ✓
- No production code or test assertions were modified.
