## 2024-05-23 - Conditional Filtering in React Lists
**Learning:** Large lists filtered in `useMemo` hooks can cause significant performance overhead if the filter logic runs even when the list is hidden.
**Action:** Always check if the consuming component is visible or if the list is needed before executing the filter logic inside `useMemo`. Add an early return if the list is not needed.

## 2024-05-23 - Redundant Client-Side Filtering
**Learning:** Chaining filters (e.g., Parent component filters -> Child component filters again) is a common anti-pattern that doubles iteration costs.
**Action:** When a child component receives an already filtered list, ensure its internal filtering is optimized to skip work (e.g., return the prop directly) when its own local filters are inactive.

## 2025-05-23 - Redundant Data Fetching with Sync Hooks
**Learning:** When a parent component already manages data lists (notes, papers, etc.), using a separate hook (`useFocusEntityCounts`) to fetch counts for those same lists results in redundant network requests and duplicate realtime subscriptions.
**Action:** Always check if the required data (or its derived stats like length) is already available in the parent component before introducing a new hook that fetches the same data. Pass the data down instead.

## 2025-05-23 - Stable Callbacks in Lists
**Learning:** Defining inline functions for event handlers (e.g., `onDelete`) in a list map loop defeats `React.memo` on child components because the function reference changes on every render.
**Action:** Extract list item handlers into a stable `useCallback` hook that accepts the item or ID as an argument, preserving referential equality for child props.

## 2025-05-23 - Date Object vs String Comparison in Sort
**Learning:** Using `new Date().getTime()` in sort comparators is significantly slower (~10x) than direct ISO string comparison. Parsing years with `parseInt(substr)` is ~5x faster than `new Date().getFullYear()`.
**Action:** When sorting by database timestamps (which are usually ISO strings), compare strings directly (`a > b ? 1 : -1`) instead of creating Date objects.
