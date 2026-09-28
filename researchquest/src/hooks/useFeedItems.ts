import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
/** @deprecated Client windowing was replaced by server keyset pagination. */
export const FEED_ITEMS_INITIAL_WINDOW = 50;
export const FEED_ITEMS_WINDOW_STEP = 50;

export type FeedTypeFilter = FeedItemType | "all";
export type FeedStatusFilter = FeedItemStatus | "all";

export interface FeedListCursor {
  published_at: string | null;
  created_at: string;
  id: string;
}

interface UseFeedItemsOptions {
  type?: FeedTypeFilter;
  status?: FeedStatusFilter;
  limit?: number;
  enabled?: boolean;
  /** Sole network/realtime owner. Non-owners read the hoisted store. */
  owner?: boolean;
  /**
   * Inbox mode: apply type/status filters on the server, exact-count the
   * active filter, and page older rows with a keyset cursor.
   */
  paged?: boolean;
}

interface PromoteResponse {
  target: FeedPromoteTarget;
  entity: unknown;
  item: FeedItem;
}

interface RealtimePayload {
  eventType: string;
  new: FeedItem | null;
  old: { id?: unknown } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function feedItemMatchesFilters(
  item: FeedItem,
  type: FeedTypeFilter,
  status: FeedStatusFilter,
) {
  return (type === "all" || item.type === type) &&
    (status === "all" || item.status === status);
}

export function compareFeedItems(a: FeedItem, b: FeedItem) {
  const aPublished = a.published_at;
  const bPublished = b.published_at;
  if (aPublished && bPublished && aPublished !== bPublished) {
    return bPublished.localeCompare(aPublished);
  }
  if (aPublished && !bPublished) return -1;
  if (!aPublished && bPublished) return 1;
  if (a.created_at !== b.created_at) {
    return b.created_at.localeCompare(a.created_at);
  }
  return b.id.localeCompare(a.id);
}

function sortFeedItems(items: FeedItem[]) {
  return [...items].sort(compareFeedItems);
}

type EqChain = { eq: (column: string, value: string) => EqChain };

export function applyFeedItemListFilters<Q extends EqChain>(
  query: Q,
  params: {
    userId: string;
    type: FeedTypeFilter;
    status: FeedStatusFilter;
  },
): Q {
  let next: EqChain = query.eq("user_id", params.userId);
  if (params.type !== "all") next = next.eq("type", params.type);
  if (params.status !== "all") next = next.eq("status", params.status);
  return next as Q;
}

export function feedItemsKeysetOrFilter(cursor: FeedListCursor): string {
  const created = quotePostgrestValue(cursor.created_at);
  const id = quotePostgrestValue(cursor.id);
  if (cursor.published_at == null) {
    return [
      `and(published_at.is.null,created_at.lt.${created})`,
      `and(published_at.is.null,created_at.eq.${created},id.lt.${id})`,
    ].join(",");
  }
  const published = quotePostgrestValue(cursor.published_at);
  return [
    `published_at.lt.${published}`,
    `and(published_at.eq.${published},created_at.lt.${created})`,
    `and(published_at.eq.${published},created_at.eq.${created},id.lt.${id})`,
    "published_at.is.null",
  ].join(",");
}

type OrChain = { or: (filters: string) => OrChain };

export function applyFeedItemKeysetCursor<Q extends OrChain>(
  query: Q,
  cursor: FeedListCursor | null,
): Q {
  if (!cursor) return query;
  return query.or(feedItemsKeysetOrFilter(cursor)) as Q;
}

export function applyFeedItemOlderThanFilter<Q extends OrChain>(
  query: Q,
  olderThanDays: number | null | undefined,
  now: Date = new Date(),
): Q {
  if (
    olderThanDays == null ||
    !Number.isFinite(olderThanDays) ||
    olderThanDays <= 0
  ) {
    return query;
  }
  const cutoff = new Date(
    now.getTime() - olderThanDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const quoted = quotePostgrestValue(cutoff);
  return query.or(
    `published_at.lt.${quoted},and(published_at.is.null,created_at.lt.${quoted})`,
  ) as Q;
}

export function feedItemCursorFromRow(item: FeedItem): FeedListCursor {
  return {
    published_at: item.published_at ?? null,
    created_at: item.created_at,
    id: item.id,
  };
}

export function mergeRealtimeFeedItem(
  current: FeedItem[],
  payload: RealtimePayload,
  options: {
    type: FeedTypeFilter;
    status: FeedStatusFilter;
    userId?: string;
    cap?: number;
  },
): { items: FeedItem[]; countDelta: number; refetch: boolean } {
  if (payload.eventType === "DELETE") {
    const oldId = payload.old?.id;
    if (typeof oldId !== "string") {
      return { items: current, countDelta: 0, refetch: true };
    }
    const existed = current.some((item) => item.id === oldId);
    return {
      items: current.filter((item) => item.id !== oldId),
      countDelta: existed ? -1 : 0,
      refetch: false,
    };
  }

  const row = payload.new;
  if (!row || typeof row.id !== "string") {
    return { items: current, countDelta: 0, refetch: true };
  }
  if (options.userId && row.user_id !== options.userId) {
    return { items: current, countDelta: 0, refetch: true };
  }

  const matches = feedItemMatchesFilters(row, options.type, options.status);
  const existingIndex = current.findIndex((item) => item.id === row.id);
  if (!matches) {
    if (existingIndex === -1) {
      return { items: current, countDelta: 0, refetch: false };
    }
    return {
      items: current.filter((item) => item.id !== row.id),
      countDelta: -1,
      refetch: false,
    };
  }

  const countDelta = existingIndex === -1 ? 1 : 0;
  const next = existingIndex === -1
    ? [row, ...current]
    : current.map((item) => (item.id === row.id ? row : item));
  const sorted = sortFeedItems(next);
  return {
    items: typeof options.cap === "number"
      ? sorted.slice(0, options.cap)
      : sorted,
    countDelta,
    refetch: false,
  };
}

const ARXIV_ID_RE =
  /(?:arXiv:)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+\/\d{7})/i;

export function arxivIdFromFeedItem(item: FeedItem): string | null {
  const payload = isRecord(item.payload) ? item.payload : {};
  const candidates = [
    payload.arxiv_id,
    payload.arxivId,
    payload.id,
    item.external_id,
    item.url,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    const match = candidate.match(ARXIV_ID_RE);
    if (match?.[1]) return match[1];
  }
  return null;
}

function authorsFromPayload(payload: Record<string, unknown>): string[] | undefined {
  const authors = payload.authors ?? payload.author;
  if (Array.isArray(authors)) {
    const values = authors.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    return values.length > 0 ? values : undefined;
  }
  if (typeof authors === "string" && authors.trim()) {
    return authors
      .split(/,|;/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return undefined;
}

export function buildPromotePaperFields(item: FeedItem): Record<string, unknown> {
  const payload = isRecord(item.payload) ? item.payload : {};
  const arxivId = arxivIdFromFeedItem(item);
  const sourceUrl =
    (typeof item.url === "string" && item.url.trim()) ||
    (arxivId ? `https://arxiv.org/abs/${arxivId}` : undefined);
  const abstractFromPayload =
    typeof payload.abstract === "string" ? payload.abstract.trim() : "";
  const abstract = abstractFromPayload || item.summary || undefined;
  const authors = authorsFromPayload(payload);
  const fields: Record<string, unknown> = { title: item.title };
  if (authors?.length) fields.authors = authors;
  if (abstract) fields.abstract = abstract;
  if (sourceUrl) fields.source_url = sourceUrl;
  if (typeof payload.doi === "string" && payload.doi.trim()) {
    fields.doi = payload.doi.trim();
  }
  return fields;
}

export function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("Supabase URL is not configured.");
  }
  return `${baseUrl}/functions/v1/api/v1`;
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

type NeqChain = { neq: (column: string, value: string) => NeqChain };

function applyArchiveExclusions<Q extends NeqChain>(query: Q): Q {
  return query.neq("status", "archived").neq("status", "promoted") as Q;
}

function scopedFeedQuery<T>(
  query: T,
  params: {
    userId: string;
    type: FeedTypeFilter;
    status: FeedStatusFilter;
  },
  extras?: {
    cursor?: FeedListCursor | null;
    olderThanDays?: number | null;
    excludeArchivedAndPromoted?: boolean;
  },
): T {
  let next: EqChain & OrChain & NeqChain = applyFeedItemListFilters(
    query as EqChain,
    params,
  ) as EqChain & OrChain & NeqChain;
  if (extras?.cursor) {
    next = applyFeedItemKeysetCursor(next, extras.cursor) as EqChain &
      OrChain &
      NeqChain;
  }
  if (extras?.olderThanDays != null) {
    next = applyFeedItemOlderThanFilter(next, extras.olderThanDays) as EqChain &
      OrChain &
      NeqChain;
  }
  if (extras?.excludeArchivedAndPromoted) {
    next = applyArchiveExclusions(next);
  }
  return next as T;
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
    paged = false,
  } = options;
  const allItems = useFeedItemsStore((state) => state.items);
  const storeLoading = useFeedItemsStore((state) => state.loading);
  const storeError = useFeedItemsStore((state) => state.error);
  const setItems = useFeedItemsStore((state) => state.setItems);
  const setLoading = useFeedItemsStore((state) => state.setLoading);
  const setError = useFeedItemsStore((state) => state.setError);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [pagedItems, setPagedItems] = useState<FeedItem[]>([]);
  const [pagedTotalCount, setPagedTotalCount] = useState(0);
  const [pagedLoading, setPagedLoading] = useState(paged);
  const [pagedError, setPagedError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const pagedItemsRef = useRef<FeedItem[]>([]);
  const pagedTotalCountRef = useRef(0);
  const promoteInFlightRef = useRef(new Set<string>());

  pagedItemsRef.current = pagedItems;
  pagedTotalCountRef.current = pagedTotalCount;

  const storeItems = useMemo(() => {
    const filtered = allItems.filter((item) =>
      feedItemMatchesFilters(item, type, status),
    );
    return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
  }, [allItems, limit, status, type]);

  const items = paged ? pagedItems : storeItems;
  const loading = paged ? pagedLoading : storeLoading;
  const error = paged ? pagedError : storeError;
  const totalCount = paged ? pagedTotalCount : storeItems.length;
  const hasMore = paged && pagedItems.length < pagedTotalCount;

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
        .order("id", { ascending: false })
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

  const fetchPagedFeedItems = useCallback(
    async (cursor: FeedListCursor | null = null) => {
      if (!userId || !enabled) {
        setPagedItems([]);
        setPagedTotalCount(0);
        setPagedLoading(false);
        setLoadingOlder(false);
        return;
      }

      if (cursor) {
        setLoadingOlder(true);
      } else {
        setPagedLoading(true);
        setPagedError(null);
      }

      const cacheKey = cacheKeyForList(
        "feed_items",
        `${userId}:${type}:${status}`,
      );

      try {
        if (!cursor) {
          const cached = await readListCache<FeedItem>(cacheKey);
          if (cached?.data.length) {
            setPagedItems(sortFeedItems(cached.data));
            setPagedLoading(false);
          }
        }

        const listQuery = scopedFeedQuery(
          supabase.from("feed_items").select("*"),
          { userId, type, status },
          { cursor },
        );
        const { data, error: fetchError } = await listQuery
          .order("published_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(FEED_ITEMS_PAGE_SIZE);

        if (fetchError) {
          logger.error("Failed to fetch feed items", fetchError);
          const message = toFeedErrorMessage(fetchError, FEED_LIST_ERROR_MESSAGE);
          setPagedError(message);
          return;
        }

        const rows = (data ?? []) as FeedItem[];

        if (!cursor) {
          const { count, error: countError } = await scopedFeedQuery(
            supabase
              .from("feed_items")
              .select("*", { count: "exact", head: true }),
            { userId, type, status },
          );
          if (countError) {
            logger.error("Failed to count feed items", countError);
            setPagedError(
              toFeedErrorMessage(countError, FEED_LIST_ERROR_MESSAGE),
            );
            return;
          }
          const nextItems = sortFeedItems(rows);
          setPagedItems(nextItems);
          setPagedTotalCount(count ?? nextItems.length);
          setPagedError(null);
          await writeListCache(cacheKey, nextItems);
          return;
        }

        const existingIds = new Set(
          pagedItemsRef.current.map((item) => item.id),
        );
        const added = rows.filter((row) => !existingIds.has(row.id));
        if (added.length === 0) {
          setPagedTotalCount(pagedItemsRef.current.length);
          return;
        }
        const combined = [...pagedItemsRef.current, ...added];
        setPagedItems(combined);
        setPagedError(null);
      } catch (fetchError) {
        logger.error("Failed to fetch feed items", fetchError);
        setPagedError(toFeedErrorMessage(fetchError, FEED_LIST_ERROR_MESSAGE));
      } finally {
        setPagedLoading(false);
        setLoadingOlder(false);
      }
    },
    [enabled, status, type, userId],
  );

  /**
   * Incremental realtime merge: INSERT/UPDATE upsert by id, DELETE removes by
   * id. Falls back to a full fetch on unknown payload shapes so the list can
   * never silently diverge. Manual refresh stays available via
   * refreshFeedItems (fetchFeedItems).
   */
  const applyFeedItemEvent = useCallback(
    (payload: {
      eventType: string;
      new: Record<string, unknown> | null;
      old: Record<string, unknown> | null;
    }) => {
      const merged = mergeRealtimeFeedItem(
        useFeedItemsStore.getState().items,
        {
          eventType: payload.eventType,
          new: payload.new as FeedItem | null,
          old: payload.old,
        },
        { type: "all", status: "all", userId, cap: FEED_ITEMS_PAGE_SIZE },
      );
      if (merged.refetch) {
        void fetchFeedItems();
        return;
      }
      setItems(merged.items);
      void persistFeedCache(merged.items);
    },
    [fetchFeedItems, persistFeedCache, setItems, userId],
  );

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
        (payload) => {
          applyFeedItemEvent({
            eventType: payload.eventType,
            new: (payload.new ?? null) as Record<string, unknown> | null,
            old: (payload.old ?? null) as Record<string, unknown> | null,
          });
        },
      )
      .subscribe((subscriptionStatus) => {
        logger.log("Feed items subscription status:", subscriptionStatus);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [applyFeedItemEvent, enabled, fetchFeedItems, owner, userId]);

  useEffect(() => {
    if (!paged) return;

    void fetchPagedFeedItems(null);

    if (!userId || !enabled) {
      return;
    }

    const subscription = supabase
      .channel(`feed_items_inbox_${userId}_${type}_${status}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_items",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const merged = mergeRealtimeFeedItem(
            pagedItemsRef.current,
            {
              eventType: payload.eventType,
              new: (payload.new ?? null) as FeedItem | null,
              old: (payload.old ?? null) as { id?: unknown } | null,
            },
            { type, status, userId },
          );
          if (merged.refetch) {
            void fetchPagedFeedItems(null);
            return;
          }
          pagedItemsRef.current = merged.items;
          setPagedItems(merged.items);
          if (merged.countDelta !== 0) {
            const nextCount = Math.max(
              0,
              pagedTotalCountRef.current + merged.countDelta,
            );
            pagedTotalCountRef.current = nextCount;
            setPagedTotalCount(nextCount);
          }
        },
      )
      .subscribe((subscriptionStatus) => {
        logger.log("Feed inbox subscription status:", subscriptionStatus);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [enabled, fetchPagedFeedItems, paged, status, type, userId]);

  const updateFeedItemStatus = useCallback(
    async (itemId: string, nextStatus: Extract<FeedItemStatus, "new" | "triaged" | "archived">) => {
      if (!userId) {
        toast.error("You must be logged in to triage feeds");
        return false;
      }

      const previousStoreItems = useFeedItemsStore.getState().items;
      const previousPagedItems = pagedItemsRef.current;
      const previousPagedCount = pagedTotalCountRef.current;
      setActionItemId(itemId);
      const patch = (current: FeedItem[]) =>
        current.map((item) =>
          item.id === itemId
            ? { ...item, status: nextStatus, updated_at: new Date().toISOString() }
            : item,
        );
      setItems(patch);
      if (paged) setPagedItems(patch);

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
        setItems(previousStoreItems);
        if (paged) {
          setPagedItems(previousPagedItems);
          setPagedTotalCount(previousPagedCount);
          setPagedError(
            toFeedErrorMessage(updateError, FEED_MUTATION_ERROR_MESSAGE),
          );
        }
        const message = toFeedErrorMessage(updateError, FEED_MUTATION_ERROR_MESSAGE);
        setError(message);
        toast.error(message);
        return false;
      }

      const applyRow = (current: FeedItem[]) => {
        const merged = mergeRealtimeFeedItem(
          current,
          { eventType: "UPDATE", new: data as FeedItem, old: { id: itemId } },
          {
            type: paged ? type : "all",
            status: paged ? status : "all",
            userId,
            cap: paged ? undefined : FEED_ITEMS_PAGE_SIZE,
          },
        );
        return merged;
      };
      const storeMerged = applyRow(useFeedItemsStore.getState().items);
      setItems(storeMerged.items);
      void persistFeedCache(storeMerged.items);
      if (paged) {
        const pagedMerged = applyRow(pagedItemsRef.current);
        pagedItemsRef.current = pagedMerged.items;
        setPagedItems(pagedMerged.items);
        if (pagedMerged.countDelta !== 0) {
          const nextCount = Math.max(
            0,
            pagedTotalCountRef.current + pagedMerged.countDelta,
          );
          pagedTotalCountRef.current = nextCount;
          setPagedTotalCount(nextCount);
        }
      }

      if (nextStatus === "archived") {
        toast.success("Feed item archived");
      }
      return true;
    },
    [paged, persistFeedCache, setError, setItems, status, type, userId],
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

  const loadOlderFeedItems = useCallback(async () => {
    if (!paged || loadingOlder || pagedLoading) return;
    const loaded = pagedItemsRef.current;
    const last = loaded[loaded.length - 1];
    if (!last) return;
    if (pagedItemsRef.current.length >= pagedTotalCountRef.current) return;
    await fetchPagedFeedItems(feedItemCursorFromRow(last));
  }, [fetchPagedFeedItems, loadingOlder, paged, pagedLoading]);

  const archiveMatchingFeedItems = useCallback(
    async (olderThanDays?: number | null) => {
      if (!userId) {
        toast.error("You must be logged in to triage feeds");
        return false;
      }

      const cutoffDays =
        olderThanDays != null && Number.isFinite(olderThanDays) && olderThanDays > 0
          ? olderThanDays
          : null;

      const { count, error: countError } = await scopedFeedQuery(
        supabase.from("feed_items").select("*", { count: "exact", head: true }),
        { userId, type, status },
        { olderThanDays: cutoffDays, excludeArchivedAndPromoted: true },
      );

      if (countError) {
        const message = toFeedErrorMessage(countError, FEED_MUTATION_ERROR_MESSAGE);
        if (paged) setPagedError(message);
        setError(message);
        toast.error(message);
        return false;
      }

      const archiveCount = count ?? 0;
      if (archiveCount === 0) {
        toast.info("No matching feed items to archive.");
        return true;
      }

      const daysLabel = cutoffDays
        ? ` older than ${cutoffDays} day${cutoffDays === 1 ? "" : "s"}`
        : "";
      const confirmed =
        typeof window === "undefined" ||
        window.confirm(
          `Archive ${archiveCount} matching feed item${archiveCount === 1 ? "" : "s"}${daysLabel}?`,
        );
      if (!confirmed) return false;

      const previousStoreItems = useFeedItemsStore.getState().items;
      const previousPagedItems = pagedItemsRef.current;
      const previousPagedCount = pagedTotalCountRef.current;
      const cutoffMs = cutoffDays
        ? Date.now() - cutoffDays * 24 * 60 * 60 * 1000
        : null;
      const shouldDrop = (item: FeedItem) => {
        if (item.status === "archived" || item.status === "promoted") return false;
        if (!feedItemMatchesFilters(item, type, status)) return false;
        if (cutoffMs != null) {
          const timestamp = Date.parse(item.published_at ?? item.created_at);
          if (!(timestamp < cutoffMs)) return false;
        }
        return true;
      };

      setItems((current) => current.filter((item) => !shouldDrop(item)));
      if (paged) {
        const nextItems = previousPagedItems.filter((item) => !shouldDrop(item));
        pagedItemsRef.current = nextItems;
        setPagedItems(nextItems);
        const nextCount = Math.max(0, previousPagedCount - archiveCount);
        pagedTotalCountRef.current = nextCount;
        setPagedTotalCount(nextCount);
      }

      const { error: updateError } = await scopedFeedQuery(
        supabase.from("feed_items").update({ status: "archived" }),
        { userId, type, status },
        { olderThanDays: cutoffDays, excludeArchivedAndPromoted: true },
      ).select("id");

      if (updateError) {
        logger.error("Failed to archive matching feed items", updateError);
        setItems(previousStoreItems);
        if (paged) {
          pagedItemsRef.current = previousPagedItems;
          setPagedItems(previousPagedItems);
          pagedTotalCountRef.current = previousPagedCount;
          setPagedTotalCount(previousPagedCount);
          setPagedError(
            toFeedErrorMessage(updateError, FEED_MUTATION_ERROR_MESSAGE),
          );
        }
        const message = toFeedErrorMessage(
          updateError,
          FEED_MUTATION_ERROR_MESSAGE,
        );
        setError(message);
        toast.error(message);
        return false;
      }

      toast.success(
        `${archiveCount} feed item${archiveCount === 1 ? "" : "s"} archived`,
      );
      if (paged) void fetchPagedFeedItems(null);
      return true;
    },
    [fetchPagedFeedItems, paged, setError, setItems, status, type, userId],
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
      if (promoteInFlightRef.current.has(itemId)) {
        return null;
      }

      const current =
        pagedItemsRef.current.find((item) => item.id === itemId) ??
        useFeedItemsStore.getState().items.find((item) => item.id === itemId);
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

      promoteInFlightRef.current.add(itemId);
      setActionItemId(itemId);

      try {
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

        const response = await fetch(
          `${getApiBaseUrl()}/feed-items/${encodeURIComponent(itemId)}/promote`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              target,
              ...(target === "paper" ? buildPromotePaperFields(current) : {}),
            }),
          },
        );
        const body = await response.json();

        if (response.status === 409) {
          toast.info("Already promoted — no duplicate created.");
          const promotedItem = { ...current, status: "promoted" as const };
          setItems((prev) =>
            sortFeedItems(
              prev.map((item) => (item.id === itemId ? promotedItem : item)),
            ),
          );
          if (paged) {
            setPagedItems((prev) => {
              const next = prev.map((item) =>
                item.id === itemId ? promotedItem : item,
              );
              pagedItemsRef.current = next;
              return next;
            });
          }
          return null;
        }

        if (!response.ok) {
          const message = extractApiErrorMessage(body, "Failed to promote feed item");
          toast.error(message);
          if (paged) setPagedError(message);
          setError(message);
          return null;
        }

        const promoted = body as PromoteResponse;
        const previousStatus = current.status;
        const applyPromoted = (prev: FeedItem[]) =>
          sortFeedItems(
            prev.map((item) =>
              item.id === promoted.item.id ? promoted.item : item,
            ),
          );
        setItems((prev) => {
          const sorted = applyPromoted(prev);
          void persistFeedCache(sorted);
          return sorted;
        });
        if (paged) {
          setPagedItems((prev) => {
            const next = applyPromoted(prev);
            pagedItemsRef.current = next;
            return next;
          });
          if (status !== "all" && status !== "promoted") {
            const nextItems = pagedItemsRef.current.filter(
              (item) => item.id !== itemId,
            );
            pagedItemsRef.current = nextItems;
            setPagedItems(nextItems);
            const nextCount = Math.max(0, pagedTotalCountRef.current - 1);
            pagedTotalCountRef.current = nextCount;
            setPagedTotalCount(nextCount);
          }
        }
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
        if (paged) setPagedError("Failed to promote feed item");
        setError("Failed to promote feed item");
        return null;
      } finally {
        promoteInFlightRef.current.delete(itemId);
        setActionItemId(null);
      }
    },
    [paged, persistFeedCache, setError, setItems, status, updateFeedItemStatus, userId],
  );

  return {
    items,
    totalCount,
    loading,
    loadingOlder,
    hasMore,
    error,
    actionItemId,
    refreshFeedItems: paged ? () => fetchPagedFeedItems(null) : fetchFeedItems,
    archiveFeedItem,
    markFeedItemTriaged,
    promoteFeedItem,
    updateFeedItemsStatusBatch,
    loadOlderFeedItems,
    archiveMatchingFeedItems,
  };
}
