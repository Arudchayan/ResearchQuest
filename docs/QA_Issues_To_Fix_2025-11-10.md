# QA Issues To Fix — 2025-11-10

> Status tracker for QA items from critical review.

## Access & Authentication
- [x] Add "Forgot password" link to login view.
- [x] Provide an SSO option (or document unavailability).
- [x] Expose a clear logout control in the UI header.

## Core Navigation and Dashboard
- [x] Improve active section indicator visibility for accessibility.
- [x] Ensure Focus Studio counts reflect latest notes/papers/ideas.

## Notes Module
- [x] Ensure note titles appear in Recent notes list.
- [x] Fix topic linking error (`user_id` column missing) for notes.
- [x] Implement working search for notes by title/content.
- [x] Replace browser confirm dialog with custom deletion modal (with undo).
- [x] Fix formatting toolbar actions and add tooltips.
- [x] Offer toggle between edit/preview instead of forced split.
- [x] Add keyboard shortcuts/accessibility improvements.

## Papers Module
- [x] Make "Add to library" button visible without extra scrolling.
- [x] Sync Focus Studio counts after paper changes.
- [x] Ensure DOI links open correctly in new tab.
- [x] Fix topic linking error for papers.
- [x] Improve readability of search results (spacing/typography).
- [x] Add progress indicator (e.g., progress bar/page count) for reading status.
- [x] Explain XP/gamification context in UI.

## Ideas Module
- [ ] Prevent title/description concatenation when creating ideas.
- [ ] Resolve mixed success/error when saving idea edits.
- [ ] Fix topic linking error for ideas.
- [ ] Add search/filtering for ideas list.
- [ ] Improve Kanban empty state guidance.
- [ ] Enlarge stage dropdown affordance in recent list.
- [ ] Enhance "Idea not found" error handling/redirect.

## Task Manager
- [ ] Allow toggling task completion on/off.
- [ ] Add delete confirmation and improve edit discoverability.
- [ ] Support sorting by due date or priority.
- [ ] Offer denser/compact list view option.
- [ ] Differentiate priority colors more clearly.

## Focus Studio
- [ ] Reduce cognitive load via collapsible panels/onboarding.
- [ ] Improve custom duration input affordance.
- [ ] Enhance session progress indicator visibility.

## Gamification & Feedback
- [ ] Explain XP levels, thresholds, and rewards in app.
- [ ] Prevent toast overlap and ensure timely dismissal.

## General
- [ ] Resolve topics schema `user_id` column issue globally.
- [ ] Ensure data consistency across modules (counts & statuses).
- [ ] Improve transactional integrity for idea saves.
- [ ] Enhance search highlighting across modules.
- [ ] Standardize icon styles and tooltips, add ARIA labels.
- [ ] Create onboarding/tutorial for new users.
- [ ] Ensure responsive layouts for smaller screens.
- [ ] Improve perceived performance with preloading/skeletons.
