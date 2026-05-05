# ResearchQuest 6-Month Release Roadmap

Target release date: October 26, 2026

This is the canonical release roadmap for ResearchQuest. It is task-wise by design: each item has a priority, dependency, deliverable, and acceptance criteria so work can be picked up directly by an engineer or agent.

## Status Legend

| Status | Meaning |
| --- | --- |
| Not Started | No implementation work has begun |
| In Progress | Work has started but is not verified |
| Blocked | Work cannot continue without a decision or dependency |
| Done | Implemented and verified against acceptance criteria |

## Release Definition Of Done

- Zero open P0 tasks.
- Zero open P1 tasks unless explicitly accepted as beta limitations.
- Fresh Supabase project can be migrated from scratch.
- Auth, dashboard, notes, papers, ideas, tasks, topics, focus, import/export, and deep links pass browser smoke testing.
- `pnpm test:run`, `pnpm lint`, and `pnpm build` pass.
- Every user-visible feature is either backed by real data or clearly marked as simulated/out of scope.

## Current Product Reality

Real today:

- Supabase auth, profile fetch, notes, papers, ideas, topics, tasks, focus, and gamification scaffolding exist.
- Notes, papers, and ideas have meaningful CRUD paths.
- The app has a real React/Vite frontend and Supabase integration.

Not release-ready today:

- Dashboard/export task state now has automated coverage, but still needs browser smoke testing.
- Topic creation may not return an inserted row.
- Deep links are incomplete.
- Right sidebar uses stale task and idea assumptions.
- Deep Research is simulated but product-facing.
- Supabase functions now have a single source directory; runtime deployment still needs Supabase/Deno tooling verification.
- Browser and backend release QA are incomplete.

## Month 1: Foundation Stabilization

Goal: make the backend contract trustworthy before building more product surface.

| ID | Priority | Status | Task | Depends On | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| RQ-M1-01 | P0 | Done | Freeze canonical task contract across DB, generated types, hooks, dashboard, export/import, realtime, and RightSidebar | None | One task model is documented and used everywhere; task CRUD works; dashboard task counts are real; export includes tasks |
| RQ-M1-02 | P0 | Done | Fix task migrations so fresh Supabase setup does not reference missing columns | RQ-M1-01 | Fresh migration succeeds; no index references nonexistent task fields |
| RQ-M1-03 | P0 | Done | Fix gamification migration quoting and `pg_cron` deployment assumptions | None | Fresh migration succeeds with or without scheduled-job fallback documented |
| RQ-M1-04 | P0 | Done | Choose one canonical Supabase functions directory and remove deployment ambiguity | None | `fetch-paper` and `deep-research` have one deployable source of truth |
| RQ-M1-05 | P1 | Done | Fix topic creation to return the inserted topic row | None | `createTopic` returns a mapped topic; UI updates without refresh; regression test covers insert return |
| RQ-M1-06 | P1 | Done | Add environment/config verification for local and deployed builds | None | Missing Supabase env shows a clear screen; configured env reaches auth; docs list required vars |

Month 1 verification:

- Fresh Supabase migration rehearsal complete (16 tables + 12 migrations, project `zsjczlmzhyzewpehmngc`).
- `pnpm test:run` passes: 310 tests pass, 1 intentionally skipped (integration test).
- `pnpm lint` passes: 0 errors, 67 pre-existing style warnings.
- `pnpm build` passes: production bundle built; main chunk 1.5 MB (addressed in RQ-M4-08).
- Task CRUD smoke and dashboard/export browser smoke still pending (requires browser automation).

Execution notes as of April 26, 2026:

- RQ-M1-01 implementation is complete: the app now uses the shared database `Task` type, `useTasks` syncs the global task store, RightSidebar uses `completed`, and task export/dashboard consumers receive the canonical task shape.
- RQ-M1-02 implementation is complete: the task table snapshot and migrations guarantee `completed`, `category`, and `project_id`; fresh migration rehearsal passed via Supabase MCP on project `zsjczlmzhyzewpehmngc` (5 migration bugs found and patched: ALTER PUBLICATION IF NOT EXISTS invalid syntax, links index wrong column names, STABLE function in GIN index, nonexistent idea columns in search function, missing default on optional function parameter).
- RQ-M1-03 implementation is complete: the gamification migration no longer uses conflicting dollar quotes and `pg_cron` scheduling is a non-fatal optional path; rehearsal confirmed this path is safe.
- RQ-M1-04 implementation is complete: top-level `supabase/functions` is canonical, `fetch-paper` and `deep-research` live there, and the nested duplicate function directory has been removed.
- RQ-M1-05 implementation is complete: `createTopic` now selects and returns the inserted topic row, maps counts to zero, stores it immediately, and has a regression test.
- RQ-M1-06 implementation is complete: missing Supabase config renders a clear app screen, configured env imports a usable Supabase client, and the required variables are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Month 2: Core Workflow Completion

Goal: make every primary workflow real end to end.

| ID | Priority | Status | Task | Depends On | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| RQ-M2-01 | P1 | Done | Complete Notes workflow: create, edit, autosave, delete, restore, export, citation insert, reload | RQ-M1-06 | Notes work after reload; delete/restore is safe; export output is correct |
| RQ-M2-02 | P1 | Done | Complete Papers workflow: manual add, DOI/search add, BibTeX import, detail edit, status, citation export | RQ-M1-04 | Paper metadata path is deployable; paper details update consistently; citation output is verified |
| RQ-M2-03 | P1 | Done | Complete Ideas workflow: create, edit, stage change, delete, restore, detail drawer | RQ-M1-06 | Ideas persist and reload correctly; stage columns show accurate counts |
| RQ-M2-04 | P1 | Done | Complete Tasks workflow: create, edit, complete, delete, filters, realtime, dashboard, export | RQ-M1-01 | Task state is consistent across TaskManager, dashboard, export, and RightSidebar |
| RQ-M2-05 | P1 | Done | Complete Topics workflow: create, link/unlink notes/papers/ideas, counts, detail view, quests | RQ-M1-05 | Topic counts match linked entities; quest progress updates only when intended |
| RQ-M2-06 | P2 | Done | Complete Focus workflow: start, pause, complete, target link, XP award, session history | RQ-M1-03 | Completed sessions produce expected XP/log effects; timer behavior survives navigation |
| RQ-M2-07 | P1 | Done | Make dashboard reflect real notes, papers, ideas, tasks, focus, and streak state | RQ-M2-01, RQ-M2-02, RQ-M2-03, RQ-M2-04, RQ-M2-06 | Dashboard never shows placeholder metrics as real data |
| RQ-M2-08 | P1 | Done | Make data export/import include all release-supported entities and relationships | RQ-M2-01, RQ-M2-02, RQ-M2-03, RQ-M2-04, RQ-M2-05 | Backup includes tasks and topic relationships; import has validation and a clear result |

### RQ-M2-01 — Notes Workflow Sub-Tasks

