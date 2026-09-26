const KEEP_ALIVE_VIEWS = ["notes", "focus"] as const;

export type KeepAliveView = (typeof KEEP_ALIVE_VIEWS)[number];

export function isKeepAliveView(view: string): view is KeepAliveView {
  return (KEEP_ALIVE_VIEWS as readonly string[]).includes(view);
}

/** After the user visits Notes or Focus, keep the pane mounted while hidden. */
export function recordKeepAliveVisit(
  visited: ReadonlySet<string>,
  view: string,
): Set<string> {
  if (!isKeepAliveView(view) || visited.has(view)) {
    return visited instanceof Set ? visited : new Set(visited);
  }
  const next = new Set(visited);
  next.add(view);
  return next;
}

export function shouldMountKeepAlive(
  view: KeepAliveView,
  currentView: string,
  visited: ReadonlySet<string>,
): boolean {
  return currentView === view || visited.has(view);
}

export function isKeepAliveVisible(
  view: KeepAliveView,
  currentView: string,
): boolean {
  return currentView === view;
}
