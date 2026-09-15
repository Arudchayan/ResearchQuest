/**
 * Shared pagination helpers for the data-fetching layer (plan item 41).
 *
 * Supabase PostgREST pagination is [`range(from, to)`] (inclusive) or
 * [`limit(n)`]. All list fetches should page through one of these instead of
 * unbounded `select()` calls; UI lists then render a client-side window via
 * `usePaginatedList` (see `hooks/usePaginatedList.ts`) on top of virtualized
 * views.
 */

/** Default page size for feed-style lists (matches SEARCH_LIMIT). */
export const DEFAULT_PAGE_SIZE = 20;

/** Default page size for entity lists (notes / papers / ideas). */
export const ENTITY_PAGE_SIZE = 50;

/**
 * Safety bound for the global sync fetches in `useDataSync`. The store keeps
 * full collections for search/filtering; views render a windowed slice.
 */
export const DATA_SYNC_ROW_LIMIT = 1000;

/**
 * Convert a 0-based page + page size into an inclusive Supabase range.
 * `pageRange(0, 20)` -> `{ from: 0, to: 19 }`.
 */
export function pageRange(
  page: number,
  pageSize: number,
): { from: number; to: number } {
  const safePage = Math.max(0, Math.floor(page));
  const safeSize = Math.max(1, Math.floor(pageSize));
  return { from: safePage * safeSize, to: (safePage + 1) * safeSize - 1 };
}

/**
 * Client-side window slice: first `visibleCount` items of an array.
 * Pure helper backing `usePaginatedList`; kept separate so it is unit
 * testable without React.
 */
export function paginateItems<T>(items: readonly T[], visibleCount: number): T[] {
  if (visibleCount <= 0) return [];
  if (visibleCount >= items.length) return [...items];
  return items.slice(0, visibleCount);
}