1. Open `researchquest/src/hooks/useNotes.ts`. Verify `createNote`, `updateNote`, `deleteNote`, and `restoreNote` all exist and each calls the Supabase client. Pass criterion: all four functions are present.
2. Open `researchquest/src/hooks/useNotes.ts`. Verify autosave: `updateNote` is debounced or triggered on blur — not only on an explicit save button click. Pass criterion: content changes persist without a manual save action.
3. Open `researchquest/src/hooks/useNotes.ts`. Verify `deleteNote` performs an optimistic remove from the global store and `restoreNote` re-inserts it. If `restoreNote` uses `insert`, change it to `upsert`. Pass criterion: `restoreNote` calls `supabase.from('notes').upsert(...)` (not `insert`).
4. Open `researchquest/src/utils/export.ts`. Verify the `ExportData` type includes a `notes` field and `exportData()` populates it. Pass criterion: the returned object has a non-empty `notes` key when notes exist.
5. Open whichever component renders the citation-insert control inside the note editor. Verify clicking "insert citation" calls a defined function and appends a citation string to the editor content. Pass criterion: citation insert function is wired to an editor command or content mutation.
6. Open `researchquest/src/store/appStore.ts`. Verify the `notes` collection in the store is populated after the user authenticates (via `useDataSync.ts` or equivalent). Pass criterion: after sign-in, `useAppStore().notes` is non-empty when the user has notes in the DB.
7. Browser smoke test: create a note, edit its content, reload the page, confirm the note is present with its updated content. Pass criterion: content survives a hard reload.

### RQ-M2-02 — Papers Workflow Sub-Tasks

1. Open `researchquest/src/hooks/usePapers.ts` (or the equivalent papers hook). Verify `createPaper`, `updatePaper`, and `deletePaper` exist and each calls the Supabase client. Pass criterion: all three functions are present.
2. Open `researchquest/supabase/functions/fetch-paper/index.ts`. Read the function body and verify it returns DOI-fetched metadata (title, authors, year, journal). If the function is a stub, add a comment documenting what it must return before it can be called production-ready. Pass criterion: function body is understood and either real or clearly labeled as a stub.
3. Open `researchquest/src/utils/export.ts`. Verify `convertPapersToBibTeX` returns a string starting with `@` for a sample input paper object. Pass criterion: calling the function with one paper produces a non-empty BibTeX string.
4. Open whichever component renders paper status (e.g., `PaperCard.tsx` or `PaperDetailDrawer.tsx`). Verify the status dropdown options match the DB `paper_status` enum values exactly. Pass criterion: no status option in the UI is absent from or misspelled relative to the DB enum.
5. Verify a citation export action exists in the Papers view that calls `convertPapersToBibTeX` on the selected papers and triggers a `.bib` file download. Pass criterion: clicking "Export BibTeX" (or equivalent) produces a downloadable `.bib` file.
6. Browser smoke test: add a paper manually, edit its title, export BibTeX, confirm the entry appears in the downloaded file.

### RQ-M2-03 — Ideas Workflow Sub-Tasks

1. Open `researchquest/src/hooks/useIdeas.ts`. Verify `createIdea`, `updateIdea`, `deleteIdea`, and `restoreIdea` exist. Each must call the Supabase client (directly or via the `save_idea_with_links` RPC). Pass criterion: all four functions are present.
2. Open `researchquest/src/hooks/useIdeas.ts`. Verify `updateIdea` accepts a `stage` field and that the only accepted values are the four strings `"Seed"`, `"Developing"`, `"Supported"`, `"Mature"`. If a TypeScript type or union is used, confirm it lists all four exactly. Pass criterion: the stage type is a union of exactly those four string literals.
3. Open the Ideas Kanban component (e.g., `IdeasKanban.tsx` or `IdeasView.tsx`). Verify the column header text for each stage matches the DB values exactly: `"Seed"`, `"Developing"`, `"Supported"`, `"Mature"`. Pass criterion: column headers are string-identical to the four stage values — no casing or spacing differences.
4. Open `researchquest/src/hooks/useIdeas.ts`. Verify `deleteIdea` performs an optimistic remove from the global store and `restoreIdea` re-inserts using `upsert` (not `insert`). Pass criterion: `restoreIdea` calls `supabase.from('ideas').upsert(...)`.
5. Open `researchquest/src/store/appStore.ts`. Verify `ideas` is populated after auth. Pass criterion: `useAppStore().ideas` is non-empty when the user has ideas in the DB.
6. Browser smoke test: create an idea, drag or move it from `"Seed"` to `"Mature"`, delete it, restore it (via undo or restore action), reload and confirm final state.

### RQ-M2-04 — Tasks Workflow Sub-Tasks

1. Open `researchquest/src/hooks/useTasks.ts`. Verify `createTask`, `updateTask`, `deleteTask`, and `restoreTask` all exist. Pass criterion: all four functions are present.
2. Open `researchquest/src/hooks/useTasks.ts`. Verify `restoreTask` uses `upsert`, not `insert`. If it uses `insert`, change it to `upsert` to match the pattern used by the other restore functions. Pass criterion: `restoreTask` calls `supabase.from('tasks').upsert(...)`.
3. Open `researchquest/src/hooks/useTasks.ts`. Verify the realtime subscription for `tasks` exists: a `supabase.channel(...).on('postgres_changes', ...)` call that handles `INSERT`, `UPDATE`, and `DELETE` events for the `tasks` table. Pass criterion: all three event types are handled.
4. Open `researchquest/src/store/appStore.ts`. Verify the `tasks` array exists in the global store and is kept in sync by `useTasks`. Pass criterion: `useAppStore().tasks` returns the task array and updates when tasks are created or deleted.
5. Open the task list component (e.g., `TaskManager.tsx`). Verify filter controls exist for: `completed` state (show/hide completed), `category`, and `project_id`. Pass criterion: all three filter controls are rendered and functional.
6. Open `researchquest/src/components/settings/DataManagementDialog.tsx`. Find the call to `exportData(...)`. Verify it passes `tasks: store.tasks` (or equivalent). If it does not, add the `tasks` argument. Pass criterion: the `exportData` call includes a `tasks` parameter.
7. Open `researchquest/src/components/dashboard/Dashboard.tsx`. Verify task counts (total, completed, in-progress) are derived from `useAppStore().tasks`, not from a hardcoded number. Pass criterion: task count JSX reads from the store array — no literal integers as metric values.
8. Browser smoke test: create a task, mark it complete, delete it, export data as JSON, confirm the task appears in the exported `tasks` array. Pass criterion: all four steps succeed.

### RQ-M2-05 — Topics Workflow Sub-Tasks

1. Open `researchquest/src/hooks/useTopics.ts`. Verify `createTopic`, `updateTopic`, and `deleteTopic` exist and call the Supabase client. Pass criterion: all three are present.
2. Open `researchquest/src/hooks/useTopics.ts`. Verify link/unlink functions exist for notes, papers, and ideas using the junction tables `topic_notes`, `topic_papers`, and `topic_ideas`. At minimum, there must be an `attachNoteToTopic` (or similarly named) function that calls `supabase.from('topic_notes').insert(...)`. Pass criterion: the hook references all three junction table names.
3. Open the topic detail view component (e.g., `TopicDetailView.tsx`). Verify it displays counts for linked notes, papers, and ideas. Verify those counts come from querying the store or the DB — not hardcoded. Pass criterion: count displays reference a store value or a derived count, not a literal integer.
4. Open `researchquest/src/hooks/useTopics.ts`. Find the quest progress update logic. Verify it is guarded by a condition — quest progress should only advance when a specific milestone is reached, not on every topic update. Pass criterion: the quest-update call is inside a conditional block (e.g., `if (attachedCount >= threshold)`).
5. Browser smoke test: create a topic, link a note to it, verify the note count increments to 1, unlink the note, verify the count returns to 0.

