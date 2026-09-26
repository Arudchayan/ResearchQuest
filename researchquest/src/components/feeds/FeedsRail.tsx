import { Inbox } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "../../store/appStore";
import { navigateToView } from "../../lib/softNavigation";
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
  const {
    items,
    loading,
    error,
    actionItemId,
    refreshFeedItems,
    archiveFeedItem,
    markFeedItemTriaged,
    promoteFeedItem,
  } = useFeedItems(userId, {
    type,
    status: "new",
    limit: 5,
    // Single-owner rule: AppDataOwners fetches; the rail only reads.
    owner: false,
  });

  const navigateToFeeds = () => {
    navigateToView("feeds");
  };

  const handlePromote = (itemId: string, target: FeedPromoteTarget) => {
    void promoteFeedItem(itemId, target);
  };

  return (
    <section className="space-y-4" aria-labelledby="feeds-rail-title">
      <div className="surface-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="icon-tile h-8 w-8 bg-accent-soft text-accent-strong">
                <Inbox className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="section-kicker mb-1">Inbox</p>
              <h2
                id="feeds-rail-title"
                className="text-small font-semibold text-text-primary"
              >
                Feeds
              </h2>
              </div>
            </div>
            <p className="mt-1 text-caption text-text-secondary">
              Triage new papers, jobs, news, and custom leads.
            </p>
          </div>
          <button
            type="button"
            onClick={navigateToFeeds}
            className="rounded-lg border border-border-moderate bg-bg-surface px-2.5 py-1 text-caption font-medium text-text-secondary shadow-sm transition-colors hover:border-border-strong hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
                "rounded-full border px-2 py-1 text-caption font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
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

      {loading ? (
        <div className="space-y-2" role="status" aria-live="polite">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="surface-card h-28 animate-pulse"
            />
          ))}
          <span className="sr-only">Loading feeds</span>
        </div>
      ) : error ? (
        <div className="surface-card flex items-center justify-between gap-3 p-4">
          <p className="text-caption text-text-secondary" role="alert">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void refreshFeedItems()}
            className="shrink-0 rounded-lg border border-border-moderate bg-bg-surface px-2.5 py-1 text-caption font-medium text-text-secondary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="surface-card border-dashed p-4 text-center">
          <span className="icon-tile mx-auto h-9 w-9 bg-bg-elevated text-text-tertiary">
            <Inbox className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="mt-3 text-small font-medium text-text-primary">
            No new feed items
          </p>
          <p className="mt-1 text-caption text-text-secondary">
            New items only appear through manual triage — nothing is
            ingested automatically.
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
