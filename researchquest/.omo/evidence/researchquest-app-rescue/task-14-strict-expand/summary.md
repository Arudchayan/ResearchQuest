# Task 14: Expand Strict TypeScript Allowlist (Hooks, Stores, Mocks)

## Changes Made

### `tsconfig.strict.json`
- Added proper glob-based exclusion for test files (`src/**/*.test.ts`, `src/**/*.test.tsx`, `src/**/*.bench.ts`, `src/**/*.bench.tsx`)
- This ensures hooks, stores, and the mock file are covered by strict checks while pre-existing test file errors are excluded

### Files Fixed for Strict Mode

**`src/hooks/useBibTeXImport.ts`**
- Added `!entry` guard for `noUncheckedIndexedAccess` on array index access in sequential import loop (line 74)

**`src/hooks/usePapers.ts`**
- Replaced `isRecord(value) && typeof value.message === "string"` with `isRecord(value)` guard + temp variable pattern to satisfy `noPropertyAccessFromIndexSignature`
- Changed `error.context` etc. to bracket notation `error["context"]` for same reason
- Replaced `value.message.trim()` with `value["message"]` + temp variable for proper type narrowing

**`src/hooks/useNotes.ts`**
- Replaced `const cleanData: any = {...}` with typed `NoteInsertPayload` type using `Pick` + `Partial<Pick>` pattern

**`src/hooks/useIdeas.ts`**
- Added optional chaining guards (`firstLine?.trim()`, `maybeTitle?.trim()`) for `noUncheckedIndexedAccess` on destructured array elements
- Fixed `description: undefined` violation of `exactOptionalPropertyTypes` by conditionally including `description` via spread

**`src/hooks/useTasks.ts`**
- Replaced `const cleanData: any = {...}` with typed `TaskInsertPayload` type using `Pick` + `Partial<Pick>` pattern
- Fixed `payload.new.id` / `payload.old.id` index signature access by extracting to typed variable with string check

**`src/hooks/useDataSync.ts`**
- Added ownership docstring (notes/papers/ideas/focus_sessions) per task requirement
- Fixed `payload.old.id` index signature access with bracket notation + string type guard
- **One channel per table/user verified:** `notes_realtime_sync_${userId}`, `papers_realtime_sync_${userId}`, `ideas_realtime_sync_${userId}`, `focus_sessions_sync_${userId}` — no duplicates

**`src/hooks/useTopics.ts`**
- Fixed `description` optional property in `mapTopicRow` via conditional spread
- Fixed index signature access in `isTopicRow` (bracket notation)
- Fixed `topic` and `due_date` optional properties in `mapQuestRow`
- Fixed `getDueDate` with `!` non-null assertion on `split("T")[0]`
- Added `targetTopic` null guard in `ensureActiveQuest`
- Fixed `payload.name`/`payload.description`/`payload.user_id` bracket notation in `updateTopic` and `attachTopicToEntity`

**`src/hooks/useRelatedItems.ts`**
- Replaced `let fullItem: any = null` with scoped `const fullItem` inside each type branch, removing `any` entirely

**`src/store/gamificationStore.ts`**
- Fixed `ActiveBoost` payload construction to avoid setting optional fields to `undefined` (violates `exactOptionalPropertyTypes`)

## Ownership Documentation

**`src/hooks/useDataSync.ts`** — sole realtime owner for notes, papers, ideas, focus_sessions
**`src/hooks/useTasks.ts`** — sole realtime owner for tasks (no other hook subscribes to tasks table for data ownership)

Both files have docstring headers documenting their ownership domain per task requirement.

## Channel Verification

| Table | Owner Channel | Sidebar Channel | Purpose |
|-------|---------------|-----------------|---------|
| notes | `notes_realtime_sync_${userId}` | (none) | CRUD sync |
| papers | `papers_realtime_sync_${userId}` | `right_sidebar_papers` | counts refresh |
| ideas | `ideas_realtime_sync_${userId}` | `right_sidebar_ideas` | counts refresh |
| focus_sessions | `focus_sessions_sync_${userId}` | `right_sidebar_daily_logs` | daily XP refresh |
| tasks | `tasks_realtime_${userId}` | `right_sidebar_tasks` | deadline counts refresh |

No duplicate subscriptions per table/user. Sidebar channels only refresh UI stats, not entity data.

## Verification

- `tsc -p tsconfig.strict.json --noEmit` — **passes** (zero errors)
- `vitest run src/test/hooks/ src/test/store/` — **16 files, 59 tests passed**
- `tsc -b --noEmit` — **passes** (zero errors)
