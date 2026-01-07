## 2024-05-23 - Conditional Filtering in React Lists
**Learning:** Large lists filtered in `useMemo` hooks can cause significant performance overhead if the filter logic runs even when the list is hidden.
**Action:** Always check if the consuming component is visible or if the list is needed before executing the filter logic inside `useMemo`. Add an early return if the list is not needed.

## 2024-05-23 - Redundant Client-Side Filtering
**Learning:** Chaining filters (e.g., Parent component filters -> Child component filters again) is a common anti-pattern that doubles iteration costs.
**Action:** When a child component receives an already filtered list, ensure its internal filtering is optimized to skip work (e.g., return the prop directly) when its own local filters are inactive.

## 2025-05-23 - Redundant Data Fetching with Sync Hooks
**Learning:** When a parent component already manages data lists (notes, papers, etc.), using a separate hook (`useFocusEntityCounts`) to fetch counts for those same lists results in redundant network requests and duplicate realtime subscriptions.
**Action:** Always check if the required data (or its derived stats like length) is already available in the parent component before introducing a new hook that fetches the same data. Pass the data down instead.
