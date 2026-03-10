# Innovator's Journal

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
