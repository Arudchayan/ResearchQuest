import React from "react";
import { Trash2, Clock, FileText } from "lucide-react";
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(note);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Select note: ${note.title || "Untitled Note"}`}
      onClick={() => onSelect(note)}
      onKeyDown={handleKeyDown}
      className={cn(
        "surface-card group h-full w-full cursor-pointer p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
        isSelected
          ? "border-accent shadow-lift"
          : "border-transparent hover:border-border-moderate",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="icon-tile shrink-0 bg-blue-soft text-blue-strong">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-semibold",
                !note.title
                  ? "text-text-tertiary italic"
                  : "text-text-primary",
              )}
            >
              {note.title ? highlightMatch(note.title, highlightQuery) : "Untitled Note"}
            </h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleDelete}
                  aria-label="Delete note"
                  className="icon-btn h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 text-text-tertiary hover:text-coral-strong"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete note</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-small text-text-secondary">
            {note.markdown_body ? highlightMatch(note.markdown_body, highlightQuery) : "No content..."}
          </p>

          {note.tags && note.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border-subtle bg-bg-elevated px-2 py-0.5 text-caption font-medium text-text-secondary"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center gap-1.5 text-caption text-text-tertiary">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
