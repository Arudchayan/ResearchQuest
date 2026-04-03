## 2024-03-01 - Fast Path for String Date parsing
**Learning:** Calling `new Date(string).getFullYear()` is an expensive operation because full JavaScript date parsing logic is invoked. For strings that are mostly predictably formatted like ISO dates or just the year "YYYY", using `.charCodeAt()` directly to verify if the first 4 characters are digits is nearly ~2x faster than relying entirely on `new Date()`.
**Action:** When repeatedly extracting patterns (like years) from strings, implement a fast-path fallback using `.charCodeAt()` or basic string length checks to early-return before falling back to heavy APIs like `new Date()` or `RegExp`.

## 2024-03-23 - Suboptimal Array Lookup in Loop
**Learning:** Performing `Array.prototype.find()` operations within a loop checking large global store array slices against smaller result arrays can cause an exponential O(N*M) slowdown, significantly impacting main thread performance.
**Action:** When filtering or hydrating relationships between a smaller ID-based list and a larger main collection (e.g. looking up paper objects for related item IDs), convert the target array into a `Map` structure upfront to allow O(1) lookups, changing the complexity to O(N+M).

## 2024-05-18 - Promise caching prevents thundering herd for concurrent DB checks
**Learning:** Initializing state hooks in multiple components concurrently (like `useTopics`) caused duplicate execution of `tableSupportsUserId`, sending multiple identical metadata DB queries because the simple boolean cache was only updated after the first await resolved.
**Action:** Always cache the in-flight `Promise` itself rather than just the final boolean value when caching asynchronous operations that may be triggered concurrently. This allows concurrent callers to await the single existing promise, drastically reducing database calls (from 15 to 3 in benchmarks).

## 2024-05-19 - O(N*M) Suboptimal Array Lookup in Loop
**Learning:** Using `Array.prototype.find()` inside a loop over related items (like in `useRelatedItems.ts`) causes O(N*M) time complexity, leading to massive hydration slow-downs for large data sets.
**Action:** Always pre-compute a lookup Map (e.g., `new Map(items.map(item => [item.id, item]))`) before iterating through relational connections to reduce the complexity to O(N+M).

## 2024-05-23 - Conditional Filtering in React Lists
**Learning:** Large lists filtered in `useMemo` hooks can cause significant performance overhead if the filter logic runs even when the list is hidden.
**Action:** Always check if the consuming component is visible or if the list is needed before executing the filter logic inside `useMemo`. Add an early return if the list is not needed.

## 2024-05-23 - Redundant Client-Side Filtering
**Learning:** Chaining filters (e.g., Parent component filters -> Child component filters again) is a common anti-pattern that doubles iteration costs.
**Action:** When a child component receives an already filtered list, ensure its internal filtering is optimized to skip work (e.g., return the prop directly) when its own local filters are inactive.

## 2024-05-24 - String.prototype.localeCompare on ISO Dates
**Learning:** Using `String.prototype.localeCompare()` to sort ISO-8601 date strings introduces significant, unnecessary overhead because `localeCompare` performs complex locale-aware collation rules that are completely redundant for predictable ISO strings.
**Action:** When sorting arrays by ISO-8601 date strings, always use direct lexicographical operators (`a > b ? 1 : a < b ? -1 : 0`) instead of `localeCompare()`.

## 2025-02-18 - Missing useShallow selector on useAppStore in High-level Components
**Learning:** High-level React components like `DataManagementDialog` and `TopicDetailView` were extracting multiple properties directly from the `useAppStore()` Zustand store without a selector. This anti-pattern causes the components to unnecessarily re-render whenever ANY property in the entire global store changes (even completely unrelated properties), which is particularly problematic for heavy dialogs or detail views.
**Action:** To prevent unnecessary re-renders in high-level components that depend on multiple properties from the Zustand store, always extract state using `useShallow` from `zustand/react/shallow` with an object selector.

