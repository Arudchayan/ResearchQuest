import React from "react";
import { BookOpen, ExternalLink, Calendar } from "lucide-react";
import type { Paper } from "../../types/database";
import { highlightMatch } from "../../utils/highlight";

const STATUS_STYLES: Record<string, string> = {
  "To Read": "bg-gold-soft text-gold-strong border border-gold/20",
  Reading: "bg-blue-soft text-blue-strong border border-blue/20",
  Read: "bg-success-bg text-success border border-success/20",
};

interface PaperCardProps {
  paper: Paper;
  highlightQuery?: string;
  onSelect: (paper: Paper) => void;
}

export const PaperCard = React.memo(function PaperCard({
  paper,
  highlightQuery = "",
  onSelect,
}: PaperCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(paper);
    }
  };

  const handleDoiClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Select paper: ${paper.title}`}
      onClick={() => onSelect(paper)}
      onKeyDown={handleKeyDown}
      className="surface-card group h-full cursor-pointer p-5 focus:outline-none focus:ring-2 focus:ring-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="icon-tile bg-violet-soft text-violet-strong">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
        </span>
        {paper.doi && (
          <a
            href={`https://doi.org/${paper.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleDoiClick}
            className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-caption font-medium text-text-tertiary transition-colors hover:bg-bg-elevated hover:text-text-primary"
          >
            DOI <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>

      <h3 className="mt-4 line-clamp-2 text-sm font-semibold text-text-primary transition-colors group-hover:text-accent-strong">
        {paper.title ? highlightMatch(paper.title, highlightQuery) : "Untitled"}
      </h3>

      <p className="mt-1.5 line-clamp-2 text-small text-text-secondary">
        {paper.authors && paper.authors.length > 0
          ? highlightMatch(paper.authors.join(", "), highlightQuery)
          : "Unknown Authors"}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
        <div className="flex min-w-0 items-center gap-1.5 text-caption text-text-tertiary">
          <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {/* Optimization: Parse year from string instead of full Date parsing */}
          <span className="truncate">
            {paper.publication_date
              ? parseInt(paper.publication_date.substring(0, 4)) || "N/A"
              : "N/A"}
          </span>
        </div>
        <span
          className={`status-chip shrink-0 ${
            STATUS_STYLES[paper.status] ?? STATUS_STYLES["To Read"]
          }`}
        >
          {paper.status}
        </span>
      </div>
    </div>
  );
});
