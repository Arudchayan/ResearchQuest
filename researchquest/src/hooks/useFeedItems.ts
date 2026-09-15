import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { DEFAULT_PAGE_SIZE } from "../lib/pagination";
import type {
  FeedItem,
  FeedItemStatus,
  FeedItemType,
  FeedPromoteTarget,
} from "../types/database";
import { logger } from "../utils/logger";

export const FEED_ITEM_TYPES = ["paper", "job", "news", "custom"] as const;
export const FEED_ITEM_STATUSES = [
  "new",
  "triaged",
  "archived",
  "promoted",
] as const;

export type FeedTypeFilter = FeedItemType | "all";
export type FeedStatusFilter = FeedItemStatus | "all";

interface UseFeedItemsOptions {
  type?: FeedTypeFilter;
  status?: FeedStatusFilter;
  limit?: number;
  enabled?: boolean;
  /**
   * Rows per page for `range()` pagination. Defaults to `limit` (fixed
   * window, e.g. the rail's `limit: 5`) or 20. Grow the window with
   * `loadMore()`; `hasMore` reports whether another page may exist.
   */
  pageSize?: number;
}

interface PromoteResponse {
  target: FeedPromoteTarget;
  entity: unknown;
  item: FeedItem;
}

function compareFeedItems(a: FeedItem, b: FeedItem) {
  const aTime = Date.parse(a.published_at ?? a.created_at);
  const bTime = Date.parse(b.published_at ?? b.created_at);
  return bTime - aTime;
}

function sortFeedItems(items: FeedItem[]) {
  return [...items].sort(compareFeedItems);
}

function feedItemMatchesFilters(
  item: FeedItem,
  type: FeedTypeFilter,
  status: FeedStatusFilter,
) {
  return (type === "all" || item.type === type) &&
    (status === "all" || item.status === status);
}

function getApiBaseUrl() {
  return `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/api/v1`;
}

// --- Single-owner realtime registry (plan item 47) ---------------------------
// One channel per userId shared by every mounted useFeedItems instance; each
// instance registers its own refetch handler. The channel closes when the
// last instance unmounts.
interface FeedChannelEntry {
  sub: { unsubscribe: () => unknown };
  refCount: number;
  handlers: Set<() => void>;
}

const feedChannels = new Map<string, FeedChannelEntry>();

function acquireFeedChannel(
  name: string,
  handler: () => void,
  subscribe: (notify: () => void) => { unsubscribe: () => unknown },
): void {
  let entry = feedChannels.get(name);
  if (!entry) {
    const handlers = new Set<() => void>();
    const sub = subscribe(() => {
      handlers.forEach((h) => {
        try {
          h();
        } catch {
          // One failing instance must not break the others.
        }
      });
    });
    entry = { sub, refCount: 0, handlers };
    feedChannels.set(name, entry);
  }
  entry.handlers.add(handler);
  entry.refCount += 1;
}

function releaseFeedChannel(name: string, handler: () => void): void {
  const entry = feedChannels.get(name);
  if (!entry) return;
  entry.handlers.delete(handler);
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    feedChannels.delete(name);
    try {
      entry.sub.unsubscribe();
    } catch {
      // Releasing must never throw during unmount cleanup.
    }
  }
}

/** Test-only reset for the feed channel registry. */
export function resetFeedChannelsForTests(): void {
  for (const name of [...feedChannels.keys()]) {
    const entry = feedChannels.get(name);
    feedChannels.delete(name);
    try {
      entry?.sub.unsubscribe();
    } catch {
      // ignore
    }
  }
  feedInflightByKey.clear();
}

// --- Fetch dedupe (plan item 46) -------------------------------------------
// One in-flight request per query window, shared by every mounted instance:
// the StrictMode double-effect and a realtime refetch racing a fetch reuse it
// instead of issuing duplicate network requests.
const feedInflightByKey = new Map<string, Promise<FeedItem[]>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractApiErrorMessage(body: unknown, fallback: string) {
  if (
    isRecord(body) &&
    isRecord(body.error) &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }
  return fallback;
}