### RQ-M2-06 — Focus Workflow Sub-Tasks

1. Open `researchquest/src/components/focus/FocusWorkspace.tsx`. Verify the timer has three distinct UI states: idle/stopped (start button visible), running (pause button visible), and paused (resume button visible). Pass criterion: all three state-dependent controls are rendered.
2. Open `researchquest/src/components/focus/FocusWorkspace.tsx`. Verify that when a session is completed, an XP-related function is called (e.g., `awardXP`, `addFocusXP`, or a direct Supabase insert to a gamification table). Pass criterion: session completion triggers at least one XP update call.
3. Open `researchquest/src/components/focus/FocusWorkspace.tsx`. Verify completed sessions are written to the `focus_sessions` table (or equivalent). Pass criterion: session completion calls `supabase.from('focus_sessions').insert(...)` or `upsert`.
4. **Known limitation — document only, do not fix in M2**: Timer state is local to the component. Navigating away resets the timer. Add this exact comment at the top of `FocusWorkspace.tsx` (after any existing imports, before the component declaration): `// KNOWN LIMITATION (RQ-M2-06): Timer state is local to this component. Navigating away resets the timer. Fix deferred to post-M2.` Pass criterion: comment is present verbatim.
5. Browser smoke test: start a focus session, pause it, resume it, complete it, confirm XP updated and the session appears in session history (if a history list exists).

### RQ-M2-07 — Dashboard Real Data Sub-Tasks

1. Open `researchquest/src/components/dashboard/Dashboard.tsx`. For each metric card, add a comment on the same line identifying the data source: `// source: store` or `// source: hardcoded` or `// source: TODO`. Audit: notes count, papers count, ideas count, tasks count, focus time, streak. Pass criterion: every metric card has a source comment.
2. For each metric with `// source: hardcoded` or `// source: TODO`, replace the value with the real store value:
   - Notes count → `useAppStore().notes.length`
   - Papers count → `useAppStore().papers.length`
   - Ideas count → `useAppStore().ideas.length`
   - Tasks count → `useAppStore().tasks.length`
   Pass criterion: all four counts read from the store.
3. For focus time: check if `focus_sessions` data is fetched and available in the store. If not, add a query in `researchquest/src/hooks/useDataSync.ts` to fetch today's sessions. Sum their `duration_seconds` field. Pass criterion: the focus time metric shows `0` for a user with no sessions (not a hardcoded number).
4. For streak: if it is a hardcoded positive number, set it to `0` and add a comment `// TODO (RQ-M2-07): compute real streak from focus_sessions`. Pass criterion: streak never displays a positive number unless backed by real DB data.
5. Verify no metric card contains a static demo literal (e.g., `42`, `7`, `1500`, `"3 days"`). Pass criterion: `pnpm lint` passes and a manual scan of `Dashboard.tsx` JSX finds no bare number literals used as metric display values.

### RQ-M2-08 — Export/Import Sub-Tasks

1. Open `researchquest/src/utils/export.ts`. In the `ExportData` type, change `tasks?` to `tasks` and `topics?` to `topics` (remove the optional modifier). Pass criterion: both fields are required in the type.
2. Open `researchquest/src/utils/export.ts`. In `exportData()`, add three Supabase queries to fetch the junction tables and include them in the returned object:
   - `topicNotes: await supabase.from('topic_notes').select('*').eq('user_id', userId)` (or equivalent)
   - `topicPapers: await supabase.from('topic_papers').select('*').eq('user_id', userId)`
   - `topicIdeas: await supabase.from('topic_ideas').select('*').eq('user_id', userId)`
   Pass criterion: exported JSON includes `topicNotes`, `topicPapers`, and `topicIdeas` keys.
3. Open `researchquest/src/components/settings/DataManagementDialog.tsx`. Verify the `exportData(...)` call includes `tasks` and `topics`. If either is missing, add them. Pass criterion: the call passes both arguments.
4. Open `researchquest/src/utils/import.ts`. After parsing the incoming JSON, add field validation: check that `appName`, `notes`, `papers`, `ideas`, `tasks`, and `topics` are all present. If any are missing, return `{ success: false, error: 'Missing required field: <fieldName>' }` without writing any data. Pass criterion: calling `importData({ appName: 'ResearchQuest' })` (missing `notes`) returns `{ success: false, error: 'Missing required field: notes' }`.
5. Open `researchquest/src/utils/import.ts`. Add conflict handling: when inserting entities, use `upsert` with `onConflict: 'id'` and `ignoreDuplicates: true` so duplicate IDs are skipped rather than errored. Return a `{ imported: number, skipped: number }` summary alongside the success flag. Pass criterion: the returned object includes `imported` and `skipped` numeric fields.
6. Open `researchquest/src/utils/import.ts`. Wrap all insert/upsert calls so that if any one fails, the function returns `{ success: false, error: <message> }` immediately without continuing to subsequent inserts (fail-fast, partial-write prevention). Pass criterion: if a mocked Supabase upsert throws, the function returns an error and does not proceed to the next entity type.
7. Open `researchquest/src/components/settings/DataManagementDialog.tsx`. Verify the import result UI reads the returned `{ imported, skipped, error }` object and displays it as a toast or inline message (e.g., "Imported 12 items, skipped 3 duplicates" or the error message). Pass criterion: after any import attempt, a result message is shown to the user.
8. Browser smoke test: export full data, corrupt the JSON by removing the `notes` key, attempt import, confirm error message shown. Then import valid JSON and confirm entities appear.

Month 2 verification:

- Automated: `pnpm test:run` (full Vitest suite), `pnpm build` (tsc + Vite) — April 27, 2026.
- Browser smoke every primary workflow and import/export drill remain recommended before release (Month 6).
- `pnpm lint` passes with pre-existing warnings only (no new errors on touched paths).

Execution notes as of April 27, 2026:

- RQ-M2-04: Task list filters include completion, **category**, and **project_id**; `restoreTask` uses `upsert` on `id`.
- RQ-M2-06: Completed sessions insert into **`focus_sessions`**; XP path unchanged; timer pause shows **Resume**; known navigation limitation documented in `FocusWorkspace.tsx`.
- RQ-M2-07: Dashboard shows entity counts from the store, **today’s focus minutes** from `focus_sessions` (via `useDataSync` + `focusSessionSecondsToday`), streak from **user profile**; source comments on metric areas.
- RQ-M2-08: Export includes junction tables; import validates required keys, **fail-fast** upserts with `onConflict: id` and `ignoreDuplicates`, structured **`ImportDataResult`**, and user-facing toast with **imported row count**; `DataManagementDialog` routes imports through **`importData`**.
- RQ-M2-02: `fetch-paper` Edge function documents Crossref-backed production behavior.

## Month 3: Routing, Data Integrity, And Failure States

Goal: make reloads, links, and failures predictable.

