## 2025-04-28 - Button State Accessibility
**Learning:** For submit/action buttons containing both a loading state and an icon (like 'Add Paper'), applying `aria-live="polite"` directly to the button provides a smoother screen reader experience for the text change, while adding `aria-hidden="true"` to the decorative SVG icons (`Loader`, `Plus`) prevents redundant announcements.
**Action:** When adding or auditing complex interactive buttons, consistently apply `aria-hidden="true"` to internal SVG icons and ensure state changes are announced with `aria-live`.

## 2025-04-30 - Missing Keyboard Focus on Primary CTA Buttons
**Learning:** Primary CTA buttons (like "New Item" in sidebars) often miss explicit `focus-visible` styles during implementation, breaking keyboard navigation accessibility, even if secondary elements (like tabs) are styled correctly.
**Action:** Audit all new primary buttons and action triggers to ensure they explicitly include `focus-visible` styles and an appropriate `aria-label`, especially if the text dynamically changes.
## 2024-05-01 - Standardize Primary CTA Accessibility
**Learning:** Primary call-to-action buttons in dynamic interfaces (like Add/Search panels) frequently miss standard focus visibility and hover states, and dynamic status changes (like spinners during loading) are invisible to screen readers without explicit ARIA live regions.
**Action:** When implementing or updating primary CTA buttons, always include `focus-visible` utilities (e.g., `focus-visible:outline-primary-500`) alongside hover/disabled styling. If the button content changes dynamically (such as showing "Adding Paper..." or a spinner), ensure `aria-live="polite"` and `aria-atomic="true"` are present to announce the state change correctly.
