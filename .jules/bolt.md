## 2025-04-04 - Pre-compute Searchable Text in React Components
**Learning:** In React components that render large lists and allow search filtering (like `LeftSidebar`), recalculating `.toLowerCase()` or `.join()` on every item inside the `.filter()` callback during keystrokes causes significant layout jank.
**Action:** Decouple the string transformation from the fast filtering loop by pre-computing a separate array of `searchableItems` wrapped in a `useMemo` hook that maps over the original data. The actual keystroke `filter` can then use these pre-computed string properties, operating near-instantly.

## 2025-04-07 - Pre-compute Searchable Text in React Components
**Learning:** In React components that render large lists and allow search filtering (like Notes, Papers, and Ideas views), recalculating `.toLowerCase()` or executing regular expressions on every item inside the `.filter()` callback during keystrokes causes significant layout jank.
**Action:** Decouple the string transformation from the fast filtering loop by pre-computing a separate array of `searchableItems` wrapped in a `useMemo` hook that maps over the original data. The actual keystroke `filter` can then use these pre-computed string properties, operating near-instantly.
