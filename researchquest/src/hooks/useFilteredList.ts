import { useMemo } from "react";

/**
 * A generic hook for filtering, searching, and sorting a list of items.
 *
 * Filters by text query first, then applies an optional filter predicate,
 * then sorts.
 *
 * @param items - The list of items to filter (can be null/undefined).
 * @param searchQuery - The search query string.
 * @param searchableFields - A function that returns the searchable text (space-joined fields) for an item. The hook lowercases it internally.
 * @param sortFn - Optional comparator for sorting the filtered results.
 * @param filterFn - Optional predicate for additional filtering beyond text search.
 * @returns A new filtered and sorted array.
 */
export function useFilteredList<T>(
  items: T[] | undefined | null,
  searchQuery: string,
  searchableFields: (item: T) => string,
  sortFn?: (a: T, b: T) => number,
  filterFn?: (item: T) => boolean,
): T[] {
  return useMemo(() => {
    const normalizedQuery = searchQuery?.trim().toLowerCase() || "";
    const source = items || [];

    // Optimization: Skip search iteration if no query and no extra filter
    if (!normalizedQuery && !filterFn) {
      const allItems = [...source];
      if (sortFn) {
        return allItems.sort(sortFn);
      }
      return allItems;
    }

    const results: T[] = [];
    for (const item of source) {
      if (filterFn && !filterFn(item)) {
        continue;
      }
      if (normalizedQuery && !searchableFields(item).toLowerCase().includes(normalizedQuery)) {
        continue;
      }
      results.push(item);
    }

    if (sortFn) {
      results.sort(sortFn);
    }

    return results;
  }, [items, searchQuery, searchableFields, sortFn, filterFn]);
}
