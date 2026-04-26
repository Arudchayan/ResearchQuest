## $(date +%Y-%m-%d) - Adding IDs and Labels to Inputs
**Learning:** Some inline editing inputs in this app's UI lacked an explicit label or `aria-label`, making them inaccessible to screen readers. Adding `id` to the input and wrapping text in `<label htmlFor="id">` (sometimes with `sr-only` class to hide it visually) or adding `aria-label` directly on the input solves this without breaking the UI design.
**Action:** Always ensure that every input field, even inline ones, has an accessible name either through a linked `<label>` or an `aria-label` attribute.
