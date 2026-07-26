import { Inbox } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../../store/appStore";
import { useFeedItems, FEED_ITEM_TYPES, type FeedTypeFilter } from "../../hooks/useFeedItems";
import { FeedItemCard } from "./FeedItemCard";
import type { FeedPromoteTarget } from "../../types/database";
import { cn } from "../../lib/utils";

const TYPE_LABELS: Record<FeedTypeFilter, string> = {
  all: "All",
  paper: "Papers",
  job: "Jobs",
  news: "News",
  custom: "Custom",
};

export function FeedsRail() {
  const [type, setType] = useState<FeedTypeFilter>("all");
  const userId = useAppStore((state) => state.user?.id);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const {
    items,
    loading,
    error,
    actionItemId,
    archiveFeedItem,
    markFeedItemTriaged,
    promoteFeedItem,
  } = useFeedItems(userId, {
    type,
    status: "new",
    limit: 5,
  });

  const navigateToFeeds = () => {
    setCurrentView("feeds");
    window.history.pushState(null, "", "/feeds");
  };

  const handlePromote = (itemId: string, target: FeedPromoteTarget) => {
    void promoteFeedItem(itemId, target);
  };

  return (
    <section className="space-y-4" aria-labelledby="feeds-rail-title">
      <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-text-primary">
              <Inbox className="h-4 w-4 text-primary-500" aria-hidden="true" />
              <h2
                id="feeds-rail-title"
                className="text-small font-semibold uppercase tracking-wide"
              >
                Feeds
              </h2>
            </div>
            <p className="mt-1 text-caption text-text-secondary">
              Triage new papers, jobs, news, and custom leads.
            </p>
          </div>
          <button
            type="button"
            onClick={navigateToFeeds}
            className="rounded-sm border border-border-subtle px-2 py-1 text-caption font-medium text-text-secondary transition-colors hover:border-border-moderate hover:text-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500"
          >
            View all
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Feed type filters">
          {(["all", ...FEED_ITEM_TYPES] as FeedTypeFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setType(filter)}
              className={cn(
                "rounded-full border px-2 py-1 text-caption font-medium transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary-500",
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

      {loading ? (
        <div className="space-y-2" role="status" aria-live="polite">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-lg border border-border-subtle bg-bg-elevated"
            />
          ))}
          <span className="sr-only">Loading feeds</span>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-4 text-caption text-text-secondary">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-moderate bg-bg-elevated p-4 text-center">
          <Inbox className="mx-auto h-6 w-6 text-text-tertiary" aria-hidden="true" />
          <p className="mt-2 text-small font-medium text-text-primary">
            No new feed items
          </p>
          <p className="mt-1 text-caption text-text-secondary">
            New items will appear here as agents ingest them.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <FeedItemCard
              key={item.id}
              item={item}
              compact
              actionItemId={actionItemId}
              onArchive={archiveFeedItem}
              onMarkTriaged={markFeedItemTriaged}
              onPromote={handlePromote}
            />
          ))}
        </div>
      )}
    </section>
  );
}
