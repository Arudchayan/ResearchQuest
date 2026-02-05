## 2024-05-22 - Safer Confirm Dialog Focus
**Learning:** For destructive actions (like deleting items), the default focus should be on the "Cancel" button, not the "Confirm" button. This prevents accidental data loss if the user reflexively presses Enter.
**Action:** When implementing confirmation dialogs, use the `variant` prop to determine the initial focus. If `variant="danger"`, focus the cancel action. For non-destructive actions (`variant="info"`), focusing the primary action is acceptable.

## 2025-05-24 - Consistent Dialog Patterns
**Learning:** Using native `window.confirm` creates inconsistent UX and accessibility issues (lack of focus control). Replacing it with a custom `ConfirmDialog` provides a unified experience and safer defaults.
**Action:** Always replace `window.confirm` with the `ConfirmDialog` component, utilizing the `useConfirmDialog` hook for cleaner integration in functional components.
