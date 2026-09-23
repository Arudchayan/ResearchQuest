export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }

  return deduped.reverse();
}

/**
 * When a refetch returns an older snapshot of a row the client already
 * updated, keep the newer local copy. Incoming-only rows still replace;
 * current-only rows are not resurrected (so deletes stay deleted).
 */
export function preferNewerByUpdatedAt<T extends { id: string; updated_at: string }>(
  incoming: T[],
  current: T[],
): T[] {
  if (current.length === 0) return incoming;
  const currentById = new Map(current.map((item) => [item.id, item]));
  return incoming.map((item) => {
    const local = currentById.get(item.id);
    if (!local) return item;
    return Date.parse(local.updated_at) > Date.parse(item.updated_at)
      ? local
      : item;
  });
}

/**
 * PERFORMANCE OPTIMIZATION:
 * Gets the top N items from an array in a single O(N) pass without sorting the entire array.
 * Useful for widgets that only need to display a small slice of a large collection.
 */
export function getTopN<T>(
  items: T[],
  limit: number,
  compareFn: (a: T, b: T) => number,
  filterFn?: (item: T) => boolean,
): T[] {
  const top: T[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (filterFn && !filterFn(item)) continue;

    if (top.length < limit) {
      top.push(item);
      top.sort(compareFn);
    } else if (compareFn(item, top[limit - 1]) < 0) {
      let pos = limit - 2;
      while (pos >= 0 && compareFn(item, top[pos]) < 0) {
        top[pos + 1] = top[pos];
        pos--;
      }
      top[pos + 1] = item;
    }
  }
  return top;
}
