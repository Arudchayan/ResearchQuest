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
import type { FeedBusyState } from "../../hooks/useFeedItems";
import type { FeedItem, FeedItemType, FeedPromoteTarget } from "../../types/database";
import { isValidUrl } from "../../utils/security";

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

const TYPE_CHIP_STYLES: Record<FeedItemType, string> = {
  paper: "bg-violet-soft text-violet-strong",
  job: "bg-blue-soft text-blue-strong",
  news: "bg-gold-soft text-gold-strong",
  custom: "bg-accent-soft text-accent-strong",
};

const STATUS_CHIP_STYLES: Record<string, string> = {
  new: "bg-accent-soft text-accent-strong",
  triaged: "bg-blue-soft text-blue-strong",
  archived: "bg-bg-elevated text-text-tertiary",
  promoted: "bg-success-bg text-success",
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

function invalidUrlReason(url: string): string {
  const scheme = url.trim().split(":")[0]?.toLowerCase() ?? "";
  if (["javascript", "data", "vbscript"].includes(scheme)) {
    return `Blocked unsafe URL scheme ("${scheme}:")`;
  }
  return "Invalid source URL (expected an http:// or https:// link)";
}

function FeedSourceLink({
  compact,
  url,
}: {
  compact: boolean;
  url?: string | null;
}) {
  if (!url) {
    return null;
  }

  if (!isValidUrl(url)) {
    return (
      <span
        className="inline-flex items-center gap-1 text-caption font-medium text-text-tertiary"
        title={invalidUrlReason(url)}
      >
        Open source
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={compact ? `Open source for this item: ${url}` : undefined}
      className="inline-flex items-center gap-1 text-caption font-medium text-accent-strong hover:text-accent"
    >
      Open source
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

interface FeedItemCardProps {
  item: FeedItem;
  compact?: boolean;
  actionItemId?: string | null;
  busyAction?: FeedBusyState | null;
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
  busyAction,
  onArchive,
  onMarkTriaged,
  onPromote,
  className,
}: FeedItemCardProps) {
  const legacyBusy = actionItemId === item.id;
  // Per-action busy (item 67): only the running action's button is disabled
  // instead of freezing every button on the card.
  const isActionBusy = (action: FeedBusyState["action"]) =>
    busyAction
      ? busyAction.itemId === item.id && busyAction.action === action
      : legacyBusy;
  const isArchiveBusy = isActionBusy("archive");
  const isTriageBusy = isActionBusy("triage");
  const isPromoteBusy = isActionBusy("promote");
  const dateLabel = formatFeedDate(item.published_at ?? item.created_at);
  const isArchived = item.status === "archived";
  const isPromoted = item.status === "promoted";
  const promoteTargets: FeedPromoteTarget[] = ["paper", "task", "note"];

  return (
    <article
      className={cn(
        "surface-card p-4",
        compact && "p-3",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`status-chip ${TYPE_CHIP_STYLES[item.type]}`}
            >
              <FeedTypeIcon type={item.type} />
              {TYPE_LABELS[item.type]}
            </span>
            <span className={`status-chip ${STATUS_CHIP_STYLES[item.status] ?? STATUS_CHIP_STYLES.new}`}>
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

          <FeedSourceLink compact={compact} url={item.url} />
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
            disabled={isArchiveBusy}
            aria-busy={isArchiveBusy || undefined}
            className="inline-flex items-center gap-1 rounded-lg border border-border-moderate bg-bg-surface px-2.5 py-1 text-caption font-medium text-text-secondary shadow-sm transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
            disabled={isTriageBusy}
            aria-busy={isTriageBusy || undefined}
            className="inline-flex items-center gap-1 rounded-lg border border-border-moderate bg-bg-surface px-2.5 py-1 text-caption font-medium text-text-secondary shadow-sm transition-colors hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
                disabled={isPromoteBusy}
                aria-busy={isPromoteBusy || undefined}
                className="inline-flex items-center gap-1 rounded-lg bg-text-primary px-2.5 py-1 text-caption font-medium text-bg-base shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
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
