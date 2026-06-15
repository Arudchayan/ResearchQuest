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
 * Returns the top N items from an array according to a comparison function.
 * This runs in O(N * N) worst case but O(N) if the array is already mostly sorted or N is very small.
 * It does not mutate the original array and doesn't sort the whole array.
 */
export function getTopN<T>(
  items: T[],
  n: number,
  compareFn: (a: T, b: T) => number
): T[] {
  if (n <= 0) return [];
  const topN: T[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let insertIndex = topN.length;

    while (insertIndex > 0 && compareFn(item, topN[insertIndex - 1]) < 0) {
      insertIndex--;
    }

    if (insertIndex < n) {
      topN.splice(insertIndex, 0, item);
      if (topN.length > n) {
        topN.pop();
      }
    }
  }

  return topN;
}
