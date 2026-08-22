import React from "react";
import { BookOpen, ExternalLink, Calendar } from "lucide-react";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { Card } from "../ui/card";
import type { Paper, ReadingStatus } from "../../types/database";
import { highlightMatch } from "../../utils/highlight";

interface PaperCardProps {
  paper: Paper;
  highlightQuery?: string;
  onSelect: (paper: Paper) => void;
}

const readingStatusVariants = {
  "To Read": "neutral",
  Reading: "neutral",
  Read: "success",
} satisfies Record<ReadingStatus, BadgeVariant>;

const readingStatusClassNames = {
  "To Read": "",
  Reading: "bg-primary-50 text-primary-500",
  Read: "",
} satisfies Record<ReadingStatus, string>;

const firstAuthorSlug = (authors: string[] | undefined): string => {
  const first = authors?.[0];
  if (!first) return "ANON";
  const namePart = first.split(",")[0] ?? "";
  const lastWord = namePart.trim().split(/\s+/).pop();
  return lastWord ? lastWord.toUpperCase() : "ANON";
};

export const PaperCard = React.memo(function PaperCard({
  paper,
  highlightQuery = "",
  onSelect,
}: PaperCardProps) {
  const displayTitle = paper.title || "Untitled";

  return (
    <Card className="group relative min-w-0 p-5 transition-colors hover:border-border-strong">
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-0 w-0.5 origin-left scale-x-0 bg-primary-500 transition-transform duration-fast ease-out group-hover:scale-x-100 group-focus-within:scale-x-100"
      />
      <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border-subtle bg-bg-elevated text-text-primary">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
        </div>
        {paper.doi && (
          <a
            href={`https://doi.org/${paper.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open DOI for ${displayTitle}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-small text-text-tertiary transition-colors hover:text-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          >
            DOI <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>

      <button
        type="button"
        aria-label={`Open paper: ${displayTitle}`}
        onClick={() => onSelect(paper)}
        className="mb-2 block min-w-0 cursor-pointer rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
      >
        <h3 className="line-clamp-2 break-words text-body-lg font-semibold text-text-primary">
          {paper.title ? highlightMatch(paper.title, highlightQuery) : displayTitle}
        </h3>
      </button>

      <p className="line-clamp-2 break-words text-small text-text-secondary">
        {paper.authors && paper.authors.length > 0
          ? highlightMatch(paper.authors.join(", "), highlightQuery)
          : "Unknown Authors"}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
          {/* Optimization: Parse year from string instead of full Date parsing */}
          <span className="font-mono text-caption text-text-tertiary">
            {firstAuthorSlug(paper.authors)}{" "}
            {paper.publication_date
              ? parseInt(paper.publication_date.substring(0, 4)) || "N/A"
              : "N/A"}
          </span>
        </div>
        <Badge
          variant={readingStatusVariants[paper.status]}
          className={readingStatusClassNames[paper.status]}
        >
          {paper.status}
        </Badge>
      </div>
    </Card>
  );
});