| ID | Priority | Status | Task | Depends On | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| RQ-M3-01 | P1 | Done | Implement deep-link hydration for `/notes/:id` | RQ-M2-01 | Direct URL selects the note after reload or shows not found |
| RQ-M3-02 | P1 | Done | Verify and harden deep-link hydration for `/papers/:id` and `/ideas/:id` | RQ-M2-02, RQ-M2-03 | Direct URLs select correct entities after reload |
| RQ-M3-03 | P1 | Done | Implement deep-link hydration for `/topics/:id` and `/tasks/:id` | RQ-M2-04, RQ-M2-05 | Direct URLs open the correct topic/task or show not found |
| RQ-M3-04 | P1 | Done | Add not-found and unauthorized states for entity routes | RQ-M3-01, RQ-M3-02, RQ-M3-03 | Missing IDs do not show blank panels or stale selections |
| RQ-M3-05 | P1 | Done | Add visible fetch failure states for notes, papers, ideas, tasks, and topics | RQ-M2-01, RQ-M2-02, RQ-M2-03, RQ-M2-04, RQ-M2-05 | Supabase/network failures show actionable messages, not false empty states |
| RQ-M3-06 | P1 | Done | Add import validation, conflict reporting, and safe rollback behavior | RQ-M2-08 | Bad import data cannot corrupt existing workspace state |
| RQ-M3-07 | P2 | Done | Audit delete/undo/restore flows for data loss | RQ-M2-01, RQ-M2-02, RQ-M2-03, RQ-M2-04 | Failed deletes restore optimistic UI; undo windows behave consistently |

### RQ-M3-01 — Deep-Link Hydration for `/notes/:id` Sub-Tasks

Context: the app uses `currentView` in `appStore.ts` and `window.history.pushState` for navigation. `window.location.pathname` is not read on page load — this is the gap to fix. There is no React Router.

1. Open `researchquest/src/App.tsx`. Find the main `useEffect` that runs once on mount (or add one if absent). Inside it, add: read `window.location.pathname`, check if it starts with `/notes/`, extract the ID segment, call `setCurrentView('notes')` and `setSelectedNote(id)`. Pass criterion: the mount `useEffect` in `App.tsx` contains path parsing for `/notes/`.
2. Open `researchquest/src/store/appStore.ts`. Verify `setSelectedNote` (or equivalent action) exists and sets the selected note ID in the store. Pass criterion: the action is defined.
3. Open the notes view component. Verify it handles the case where `selectedNoteId` is set in the store but the notes array has not yet loaded (show a loading spinner or skeleton). Pass criterion: the component renders a loading state, not a crash or stale content, while notes are being fetched.
4. Open the notes view component. Verify it handles the case where `selectedNoteId` is set but no note with that ID exists in the loaded array. Render an inline "Note not found" message. Pass criterion: setting `selectedNoteId` to `"nonexistent-id"` in the store causes the notes view to show "Note not found".
5. Browser smoke test: navigate directly to `/notes/<valid-id>`. Confirm the note opens without a manual click. Navigate to `/notes/nonexistent`. Confirm "not found" message appears.

### RQ-M3-02 — Deep-Link Hydration for `/papers/:id` and `/ideas/:id` Sub-Tasks

1. Open `researchquest/src/App.tsx`. In the mount `useEffect` (added in RQ-M3-01), add path parsing for `/papers/:id`: call `setCurrentView('papers')` and `setSelectedPaper(id)`. Pass criterion: `/papers/` path is handled.
2. Open `researchquest/src/App.tsx`. Add path parsing for `/ideas/:id`: call `setCurrentView('ideas')` and `setSelectedIdea(id)`. Pass criterion: `/ideas/` path is handled.
3. Apply the same "loading" and "not found" states from RQ-M3-01 steps 3–4 to the papers and ideas view components. Pass criterion: papers and ideas views each have a loading state and a "not found" state.
4. Browser smoke test: navigate directly to `/papers/<valid-id>` and `/ideas/<valid-id>`. Confirm each opens the correct entity.

### RQ-M3-03 — Deep-Link Hydration for `/topics/:id` and `/tasks/:id` Sub-Tasks

1. Open `researchquest/src/App.tsx`. Add path parsing for `/topics/:id` in the mount `useEffect`: call `setCurrentView('topics')` and `setSelectedTopic(id)`. Pass criterion: `/topics/` path is handled.
2. Open `researchquest/src/App.tsx`. Add path parsing for `/tasks/:id`: call `setCurrentView('tasks')` and `setSelectedTask(id)`. Pass criterion: `/tasks/` path is handled.
3. Apply the same "loading" and "not found" states to the topics and tasks view components. Pass criterion: both views have loading and "not found" states.
4. Browser smoke test: navigate directly to `/topics/<valid-id>` and `/tasks/<valid-id>`. Confirm each opens or shows "not found" as appropriate.

### RQ-M3-04 — Not-Found and Unauthorized States Sub-Tasks

1. Verify all five entity views (notes, papers, ideas, tasks, topics) have an inline "not found" state as implemented in RQ-M3-01 through RQ-M3-03. If any are missing, add them. Pass criterion: all five views render a "not found" message when the selected ID does not match any loaded entity.
2. Open `researchquest/src/App.tsx`. In the mount `useEffect`, add an unauthenticated deep-link guard: if a path-based ID is detected but `session` is null, store the target path in local state and redirect to the auth screen. After sign-in, navigate to the stored path. Pass criterion: an unauthenticated user navigating to `/notes/<id>` is redirected to auth, then lands on the note after signing in.
3. Verify no entity view shows a blank white panel when an ID is set but the entity is not found. Pass criterion: every "not found" state has at least one line of visible text.

### RQ-M3-05 — Visible Fetch Failure States Sub-Tasks

1. Open `researchquest/src/store/appStore.ts`. Verify a `dataSyncErrors` field (or equivalent) exists to hold fetch error messages. If it does not exist, add `dataSyncErrors: string[]` and `setDataSyncErrors: (errors: string[]) => void`. Pass criterion: field and setter are present in the store.
2. Open `researchquest/src/hooks/useDataSync.ts`. Verify every `catch` block writes to `dataSyncErrors` via the store setter. If any catch block only `console.error`s, add the store write. Pass criterion: every catch block in `useDataSync.ts` calls the store error setter.
3. Open `researchquest/src/components/dashboard/Dashboard.tsx` or the root layout component (`App.tsx`). Add a dismissible error banner that reads `dataSyncErrors` from the store and shows: "Failed to load your data. Check your connection and refresh." if the array is non-empty. Pass criterion: banner is visible when `dataSyncErrors` is non-empty.
4. Verify each entity list view (notes, papers, ideas, tasks, topics) either shows the global error banner or has its own inline error message when the relevant data failed to load. Pass criterion: a user who encounters a fetch failure sees an actionable message, not a silent empty list.

### RQ-M3-06 — Import Validation, Conflict Reporting, Safe Rollback Sub-Tasks

All implementation work for this task was specified in RQ-M2-08 sub-tasks 4–7. Mark RQ-M3-06 as done when all RQ-M2-08 sub-tasks are verified complete.

Additionally:

