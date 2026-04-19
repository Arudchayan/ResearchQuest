# ResearchQuest Debug Progress

## Issues to Fix
1. Navigation routing failure - All tabs route to "Notes"
2. Note creation modal missing
3. Supabase API 406 error on daily_logs endpoint

## Investigation

### Navigation / App Structure
- `src/App.tsx` is the active app entry now.
- `src/App-Original.tsx` and `src/App-Simple.tsx` are legacy variants still present in the tree.
- The legacy variants are cleanup debt, not the active code path.

### Supabase / Sync
- Current sync path is working through the real `src/App.tsx` entry.
- No current Supabase 406 issue surfaced in the active app path during this sweep.

## Current status
- Active app path looks stable.
- Main remaining debt here is cleanup of legacy app variants and stale docs that still mention the old routing bug.
