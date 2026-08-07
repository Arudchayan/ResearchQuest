import { useMemo, useRef } from "react";

/**
 * A generic hook for filtering, searching, and sorting a list of items.
 *
 * Pre-computes searchable text from items so that fast keystroke filtering
 * doesn't rebuild strings on every render. Filters by text query first,
 * then applies an optional filter predicate, then sorts.
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
  // Keep a ref to searchableFields so the pre-computation useMemo
  // only depends on `items`, avoiding unnecessary recomputation
  // when the callback reference changes.
  const searchableFieldsRef = useRef(searchableFields);
  searchableFieldsRef.current = searchableFields;

  // ⚡ PERFORMANCE OPTIMIZATION: Pre-compute derived text fields for faster searching
  const searchableItems = useMemo(() => {
    const safeItems = items || [];
    const fields = searchableFieldsRef.current;
    return safeItems.map((item) => ({
      item,
      searchText: fields(item).toLowerCase(),
    }));
  }, [items]);

  return useMemo(() => {
    const normalizedQuery = searchQuery?.trim().toLowerCase() || "";

    // Optimization: Skip search iteration if no query and no extra filter
    if (!normalizedQuery && !filterFn) {
      const allItems = searchableItems.map((si) => si.item);
      if (sortFn) {
        return allItems.sort(sortFn);
      }
      return allItems;
    }

    // ⚡ PERFORMANCE OPTIMIZATION: Iterate the pre-computed searchableItems array
    // directly instead of allocating intermediate arrays or sets.
    const results: T[] = [];
    for (const si of searchableItems) {
      if (filterFn && !filterFn(si.item)) {
        continue;
      }
      if (normalizedQuery && !si.searchText.includes(normalizedQuery)) {
        continue;
      }
      results.push(si.item);
    }

    if (sortFn) {
      results.sort(sortFn);
    }

    return results;
  }, [searchQuery, searchableItems, sortFn, filterFn]);
}