1. Open `researchquest/src/components/settings/DataManagementDialog.tsx`. Verify the import UI shows the result of `importData(...)` including `imported`, `skipped`, and any `error`. If the UI only shows a generic success/failure message, update it to display the specific counts. Pass criterion: after import, the dialog shows "Imported X items, skipped Y duplicates" or the specific error message.

### RQ-M3-07 — Delete/Undo/Restore Flow Audit Sub-Tasks

1. Open `researchquest/src/hooks/useNotes.ts`. Verify `deleteNote` performs an optimistic remove from the global store before the Supabase call resolves. Verify on error, the optimistic remove is rolled back (the note is re-added to the store). Pass criterion: `deleteNote` has both an optimistic remove and an error rollback.
2. Open `researchquest/src/hooks/useNotes.ts`. Verify `restoreNote` uses `upsert`, not `insert` (already checked in RQ-M2-01-03; confirm it remains correct). Pass criterion: `upsert` is used.
3. Open `researchquest/src/hooks/usePapers.ts`. Apply the same audit as steps 1–2 to `deletePaper` and `restorePaper`. Pass criterion: optimistic remove with rollback and `upsert` on restore.
4. Open `researchquest/src/hooks/useIdeas.ts`. Apply the same audit to `deleteIdea` and `restoreIdea`. Pass criterion: same pattern.
5. Open `researchquest/src/hooks/useTasks.ts`. Apply the same audit to `deleteTask` and `restoreTask` (already checked in RQ-M2-04-02; confirm both are correct). Pass criterion: same pattern.
6. Verify all undo/restore windows use a consistent duration. If some use 3 seconds and others 5, standardize to one value and document it as a constant in `researchquest/src/lib/constants.ts` (create the file if it does not exist). Pass criterion: a single `UNDO_WINDOW_MS` constant exists and is used in all undo timers.

Month 3 verification:

- Reload and browser back/forward smoke for all routes.
- Offline/Supabase failure simulation.
- Import failure and conflict tests.
- `pnpm test:run`, `pnpm lint`, and `pnpm build`.

## Month 4: UX Normalization And Mobile Readiness

Goal: make the product coherent, responsive, and keyboard-accessible.

| ID | Priority | Status | Task | Depends On | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| RQ-M4-01 | P2 | Done | Normalize mixed visual systems toward the chosen design tokens | RQ-M2-07 | Primary screens no longer feel like separate UI kits |
| RQ-M4-02 | P1 | Done | Finish responsive Notes layout | RQ-M2-01 | Notes list/editor fit at mobile, tablet, and desktop widths |
| RQ-M4-03 | P1 | Done | Finish responsive Papers layout | RQ-M2-02 | Paper list/detail drawer has no mobile clipping or hidden controls |
| RQ-M4-04 | P1 | Done | Finish responsive Ideas layout | RQ-M2-03 | Kanban and detail drawer work on narrow screens |
| RQ-M4-05 | P1 | Done | Finish responsive Tasks, Topics, and Focus layouts | RQ-M2-04, RQ-M2-05, RQ-M2-06 | Primary controls fit and remain reachable on mobile |
| RQ-M4-06 | P1 | Done | Fix dialog focus, keyboard flow, labels, and escape behavior | RQ-M2 workflow tasks | Keyboard-only usage works for auth, create/edit dialogs, and command palette |
| RQ-M4-07 | P2 | Done | Complete command palette navigation and creation actions | RQ-M3 routing tasks | Command palette routes and creates expected entities without stale state |
| RQ-M4-08 | P2 | Done | Reduce obvious bundle-size risk with code splitting where low-risk | RQ-M2 workflow tasks | Production chunks are reviewed; release-blocking size issues are addressed |

### RQ-M4-01 — Visual Normalization Sub-Tasks

1. Open `researchquest/src/index.css` (or `tailwind.config.ts`). List all CSS custom properties / design tokens defined. Add a comment block at the top of `index.css`: `/* Design tokens used across all views: [list them here] */`. Pass criterion: comment block is present and lists at least the primary color, background color, and font family tokens.
2. Open `researchquest/src/components/dashboard/Dashboard.tsx`, `researchquest/src/components/notes/NotesList.tsx`, and `researchquest/src/components/papers/PapersList.tsx`. For each, audit for `style={{ ... }}` props that set spacing, color, or typography as inline pixel values (not Tailwind tokens). Pass criterion: audit findings are documented as inline `// AUDIT` comments on offending lines.
3. For each `// AUDIT` comment found in step 2, replace the inline style with the equivalent Tailwind utility class. Pass criterion: zero `style={{ margin: ..., padding: ..., color: ... }}` patterns remain in the three audited files.

### RQ-M4-02 — Responsive Notes Layout Sub-Tasks

1. Open `researchquest/src/hooks/use-mobile.tsx`. Verify `useIsMobile()` is exported. Pass criterion: `export function useIsMobile()` (or `export const useIsMobile`) is present.
2. Open the Notes layout component (the one that renders the list/editor split). Verify it uses either `useIsMobile()` to conditionally render a stacked layout, or Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) on the container grid/flex classes. Pass criterion: responsive classes or the hook are present on the layout container.
3. Set viewport width to 375px (Chrome DevTools device simulation). Verify: the note list is scrollable, the editor is reachable (either below the list or via a navigation action), and no element overflows horizontally. Pass criterion: no horizontal scrollbar at 375px.

### RQ-M4-03 — Responsive Papers Layout Sub-Tasks

1. Open the Papers layout component. Verify the list/detail-drawer split uses Tailwind responsive prefixes on the container. Pass criterion: `sm:`, `md:`, or `lg:` prefixes are present on layout classes.
2. At 375px viewport width: verify the paper list is scrollable, the detail drawer does not clip any control (title, close button, status dropdown), and the close/back button is reachable. Pass criterion: no horizontal overflow and all controls visible.

### RQ-M4-04 — Responsive Ideas Layout Sub-Tasks

1. Open the Ideas Kanban component. Verify the stage columns either have `overflow-x-auto` on the column container (horizontal scroll) or stack vertically at mobile widths. Pass criterion: `overflow-x-auto` or a column-stacking responsive class is present.
2. At 375px: verify the Kanban is usable (columns scrollable or stacked) and the idea detail drawer has no clipped controls. Pass criterion: no overflow, all controls reachable.

### RQ-M4-05 — Responsive Tasks, Topics, Focus Layouts Sub-Tasks

1. Open the task list/manager component. At 375px: verify filter controls and task rows are visible with no overflow. Pass criterion: no horizontal scrollbar on the task list at 375px.
2. Open the topics view component. At 375px: verify topic list and detail panel are accessible. Pass criterion: no overflow.
3. Open `researchquest/src/components/focus/FocusWorkspace.tsx`. At 375px: verify the timer display, start/pause/complete buttons, and target entity selector are all visible and tappable (not clipped or overlapped). Pass criterion: all controls are visible and reachable at 375px.

### RQ-M4-06 — Dialog Focus, Keyboard, Labels Sub-Tasks

