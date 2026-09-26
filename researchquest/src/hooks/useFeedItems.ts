import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import type {
  FeedItem,
  FeedItemStatus,
  FeedItemType,
  FeedPromoteTarget,
} from "../types/database";
import { logger } from "../utils/logger";
import {
  cacheKeyForList,
  readListCache,
  writeListCache,
} from "../lib/idbCache";
import { useFeedItemsStore } from "../store/feedItemsStore";

export const FEED_ITEM_TYPES = ["paper", "job", "news", "custom"] as const;
export const FEED_ITEM_STATUSES = [
  "new",
  "triaged",
  "archived",
  "promoted",
] as const;

/** Server page cap: the feed list is windowed, never unbounded. */
export const FEED_ITEMS_PAGE_SIZE = 100;
/** Initial client window (virtualized via "Show more" increments). */
export const FEED_ITEMS_INITIAL_WINDOW = 50;
export const FEED_ITEMS_WINDOW_STEP = 50;

export type FeedTypeFilter = FeedItemType | "all";
export type FeedStatusFilter = FeedItemStatus | "all";

interface UseFeedItemsOptions {
  type?: FeedTypeFilter;
  status?: FeedStatusFilter;
  limit?: number;
  enabled?: boolean;
  /** Sole network/realtime owner. Non-owners read the hoisted store. */
  owner?: boolean;
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

export function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("Supabase URL is not configured.");
  }
  return `${baseUrl}/functions/v1/api/v1`;
}

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

/**
 * Single transport error surface: every feed fetch/mutation maps failures
 * through here so the rail and the full view show the same message and the
 * same retry affordance (refreshFeedItems).
 */
export const FEED_LIST_ERROR_MESSAGE = "Couldn't load feeds. Retry?";
export const FEED_MUTATION_ERROR_MESSAGE = "Feed update failed. Retry?";

function toFeedErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export function useFeedItems(
  userId: string | undefined,
  options: UseFeedItemsOptions = {},
) {
  const {
    type = "all",
    status = "all",
    limit,
    enabled = true,
    // Single-owner default: AppDataOwners holds the only fetcher/realtime
    // subscription (owner: true). Views/rails read the hoisted store.
    owner = false,
  } = options;
  const allItems = useFeedItemsStore((state) => state.items);
  const loading = useFeedItemsStore((state) => state.loading);
  const error = useFeedItemsStore((state) => state.error);
  const setItems = useFeedItemsStore((state) => state.setItems);
  const setLoading = useFeedItemsStore((state) => state.setLoading);
  const setError = useFeedItemsStore((state) => state.setError);
  const [actionItemId, setActionItemId] = useState<string | null>(null);

  const items = useMemo(() => {
    const filtered = allItems.filter((item) =>
      feedItemMatchesFilters(item, type, status),
    );
    return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
  }, [allItems, limit, status, type]);

  const fetchFeedItems = useCallback(async () => {
    if (!userId || !enabled) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const cacheKey = cacheKeyForList("feed_items", userId);

    try {
      const cached = await readListCache<FeedItem>(cacheKey);
      if (cached?.data.length) {
        setItems(sortFeedItems(cached.data));
        setLoading(false);
      }

      const { data, error: fetchError } = await supabase
        .from("feed_items")
        .select("*")
        .eq("user_id", userId)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(FEED_ITEMS_PAGE_SIZE);

      if (fetchError) {
        logger.error("Failed to fetch feed items", fetchError);
        setError(toFeedErrorMessage(fetchError, FEED_LIST_ERROR_MESSAGE));
        return;
      }

      const rows = sortFeedItems((data ?? []) as FeedItem[]).slice(
        0,
        FEED_ITEMS_PAGE_SIZE,
      );
      setItems(rows);
      setError(null);
      await writeListCache(cacheKey, rows);
    } catch (fetchError) {
      logger.error("Failed to fetch feed items", fetchError);
      setError(toFeedErrorMessage(fetchError, FEED_LIST_ERROR_MESSAGE));
    } finally {
      setLoading(false);
    }
  }, [enabled, setError, setItems, setLoading, userId]);

  useEffect(() => {
    if (!owner) return;

    void fetchFeedItems();

    if (!userId || !enabled) {
      return;
    }

    const subscription = supabase
      .channel(`feed_items_realtime_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_items",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchFeedItems();
        },
      )
      .subscribe((subscriptionStatus) => {
        logger.log("Feed items subscription status:", subscriptionStatus);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [enabled, fetchFeedItems, owner, userId]);

  const persistFeedCache = useCallback(
    async (nextItems: FeedItem[]) => {
      if (!userId) return;
      try {
        await writeListCache(
          cacheKeyForList("feed_items", userId),
          nextItems.slice(0, FEED_ITEMS_PAGE_SIZE),
        );
      } catch (cacheError) {
        logger.error("Failed to persist feed items cache", cacheError);
      }
    },
    [userId],
  );

  const updateFeedItemStatus = useCallback(
    async (itemId: string, nextStatus: Extract<FeedItemStatus, "new" | "triaged" | "archived">) => {
      if (!userId) {
        toast.error("You must be logged in to triage feeds");
        return false;
      }

      const previousItems = useFeedItemsStore.getState().items;
      setActionItemId(itemId);
      setItems((current) =>
        current.map((item) =>
          item.id === itemId
            ? { ...item, status: nextStatus, updated_at: new Date().toISOString() }
            : item,
        ),
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
        const message = toFeedErrorMessage(updateError, FEED_MUTATION_ERROR_MESSAGE);
        setError(message);
        toast.error(message);
        return false;
      }

      setItems((current) => {
        const merged = current.some((item) => item.id === data.id)
          ? current.map((item) => (item.id === data.id ? data as FeedItem : item))
          : [data as FeedItem, ...current];
        const sorted = sortFeedItems(merged);
        void persistFeedCache(sorted);
        return sorted;
      });

      if (nextStatus === "archived") {
        toast.success("Feed item archived");
      }
      return true;
    },
    [persistFeedCache, setError, setItems, userId],
  );

  /**
   * Batch/txn write: one `.in()` UPDATE for many items with a single
   * optimistic patch and single rollback. Used by "Archive all visible".
   */
  const updateFeedItemsStatusBatch = useCallback(
    async (
      itemIds: string[],
      nextStatus: Extract<FeedItemStatus, "new" | "triaged" | "archived">,
    ) => {
      if (!userId) {
        toast.error("You must be logged in to triage feeds");
        return false;
      }
      if (itemIds.length === 0) return true;

      const previousItems = useFeedItemsStore.getState().items;
      const now = new Date().toISOString();
      setItems((current) =>
        current.map((item) =>
          itemIds.includes(item.id)
            ? { ...item, status: nextStatus, updated_at: now }
            : item,
        ),
      );

      const { data, error: batchError } = await supabase
        .from("feed_items")
        .update({ status: nextStatus })
        .in("id", itemIds)
        .eq("user_id", userId)
        .select("*");

      if (batchError || !data || data.length !== itemIds.length) {
        logger.error("Failed to batch-update feed items", batchError);
        setItems(previousItems);
        const message =
          !batchError && data
            ? `Only ${data.length} of ${itemIds.length} feed items updated — retry the remainder`
            : toFeedErrorMessage(batchError, FEED_MUTATION_ERROR_MESSAGE);
        setError(message);
        toast.error(message);
        return false;
      }

      const updatedById = new Map(
        (data as FeedItem[]).map((row) => [row.id, row]),
      );
      setItems((current) => {
        const sorted = sortFeedItems(
          current.map((item) => updatedById.get(item.id) ?? item),
        );
        void persistFeedCache(sorted);
        return sorted;
      });
      toast.success(
        `${itemIds.length} feed item${itemIds.length === 1 ? "" : "s"} ${nextStatus}`,
      );
      return true;
    },
    [persistFeedCache, setError, setItems, userId],
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

      // Validate + dedupe against the local store before any network call.
      const current = useFeedItemsStore.getState().items.find(
        (item) => item.id === itemId,
      );
      if (!current) {
        toast.error("Feed item not found. Refresh and try again.");
        return null;
      }
      if (current.status === "promoted") {
        toast.info("Already promoted — no duplicate created.");
        return null;
      }
      if (current.status === "archived") {
        toast.error("Archived items can't be promoted. Mark it new first.");
        return null;
      }

      // Confirm: promotion creates a real paper/task/note.
      const confirmed =
        typeof window === "undefined" ||
        window.confirm(
          `Promote "${current.title}" to ${target}? This creates a new ${target}.`,
        );
      if (!confirmed) return null;

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
        const previousStatus = current.status;
        setItems((prev) => {
          const sorted = sortFeedItems(
            prev.map((item) =>
              item.id === promoted.item.id ? promoted.item : item,
            ),
          );
          void persistFeedCache(sorted);
          return sorted;
        });
        // Undo reverts the feed status (the promoted copy is kept — the
        // toast says so honestly).
        toast.success(`Promoted to ${target}`, {
          description: "Undo reverts the feed status; the new copy is kept.",
          action: {
            label: "Undo",
            onClick: () => {
              void updateFeedItemStatus(
                itemId,
                previousStatus === "triaged" ? "triaged" : "new",
              );
            },
          },
        });
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
    [persistFeedCache, setError, setItems, updateFeedItemStatus, userId],
  );

  return {
    items,
    loading,
    error,
    actionItemId,
    refreshFeedItems: fetchFeedItems,
    archiveFeedItem,
    markFeedItemTriaged,
    promoteFeedItem,
    updateFeedItemsStatusBatch,
  };
}
