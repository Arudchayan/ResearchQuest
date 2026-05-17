## 2025-04-30 - Prevent Expensive Background Allocations in Tabbed Views
**Learning:** Components with multiple hidden or inactive tabbed views (e.g., `LeftSidebar.tsx`) can silently trigger expensive O(N) operations in `useMemo` hooks. If an operation maps over a large dataset and performs expensive string processing (like markdown extraction or `toLowerCase`), and lacks an early return for the current view state, it will execute and allocate memory even when its parent tab is inactive. This becomes a performance drain during high-frequency keystroke events or global store updates.
**Action:** Always include early returns based on visibility or active tab state (e.g., `if (currentView !== "tabName") return [];`) at the top of `useMemo` blocks that pre-compute mapping loops or search fields. Remember to include the view state variable in the dependency array to ensure the operation correctly fires when the user switches to that tab.

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

## 2025-04-11 - Pre-compute Searchable Text in React List Components
**Learning:** In React components rendering lists with search inputs (like IdeaList and TopicsView), computing `.toLowerCase()` inside the `.filter()` callback during keystrokes triggers O(N) string processing on every render, causing layout jank for large datasets.
**Action:** Always decouple string transformation from the fast filtering loop by pre-computing a separate array (e.g., `searchableItems`) using `useMemo` that maps the original data to its lowercase representation once. Crucially, optimize the `filteredItems` useMemo by adding an early return (e.g., `if (!query) return items;`) to bypass the `.filter().map()` iteration entirely when the search input is empty.
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

---

## Merged from `researchquest/.jules/bolt.md` (app-scoped journal)

# Bolt's Journal

## 2024-03-24 - Optimizing Zustand Selectors in Core Layout Components

**Learning:** Large React components (like `AppShell`, `Sidebar`, `RightSidebar`) that subscribe to the entire Zustand store via `useAppStore()` will re-render on EVERY state change, even if the data they need hasn't changed. This is particularly impactful when the store updates frequently (e.g., during text input in `MarkdownEditor` which updates `selectedNote`).

**Action:** Always use granular selectors when subscribing to Zustand stores in high-level layout components or heavy components to prevent unnecessary re-renders. Use `useAppStore(state => state.specificValue)` instead of `const { specificValue } = useAppStore()`.

## 2026-03-24 - Optimizing Zustand Selectors in Core Hooks and Components
**Learning:** Subscribing to the entire Zustand store via `useAppStore()` in central hooks like `useDataSync` or root components like `App` triggers unnecessary evaluations and re-renders on EVERY state change (such as text input in a sub-component).
**Action:** Always use granular selectors (e.g., `useAppStore(useShallow(state => ({ ... })))`) when extracting multiple properties from the store to prevent performance degradation.

## 2024-03-24 - Optimizing Array.prototype.find in Animation Frames
**Learning:** Using `Array.prototype.find()` inside high-frequency animation loops like `requestAnimationFrame` (e.g., iterating over edges to find target nodes) causes `O(N*M)` complexity and layout jank, as the full array is scanned repeatedly 60 times per second.
**Action:** Always pre-compute a `Map` lookup object (e.g., `new Map(items.map(i => [i.id, i]))`) immediately before loops or inside the animation frame to reduce lookups from `O(N)` to `O(1)`.

## 2026-04-30 - Pre-computing Aggregates Avoids Filter Loop Overheads
**Learning:** Computing multiple aggregate statistics by chaining multiple `.filter().length` calls during React renders allocates throwaway intermediate arrays and forces multiple O(N) passes, creating performance overhead.
**Action:** When calculating multiple statistics from a single array (e.g., pending and completed counts), compute all values in a single O(N) pass using a `for` loop inside a `useMemo` block.

## 2025-04-28 - Optimize aggregate statistics calculations

**Learning:** When components calculate multiple aggregate statistics from a single array (e.g., counting pending and completed tasks), chaining multiple `.filter().length` calls creates unnecessary intermediate arrays and triggers redundant iterations during render.
**Action:** Compute all aggregates in a single O(N) pass inside a `useMemo` block using a for-loop. This significantly reduces allocations and iteration overhead.

## 2024-05-18 - Avoid View/Tab State in Data Memoization
**Learning:** Adding active UI state (like `currentView`) to the dependency array of data transformation `useMemo` hooks is an anti-pattern. While it seems like a way to prevent allocations when a tab is hidden by using an early return, it causes a severe performance regression by forcing the entire dataset (e.g., Markdown parsing for searchable notes) to be synchronously re-calculated from scratch every single time the user switches back to that tab.
**Action:** Memoization arrays for data should strictly depend on the underlying data itself (e.g., `notes`), decoupling expensive string and text transformations from fast UI interactions like tab switching or keystroke filtering.

## 2024-05-18 - Deduplicate Aggregate Computations
**Learning:** Computing the same aggregate statistics (e.g., counting pending and completed tasks) in multiple separate `useMemo` blocks within the same component unnecessarily repeats O(N) loops.
**Action:** Always compute related aggregate statistics in a single O(N) pass inside a single `useMemo` block, and reuse the resulting variables throughout the component to eliminate duplicate work.

## 2024-05-05 - Fix useMemo fast-path matching for sortOption
**Learning:** When implementing early return fast paths in `useMemo` filter blocks, the condition must exactly match the default initial state (e.g., `sortOption === "updated_desc"`). If it checks for an incorrect value (like `"name_asc"` when the default is `"updated_desc"`), the optimization is bypassed on initial render, leading to unnecessary operations like O(N log N) sorting.
**Action:** When adding or verifying `useMemo` fast paths that check state variables, trace the state variable back to its `useState` initialization to ensure the fast path correctly captures the default state.
## 2026-05-07 - Fix useMemo dependency invalidation on tab switches
**Learning:** Adding active UI state (like `currentView`) to `useMemo` dependencies or early returns for data transformations (like searchable text arrays) is an anti-pattern. It causes synchronous recalculation of the whole array when switching tabs, hurting performance. Memoization should depend strictly on the underlying data.
**Action:** Remove active UI view state dependencies from `useMemo` hooks and keep memoized lists cached across tab switches.
<<<<<<< HEAD

## 2026-05-08 - Optimize Idea Stage Bucketing
**Learning:** Chaining `.filter().sort()` for each stage in an array created an $O(S \times N)$ operation that iterated and created intermediate arrays repeatedly.
**Action:** Replace multiple filters inside a reduce with a single $O(N)$ pass (`for` loop) that groups items into buckets, and then sort the individual buckets afterwards, significantly reducing memory allocation and iteration time.
=======
## 2026-05-17 - Optimize array bucketing with single-pass loops
**Learning:** Using `Array.prototype.reduce` alongside inner `Array.prototype.filter` calls inside `useMemo` for bucketing data (like categorizing ideas by stage) creates O(M*N) time complexity and redundant array allocations. Additionally, deriving subsequent counts via `.filter().length` on the original array repeats O(N) iterations unnecessarily.
**Action:** Replace `reduce` and `filter` with a single-pass `for` loop to distribute items into buckets. Then, derive subsequent aggregations (like `activeCount`) directly in O(1) time by summing the lengths of the pre-computed buckets.
>>>>>>> 610850f (perf(ideas): optimize stage bucketing with single-pass loop)
