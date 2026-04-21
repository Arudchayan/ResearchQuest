## 2026-04-11 - Implement Markdown Export for Papers

**Opportunity:** Users should be able to export papers as Markdown to embed within notes or external tools, just like they can with Ideas and Notes.
**Learning:** The export UI patterns and logic are localized in `PapersView.tsx` and `export.ts`. It's easy to add new export formats by extending the `convert[Entity]To[Format]` paradigm.
**Prevention:** Always check if a generic export feature is implemented uniformly across all entity types. If a new export type is needed, update the specific view components and utility scripts accordingly.

This journal tracks critical discoveries, patterns, and learnings encountered during feature development.

2024-05-22 — Isolated Component Verification
Opportunity: Verifying authenticated components like `MarkdownEditor` in isolation without needing a full auth flow.
Learning: Creating a temporary `TestWrapper.tsx` and swapping it into `main.tsx` allows for rapid verification of isolated components with mocked state.
Prevention: N/A - this is a reusable pattern for future tasks.

2024-05-23 — Unified Undo Pattern
Opportunity: Deletion UX was inconsistent across entity types (Notes vs Papers/Ideas).
Learning: Implementing "Undo" requires coordination between the list view (which stays mounted) and detail view (which might unmount). Delegating the toast/undo logic to a persistent parent component (like PapersView or Sidebar) ensures the undo action remains available even if the detail view closes.
Prevention: Always check if a component unmounts before setting state in async handlers. Use refs or parent delegation for post-unmount actions.

2024-10-18 — Gamified Focus Logic & Testing
Opportunity: Integrating XP rewards into the `FocusWorkspace` timer required careful testing of the completion callback.
Learning: `FocusWorkspace` relies on `setInterval` for its timer. Testing this requires mocking hooks (`useNotes`, `useAppStore`) and `awardXP` function, along with using `vi.useFakeTimers()` to verify the exact moment of completion and subsequent XP award.
Prevention: When adding features that depend on time-based logic, always use `fakeTimers` in tests to ensure deterministic execution and prevent flaky tests.

2024-05-24 — Global Search Discoverability
Opportunity: The Command Palette is a powerful feature for global search, but its discoverability was low as it was only accessible via keyboard shortcuts (Cmd/Ctrl+K).
Learning: When migrating to a new layout (e.g., from v1 LeftSidebar to v2 Sidebar), visual affordances for core features like search can accidentally be dropped. Adding a persistent, clickable search button to the sidebar and mobile header that triggers the `open-command-palette` custom event significantly improves UX for non-power users.
Prevention: Always audit visual affordances for core features during layout migrations. Ensure functionality accessible via keyboard shortcuts also has a visible UI trigger unless intentionally hidden.

2024-05-25 — Markdown Editor Heading Formatting
Opportunity: The MarkdownEditor lacked a simple UI affordance and shortcut for creating and toggling headings.
Learning: CodeMirror programmatic text manipulation via `view.dispatch` requires mapping line numbers and extracting matches on the text content to cycle values.
Prevention: When manipulating multi-line editor selections, always retrieve the lines via `state.doc.line(lineNumber)` and ensure `scrollIntoView` is applied so the user focus doesn't detach.

2024-05-24 — Add Tasks to Command Palette global search
Opportunity: The global search (CommandPalette) did not include tasks, creating a friction point where users could search for notes, papers, and ideas, but not their tasks.
Learning: Unified global search is a high-value productivity booster.
Prevention: When adding new top-level entities, always ensure they are integrated into global components like search and command palettes.

2024-11-20 — Standardize Search and Export across List Views
Opportunity: IdeasBoard lacked parity with NotesView and PapersView regarding search and export functionality.
Learning: Ensuring consistent features (like search and export) across similar list views (Notes, Papers, Ideas) enhances overall usability and predictability for users.
Prevention: When creating new list views in the future, automatically evaluate if search, sort, and export functionalities are needed based on existing patterns.

2024-05-24 — Add Data Export to Task Manager
Opportunity: TaskManager lacked parity with Notes, Papers, and Ideas regarding Data Export functionality (Markdown, CSV, JSON).
Learning: Maintaining UX consistency across similar list views enhances usability. The pattern of adding an export DropdownMenu that leverages utility functions from `src/utils/export.ts` is robust and easy to replicate across entities.
Prevention: When creating new list views in the future, automatically evaluate if export functionalities are needed based on existing patterns to maintain feature parity.

2024-05-24 — Standardize Sorting across List Views
Opportunity: NotesView lacked parity with PapersView and TaskManager regarding explicit sorting functionality.
Learning: Maintaining UX consistency across similar list views (Notes, Papers, Tasks) enhances overall usability. Adding explicit sorting options provides users with better control over their content.
Prevention: When creating new list views in the future, automatically evaluate if search, sort, and export functionalities are needed based on existing patterns.

2024-11-20 — Standardize Sorting across List Views
Opportunity: IdeasBoard lacked parity with NotesView, PapersView, and TaskManager regarding explicit sorting functionality.
Learning: Maintaining UX consistency across similar list views enhances overall usability and predictability for users. Adding explicit sorting options provides users with better control over their content.
Prevention: When creating new list views in the future, automatically evaluate if search, sort, and export functionalities are needed based on existing patterns.

2024-05-24 — Add Tasks to Global Backup and Data Export
Opportunity: The global data backup feature (`DataManagementDialog.tsx`) excluded Tasks, creating a friction point and risk of data loss. Users could back up Notes, Papers, Ideas, and Topics, but not Tasks.
Learning: Unifying global export across all core entities ensures data portability and prevents partial backups, avoiding catastrophic data loss scenarios for end users relying on the backup system.
Prevention: When adding new core entities to a project with a global backup strategy, always add the new entity explicitly to both the export utility formats and the import/export orchestrator dialog.

2024-11-20 — Top-Level Entity Views
Opportunity: The application had a `TopicDetailView` and `TopicList`, and `topics` were deeply integrated in relations and global data exports, but there was no dedicated "Topics" view for the user to manage them efficiently.
Learning: When core entities are added to the platform (like Topics), they must be elevated to top-level navigation (in both v1 and v2 sidebars, `App.tsx` routing, and the `CommandPalette` global search) to be truly discoverable and manageable.
Prevention: When adding new top-level entities, always ensure they are integrated into global components like sidebars, routing arrays, and command palettes.

2025-03-05 — Visual Feedback for File Drop Zones
Opportunity: The BibTeX import tab had functional drag-and-drop for file uploads but completely lacked visual feedback when users dragged files over the UI, creating ambiguity.
Learning: When using invisible `<input type="file" />` elements overlaid on a UI to enable native drag-and-drop, it's essential to track `onDragOver` and `onDragLeave` events on the wrapper to provide explicit visual state changes (like border highlights or message updates) to confirm the drop zone is active.
Prevention: Always implement explicit drag state tracking (`isDragging`) and visual affordances whenever implementing custom or overlaid file upload drop zones.

2025-04-18 — Visual Feedback for File Drop Zones
Opportunity: The Data Management import dialog lacked drag and drop visual feedback when users dragged files over the UI, creating ambiguity for file drops.
Learning: Following the established pattern from the BibTeX import tab, tracking `onDragOver` and `onDragLeave` events on the file dropzone container with an explicit visual state change (`isDragging`) improves affordance and creates a more robust drag and drop target.
Prevention: Always implement explicit drag state tracking (`isDragging`) and visual affordances whenever implementing custom or overlaid file upload drop zones across the application.
