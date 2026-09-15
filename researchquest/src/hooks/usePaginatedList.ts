/**
 * Client-side windowing + infinite scroll primitives (plan item 41).
 *
 * Server pagination (`range()`/`limit()`) bounds what we fetch; these hooks
 * bound what we *render*: lists expose an initial window and grow it via
 * `loadMore`, typically driven by an IntersectionObserver sentinel through
 * `useInfiniteScroll`. Works on top of virtualized views (`useVirtualizer`)
 * and plain lists alike.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ENTITY_PAGE_SIZE } from "../lib/pagination";
import { paginateItems } from "../lib/pagination";

export interface PaginatedList<T> {
  /** Currently visible window of items. */
  visibleItems: T[];
  /** Total item count (unwindowed). */
  totalCount: number;
  /** Whether more items exist beyond the visible window. */
  hasMore: boolean;
  /** Grow the window by one page. */
  loadMore: () => void;
  /** Collapse back to the first page. */
  reset: () => void;
  /** Current window size (items). */
  visibleCount: number;
}

/**
 * Window `items` to `pageSize` rows, growing by one page per `loadMore()`.
 * Resets to the first page when the identity of `items` changes.
 */
export function usePaginatedList<T>(
  items: readonly T[],
  pageSize: number = ENTITY_PAGE_SIZE,
): PaginatedList<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const [pages, setPages] = useState(1);
  const itemsRef = useRef(items);
  if (itemsRef.current !== items) {
    itemsRef.current = items;
    setPages(1);
  }

  const visibleCount = pages * safePageSize;
  const visibleItems = paginateItems(items, visibleCount);

  const loadMore = useCallback(() => {
    setPages((p) => p + 1);
  }, []);
  const reset = useCallback(() => {
    setPages(1);
  }, []);

  return {
    visibleItems,
    totalCount: items.length,
    hasMore: visibleCount < items.length,
    loadMore,
    reset,
    visibleCount: Math.min(visibleCount, items.length),
  };
}

interface InfiniteScrollOptions {
  /** Disable observation (e.g. while loading or when `hasMore` is false). */
  enabled?: boolean;
  /** Pre-fetch distance around the sentinel. */
  rootMargin?: string;
}

/**
 * Observe a sentinel element and call `loadMore` when it scrolls into view.
 * Safe without IntersectionObserver (SSR/jsdom): then it simply never fires
 * and callers drive `loadMore` imperatively.
 */
export function useInfiniteScroll(
  loadMore: () => void,
  { enabled = true, rootMargin = "400px" }: InfiniteScrollOptions = {},
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    if (!enabled) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) loadMoreRef.current();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return sentinelRef;
}

/** Debounce any value (used for search-as-you-type). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
