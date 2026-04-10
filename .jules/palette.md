## 2024-05-18 - Ensure Screen Reader Announcements on Empty State Filtering
**Learning:** By default, when a dynamically filtered list (e.g. `NoteList`, `PaperList`) updates to have zero results due to search/filters, the empty state `div` that renders is silent to screen reader users, leaving them unaware the results are empty.
**Action:** Always wrap empty state components for filtered lists with `role="status"` and `aria-live="polite"` so screen readers proactively announce the lack of results (e.g. "No matches found. Try a different keyword.").
