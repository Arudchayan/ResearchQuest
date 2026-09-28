import type { AppView } from "./router";

export type ViewedEntityKind = "note" | "paper" | "idea";

export interface ViewedEntityRef {
  id: string;
  type: ViewedEntityKind;
}

interface SelectedEntities {
  note: { id: string } | null;
  paper: { id: string } | null;
  idea: { id: string } | null;
}

function firstSelected(selected: SelectedEntities): ViewedEntityRef | null {
  if (selected.note) return { id: selected.note.id, type: "note" };
  if (selected.paper) return { id: selected.paper.id, type: "paper" };
  if (selected.idea) return { id: selected.idea.id, type: "idea" };
  return null;
}

/**
 * Notes, papers, and ideas keep independent selected* slots. Backlinks must
 * follow the current view so a leftover note cannot win on a papers route.
 */
export function resolveViewedEntity(
  currentView: AppView,
  selected: SelectedEntities,
): ViewedEntityRef | null {
  switch (currentView) {
    case "notes":
      return selected.note ? { id: selected.note.id, type: "note" } : null;
    case "papers":
      return selected.paper ? { id: selected.paper.id, type: "paper" } : null;
    case "ideas":
      return selected.idea ? { id: selected.idea.id, type: "idea" } : null;
    case "dashboard":
    case "tasks":
    case "topics":
    case "feeds":
    case "focus":
      return firstSelected(selected);
    default: {
      const _exhaustive: never = currentView;
      return _exhaustive;
    }
  }
}
