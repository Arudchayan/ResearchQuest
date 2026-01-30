## 2024-05-23 - Task Manager Accessibility
**Learning:** React components (like the TaskManager modal) often rely on implicit labeling (nesting) or placeholders, which fails accessibility checks. Explicitly linking `label` to `input` via `htmlFor` and `id` is crucial for screen readers and improves click-target usability.
**Action:** Always verify form inputs have associated labels. Use `aria-label` for inputs that cannot have a visible text label (like search bars). When verifying locally without a backend, bypassing auth in `App.tsx` is a valid strategy for UI testing.

## 2024-05-24 - Interactive List Items
**Learning:** Using `div` with `onClick` for list items (like search results) makes them inaccessible to keyboard users. They lack focus states and key handlers (Enter/Space).
**Action:** Replace interactive `div` wrappers with `button` elements (using `type="button"`). Apply `w-full text-left` to maintain the block layout, and ensure visible focus states (`focus:ring`).

## 2024-05-25 - Radix UI Dialog Accessibility
**Learning:** Radix UI Dialog component requires `Dialog.Title` for screen reader accessibility. If a `Dialog.Description` is not provided, `aria-describedby={undefined}` can be used on `Dialog.Content` to silence warnings when the dialog content is self-explanatory.
**Action:** Ensure all `Dialog.Content` implementations include a `Dialog.Title` and either a `Dialog.Description` or explicit `aria-describedby` attribute.
