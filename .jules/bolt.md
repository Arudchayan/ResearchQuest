## 2025-04-04 - Pre-compute Searchable Text in React Components
**Learning:** In React components that render large lists and allow search filtering (like `LeftSidebar`), recalculating `.toLowerCase()` or `.join()` on every item inside the `.filter()` callback during keystrokes causes significant layout jank.
**Action:** Decouple the string transformation from the fast filtering loop by pre-computing a separate array of `searchableItems` wrapped in a `useMemo` hook that maps over the original data. The actual keystroke `filter` can then use these pre-computed string properties, operating near-instantly.

## 2025-04-07 - Pre-compute Searchable Text in React Components
**Learning:** In React components that render large lists and allow search filtering (like Notes, Papers, and Ideas views), recalculating `.toLowerCase()` or executing regular expressions on every item inside the `.filter()` callback during keystrokes causes significant layout jank.
**Action:** Decouple the string transformation from the fast filtering loop by pre-computing a separate array of `searchableItems` wrapped in a `useMemo` hook that maps over the original data. The actual keystroke `filter` can then use these pre-computed string properties, operating near-instantly.

## 2024-04-08 - ISO Date String Comparison Optimization
**Learning:** Instantiating Date objects (e.g. `parseDateInput(due_date)?.getTime()`) inside `Array.prototype.sort()` callbacks is extremely expensive and causes performance bottlenecks, especially with large lists like tasks. ISO-8601 formatted date strings (YYYY-MM-DD) are naturally sortable lexicographically.
**Action:** Always use direct string comparison (`a > b ? 1 : -1`) for ISO date strings inside sort callbacks instead of parsing them into Date objects. Use a high/low string fallback like `"9999-12-31"` for missing dates to maintain `Infinity` placement behavior.

## 2025-04-10 - Array.prototype.find() vs Map for Lookup Performance
**Learning:** Using `Array.prototype.find()` inside a loop or for repeated lookups creates $O(N)$ or $O(N \times M)$ time complexity, which scales poorly.
**Action:** Replace `Array.prototype.find()` with `Map.prototype.get()` when multiple lookups are performed on the same dataset, reducing time complexity to $O(1)$ per lookup after an initial $O(N)$ map creation.
