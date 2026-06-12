export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }

  return deduped.reverse();
}

/**
 * Returns the top N items from an array based on a comparison function.
 * Optimized to run in O(N) time for small N, avoiding a full array sort.
 */
export function getTopN<T>(items: T[], n: number, compare: (a: T, b: T) => number): T[] {
  if (n <= 0) return [];
  if (items.length <= n) return [...items].sort(compare);

  const topN = items.slice(0, n).sort(compare);

  for (let i = n; i < items.length; i++) {
    const item = items[i];
    if (compare(item, topN[n - 1]) < 0) {
      let j = n - 2;
      while (j >= 0 && compare(item, topN[j]) < 0) {
        j--;
      }
      topN.splice(j + 1, 0, item);
      topN.pop();
    }
  }

  return topN;
}
