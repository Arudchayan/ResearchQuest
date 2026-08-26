import type { Paper, Idea, Note, TopicWithCounts, Task } from "../types/database";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type AppView =
  | "dashboard"
  | "notes"
  | "papers"
  | "ideas"
  | "tasks"
  | "focus"
  | "topics"
  | "feeds";

/** Every valid top-level view name. */
export const VALID_VIEWS: readonly AppView[] = [
  "dashboard",
  "notes",
  "papers",
  "ideas",
  "tasks",
  "topics",
  "focus",
  "feeds",
] as const;

/** Views that support deep-link item selection via `/[view]/[itemId]`. */
export const ENTITY_VIEWS: readonly AppView[] = [
  "papers",
  "ideas",
  "notes",
  "topics",
  "tasks",
] as const;

// ---------------------------------------------------------------------------
// ParsedRoute
// ---------------------------------------------------------------------------

export interface ParsedRoute {
  /** The recognised view name, or `null` when the path is not a valid route. */
  view: AppView | null;
  /** Optional item id segment (second path component). */
  itemId: string | null;
  /** `true` when the path matched a known view. */
  isValid: boolean;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Parse a URL pathname into a typed `ParsedRoute`.
 *
 * Examples:
 * ```
 * parseRoute("/")        → { view: "dashboard", itemId: null, isValid: true }
 * parseRoute("/notes")   → { view: "notes",     itemId: null, isValid: true }
 * parseRoute("/papers/x") → { view: "papers",   itemId: "x",  isValid: true }
 * parseRoute("/unknown") → { view: null,        itemId: null, isValid: false }
 * ```
 */
export function parseRoute(path: string): ParsedRoute {
  const normalized = path.startsWith("/") ? path.slice(1) : path;

  if (normalized === "") {
    return { view: "dashboard", itemId: null, isValid: true };
  }

  const parts = normalized.split("/");
  const viewStr = parts[0];
  const itemId = parts[1] ?? null;

  if (viewStr && isValidView(viewStr)) {
    return { view: viewStr, itemId, isValid: true };
  }

  return { view: null, itemId: null, isValid: false };
}

/** Type guard — returns `true` when `view` is one of the recognised view names. */
export function isValidView(view: string): view is AppView {
  return (VALID_VIEWS as readonly string[]).includes(view);
}

// ---------------------------------------------------------------------------
// Selection hydration (deep-link entity resolution)
// ---------------------------------------------------------------------------

export interface RouteDataSnapshot {
  papers: Paper[];
  papersLoading: boolean;
  ideas: Idea[];
  ideasLoading: boolean;
  notes: Note[];
  notesLoading: boolean;
  topics: Record<string, TopicWithCounts>;
  topicsLoading: boolean;
  tasks: Task[];
  tasksLoading: boolean;
}

export interface RouteSelectionSetters {
  setSelectedPaper: (p: Paper | null) => void;
  setSelectedIdea: (i: Idea | null) => void;
  setSelectedNote: (n: Note | null) => void;
  setSelectedTopic: (t: TopicWithCounts | null) => void;
  setSelectedTask: (t: Task | null) => void;
}

/**
 * Attempt to select (hydrate) the entity referenced by a deep-link route once
 * the relevant data has finished loading.
 *
 * **Contract:**
 * 1. If the route has no `itemId`, or is invalid, this is a no-op.
 * 2. If the relevant data is still loading, the function returns early (the
 *    caller must re-invoke when loading finishes).
 * 3. When data is ready and the item is found, the corresponding setter is
 *    called with the entity.
 * 4. When data is ready and the item is **not** found, the setter is called
 *    with `null` — ensuring stale selections are cleared.
 *
 * This is a **pure function** (takes data + setters) so it can be tested
 * without a React environment.
 */
export function selectEntityForRoute(
  route: ParsedRoute,
  data: RouteDataSnapshot,
  setters: RouteSelectionSetters,
): void {
  if (!route.isValid || !route.itemId || !route.view) return;

  const { view, itemId } = route;

  switch (view) {
    case "papers": {
      if (data.papersLoading) return;
      setters.setSelectedPaper(
        data.papers.find((p) => p.id === itemId) ?? null,
      );
      break;
    }
    case "ideas": {
      if (data.ideasLoading) return;
      setters.setSelectedIdea(
        data.ideas.find((i) => i.id === itemId) ?? null,
      );
      break;
    }
    case "notes": {
      if (data.notesLoading) return;
      setters.setSelectedNote(
        data.notes.find((n) => n.id === itemId) ?? null,
      );
      break;
    }
    case "topics": {
      if (data.topicsLoading) return;
      setters.setSelectedTopic(data.topics[itemId] ?? null);
      break;
    }
    case "tasks": {
      if (data.tasksLoading) return;
      setters.setSelectedTask(
        data.tasks.find((t) => t.id === itemId) ?? null,
      );
      break;
    }
    // dashboard, focus — no item-level selection
  }
}
