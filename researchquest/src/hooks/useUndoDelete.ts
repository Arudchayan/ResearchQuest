import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UNDO_WINDOW_MS } from "../lib/constants";

/**
 * Shared hook for the "delete with undo" pattern used across TaskManager,
 * PapersView, and NotesView.
 *
 * Usage:
 *   const { handleDeleteWithUndo } = useUndoDelete(
 *     (item) => deleteFn(item.id),
 *     (item) => restoreFn(item),
 *     { entityLabel: "Task" },
 *   );
 *
 * The caller is responsible for looking up the item from state before
 * calling handleDeleteWithUndo(item). This keeps the hook generic and
 * avoids coupling it to any particular store shape.
 */
export function useUndoDelete<T extends { id: string }>(
  deleteFn: (item: T) => Promise<boolean>,
  restoreFn: (item: T) => Promise<unknown>,
  options?: {
    undoWindowMs?: number;
    entityLabel?: string;
  },
): {
  handleDeleteWithUndo: (item: T) => Promise<void>;
  isDeleting: boolean;
} {
  const undoWindowMs = options?.undoWindowMs ?? UNDO_WINDOW_MS;
  const entityLabel = options?.entityLabel ?? "Item";

  const lastDeletedRef = useRef<T | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDeletingRef = useRef(false);

  // Keep stable refs to callbacks so the main handler useCallback never
  // needs to depend on them. This prevents the caller's inline adapter
  // functions (e.g. (note) => deleteNote(note.id)) from destabilizing the
  // returned handleDeleteWithUndo reference on every render.
  const deleteFnRef = useRef(deleteFn);
  deleteFnRef.current = deleteFn;
  const restoreFnRef = useRef(restoreFn);
  restoreFnRef.current = restoreFn;

  const [isDeleting, setIsDeleting] = useState(false);

  // Cleanup on unmount so the real delete never fires after the component
  // is torn down.
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteWithUndo = useCallback(
    async (item: T) => {
      // Prevent concurrent deletes
      if (isDeletingRef.current) return;
      isDeletingRef.current = true;
      setIsDeleting(true);

      try {
        const success = await deleteFnRef.current(item);
        if (success && item) {
          lastDeletedRef.current = item;

          // Clear any existing undo timeout (e.g. when deleting another item
          // before the previous undo window expired).
          if (undoTimeoutRef.current) {
            clearTimeout(undoTimeoutRef.current);
          }

          const toastId = toast.success(`${entityLabel} deleted`, {
            description: `Undo within ${undoWindowMs / 1000} seconds to restore it.`,
            duration: undoWindowMs,
            action: {
              label: "Undo",
              onClick: async () => {
                if (lastDeletedRef.current) {
                  await restoreFnRef.current(lastDeletedRef.current);
                  lastDeletedRef.current = null;
                  if (undoTimeoutRef.current) {
                    clearTimeout(undoTimeoutRef.current);
                    undoTimeoutRef.current = null;
                  }
                  toast.dismiss(toastId);
                }
              },
            },
          });

          undoTimeoutRef.current = setTimeout(() => {
            lastDeletedRef.current = null;
            toast.dismiss(toastId);
            undoTimeoutRef.current = null;
          }, undoWindowMs);
        }
      } finally {
        isDeletingRef.current = false;
        setIsDeleting(false);
      }
    },
    [undoWindowMs, entityLabel],
  );

  return { handleDeleteWithUndo, isDeleting };
}
