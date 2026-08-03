import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
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
  const { type = "all", status = "all", limit, enabled = true } = options;
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionItemId, setActionItemId] = useState<string | null>(null);

  const fetchFeedItems = useCallback(async () => {
    if (!userId || !enabled) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
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

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        logger.error("Failed to fetch feed items", fetchError);
        setError("Failed to load feeds");
        return;
      }

      setItems(sortFeedItems((data ?? []) as FeedItem[]));
    } catch (fetchError) {
      logger.error("Failed to fetch feed items", fetchError);
      setError("Failed to load feeds");
    } finally {
      setLoading(false);
    }
  }, [enabled, limit, status, type, userId]);

  useEffect(() => {
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
  }, [enabled, fetchFeedItems, userId]);

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
    archiveFeedItem,
    markFeedItemTriaged,
    promoteFeedItem,
  };
}
