## 2024-05-23 - Task Manager Accessibility
**Learning:** React components (like the TaskManager modal) often rely on implicit labeling (nesting) or placeholders, which fails accessibility checks. Explicitly linking `label` to `input` via `htmlFor` and `id` is crucial for screen readers and improves click-target usability.
**Action:** Always verify form inputs have associated labels. Use `aria-label` for inputs that cannot have a visible text label (like search bars). When verifying locally without a backend, bypassing auth in `App.tsx` is a valid strategy for UI testing.