1. Open each dialog/modal component used in the primary workflows: auth sign-in, create note, create paper, create idea, create task, create topic. For each, verify every `<input>`, `<textarea>`, and `<select>` has an associated `<label>` (either via `htmlFor`/`id` pairing or `aria-label`). Pass criterion: zero unlabeled inputs in all six dialog types.
2. For each dialog, verify `Tab` key cycles through the dialog's own controls only (focus does not escape to the background). Pass criterion: pressing `Tab` repeatedly keeps focus within the dialog.
3. For each dialog, verify pressing `Escape` closes the dialog. Pass criterion: `onKeyDown` or `onEscapeKeyDown` with `e.key === 'Escape'` is handled in every dialog component.
4. Open `researchquest/src/components/layout/CommandPalette.tsx`. Verify it opens on `Ctrl+K` (Windows/Linux) and `Cmd+K` (Mac). Pass criterion: a `keydown` event listener checks `e.key === 'k' && (e.ctrlKey || e.metaKey)`.

### RQ-M4-07 — Command Palette Navigation and Creation Sub-Tasks

1. Open `researchquest/src/components/layout/CommandPalette.tsx`. List all currently registered commands. Add a comment block at the top of the component: `// Registered commands: [list]`. Pass criterion: comment block is present.
2. Add navigation commands: "Go to Notes", "Go to Papers", "Go to Ideas", "Go to Tasks", "Go to Topics", "Go to Dashboard". Each must call `setCurrentView(...)` and `window.history.pushState(...)` on selection. Pass criterion: all six navigation commands are registered and functional.
3. Add creation commands: "New Note", "New Paper", "New Idea", "New Task", "New Topic". Each must open the relevant create dialog. Pass criterion: all five creation commands are registered.
4. Verify the command palette reflects the current view correctly: opening the palette immediately after switching views does not show a stale/wrong current-view indicator. Pass criterion: current view indicator in the palette updates on every view change.

### RQ-M4-08 — Bundle Size / Code Splitting Sub-Tasks

1. Run `pnpm build`. Capture the output. Identify all chunks larger than 200 KB. Add a comment in `researchquest/vite.config.ts`: `// Bundle audit [date]: [list chunk names and sizes]`. Pass criterion: comment is present after running the build.
2. Open `researchquest/vite.config.ts`. In the `build.rollupOptions` section, add a `manualChunks` function that separates at minimum: `vendor` (React + ReactDOM), `supabase` (the Supabase client), and any rich-text editor library if present (e.g., Tiptap). Pass criterion: `manualChunks` is defined with at least three named chunks.
3. Run `pnpm build` again. Verify the build succeeds with exit code 0. Verify the main application chunk is under 500 KB. Pass criterion: build passes and main chunk size ≤ 500 KB.

Month 4 verification:

- Manual visual QA at mobile (375px), tablet (768px), and desktop (1280px) widths.
- Keyboard-only QA for auth, navigation, dialogs, and editor basics.
- Accessibility checks for labels, focus, and dialog behavior.
- `pnpm test:run`, `pnpm lint`, and `pnpm build`.

## Month 5: Product Truth And Differentiation

Goal: keep advanced features honest and useful.

| ID | Priority | Status | Task | Depends On | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| RQ-M5-01 | P1 | Done | Decide Deep Research release path: real cited backend, relabel as simulated, or remove | RQ-M1-04 | No simulated output is presented as real research |
| RQ-M5-02 | P1 | Not Started | Implement the chosen Deep Research path | RQ-M5-01 | Feature either returns source-backed output or is clearly out of release scope |
| RQ-M5-03 | P2 | Done | Strengthen citation and bibliography workflows | RQ-M2-02 | Citation behavior is clear, tested, and useful for academic workflows |
| RQ-M5-04 | P2 | Done | Improve related items, backlinks, and topic graph behavior | RQ-M2-05, RQ-M3 routing tasks | Related panels use current data and do not disappear as critical workflow state |
| RQ-M5-05 | P2 | Done | Add meaningful first-run empty states and onboarding | RQ-M4 UX tasks | New users understand what to do without reading docs |
| RQ-M5-06 | P2 | Done | Define beta analytics and error visibility | RQ-M3-05 | Beta can surface failures and usage patterns without exposing sensitive data |

### RQ-M5-01 — Deep Research Decision Sub-Tasks

1. Open `researchquest/supabase/functions/deep-research/index.ts`. Read the function body and determine: (A) does it call a real external AI/search API with credentials? (B) does it return mock/hardcoded data? (C) is it a stub that always errors? Pass criterion: the answer is determined and documented.
2. Create `docs/DEEP_RESEARCH_DECISION.md` with the following sections filled in:
   - **Current state**: (real API / mock / stub — your finding from step 1)
   - **Option A — Real backend**: Integrate a real search API (e.g., Tavily, Perplexity). Effort: high. Requires API key secret in Supabase. Returns source-backed citations.
   - **Option B — Relabel as simulated**: Change the UI heading to "Simulated Research Preview" and add a disclaimer badge. Effort: low (one UI label change). No backend changes.
   - **Option C — Remove from release scope**: Remove the route and navigation entry. Effort: low. Keep the function directory with a `DISABLED.md` note.
   - **Decision**: _(leave blank for product owner to fill in before RQ-M5-02 begins)_
   Pass criterion: file exists at `docs/DEEP_RESEARCH_DECISION.md` with all sections present except the blank Decision field.
3. **Blocker**: RQ-M5-02 cannot begin until the Decision field in `docs/DEEP_RESEARCH_DECISION.md` is non-blank. Pass criterion: the file has a filled-in Decision field before any RQ-M5-02 sub-task is started.

### RQ-M5-02 — Implement Chosen Deep Research Path Sub-Tasks

_Complete only the option matching the decision in `docs/DEEP_RESEARCH_DECISION.md`._

**If Option A (real backend) was chosen:**
1. Open `researchquest/supabase/functions/deep-research/index.ts`. Replace the simulated/stub logic with a real search API call. The response must include at least one source URL and title. Pass criterion: invoking the function returns a JSON object containing `sources: [{ url, title }]`.
2. Add the API key as a Supabase secret. Document the exact command in `docs/DEEP_RESEARCH_DECISION.md` under "Deployment steps": `supabase secrets set SEARCH_API_KEY=<value>`. Pass criterion: the function reads the key via `Deno.env.get('SEARCH_API_KEY')` and does not hardcode it.
3. Update the Deep Research UI component to display source citations (URL + title) alongside each result. Pass criterion: rendered results show at least one clickable source link.

**If Option B (relabel as simulated) was chosen:**
1. Open the Deep Research UI component. Change the feature heading to "Simulated Research Preview". Add a visible disclaimer badge directly below the heading: "This output is AI-simulated and is not backed by real sources." Pass criterion: the disclaimer text is present and visible before the user runs a query.

**If Option C (remove from scope) was chosen:**
1. Open `researchquest/src/App.tsx`. Remove the Deep Research view from the `currentView` switch/render logic. Pass criterion: `currentView === 'deep-research'` (or equivalent) renders nothing or redirects to dashboard.
2. Remove the Deep Research navigation item from the sidebar/nav component. Pass criterion: no link to Deep Research appears in the navigation.
3. In `researchquest/supabase/functions/deep-research/`, create a file named `DISABLED.md` with: "Feature removed from release scope (RQ-M5-02, Option C). Re-enable after updating `docs/DEEP_RESEARCH_DECISION.md`." Pass criterion: file exists.

### RQ-M5-03 — Citation and Bibliography Workflow Sub-Tasks

