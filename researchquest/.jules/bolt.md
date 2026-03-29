# Bolt's Journal

## 2024-03-24 - Optimizing Zustand Selectors in Core Layout Components

**Learning:** Large React components (like `AppShell`, `Sidebar`, `RightSidebar`) that subscribe to the entire Zustand store via `useAppStore()` will re-render on EVERY state change, even if the data they need hasn't changed. This is particularly impactful when the store updates frequently (e.g., during text input in `MarkdownEditor` which updates `selectedNote`).

**Action:** Always use granular selectors when subscribing to Zustand stores in high-level layout components or heavy components to prevent unnecessary re-renders. Use `useAppStore(state => state.specificValue)` instead of `const { specificValue } = useAppStore()`.

## 2026-03-24 - Optimizing Zustand Selectors in Core Hooks and Components
**Learning:** Subscribing to the entire Zustand store via `useAppStore()` in central hooks like `useDataSync` or root components like `App` triggers unnecessary evaluations and re-renders on EVERY state change (such as text input in a sub-component).
**Action:** Always use granular selectors (e.g., `useAppStore(useShallow(state => ({ ... })))`) when extracting multiple properties from the store to prevent performance degradation.
