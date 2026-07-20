import React from "react";
import { BookOpen, ExternalLink, Calendar } from "lucide-react";
import type { Paper } from "../../types/database";
import { highlightMatch } from "../../utils/highlight";

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
      className="bg-bg-surface border border-border-moderate rounded-xl p-5 cursor-pointer hover:border-border-strong transition-all hover:shadow-md group focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-bg-elevated rounded-lg text-text-primary">
          <BookOpen className="w-5 h-5" />
        </div>
        {paper.doi && (
          <a
            href={`https://doi.org/${paper.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleDoiClick}
            className="text-xs text-text-tertiary hover:text-text-primary flex items-center gap-1"
          >
            DOI <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <h3 className="font-semibold text-text-primary mb-2 line-clamp-2 group-hover:underline decoration-border-strong underline-offset-2 transition-colors">
        {paper.title ? highlightMatch(paper.title, highlightQuery) : "Untitled"}
      </h3>

      <p className="text-sm text-text-secondary mb-4 line-clamp-2">
        {paper.authors && paper.authors.length > 0
          ? highlightMatch(paper.authors.join(", "), highlightQuery)
          : "Unknown Authors"}
      </p>

      <div className="flex items-center gap-4 text-xs text-text-tertiary">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {/* Optimization: Parse year from string instead of full Date parsing */}
          <span>
            {paper.publication_date
              ? parseInt(paper.publication_date.substring(0, 4)) || "N/A"
              : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
});