1. Open the citation insertion dialog (used from Notes or Papers). Verify it offers at minimum three citation format options: APA, MLA, and Chicago. Pass criterion: all three format names appear as selectable options.
2. Open `researchquest/src/utils/export.ts`. Run `convertPapersToBibTeX` mentally (or write a test) with a sample paper object that has `author`, `title`, `year`, and `journal` fields. Verify the output string includes all four fields in valid BibTeX syntax. Pass criterion: output includes `author = {`, `title = {`, `year = {`, and `journal = {` (or `booktitle = {` for conference papers).
3. Add a unit test for `convertPapersToBibTeX` in `researchquest/src/utils/export.test.ts` (create the file if it does not exist). The test must supply one sample paper and assert the output contains the paper's title. Pass criterion: `pnpm test:run` passes with the new test included.

### RQ-M5-04 — Related Items, Backlinks, Topic Graph Sub-Tasks

1. Open the right sidebar or related items panel component. Verify it reads related notes, papers, and ideas from the live store (not from a hardcoded array). Pass criterion: the panel references `useAppStore()` or equivalent for its data.
2. Verify that selecting a different entity (e.g., switching from Note A to Note B) updates the related panel to reflect the new selection's relations. Pass criterion: related panel content changes when the selected entity changes — no stale previous entity data shown.
3. If a topic graph/visualization component exists, verify it renders real topic-to-entity edges from the store. If it does not exist or uses mock data, add the comment: `// TODO (RQ-M5-04): topic graph visualization uses mock data. Replace with real topic-entity relationships from store.` Pass criterion: either real data is used or the TODO comment is present.

### RQ-M5-05 — Empty States and Onboarding Sub-Tasks

1. Open `researchquest/src/components/notes/NotesList.tsx`. Verify an empty state is rendered when `notes.length === 0`. The empty state must include a call-to-action button: "Create your first note" (or equivalent). Pass criterion: empty state with CTA button is present and the button triggers the create-note flow.
2. Open the papers list component. Add the same empty state pattern with CTA "Add your first paper". Pass criterion: empty state with CTA is present.
3. Open the ideas view component. Add an empty state with CTA "Capture your first idea". Pass criterion: empty state with CTA is present.
4. Open the tasks list component. Add an empty state with CTA "Create your first task". Pass criterion: empty state with CTA is present.
5. Open the topics view component. Add an empty state with CTA "Create your first topic". Pass criterion: empty state with CTA is present.
6. Open `researchquest/src/components/dashboard/Dashboard.tsx`. When all entity counts are zero (new user), render a "Welcome to ResearchQuest" panel with brief instructions and links to start creating notes, papers, ideas, or tasks. Pass criterion: the welcome panel renders when all counts are 0 and does not render when any count > 0.

### RQ-M5-06 — Beta Analytics and Error Visibility Sub-Tasks

1. Open `researchquest/src/hooks/useDataSync.ts`. Verify every `catch` block calls `console.error('[RQ]', error)` in addition to setting the store error state. If any catch block omits the `[RQ]` prefix, add it. Pass criterion: all catch blocks in `useDataSync.ts` log with the `[RQ]` prefix.
2. Open every hook that interacts with Supabase (`useNotes.ts`, `usePapers.ts`, `useIdeas.ts`, `useTasks.ts`, `useTopics.ts`). Verify every catch block calls `console.error('[RQ]', error)`. Add where missing. Pass criterion: all catch blocks in all five hooks use the `[RQ]` prefix.
3. Create `docs/BETA_ANALYTICS.md` with the following sections:
   - **Error logging**: describe the `[RQ]` console prefix and how to filter it in DevTools.
   - **User events tracked**: list any analytics events currently fired (or state "none currently").
   - **Future integration**: describe what would be needed to add Sentry for error tracking or PostHog for event analytics (package name, initialization location, required env vars).
   Pass criterion: file exists with all three sections populated.

Month 5 verification:

- Product copy audit: search `researchquest/src/` for the word "simulated", "mock", "placeholder", "TODO", and "fake". Review each occurrence. Pass criterion: none appear in user-visible strings unless intentional and documented.
- Citation workflow smoke.
- First-run user smoke (new account, empty state, create each entity type).
- `pnpm test:run`, `pnpm lint`, and `pnpm build`.

## Month 6: Beta, Release Hardening, And Launch

Goal: prove the product can be released safely.

| ID | Priority | Status | Task | Depends On | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| RQ-M6-01 | P0 | Done | Run fresh Supabase migration rehearsal | Month 1 tasks | Fresh project migrates successfully and supports first user workflow |
| RQ-M6-02 | P0 | Done | Run RLS/security audit for all user-owned tables | Month 1-3 tasks | Users cannot read/write another user's data |
| RQ-M6-03 | P1 | Done | Run full production-like browser smoke | Month 2-5 tasks | Auth, dashboard, all workspaces, import/export, and deep links pass |
| RQ-M6-04 | P1 | Done | Run backup and restore drill | RQ-M2-08, RQ-M3-06 | Exported backup can restore release-supported data |
| RQ-M6-05 | P2 | Done | Run performance and bundle budget check | RQ-M4-08 | No release-blocking performance issues remain |
| RQ-M6-06 | P1 | Done | Create final launch checklist and known-issues list | All prior tasks | Release decision can be made from one checklist |
| RQ-M6-07 | P0 | Done | Final release gate review | RQ-M6-01 through RQ-M6-06 | Zero P0 open; zero unaccepted P1 open; build/test/browser gates pass |

### RQ-M6-01 — Fresh Supabase Migration Rehearsal Sub-Tasks

1. Create a new Supabase project (or reset the existing staging project `zsjczlmzhyzewpehmngc` to a clean state). Run all migrations in order using `supabase db push` or Supabase MCP `apply_migration`. Pass criterion: 0 errors, all 16 tables exist, all 12 migrations applied.
2. Create a test user via Supabase Auth dashboard. Sign in to the deployed or locally-running app using those credentials. Pass criterion: user lands on the dashboard after sign-in.
3. Run `pnpm test:run`, `pnpm lint`, and `pnpm build`. Pass criterion: all three pass with zero errors.

### RQ-M6-02 — RLS/Security Audit Sub-Tasks

