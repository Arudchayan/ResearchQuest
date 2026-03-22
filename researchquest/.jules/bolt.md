# Bolt's Journal

## 2024-03-24 - Optimizing Zustand Selectors in Core Layout Components

**Learning:** Large React components (like `AppShell`, `Sidebar`, `RightSidebar`) that subscribe to the entire Zustand store via `useAppStore()` will re-render on EVERY state change, even if the data they need hasn't changed. This is particularly impactful when the store updates frequently (e.g., during text input in `MarkdownEditor` which updates `selectedNote`).

**Action:** Always use granular selectors when subscribing to Zustand stores in high-level layout components or heavy components to prevent unnecessary re-renders. Use `useAppStore(state => state.specificValue)` instead of `const { specificValue } = useAppStore()`.

## 2024-03-24 - Optimizing Zustand Selectors in Custom Hooks

**Learning:** Just like high-level React components, custom hooks (such as `useDataSync`) that subscribe to the Zustand store using default destructuring (e.g., `const { ... } = useAppStore()`) will trigger re-renders or re-evaluations whenever *any* unrelated state in the store changes. This compounds performance issues when these hooks are used in root components like `App`.
**Action:** Always use `useShallow` with an object selector when extracting multiple properties from a Zustand store inside custom data-fetching or syncing hooks to maintain referential equality and prevent unnecessary re-evaluations.
