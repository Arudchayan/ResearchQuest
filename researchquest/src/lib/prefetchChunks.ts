const chunkImporters = [
  () => import("../components/dashboard/Dashboard"),
  () => import("../components/layout/CommandPalette"),
];

/**
 * Warm Dashboard and Command Palette after first paint.
 * Skipped entirely on data-saver connections; Notes/Focus chunks stay
 * on-demand so idle prefetch never competes with visible work. Runs only
 * while the page is visible, via idle time (fallback: short timeout).
 */
export function prefetchPlanChunks(): void {
  const connection =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { connection?: { saveData?: boolean } })
          .connection
      : undefined;
  if (connection?.saveData) {
    return;
  }
  const run = () => {
    if (typeof document !== "undefined" && document.hidden) {
      return;
    }
    for (const load of chunkImporters) {
      // Prefetch is best-effort: a stale chunk here rejects harmlessly and
      // the real navigation goes through lazyWithReload's auto-reload guard.
      void load().catch(() => {});
    }
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 4000 });
    return;
  }
  window.setTimeout(run, 1);
}
