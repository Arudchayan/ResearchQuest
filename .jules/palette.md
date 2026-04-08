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

## 2025-02-23 - Empty State Accessibility & Labeling
**Learning:** Empty states are opportunities for delight and guidance. Using `role="status"` and `aria-live="polite"` ensures screen readers announce the state change (e.g., after filtering). Crucially, adding `aria-label` to a button overrides its visible text content, which can confuse testing libraries looking for the visible name.
**Action:** Enhance empty states with icons and actionable buttons. Avoid redundant `aria-label` on buttons that already have descriptive visible text.

## 2026-03-09 - Decorative Icon Accessibility
**Learning:** Decorative icons (like those from `lucide-react`) placed alongside visible text or within buttons with `aria-label` attributes create redundant noise for screen readers if not explicitly hidden.
**Action:** Always append `aria-hidden="true"` to decorative icons to ensure screen readers only announce the meaningful, associated text or accessible labels.

## 2024-05-20 - Icon-Only Buttons Require Explicit ARIA Attributes
**Learning:** Icon-only buttons that rely solely on the `title` attribute for tooltip text may not be sufficiently accessible across all screen reader configurations. The `title` attribute is often insufficient for a primary accessible name.
**Action:** Always provide an explicit `aria-label` on icon-only buttons, even if a `title` is present. Additionally, explicitly hide the decorative/informative icons inside these buttons from screen readers by adding `aria-hidden="true"` to the icon component (e.g., `<Icon aria-hidden="true" />`) to prevent redundant or confusing announcements.

## 2024-03-05 - Accessible Dialog Close Buttons
**Learning:** Radix UI's `Dialog.Close` components wrapping icon-only elements (like an `X` icon) do not inherit accessible names by default and often get overlooked, leading to "unlabeled button" errors in screen readers.
**Action:** Always explicitly provide an `aria-label` (e.g., `aria-label="Close dialog"`) to `Dialog.Close` when it lacks readable text content.

## 2024-11-20 - Inline Form Edit Accessibility
**Learning:** Inputs that are used for inline editing of titles, descriptions, and metadata (like author lists) within detail views frequently omit `aria-label` attributes because they lack visual `<label>` elements and rely on placeholder text or context. This breaks screen reader accessibility since the placeholder is not a robust accessible name.
**Action:** When implementing or reviewing inline editing states (e.g., swapping a heading for an input), always explicitly provide an `aria-label` attribute (e.g. `aria-label="Idea title"`) to ensure context is maintained for assistive technologies.

## 2024-03-15 - ARIA Labels and Buttons
**Learning:** Adding `aria-label`s to standard `<button>` elements that already contain clear, identical visible text is an accessibility anti-pattern (it overrides the native text and can cause confusing double-announcements). Interactive card elements built from generic containers (like `<div>`s) need `role="button"` and `tabIndex={0}` to be accessible, but if they are already semantically `<button>` tags, adding `role="button"` is redundant and unnecessary. Adding `aria-hidden="true"` to decorative icons inside buttons is good practice to prevent redundant screen reader announcements.
**Action:** Before adding `aria-label`s, check if the button has visible descriptive text. If it does, rely on the native text. Ensure any interactive, clickable card element uses the correct semantic tags (`<button>`) or has `role="button"` and `tabIndex={0}` if using `<div>`, but don't mix them up. Only apply `aria-hidden="true"` to purely decorative elements like SVG icons inside accessible buttons.

## 2026-02-21 - Search Input Clear Button
**Learning:** Consistent search inputs (in TaskManager, NotesView) benefit from a UX pattern where a conditional "Clear" button appears when text is present. This button must restore focus to the input after clearing to maintain keyboard flow.
**Action:** Implement search inputs with a relative container, an absolute-positioned 'X' icon button (using `aria-label="Clear search"`), and use `useRef` to programmatically focus the input after clearing.
## 2025-02-28 - Focus-visible and Decorative Icons in TaskManager
**Learning:** Decorative icons (like those in export buttons or empty states) create redundant screen reader noise if not explicitly hidden. Interactive elements (buttons, filters) need `focus-visible` utility classes to clearly indicate keyboard focus without affecting mouse users. Empty states resulting from filtering need `role="status"` and `aria-live="polite"` to announce the state change.
**Action:** Always add `aria-hidden="true"` to purely decorative icons. Apply `focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2` to interactive elements to improve keyboard accessibility. Ensure dynamically filtered empty states use `role="status"` and `aria-live="polite"`.

## 2024-05-30 - Explicitly Labeling Mixed-Content Cards
**Learning:** Mixed-content navigation buttons (such as cards that display a combination of text, truncated descriptions, dates, and decorative icons) can be confusing or overly noisy for screen reader users if relying solely on their inner content.
**Action:** When implementing mixed-content buttons or cards (especially those acting as navigation links in lists), always explicitly provide a descriptive `aria-label` (e.g., `aria-label="Navigate to note [Title]"`) to provide clear, concise context and hide large decorative background icons with `aria-hidden="true"`.

## 2026-04-08 - Added focus-visible classes to buttons in Dashboard
**Learning:** Found multiple interactive `<button>` elements in the application, specifically the Dashboard, missing focus indicators. This makes keyboard navigation difficult.
**Action:** Always append the standard focus ring classes (`focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 focus-visible:outline-offset-2`) to all interactive elements to ensure clear keyboard accessibility.
