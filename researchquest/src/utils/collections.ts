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
 * This performs a single O(N) pass, which is significantly faster than sorting the entire array and slicing it.
 */
export function getTopN<T>(
  items: T[],
  n: number,
  compareFn: (a: T, b: T) => number
): T[] {
  if (n <= 0) return [];
  if (items.length <= n) {
    return [...items].sort(compareFn);
  }

  const result: T[] = [];
  for (const item of items) {
    let i = 0;
    while (i < result.length && compareFn(item, result[i]) >= 0) {
      i++;
    }
    if (i < n) {
      result.splice(i, 0, item);
      if (result.length > n) {
        result.pop();
      }
    }
  }
  return result;
}
