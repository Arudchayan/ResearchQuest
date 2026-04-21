## 2024-05-18 - Screen readers and dynamic empty states
**Learning:** Screen readers need explicit hints when a dynamically filtered list becomes empty, otherwise they may not announce that no results match the filter, leaving the user confused.
**Action:** Always add `role="status"` and `aria-live="polite"` to empty state containers that are conditionally rendered based on user input (like search or filtering).
