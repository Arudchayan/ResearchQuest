2025-05-24 — Inconsistent Modal Patterns and Prompt Usage
Opportunity:
Replacing `window.prompt()` in `LeftSidebar` with a proper UI component will significantly improve UX, allowing for better text entry (especially for descriptions).

Learning:
The codebase currently mixes inline modal implementations (in `TaskManager.tsx`) with a reusable `ConfirmDialog` component. There isn't a standardized "Form Dialog" pattern yet.

Prevention:
Future features requiring user input should avoid `window.prompt()` and instead use a consistent modal pattern, ideally extracting a reusable `FormDialog` or `Modal` primitive to avoid code duplication seen between `TaskManager` and `ConfirmDialog`.
