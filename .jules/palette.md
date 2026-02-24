## 2024-05-23 - Task Manager Accessibility
**Learning:** React components (like the TaskManager modal) often rely on implicit labeling (nesting) or placeholders, which fails accessibility checks. Explicitly linking `label` to `input` via `htmlFor` and `id` is crucial for screen readers and improves click-target usability.
**Action:** Always verify form inputs have associated labels. Use `aria-label` for inputs that cannot have a visible text label (like search bars). When verifying locally without a backend, bypassing auth in `App.tsx` is a valid strategy for UI testing.

## 2024-05-24 - Interactive List Items
**Learning:** Using `div` with `onClick` for list items (like search results) makes them inaccessible to keyboard users. They lack focus states and key handlers (Enter/Space).
**Action:** Replace interactive `div` wrappers with `button` elements (using `type="button"`). Apply `w-full text-left` to maintain the block layout, and ensure visible focus states (`focus:ring`).

## 2024-05-25 - Radix UI Dialog Accessibility
**Learning:** Radix UI Dialog component requires `Dialog.Title` for screen reader accessibility. If a `Dialog.Description` is not provided, `aria-describedby={undefined}` can be used on `Dialog.Content` to silence warnings when the dialog content is self-explanatory.
**Action:** Ensure all `Dialog.Content` implementations include a `Dialog.Title` and either a `Dialog.Description` or explicit `aria-describedby` attribute.

## 2024-05-26 - Keyboard Event Bubbling in Cards
**Learning:** When implementing keyboard accessibility on a card container (using `onKeyDown` for Enter/Space), events from interactive children (like delete buttons) bubble up. Pressing 'Enter' on a child button triggers both the child action AND the parent card action if not handled.
**Action:** In the parent `onKeyDown` handler, always check `if (e.target !== e.currentTarget) return;` to ensure the parent only responds to events targeting itself.

## 2024-05-27 - Client-Side Routing with Anchor Tags
**Learning:** Using `<button>` for navigation in Single Page Applications (SPAs) prevents users from opening links in new tabs (Ctrl/Cmd+Click).
**Action:** Replace navigation buttons with `<a>` tags using `href`. Implement a click handler that prevents default behavior ONLY when modifier keys are absent, ensuring both client-side routing and native browser features work.

## 2024-05-28 - Search Input UX Consistency
**Learning:** Inconsistent search input behavior (missing clear button) across views creates friction. Users expect a way to quickly reset search without backspacing.
**Action:** Standardize search input components to always include a clear button when content is present, using `useRef` to restore focus to the input after clearing.

## 2025-02-23 - Accessibility of Loading Skeletons
**Learning:** Repetitive skeleton loaders without proper grouping create significant noise for screen readers ("Loading..." x20).
**Action:** Use a container with `role="status"` and a descriptive `aria-label` (e.g., "Loading papers...") for the entire list, and mark individual skeleton items as decorative (`aria-hidden="true"`).
