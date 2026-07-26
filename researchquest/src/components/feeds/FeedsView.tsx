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
        <header className="rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3 text-text-primary">
                <div className="rounded-lg border border-border-subtle bg-bg-elevated p-2">
                  <Inbox className="h-5 w-5 text-primary-500" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="font-serif text-2xl font-bold tracking-tight">
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
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-border-subtle px-3 py-2 text-small font-medium text-text-secondary transition-colors hover:border-border-moderate hover:text-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </header>

        <section
          className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm"
          aria-label="Feed filters"
        >
          <div className="space-y-4">
            <div>
              <h2 className="text-caption font-semibold uppercase tracking-wide text-text-tertiary">
                Type
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["all", ...FEED_ITEM_TYPES] as FeedTypeFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setType(filter)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-small font-medium transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500",
                      type === filter
                        ? "border-primary-500 bg-primary-500 text-bg-base"
                        : "border-border-subtle bg-bg-base text-text-secondary hover:border-border-moderate hover:text-text-primary",
                    )}
                    aria-pressed={type === filter}
                  >
                    {TYPE_LABELS[filter]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-caption font-semibold uppercase tracking-wide text-text-tertiary">
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
                        "rounded-full border px-3 py-1.5 text-small font-medium transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500",
                        status === filter
                          ? "border-primary-500 bg-primary-500 text-bg-base"
                          : "border-border-subtle bg-bg-base text-text-secondary hover:border-border-moderate hover:text-text-primary",
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
                  className="h-44 animate-pulse rounded-xl border border-border-subtle bg-bg-surface"
                />
              ))}
              <span className="sr-only">Loading feeds</span>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 text-text-secondary">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-dashed border-border-moderate bg-bg-surface p-10 text-center"
            >
              <Inbox className="mx-auto h-8 w-8 text-text-tertiary" aria-hidden="true" />
              <h2 className="mt-3 font-serif text-xl font-semibold text-text-primary">
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
