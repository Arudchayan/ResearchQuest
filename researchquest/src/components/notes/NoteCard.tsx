import React from "react";
import { Trash2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../../lib/utils";
import type { Note } from "../../types/database";
import { highlightMatch } from "../../utils/highlight";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface NoteCardProps {
  note: Note;
  isSelected: boolean;
  highlightQuery?: string;
  onSelect: (note: Note) => void;
  onDelete: (noteId: string) => void;
}

export const NoteCard = React.memo(function NoteCard({
  note,
  isSelected,
  highlightQuery = "",
  onSelect,
  onDelete,
}: NoteCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(note.id);
  };

  const title = note.title || "Untitled Note";

  return (
    <div
      className={cn(
        "group min-w-0 border-l-4 p-4 transition-colors",
        isSelected
          ? "border-primary-500 bg-primary-50 hover:bg-primary-50"
          : "border-transparent hover:bg-bg-elevated",
      )}
    >
      <div className="mb-1 flex min-w-0 items-start justify-between gap-2">
        <button
          type="button"
          data-note-card={note.id}
          aria-label={`Open note: ${title}`}
          aria-current={isSelected ? "true" : undefined}
          onClick={() => onSelect(note)}
          className="min-w-0 flex-1 cursor-pointer rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-[-2px]"
        >
          <h3
            className={cn(
              "truncate text-body font-medium",
              !note.title ? "italic text-text-tertiary" : "text-text-primary",
            )}
          >
            {note.title ? highlightMatch(note.title, highlightQuery) : "Untitled Note"}
          </h3>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleDelete}
              aria-label="Delete note"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control p-1 text-text-tertiary transition-colors hover:bg-destructive-bg hover:text-destructive focus:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-destructive focus-visible:outline-offset-2 md:min-h-0 md:min-w-0 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete note</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <p className="mb-2 line-clamp-2 text-small text-text-secondary">
        {note.markdown_body ? highlightMatch(note.markdown_body, highlightQuery) : "No content..."}
      </p>

      {note.tags && note.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-control border border-border-subtle bg-bg-elevated px-2 py-0.5 text-caption font-medium text-text-secondary"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-caption text-text-tertiary">
        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>
          {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
});
