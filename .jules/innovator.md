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
