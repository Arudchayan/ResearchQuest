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

## 2025-05-25 - Parallelizing Independent Fetches
**Learning:** Sequential `await` calls for independent data (like related notes, papers, ideas) create a "waterfall" effect, significantly increasing latency.
**Action:** Use `Promise.all` to fetch independent resources concurrently. Verify parallelism with a test that mocks controlled promises and asserts all requests are initiated before any resolve.

## 2026-02-14 - Conditional Fetching for Hidden UI
**Learning:** Components hidden via CSS (e.g., sidebars with `w-0` or `opacity-0`) still mount and run effects, causing unnecessary data fetching.
**Action:** Pass an `enabled` prop (controlled by visibility state) to data fetching hooks to skip work when the component is hidden.

## 2026-02-14 - Efficient String Processing in Render
**Learning:** Repeatedly calling `split('\n')` on large strings in a list render loop (e.g., to derive a title) causes massive memory churn and CPU overhead (O(N*M) where N is list size and M is content length).
**Action:** Use a dedicated utility function (`deriveTitleFromMarkdown`) consistently everywhere throughout the app instead of inline `split('\n')` to ensure optimal performance when handling markdown strings.

## 2026-02-14 - Debouncing Expensive Previews
**Learning:** Real-time markdown previews (using `ReactMarkdown` or similar parsers) re-parse and re-render the entire document AST on every keystroke, causing significant input lag on large documents.
**Action:** Decouple the editor input state from the preview render state. Use a `useDebounce` hook (e.g., 300ms) to throttle updates to the heavy preview component while keeping the editor input responsive.

## 2026-02-14 - Redundant String Operations in Lists
**Learning:** Extracting derived content (like markdown previews or titles) inside a list item component forces heavy string parsing on every render of that component, which occurs on unrelated state changes (like hovering or selecting an item).
**Action:** Use `useMemo` to wrap derived string or markdown parsing operations inside list item components so they only run when the actual text content changes.

## 2024-05-24 - String.prototype.localeCompare on ISO Dates
**Learning:** Using `String.prototype.localeCompare()` to sort ISO-8601 date strings introduces significant, unnecessary overhead because `localeCompare` performs complex locale-aware collation rules that are completely redundant for predictable ISO strings.
**Action:** When sorting arrays by ISO-8601 date strings, always use direct lexicographical operators (`a > b ? 1 : a < b ? -1 : 0`) instead of `localeCompare()`.
## 2025-03-14 - Direct String Comparison for Lexicographical Sorting
**Learning:** `String.prototype.localeCompare()` is significantly slower than direct standard string comparison operators (`<`, `>`). While `localeCompare` handles localization and case-insensitivity depending on parameters, simple application-level UI sorting like lists or titles can be securely and significantly optimized using direct JS comparison if localization isn't strictly necessary.
**Action:** When implementing sort options for lists in React components like `PapersView` or `NotesView` where non-localized sorting is acceptable, prefer `(a || "") > (b || "") ? 1 : ((a || "") < (b || "") ? -1 : 0)` over `(a || "").localeCompare(b || "")` for improved sorting performance over large datasets.

## 2025-02-18 - Missing useShallow selector on useAppStore in High-level Components
**Learning:** High-level React components like `DataManagementDialog` and `TopicDetailView` were extracting multiple properties directly from the `useAppStore()` Zustand store without a selector. This anti-pattern causes the components to unnecessarily re-render whenever ANY property in the entire global store changes (even completely unrelated properties), which is particularly problematic for heavy dialogs or detail views.
**Action:** To prevent unnecessary re-renders in high-level components that depend on multiple properties from the Zustand store, always extract state using `useShallow` from `zustand/react/shallow` with an object selector.
