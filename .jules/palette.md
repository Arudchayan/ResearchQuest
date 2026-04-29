## 2025-04-28 - Button State Accessibility
**Learning:** For submit/action buttons containing both a loading state and an icon (like 'Add Paper'), applying `aria-live="polite"` directly to the button provides a smoother screen reader experience for the text change, while adding `aria-hidden="true"` to the decorative SVG icons (`Loader`, `Plus`) prevents redundant announcements.
**Action:** When adding or auditing complex interactive buttons, consistently apply `aria-hidden="true"` to internal SVG icons and ensure state changes are announced with `aria-live`.