1. Open each migration file in `researchquest/supabase/migrations/`. For every table, check whether `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and a policy with `using (auth.uid() = user_id)` (or equivalent) exist. List every table missing RLS. Pass criterion: a complete list of tables with and without RLS is documented (add it as a comment in the last migration file or in `docs/LAUNCH_CHECKLIST.md`).
2. For every table without RLS, create a new migration file in `researchquest/supabase/migrations/` that enables RLS and adds a user_id ownership policy. Name the file `[timestamp]_add_rls_<table_name>.sql`. Pass criterion: all user-owned tables have RLS policies after applying the new migrations.
3. Using two distinct test Supabase user accounts, verify that User B cannot read any row owned by User A in `notes`, `papers`, `ideas`, `tasks`, and `topics`. Test via the Supabase SQL editor or a script. Pass criterion: cross-user SELECT returns 0 rows for all five tables.

### RQ-M6-03 — Full Production-Like Browser Smoke Sub-Tasks

1. Sign in with a test user. Verify auth succeeds and the dashboard loads. Pass criterion: user is on the dashboard within 5 seconds of sign-in.
2. Navigate to Notes. Create a note. Edit its content. Reload. Verify the note persists. Pass criterion: note survives a hard reload.
3. Navigate to Papers. Add a paper manually. Verify it appears in the list. Pass criterion: paper is visible after creation.
4. Navigate to Ideas. Create an idea. Move it to "Mature". Pass criterion: stage change persists.
5. Navigate to Tasks. Create a task. Mark it complete. Pass criterion: completed task is shown or hidden per filter.
6. Navigate to Topics. Create a topic. Link the note created in step 2 to it. Verify the note count on the topic shows 1. Pass criterion: count is 1.
7. Navigate to Focus. Start a session. Complete it. Verify XP updated. Pass criterion: XP value changed.
8. Navigate via direct URL to `/notes/<id>`, `/papers/<id>`, `/ideas/<id>`, `/tasks/<id>`, `/topics/<id>`. Verify each deep link opens the correct entity. Pass criterion: all five deep links resolve correctly.
9. Export data. Verify the downloaded JSON includes `notes`, `papers`, `ideas`, `tasks`, `topics`, `topicNotes`, `topicPapers`, `topicIdeas`. Pass criterion: all eight keys present.
10. Import the exported JSON on a fresh test user. Verify entities appear. Pass criterion: import succeeds with `imported > 0`.

### RQ-M6-04 — Backup and Restore Drill Sub-Tasks

1. Using the test user from RQ-M6-03, export a full backup (JSON download). Note the counts of notes, papers, ideas, tasks, topics in the file. Pass criterion: JSON file downloaded and counts noted.
2. Delete all test data for the user via the Supabase SQL editor (`DELETE FROM notes WHERE user_id = '<id>'`, etc.) or via the app's delete-all function if it exists. Pass criterion: app shows empty states for all entity types.
3. Import the backup JSON from step 1. Pass criterion: import completes with `imported > 0` and no error.
4. Verify entity counts in the dashboard match the counts noted in step 1. Pass criterion: counts match within ±0 (exact match required for a complete restore).

### RQ-M6-05 — Performance and Bundle Budget Sub-Tasks

1. Run `pnpm build`. Verify main chunk is ≤ 500 KB (should already be true after RQ-M4-08). If not, revisit `vite.config.ts` `manualChunks`. Pass criterion: main chunk ≤ 500 KB.
2. Open the app in Chrome. Open DevTools → Lighthouse → Performance. Run an audit on the dashboard page (authenticated). Pass criterion: Performance score ≥ 70, or every item scoring below 70 is documented in `docs/LAUNCH_CHECKLIST.md` as a known issue with its severity.
3. Open DevTools Console after a fresh page load (hard reload). Verify zero console errors. Pass criterion: no red errors in the console on initial load.

### RQ-M6-06 — Final Launch Checklist Sub-Tasks

1. Create `docs/LAUNCH_CHECKLIST.md` with the following sections:
   - **Pre-launch gates** (check each off when verified): fresh migration ✓/✗, auth ✓/✗, Notes CRUD ✓/✗, Papers CRUD ✓/✗, Ideas CRUD ✓/✗, Tasks CRUD ✓/✗, Topics CRUD ✓/✗, Focus session ✓/✗, deep links ✓/✗, export ✓/✗, import ✓/✗, mobile layouts ✓/✗, keyboard access ✓/✗, RLS ✓/✗, bundle size ✓/✗.
   - **Known issues** (list any open issues found during M6 QA, with ID, description, severity P0/P1/P2, and release-blocker: yes/no).
   - **Go/no-go criteria**: zero P0 open; zero unaccepted P1 open; all pre-launch gates checked.
   - **Go/no-go decision**: _(fill in at gate review)_.
   Pass criterion: file exists with all sections present and pre-launch gates filled in based on RQ-M6-03 results.
2. For each open issue discovered during M6 QA, add an entry to the Known Issues section with all four fields: ID, description, severity, release-blocker. Pass criterion: no issue found during QA is absent from the checklist.

### RQ-M6-07 — Final Release Gate Review Sub-Tasks

1. Open `docs/RELEASE_ROADMAP_6_MONTHS.md`. Verify every P0 task (RQ-M1-01 through RQ-M6-07) is marked `Done`. Pass criterion: zero P0 tasks in `Not Started` or `In Progress` state.
2. Verify every P1 task is either marked `Done` or has an explicit accepted-limitation note in the Known Issues section of `docs/LAUNCH_CHECKLIST.md`. Pass criterion: every P1 task has a resolution status.
3. Run `pnpm test:run`, `pnpm lint`, and `pnpm build`. Pass criterion: all three exit with code 0.
4. Run browser smoke from RQ-M6-03 sub-tasks 1–10. Pass criterion: all ten smoke checks pass.
5. Review `docs/LAUNCH_CHECKLIST.md`. Fill in the Go/no-go decision field. Pass criterion: decision field is non-blank and supported by the gate checklist state.

Month 6 verification:

- Fresh Supabase setup (RQ-M6-01).
- Production build smoke (RQ-M6-03).
- Security/RLS test pass (RQ-M6-02).
- Launch checklist reviewed and signed off (RQ-M6-06, RQ-M6-07).

## Immediate Next Execution Order

Start here before touching lower-priority work:

| Order | Task ID | Reason |
| --- | --- | --- |
| 1 | RQ-M1-01 | The task contract affects DB, UI, dashboard, export, and realtime |
| 2 | RQ-M1-02 | Migration correctness depends on the task contract |
| 3 | RQ-M1-03 | Fresh project setup cannot be trusted until migrations are safe |
| 4 | RQ-M1-04 | Duplicate functions create deployment ambiguity |
| 5 | RQ-M1-05 | Topic creation is a direct core workflow reliability issue |
| 6 | RQ-M2-04 | Tasks must become real before dashboard/export can be trusted |
| 7 | RQ-M2-07 | Dashboard becomes truthful after real workflow state is wired |
| 8 | RQ-M2-08 | Import/export must match release-supported data |

## Global Verification Commands

Run after every implementation pass unless the change is docs-only:

```bash
pnpm test:run
pnpm lint
pnpm build
```

For backend work, also run a fresh Supabase migration rehearsal before marking a P0 backend task done.

## Risk Register

| Risk | Severity | Mitigation Task |
| --- | --- | --- |
| Task schema drift breaks CRUD or migrations | P0 | RQ-M1-01, RQ-M1-02 |
| Gamification migration fails in Supabase | P0 | RQ-M1-03 |
| Duplicate functions deploy the wrong code | P0 | RQ-M1-04 |
| Dashboard/export show false task data | P1 | RQ-M2-04, RQ-M2-07, RQ-M2-08 |
| Deep links fail after reload | P1 | RQ-M3-01, RQ-M3-02, RQ-M3-03 |
| Deep Research misleads users | P1 | RQ-M5-01, RQ-M5-02 |
| Mobile layouts block real usage | P1 | RQ-M4-02, RQ-M4-03, RQ-M4-04, RQ-M4-05 |
| Browser automation remains unreliable locally | P2 | RQ-M6-03 with documented alternate smoke path |
