import {
  Archive,
  BookOpen,
  Briefcase,
  Check,
  CheckSquare,
  ExternalLink,
  FileText,
  Newspaper,
  Sparkles,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { FeedItem, FeedItemType, FeedPromoteTarget } from "../../types/database";

const TYPE_LABELS: Record<FeedItemType, string> = {
  paper: "Paper",
  job: "Job",
  news: "News",
  custom: "Custom",
};

const TARGET_LABELS: Record<FeedPromoteTarget, string> = {
  paper: "Paper",
  task: "Task",
  note: "Note",
};

function FeedTypeIcon({ type }: { type: FeedItemType }) {
  switch (type) {
    case "paper":
      return <BookOpen className="h-4 w-4" aria-hidden="true" />;
    case "job":
      return <Briefcase className="h-4 w-4" aria-hidden="true" />;
    case "news":
      return <Newspaper className="h-4 w-4" aria-hidden="true" />;
    case "custom":
      return <Sparkles className="h-4 w-4" aria-hidden="true" />;
  }
}

function PromoteIcon({ target }: { target: FeedPromoteTarget }) {
  switch (target) {
    case "paper":
      return <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />;
    case "task":
      return <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />;
    case "note":
      return <FileText className="h-3.5 w-3.5" aria-hidden="true" />;
  }
}

function formatFeedDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface FeedItemCardProps {
  item: FeedItem;
  compact?: boolean;
  actionItemId?: string | null;
  onArchive?: (itemId: string) => void | Promise<unknown>;
  onMarkTriaged?: (itemId: string) => void | Promise<unknown>;
  onPromote?: (
    itemId: string,
    target: FeedPromoteTarget,
  ) => void | Promise<unknown>;
  className?: string;
}

export function FeedItemCard({
  item,
  compact = false,
  actionItemId,
  onArchive,
  onMarkTriaged,
  onPromote,
  className,
}: FeedItemCardProps) {
  const isBusy = actionItemId === item.id;
  const dateLabel = formatFeedDate(item.published_at ?? item.created_at);
  const isArchived = item.status === "archived";
  const isPromoted = item.status === "promoted";
  const promoteTargets: FeedPromoteTarget[] = ["paper", "task", "note"];

  return (
    <article
      className={cn(
        "rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm transition-colors",
        "hover:border-border-moderate",
        compact && "p-3",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-bg-elevated px-2 py-0.5 text-caption font-medium text-text-secondary">
              <FeedTypeIcon type={item.type} />
              {TYPE_LABELS[item.type]}
            </span>
            <span className="rounded-full bg-primary-500/10 px-2 py-0.5 text-caption font-medium text-primary-600 dark:text-primary-400">
              {item.status}
            </span>
            {dateLabel && (
              <time
                className="text-caption text-text-tertiary"
                dateTime={item.published_at ?? item.created_at}
              >
                {dateLabel}
              </time>
            )}
          </div>

          <h3
            className={cn(
              "font-serif font-semibold text-text-primary",
              compact ? "line-clamp-2 text-small" : "text-lg leading-snug",
            )}
          >
            {item.title}
          </h3>

          {item.summary && (
            <p
              className={cn(
                "text-text-secondary",
                compact
                  ? "line-clamp-3 text-caption leading-relaxed"
                  : "line-clamp-4 text-small leading-relaxed",
              )}
            >
              {item.summary}
            </p>
          )}

          {item.url && !compact && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-caption font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
            >
              Open source
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <div
        className={cn(
          "mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3",
          compact && "gap-1.5",
        )}
      >
        {onArchive && !isArchived && (
          <button
            type="button"
            onClick={() => void onArchive(item.id)}
            disabled={isBusy}
            className="inline-flex items-center gap-1 rounded-sm border border-border-subtle px-2 py-1 text-caption font-medium text-text-secondary transition-colors hover:border-border-moderate hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500"
            aria-label={`Archive ${item.title}`}
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            Archive
          </button>
        )}

        {onMarkTriaged && item.status === "new" && (
          <button
            type="button"
            onClick={() => void onMarkTriaged(item.id)}
            disabled={isBusy}
            className="inline-flex items-center gap-1 rounded-sm border border-border-subtle px-2 py-1 text-caption font-medium text-text-secondary transition-colors hover:border-border-moderate hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500"
            aria-label={`Mark ${item.title} as triaged`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Triage
          </button>
        )}

        {!isArchived && !isPromoted && onPromote && (
          <div className="flex flex-wrap items-center gap-1.5">
            {promoteTargets.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => void onPromote(item.id, target)}
                disabled={isBusy}
                className="inline-flex items-center gap-1 rounded-sm bg-primary-500 px-2 py-1 text-caption font-medium text-bg-base transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500 focus-visible:outline-offset-2"
                aria-label={`Promote ${item.title} to ${TARGET_LABELS[target]}`}
              >
                <PromoteIcon target={target} />
                {compact ? TARGET_LABELS[target] : `Promote ${TARGET_LABELS[target]}`}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
