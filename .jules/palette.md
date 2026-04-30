## 2025-04-28 - Button State Accessibility
**Learning:** For submit/action buttons containing both a loading state and an icon (like 'Add Paper'), applying `aria-live="polite"` directly to the button provides a smoother screen reader experience for the text change, while adding `aria-hidden="true"` to the decorative SVG icons (`Loader`, `Plus`) prevents redundant announcements.
**Action:** When adding or auditing complex interactive buttons, consistently apply `aria-hidden="true"` to internal SVG icons and ensure state changes are announced with `aria-live`.

## 2025-04-30 - Missing Keyboard Focus on Primary CTA Buttons
**Learning:** Primary CTA buttons (like "New Item" in sidebars) often miss explicit `focus-visible` styles during implementation, breaking keyboard navigation accessibility, even if secondary elements (like tabs) are styled correctly.
**Action:** Audit all new primary buttons and action triggers to ensure they explicitly include `focus-visible` styles and an appropriate `aria-label`, especially if the text dynamically changes.
