import { useState, memo, useCallback, useMemo, useRef, useEffect } from "react";
import { Clock, Hash, Link2, Trash2, FileText, Copy } from "lucide-react";
import type { Note } from "../../types/database";
import { ListSkeleton } from "../ui/Skeleton";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { toast } from "sonner";
import { highlightMatch } from "../../utils/highlight";
import { deriveTitleFromMarkdown } from "../../utils/text";
import { UNDO_WINDOW_MS } from "../../lib/constants";

interface NoteCardProps {
  note: Note;
  onSelect: (note: Note) => void;
  onDelete: (note: Note) => void;
  onDuplicate?: (note: Note) => void;
  isSelected: boolean;
  searchQuery?: string;
}

const NoteCardComponent = ({
  note,
  onSelect,
  onDelete,
  onDuplicate,
  isSelected,
  searchQuery = "",
}: NoteCardProps) => {
  // Extract title from markdown or use first line
  const { title, preview } = useMemo(() => {
    return {
      title: note.title || deriveTitleFromMarkdown(note.markdown_body),
      preview:
        note.markdown_body.slice(0, 100) +
        (note.markdown_body.length > 100 ? "..." : ""),
    };
  }, [note.title, note.markdown_body]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(note);
    },
    [onDelete, note],
  );

  const handleDuplicate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDuplicate?.(note);
    },
    [onDuplicate, note],
  );

  const handleSelect = useCallback(() => {
    onSelect(note);
  }, [onSelect, note]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(note);
      }
    },
    [onSelect, note],
  );

  return (
    <div
      role="button"
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`p-3 rounded-md border cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        isSelected
          ? "bg-bg-elevated border-primary-500"
          : "bg-bg-surface border-border-subtle hover:border-border-moderate hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="w-4 h-4 text-text-tertiary flex-shrink-0" />
          <h4 className="text-small font-semibold text-text-primary truncate">
            {highlightMatch(title, searchQuery)}
          </h4>
        </div>
        {onDuplicate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleDuplicate}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slate-400 hover:text-blue-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="Duplicate note"
              >
                <Copy className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Duplicate note</p>
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
              aria-label="Delete note"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete note</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <p className="text-caption text-text-secondary line-clamp-2 mb-2">
        {highlightMatch(preview, searchQuery)}
      </p>

      <div className="flex items-center gap-3 text-caption text-text-tertiary">
        {note.tags && note.tags.length > 0 && (
          <div className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            <span>{note.tags.length}</span>
          </div>
        )}
        {note.linked_entity_ids && note.linked_entity_ids.length > 0 && (
          <div className="flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            <span>{note.linked_entity_ids.length}</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <Clock className="w-3 h-3" />
          <span>{new Date(note.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

export const NoteCard = memo(NoteCardComponent);

interface NoteListProps {
  notes: Note[];
  onSelectNote: (note: Note) => void;
  onDeleteNote: (note: Note) => Promise<boolean>;
  onRestoreNote: (note: Note) => Promise<Note | null>;
  onDuplicate?: (note: Note) => void;
  selectedNoteId?: string;
  selectedNote?: Note | null;
  loading?: boolean;
  searchQuery?: string;
}

export function NoteList({
  notes,
  onSelectNote,
  onDeleteNote,
  onRestoreNote,
  onDuplicate,
  selectedNoteId,
  selectedNote,
  loading = false,
  searchQuery = "",
}: NoteListProps) {
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDeletedRef = useRef<Note | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const mergedNotes = useMemo(
    () =>
      notes.map((note) => {
        if (selectedNote && note.id === selectedNote.id) {
          return { ...note, ...selectedNote };
        }
        return note;
      }),
    [notes, selectedNote],
  );

  const emptyMessage = loading ? "" : (notes.length === 0
    ? (searchQuery ? "No matches found. Try a different keyword or clear your search." : "No notes yet. Create your first note above.")
    : "");

  const handleDeleteRequest = useCallback((candidate: Note) => {
    setNoteToDelete(candidate);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!noteToDelete) return;
    setDeleting(true);
    const note = noteToDelete;
    const success = await onDeleteNote(note);
    setDeleting(false);
    setNoteToDelete(null);

    if (success) {
      lastDeletedRef.current = note;
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }

      const toastId = toast.success("Note deleted", {
        description: "Undo within 6 seconds to restore it.",
        duration: UNDO_WINDOW_MS,
        action: {
          label: "Undo",
          onClick: async () => {
            if (lastDeletedRef.current) {
              await onRestoreNote(lastDeletedRef.current);
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
      }, 6000);
    }
  }, [noteToDelete, onDeleteNote, onRestoreNote]);



  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">
        {emptyMessage}
      </div>

      {loading ? (
        <ListSkeleton count={5} itemType="note" />
      ) : notes.length === 0 ? (
        searchQuery ? (
          <div className="text-center py-12 text-text-tertiary" aria-hidden="true">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-small font-semibold text-text-secondary">
              No matches found
            </p>
            <p className="text-caption mt-1">
              Try a different keyword or clear your search.
            </p>
          </div>
        ) : (
          <div className="text-center py-12 text-text-tertiary" aria-hidden="true">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-small">No notes yet</p>
            <p className="text-caption mt-1">Create your first note above</p>
          </div>
        )
      ) : (
        <div className="space-y-2">
          {mergedNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onSelect={onSelectNote}
            onDelete={handleDeleteRequest}
            onDuplicate={onDuplicate}
            isSelected={note.id === selectedNoteId}
            searchQuery={searchQuery}
          />
        ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(noteToDelete)}
        onClose={() => {
          if (!deleting) {
            setNoteToDelete(null);
          }
        }}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        title="Delete note"
        message={`Are you sure you want to delete "${noteToDelete?.title || (noteToDelete ? deriveTitleFromMarkdown(noteToDelete.markdown_body) : "Untitled Note")}"? You can undo for a short time after deleting.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleting}
      />
    </>
  );
}