## 2025-03-14 - Direct String Comparison for Lexicographical Sorting
**Learning:** `String.prototype.localeCompare()` is significantly slower than direct standard string comparison operators (`<`, `>`). While `localeCompare` handles localization and case-insensitivity depending on parameters, simple application-level UI sorting like lists or titles can be securely and significantly optimized using direct JS comparison if localization isn't strictly necessary.
**Action:** When implementing sort options for lists in React components like `PapersView` or `NotesView` where non-localized sorting is acceptable, prefer `(a || "") > (b || "") ? 1 : ((a || "") < (b || "") ? -1 : 0)` over `(a || "").localeCompare(b || "")` for improved sorting performance over large datasets.

## 2025-05-23 - Redundant Data Fetching with Sync Hooks
**Learning:** When a parent component already manages data lists (notes, papers, etc.), using a separate hook (`useFocusEntityCounts`) to fetch counts for those same lists results in redundant network requests and duplicate realtime subscriptions.
**Action:** Always check if the required data (or its derived stats like length) is already available in the parent component before introducing a new hook that fetches the same data. Pass the data down instead.

## 2025-05-23 - Stable Callbacks in Lists
**Learning:** Defining inline functions for event handlers (e.g., `onDelete`) in a list map loop defeats `React.memo` on child components because the function reference changes on every render.
**Action:** Extract list item handlers into a stable `useCallback` hook that accepts the item or ID as an argument, preserving referential equality for child props.

## 2025-05-23 - Date Object vs String Comparison in Sort
**Learning:** Using `new Date().getTime()` in sort comparators is significantly slower (~10x) than direct ISO string comparison. Parsing years with `parseInt(substr)` is ~5x faster than `new Date().getFullYear()`.
**Action:** When sorting by database timestamps (which are usually ISO strings), compare strings directly (`a > b ? 1 : -1`) instead of creating Date objects.

## 2025-05-24 - Breaking Dependency Chains in List Callbacks
**Learning:** If a callback passed to every item in a list depends on a frequently changing global state (like `selectedId`), it breaks `React.memo` for ALL items whenever that state changes, causing O(N) re-renders.
**Action:** Use `store.getState()` (or refs) to access the current value of the volatile state inside the callback without adding it to the dependency array, ensuring the callback remains stable.

## 2025-05-24 - Safe Conditional Filtering with Sort
**Learning:** Optimizing list filtering by returning the original array when filters are empty can lead to store mutations if `.sort()` is called on the returned array, as `.sort()` mutates in place.
**Action:** When skipping filtering but still sorting, always create a shallow copy (`[...array]`) before calling `.sort()` to preserve the immutability of the source data (e.g., from a Zustand store).

## 2025-05-24 - Decoupling Fetch and Hydration
**Learning:** Hooks that both fetch data (network) and hydrate it with store data (memory) in a single effect will re-trigger network requests whenever the store updates, even if the network data is unchanged.
**Action:** Split the logic into two effects: one for fetching IDs (dependent only on entity ID) and one for hydrating full objects (dependent on store data). Use `useMemo` for the hydration step to keep it cheap.

## 2025-05-24 - Redundant Helper Fetches
**Learning:** Helper functions (like `awardXP` calling `updateDailyLog`) that independently re-fetch the same entity (e.g., user profile) cause N+1 performance issues on the client.     
**Action:** Refactor helper functions to accept the required data (e.g., `streak`) as arguments instead of fetching it again. Consolidate updates into a single database call where possible.

## 2025-05-24 - Pre-computing Lookups for Nested Lists
**Learning:** Using `.find()` inside a `map` loop (e.g. `selectedIds.map(id => topics.find(t => t.id === id))`) causes O(N*M) performance bottlenecks during React rendering, particularly when dealing with long relational lists.
**Action:** When mapping over lists of IDs to hydrate components, always pre-compute a lookup Map (`const map = new Map(items.map(i => [i.id, i]))`) using `useMemo` and use `.get()` to achieve O(N+M) time complexity.

## 2025-05-25 - Missing useShallow selector on useAppStore in High-level App Components
**Learning:** High-level React components like `App` extract properties directly from the `useAppStore()` Zustand store without a selector. This anti-pattern causes the entire App to unnecessarily re-render whenever ANY property in the global store changes (even unrelated properties like search queries or list updates), leading to massive performance regressions across the entire application.
**Action:** Always extract state using `useShallow` from `zustand/react/shallow` with an object selector in top-level components like `App` that depend on multiple properties from the Zustand store.

