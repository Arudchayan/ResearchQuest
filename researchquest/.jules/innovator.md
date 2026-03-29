2025-05-24 — Inconsistent Modal Patterns and Prompt Usage
Opportunity:
Replacing `window.prompt()` in `LeftSidebar` with a proper UI component will significantly improve UX, allowing for better text entry (especially for descriptions).

Learning:
The codebase currently mixes inline modal implementations (in `TaskManager.tsx`) with a reusable `ConfirmDialog` component. There isn't a standardized "Form Dialog" pattern yet.

Prevention:
Future features requiring user input should avoid `window.prompt()` and instead use a consistent modal pattern, ideally extracting a reusable `FormDialog` or `Modal` primitive to avoid code duplication seen between `TaskManager` and `ConfirmDialog`.

2025-05-25 — Data Import Implementation & Missing Entity Export
Opportunity:
Implemented "Import Data" functionality to complete the Data Export/Import feature set. This allows users to restore backups or migrate data.

Learning:
The existing `ExportData` interface was missing `topics`, despite papers having `topic_ids`. This would have led to broken references upon restoration. The store holds `TopicWithCounts` (computed UI state) rather than the raw `Topic` schema, necessitating a transformation (stripping counts) before export to match the database schema.

Prevention:
When implementing data persistence or export features, always cross-reference the application state (often decorated with UI-specific data) against the database schema to ensuring only raw, restorable data is persisted.
2025-05-26 — Extracted FormDialog Component
Opportunity:
The codebase was missing a unified pattern for handling form inputs in modal contexts, relying on either `window.prompt()` calls (such as in `App-Simple.tsx`) or custom, bespoke `div` layouts (such as in `TaskManager.tsx` and `AddIdeaDialog.tsx`). I extracted a reusable `FormDialog` primitive to standardize this behavior.

Learning:
Extracting a `<FormDialog>` primitive alongside the existing `<ConfirmDialog>` ensures that keyboard events (Escape to close), focus states, DOM structural accessibility (roles like `dialog`), and design system patterns are applied consistently across all data input interfaces.

Prevention:
Do not use `window.prompt` or create inline/bespoke HTML implementations for popups or modal-based input forms. Always implement or reuse `FormDialog` to maintain UI and accessibility consistency.
