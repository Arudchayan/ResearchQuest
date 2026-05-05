# Backup and Restore Drill (RQ-M6-04)

This document describes how to perform a full backup/restore drill for ResearchQuest user data. Run before every production release to verify data portability is intact.

## Overview

ResearchQuest stores user data in Supabase (notes, papers, ideas, tasks, topics, junction tables). The app has a built-in export/import mechanism in **Settings → Data Management** that produces a JSON backup.

The backup covers:
- `notes`
- `papers`
- `ideas`
- `tasks`
- `topics`
- `topicNotes` (note–topic associations)
- `topicPapers` (paper–topic associations)
- `topicIdeas` (idea–topic associations)

The backup does **not** cover: focus sessions (ephemeral), user profile preferences (account-level, not portable), or gamification state.

## Drill Procedure

### Step 1 — Create export baseline

1. Log in as the test user.
2. Navigate to **Settings → Data Management → Export**.
3. Download the JSON backup file.
4. Open the file and record the entity counts:

   | Entity | Count |
   |--------|-------|
   | notes | ___ |
   | papers | ___ |
   | ideas | ___ |
   | tasks | ___ |
   | topics | ___ |
   | topicNotes | ___ |
   | topicPapers | ___ |
   | topicIdeas | ___ |

**Pass criterion:** JSON file downloaded. All eight keys present. Counts recorded.

### Step 2 — Delete all test data

Either:

**Option A — Via Supabase SQL editor:**
```sql
-- Replace '<user_id>' with the test user's UUID from auth.users
DELETE FROM topic_notes WHERE user_id = '<user_id>';
DELETE FROM topic_papers WHERE user_id = '<user_id>';
DELETE FROM topic_ideas WHERE user_id = '<user_id>';
DELETE FROM notes WHERE user_id = '<user_id>';
DELETE FROM papers WHERE user_id = '<user_id>';
DELETE FROM ideas WHERE user_id = '<user_id>';
DELETE FROM tasks WHERE user_id = '<user_id>';
DELETE FROM topics WHERE user_id = '<user_id>';
```

**Option B — Via app:** Use the delete flow for each entity type (no bulk-delete exists today).

Verify in the app: all five entity views show empty states.

**Pass criterion:** All entity views show empty states.

### Step 3 — Import the backup

1. Navigate to **Settings → Data Management → Import**.
2. Select the JSON file exported in Step 1.
3. Confirm the import.
4. Verify the success toast reads: `Imported N items successfully` where N > 0.

**Pass criterion:** Import toast shows `Imported N items successfully`, N > 0. No error toast.

### Step 4 — Verify restore fidelity

Check the counts in the app match those recorded in Step 1:

| Entity | Expected | Actual | Match? |
|--------|----------|--------|--------|
| notes | ___ | ___ | ✓/✗ |
| papers | ___ | ___ | ✓/✗ |
| ideas | ___ | ___ | ✓/✗ |
| tasks | ___ | ___ | ✓/✗ |
| topics | ___ | ___ | ✓/✗ |

**Pass criterion:** All entity counts match exactly (±0). Topic–entity associations (topicNotes etc.) are visible in the Topics view.

## Implementation Notes

### How export works (`src/lib/export.ts`)

`exportData(supabase, userId)` fetches all rows for the user from each table and writes them to a JSON object with a `metadata` section (version, export timestamp, user ID). The file is downloaded via a Blob URL.

### How import works (`src/lib/import.ts`)

`importData(supabase, userId, json)` validates that the JSON contains the expected keys, then calls `upsert({ onConflict: 'id' })` for each entity type. This means:
- Existing rows (by `id`) are updated in place.
- Missing rows are inserted.
- True duplicates are silently skipped (Supabase `ignoreDuplicates` behaviour).

The `imported` count reflects total rows processed (not uniquely inserted). For a clean restore after deletion, `imported` should equal the total entity count from Step 1.

## Known Limitations

- `skipped` count in the import result is always `0` due to Supabase `ignoreDuplicates` not returning a skip count. This is documented — see `src/lib/import.ts`.
- Focus sessions and gamification state are not included in the backup. These are non-critical for a data restore.
- No bulk-delete exists in the app UI — manual deletion via Supabase SQL editor is required for Option A in Step 2.