export function useFeedItems(
  userId: string | undefined,
  options: UseFeedItemsOptions = {},
) {
  const { type = "all", status = "all", limit, enabled = true, pageSize } = options;
  // `limit` keeps its legacy meaning as the window size (FeedsRail's
  // `limit: 5` still fetches exactly 5 rows initially); `pageSize` overrides
  // it when both are given. The window grows by `loadMore()` via `range()`.
  const windowSize = Math.max(
    1,
    Math.floor(pageSize ?? limit ?? DEFAULT_PAGE_SIZE),
  );
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [pages, setPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Reset the window when the query identity changes.
  const filterKey = `${userId ?? ""}|${type}|${status}|${enabled}|${windowSize}`;
  const prevFilterKeyRef = useRef(filterKey);
  if (prevFilterKeyRef.current !== filterKey) {
    prevFilterKeyRef.current = filterKey;
    setPages(1);
    setHasMore(false);
  }

  // Generation guard: stale fetches (filter change, loadMore race, unmount)
  // must not commit over fresher state (plan item 46).
  const fetchGenRef = useRef(0);

  const fetchFeedItems = useCallback(async () => {
    const gen = (fetchGenRef.current += 1);
    if (!userId || !enabled) {
      setItems([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Paged window (plan item 41): range() instead of an unbounded select.
    const windowEnd = pages * windowSize - 1;
    const requestKey = `${filterKey}|${pages}`;

    const runFeedQuery = async (): Promise<FeedItem[]> => {
      let query = supabase
        .from("feed_items")
        .select("*")
        .eq("user_id", userId);

      if (type !== "all") {
        query = query.eq("type", type);
      }
      if (status !== "all") {
        query = query.eq("status", status);
      }

      query = query
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      const { data, error: fetchError } = await query.range(0, windowEnd);

      if (fetchError) {
        throw fetchError;
      }
      return sortFeedItems((data ?? []) as FeedItem[]);
    };

    try {
      let flight = feedInflightByKey.get(requestKey);
      if (!flight) {
        flight = runFeedQuery();
        feedInflightByKey.set(requestKey, flight);
        const settled = flight;
        void settled.then(
          () => {
            if (feedInflightByKey.get(requestKey) === settled) {
              feedInflightByKey.delete(requestKey);
            }
          },
          () => {
            if (feedInflightByKey.get(requestKey) === settled) {
              feedInflightByKey.delete(requestKey);
            }
          },
        );
      }
      const rows = await flight;

      if (fetchGenRef.current !== gen) return; // stale: discard

      setItems(rows);
      // A full window means the server may hold more rows.
      setHasMore(rows.length > windowEnd);
    } catch (fetchError) {
      if (fetchGenRef.current !== gen) return; // stale: discard
      logger.error("Failed to fetch feed items", fetchError);
      setError("Failed to load feeds");
      setHasMore(false);
    } finally {
      if (fetchGenRef.current === gen) setLoading(false);
    }
  }, [enabled, filterKey, pages, status, type, userId, windowSize]);

  const loadMore = useCallback(() => {
    if (hasMore) setPages((p) => p + 1);
  }, [hasMore]);

  const fetchRef = useRef(fetchFeedItems);
  fetchRef.current = fetchFeedItems;

  useEffect(() => {
    void fetchFeedItems();
  }, [fetchFeedItems]);

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    const channelName = `feed_items_realtime_${userId}`;
    const handler = () => {
      void fetchRef.current();
    };
    acquireFeedChannel(channelName, handler, (notify) =>
      supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "feed_items",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            notify();
          },
        )
        .subscribe((subscriptionStatus) => {
          logger.log("Feed items subscription status:", subscriptionStatus);
        }),
    );

    return () => {
      releaseFeedChannel(channelName, handler);
    };
  }, [enabled, userId]);

  const updateFeedItemStatus = useCallback(
    async (itemId: string, nextStatus: Extract<FeedItemStatus, "new" | "triaged" | "archived">) => {
      if (!userId) {
        toast.error("You must be logged in to triage feeds");
        return false;
      }

      const previousItems = items;
      setActionItemId(itemId);
      setItems((current) =>
        current
          .map((item) =>
            item.id === itemId
              ? { ...item, status: nextStatus, updated_at: new Date().toISOString() }
              : item,
          )
          .filter((item) => feedItemMatchesFilters(item, type, status)),
      );

      const { data, error: updateError } = await supabase
        .from("feed_items")
        .update({ status: nextStatus })
        .eq("id", itemId)
        .eq("user_id", userId)
        .select("*")
        .single();

      setActionItemId(null);

      if (updateError || !data) {
        logger.error("Failed to update feed item status", updateError);
        setItems(previousItems);
        toast.error("Failed to update feed item");
        return false;
      }

      setItems((current) => {
        const merged = current.some((item) => item.id === data.id)
          ? current.map((item) => (item.id === data.id ? data as FeedItem : item))
          : [data as FeedItem, ...current];
        return sortFeedItems(
          merged.filter((item) => feedItemMatchesFilters(item, type, status)),
        );
      });

      if (nextStatus === "archived") {
        toast.success("Feed item archived");
      }
      return true;
    },
    [items, status, type, userId],
  );

  const archiveFeedItem = useCallback(
    (itemId: string) => updateFeedItemStatus(itemId, "archived"),
    [updateFeedItemStatus],
  );

  const markFeedItemTriaged = useCallback(
    (itemId: string) => updateFeedItemStatus(itemId, "triaged"),
    [updateFeedItemStatus],
  );

  const promoteFeedItem = useCallback(
    async (itemId: string, target: FeedPromoteTarget) => {
      if (!userId) {
        toast.error("You must be logged in to promote feeds");
        return null;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Your session expired. Please sign in again.");
        return null;
      }

      setActionItemId(itemId);

      try {
        const response = await fetch(
          `${getApiBaseUrl()}/feed-items/${encodeURIComponent(itemId)}/promote`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ target }),
          },
        );
        const body = await response.json();

        if (!response.ok) {
          const message = extractApiErrorMessage(body, "Failed to promote feed item");
          toast.error(message);
          setError(message);
          return null;
        }

        const promoted = body as PromoteResponse;
        setItems((current) =>
          sortFeedItems(
            current
              .map((item) => (item.id === promoted.item.id ? promoted.item : item))
              .filter((item) => feedItemMatchesFilters(item, type, status)),
          ),
        );
        toast.success(`Promoted to ${target}`);
        return promoted;
      } catch (promoteError) {
        logger.error("Failed to promote feed item", promoteError);
        toast.error("Failed to promote feed item");
        setError("Failed to promote feed item");
        return null;
      } finally {
        setActionItemId(null);
      }
    },
    [status, type, userId],
  );

  return {
    items,
    loading,
    error,
    actionItemId,
    refreshFeedItems: fetchFeedItems,
    hasMore,
    loadMore,
    archiveFeedItem,
    markFeedItemTriaged,
    promoteFeedItem,
  };
}
