import { Inbox, RefreshCw } from "lucide-react";
import { useState } from "react";
import {
  FEED_ITEM_STATUSES,
  FEED_ITEM_TYPES,
  type FeedStatusFilter,
  type FeedTypeFilter,
  useFeedItems,
} from "../../hooks/useFeedItems";
import { useAppStore } from "../../store/appStore";
import type { FeedPromoteTarget } from "../../types/database";
import { cn } from "../../lib/utils";
import { FeedItemCard } from "./FeedItemCard";

const TYPE_LABELS: Record<FeedTypeFilter, string> = {
  all: "All types",
  paper: "Papers",
  job: "Jobs",
  news: "News",
  custom: "Custom",
};

const STATUS_LABELS: Record<FeedStatusFilter, string> = {
  all: "All statuses",
  new: "New",
  triaged: "Triaged",
  archived: "Archived",
  promoted: "Promoted",
};

export function FeedsView() {
  const [type, setType] = useState<FeedTypeFilter>("all");
  const [status, setStatus] = useState<FeedStatusFilter>("new");
  const userId = useAppStore((state) => state.user?.id);
  const {
    items,
    loading,
    error,
    actionItemId,
    refreshFeedItems,
    archiveFeedItem,
    markFeedItemTriaged,
    promoteFeedItem,
  } = useFeedItems(userId, { type, status });

  const handlePromote = (itemId: string, target: FeedPromoteTarget) => {
    void promoteFeedItem(itemId, target);
  };

  return (
    <div className="min-h-full bg-bg-base px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="surface-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3 text-text-primary">
                <div className="icon-tile bg-accent-soft text-accent-strong">
                  <Inbox className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="section-kicker mb-1">Research intelligence</p>
                  <h1 className="font-serif text-2xl font-bold text-text-primary">
                    Feeds
                  </h1>
                  <p className="mt-1 text-small text-text-secondary">
                    Review incoming research leads, archive noise, or promote
                    items into papers, tasks, and notes.
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void refreshFeedItems()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-moderate bg-bg-surface px-3 py-2 text-small font-medium text-text-secondary shadow-sm transition-colors hover:border-border-strong hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </header>

        <section
          className="surface-card p-4 sm:p-5"
          aria-label="Feed filters"
        >
          <div className="space-y-4">
            <div>
              <h2 className="section-kicker">
                Type
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["all", ...FEED_ITEM_TYPES] as FeedTypeFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setType(filter)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-small font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                      type === filter
                        ? "border-accent bg-accent-soft text-accent-strong"
                        : "border-border-subtle bg-bg-surface text-text-secondary hover:border-border-moderate hover:text-text-primary",
                    )}
                    aria-pressed={type === filter}
                  >
                    {TYPE_LABELS[filter]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="section-kicker">
                Status
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["all", ...FEED_ITEM_STATUSES] as FeedStatusFilter[]).map(
                  (filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setStatus(filter)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-small font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                        status === filter
                          ? "border-accent bg-accent-soft text-accent-strong"
                          : "border-border-subtle bg-bg-surface text-text-secondary hover:border-border-moderate hover:text-text-primary",
                      )}
                      aria-pressed={status === filter}
                    >
                      {STATUS_LABELS[filter]}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Feed items">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-small text-text-secondary">
              {loading ? "Loading feed items..." : `${items.length} item${items.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {loading ? (
            <div className="space-y-3" role="status" aria-live="polite">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="surface-card h-44 animate-pulse"
                />
              ))}
              <span className="sr-only">Loading feeds</span>
            </div>
          ) : error ? (
            <div className="surface-card p-6 text-text-secondary">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div
              role="status"
              aria-live="polite"
              className="surface-card border-dashed p-10 text-center"
            >
              <span className="icon-tile mx-auto bg-bg-elevated text-text-tertiary">
                <Inbox className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-serif text-xl font-semibold text-text-primary">
                Nothing to triage
              </h2>
              <p className="mx-auto mt-2 max-w-md text-small text-text-secondary">
                Try a different filter, or check back when agents ingest more
                feed items.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <FeedItemCard
                  key={item.id}
                  item={item}
                  actionItemId={actionItemId}
                  onArchive={archiveFeedItem}
                  onMarkTriaged={markFeedItemTriaged}
                  onPromote={handlePromote}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