## 2025-05-25 - Parallelizing Independent Fetches
**Learning:** Sequential `await` calls for independent data (like related notes, papers, ideas) create a "waterfall" effect, significantly increasing latency.
**Action:** Use `Promise.all` to fetch independent resources concurrently. Verify parallelism with a test that mocks controlled promises and asserts all requests are initiated before any resolve.

## 2025-05-26 - Defeating useMemo with Unmemoized Dependencies
**Learning:** Creating a derived array directly in the render body (e.g., `const filteredTasks = tasks.filter(...)`) and then passing it as a dependency to a `useMemo` hook (e.g., `const sortedTasks = useMemo(..., [filteredTasks])`) completely defeats the purpose of memoization. Because the derived array is recreated on every render, its referential identity changes, causing the `useMemo` to re-execute entirely on every unrelated state update (such as typing in an input field).
**Action:** Always encapsulate chained data transformations (like filtering and then sorting) into a single `useMemo` hook, or ensure that all intermediate derived arrays passed as dependencies are themselves properly memoized.

## 2026-02-14 - Conditional Fetching for Hidden UI
**Learning:** Components hidden via CSS (e.g., sidebars with `w-0` or `opacity-0`) still mount and run effects, causing unnecessary data fetching.
**Action:** Pass an `enabled` prop (controlled by visibility state) to data fetching hooks to skip work when the component is hidden.

## 2026-02-14 - Efficient String Processing in Render
**Learning:** Repeatedly calling `split('\n')` on large strings in a list render loop (e.g., to derive a title) causes massive memory churn and CPU overhead (O(N*M) where N is list size and M is content length).
**Action:** Use a dedicated utility function that iterates to find the first line without splitting the entire string.

## 2026-02-14 - Debouncing Expensive Previews
**Learning:** Real-time markdown previews (using `ReactMarkdown` or similar parses) re-parse and re-render the entire document AST on every keystroke, causing significant input lag on large documents.
**Action:** Decouple the editor input state from the preview render state. Use a `useDebounce` hook (e.g., 300ms) to throttle updates to the heavy preview component while keeping the editor input responsive.

## 2026-02-14 - Redundant String Operations in Lists
**Learning:** Extracting derived content (like markdown previews or titles) inside a list item component forces heavy string parsing on every render of that component, which occurs on unrelated state changes (like hovering or selecting an item).
**Action:** Use `useMemo` to wrap derived string or markdown parsing operations inside list item components so they only run when the actual text content changes.

## 2026-03-03 - targeted performance optimizations
**Learning:** When performing targeted enhancements (e.g., performance optimizations or accessibility fixes), strictly isolate the changes. Bundling unrelated backend logic changes, security fixes, or regex optimizations into the same commit pollutes the commit history and violates strict task boundaries.
**Action:** Do not include unrelated fixes, scratchpads, or diagnostic scripts in the final submitted patch. Always revert unrelated files and delete temporary scripts before verifying and submitting the single targeted improvement.

## 2026-04-01 - Pre-computing String Parsing for Keystroke Filters
**Learning:** Implementing real-time keystroke-driven search filters on complex lists by computing derived properties (like extracting markdown titles or doing `.toLowerCase()`) inside the filter loop causes high CPU overhead and blocks the main thread.
**Action:** Pre-compute and memoize expensive derived searchable text into a separate `useMemo` hook that maps over the list only when the data changes, decoupling heavy string operations from the fast filtering loop.
## 2024-04-02 - Batched Independent Promise Chaining for Topic Associations
**Learning:** Sequential `Promise.all` blocks waiting for multiple independent entity arrays to resolve before moving to the next `Promise.all` stage (e.g. fetching IDs, then fetching detail rows) creates artificial sequential bottlenecks. Chaining the two promises per entity independently and awaiting them in one `Promise.all` resolves latency far faster since the row query starts immediately after its respective ID query finishes.
**Action:** Use batched independent `Promise.all` chains when fetching multi-staged data across disparate database tables.
