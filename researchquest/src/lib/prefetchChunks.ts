const chunkImporters = [
  () => import("../components/notes/NotesView"),
  () => import("../components/focus/FocusWorkspace"),
  () => import("../components/dashboard/Dashboard"),
  () => import("../components/layout/CommandPalette"),
];

/** Warm Notes, Focus, Dashboard, and Command Palette after first paint. */
export function prefetchPlanChunks(): void {
  const run = () => {
    for (const load of chunkImporters) {
      void load();
    }
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 4000 });
    return;
  }
  window.setTimeout(run, 1);
}
