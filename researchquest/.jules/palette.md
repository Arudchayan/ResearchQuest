## 2024-05-22 - Safer Confirm Dialog Focus
**Learning:** For destructive actions (like deleting items), the default focus should be on the "Cancel" button, not the "Confirm" button. This prevents accidental data loss if the user reflexively presses Enter.
**Action:** When implementing confirmation dialogs, use the `variant` prop to determine the initial focus. If `variant="danger"`, focus the cancel action. For non-destructive actions (`variant="info"`), focusing the primary action is acceptable.

## 2025-05-24 - Consistent Dialog Patterns
**Learning:** Using native `window.confirm` creates inconsistent UX and accessibility issues (lack of focus control). Replacing it with a custom `ConfirmDialog` provides a unified experience and safer defaults.
**Action:** Always replace `window.confirm` with the `ConfirmDialog` component, utilizing the `useConfirmDialog` hook for cleaner integration in functional components.
## 2024-03-24 - Redundant screen reader announcements on button icons
**Learning:** Adding an aria-label to a button does not automatically hide its child elements (like SVG icons) from screen readers if they lack semantic meaning. This causes redundant or noisy announcements when using accessible buttons containing only `lucide-react` icons.
**Action:** Always add `aria-hidden="true"` to decorative `lucide-react` icons inside `<button>` tags when the button itself has an `aria-label`.

## 2024-05-25 - Context in mixed-content navigation buttons
**Learning:** When creating navigation buttons for lists that mix visual icons with multi-line string text (like Backlinks or Related Items lists), the combination of elements can cause screen readers to lose context or read disjointed information.
**Action:** Always provide an explicit, descriptive `aria-label` (e.g., `Navigate to [item.type] [item.title]`) to ensure the intent and target of the navigation button are crystal clear to screen reader users.
## 2024-05-26 - Keyboard Nav in Layout Contexts
**Learning:** High-level layout components (like Sidebars and App Shells) often contain numerous icon-only buttons or tightly grouped navigation items that lack native focus indicators, making keyboard navigation difficult or invisible.
**Action:** When working on navigation or layout shell components, always ensure that standard interactive elements (`<button>`, `<a>`) include explicit focus-visible styles (e.g., `focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500` or equivalent design tokens) to guarantee clear keyboard focus indicators.
