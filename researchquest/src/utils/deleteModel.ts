/**
 * Single delete model (plan item 56).
 *
 * - Single-item deletes use toast-undo (`useUndoDelete` or the per-view
 *   equivalent); the dialog copy below names the item and states the undo
 *   window so the Confirm never promises something the flow cannot do.
 * - Bulk-destructive deletes (e.g. Data & Backup "clear all") have no undo
 *   path and MUST use a Confirm dialog with the "cannot be undone" copy.
 *
 * This module unifies copy only. Execution paths stay per-entity (delete +
 * restore per store/hook) so one regression cannot take down every delete.
 */

export type DeletableEntity = "note" | "paper" | "idea" | "task" | "topic";

export interface DeleteDialogCopy {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
}

const ENTITY_FALLBACK_NAME: Record<DeletableEntity, string> = {
  note: "Untitled note",
  paper: "Untitled paper",
  idea: "Untitled idea",
  task: "Untitled task",
  topic: "Untitled topic",
};

/**
 * Copy for a single-item delete Confirm. `itemName` is the entity title;
 * pass `linksNote: true` for topics, whose delete also removes entity links.
 */
export function singleDeleteCopy(
  entity: DeletableEntity,
  itemName?: string | null,
  options?: { linksNote?: boolean },
): DeleteDialogCopy {
  const name = itemName?.trim() || ENTITY_FALLBACK_NAME[entity];
  const linksNote = options?.linksNote
    ? " This will remove its links to notes, papers, and ideas."
    : "";
  return {
    title: `Delete ${entity}`,
    message: `Are you sure you want to delete "${name}"?${linksNote} You can undo for a short time after deleting.`,
    confirmText: "Delete",
    cancelText: "Cancel",
  };
}

/** Copy for bulk-destructive deletes with no undo path (clear-all data). */
export function bulkDeleteCopy(): DeleteDialogCopy {
  return {
    title: "Clear all research data",
    message:
      "This will permanently delete all your notes, papers, ideas, tasks, topics, and their connections. It cannot be undone.",
    confirmText: "Delete everything",
    cancelText: "Keep my data",
  };
}
