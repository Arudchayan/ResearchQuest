## 2024-04-08 - ISO Date String Comparison Optimization
**Learning:** Instantiating Date objects (e.g. `parseDateInput(due_date)?.getTime()`) inside `Array.prototype.sort()` callbacks is extremely expensive and causes performance bottlenecks, especially with large lists like tasks. ISO-8601 formatted date strings (YYYY-MM-DD) are naturally sortable lexicographically.
**Action:** Always use direct string comparison (`a > b ? 1 : -1`) for ISO date strings inside sort callbacks instead of parsing them into Date objects. Use a high/low string fallback like `"9999-12-31"` for missing dates to maintain `Infinity` placement behavior.

## 2024-05-24 - O(N) to O(1) Gamification Math Calculation
**Learning:** Gamification logic for calculating level thresholds via linear iteration (`while (totalXP >= xpNeeded)`) caused significant execution slowdowns on large amounts of XP.
**Action:** Replace iterative calculations matching linear formulas like $y = m*x$ with derived inverse formulas $x = y/m$. In this codebase, leveling logic uses $O(1)$ calculations (`Math.floor(totalXP / 500) + 1`).

## 2025-04-04 - Pre-compute Searchable Text in React Components
**Learning:** In React components that render large lists and allow search filtering (like `LeftSidebar`), recalculating `.toLowerCase()` or `.join()` on every item inside the `.filter()` callback during keystrokes causes significant layout jank.
**Action:** Decouple the string transformation from the fast filtering loop by pre-computing a separate array of `searchableItems` wrapped in a `useMemo` hook that maps over the original data. The actual keystroke `filter` can then use these pre-computed string properties, operating near-instantly.

## 2025-04-07 - Pre-compute Searchable Text in React Components
**Learning:** In React components that render large lists and allow search filtering (like Notes, Papers, and Ideas views), recalculating `.toLowerCase()` or executing regular expressions on every item inside the `.filter()` callback during keystrokes causes significant layout jank.
**Action:** Decouple the string transformation from the fast filtering loop by pre-computing a separate array of `searchableItems` wrapped in a `useMemo` hook that maps over the original data. The actual keystroke `filter` can then use these pre-computed string properties, operating near-instantly.

## 2024-04-15 - Prevent layout jank in animation loops by pre-computing Map lookups
**Learning:** Avoid using Array.prototype.find() or creating new Map objects inside high-frequency animation loops (like tick() or requestAnimationFrame), as this causes per-frame memory allocation and garbage collection overhead.
**Action:** Always pre-compute Map lookups outside the loop to reduce O(N x M) complexity to O(N + M) and eliminate garbage collection spikes during layout/animation calculations.
## 2024-04-17 - React Filter Loop Allocations
**Learning:** Instantiating new data structures like `new Set` inside a high-frequency `useMemo` filter path (especially for keystroke searches) creates unnecessary object allocations and leads to O(M) operations per filter item inside an O(N) loop.
**Action:** Always filter the pre-computed text array directly, without executing cross-reference lookups or instantiating Sets mid-loop, and then `.map()` back to the object instances.
## 2025-04-10 - Array.prototype.find() vs Map for Lookup Performance
**Learning:** Using `Array.prototype.find()` inside a loop or for repeated lookups creates $O(N)$ or $O(N \times M)$ time complexity, which scales poorly.
**Action:** Replace `Array.prototype.find()` with `Map.prototype.get()` when multiple lookups are performed on the same dataset, reducing time complexity to $O(1)$ per lookup after an initial $O(N)$ map creation.
## 2025-04-16 - Pre-compute Searchable Text Array Avoid Intermediate Allocations
**Learning:** When optimizing React search filters by pre-computing searchable text arrays with `useMemo`, allocating intermediate structures like `new Set()` or executing cross-referencing lookups (e.g., `validTopicIds.has(st.topic.id)`) inside the high-frequency keystroke filter loop severely degrades performance and creates massive memory pressure.
**Action:** Instead, directly filter the pre-computed array based on the text criteria, then immediately `.map()` back to the original objects. Keep the fast path strictly O(N) string comparisons without intermediate structural allocations to prevent layout jank during keystrokes.
## 2025-04-18 - Schwartzian Transform for Complex Sorting
**Learning:** To optimize sorting performance for lists of entities, use direct string comparison for strictly uniform ISO date strings instead of instantiating `Date` objects inside the `.sort()` callback. However, if date formats might be non-uniform or require parsing, do not bypass the parser; instead, implement a Schwartzian transform (decorate-sort-undecorate) to pre-parse the dates exactly once in an O(N) mapping step prior to the O(N log N) sort.
**Action:** Always extract expensive functions (like `parseDateInput`) from inside `.sort()` comparators. Map the array to include the computed comparable values, sort the mapped array, and then map back to the original objects.
## 2025-04-20 - Early Return in useMemo Filter Loops
**Learning:** In React components that render large lists (like `TopicsView`), executing an empty `.filter().map()` chain or sorting operations when no search/sort overrides are active consumes unnecessary CPU cycles and triggers array allocations.
**Action:** Always include an early return (skip condition) in the `useMemo` filter block. If the search query is empty, no hidden constraints apply, and the active sort matches the default, return the original data array (`topics || []`) directly rather than executing an O(N) chain.
