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
 * Gets the top N items from an array based on a comparison function in O(N) time.
 * This is faster than sorting the entire array and slicing which is O(N log N).
 */
export function getTopN<T>(
  items: T[],
  n: number,
  compare: (a: T, b: T) => number,
): T[] {
  if (!items || items.length === 0 || n <= 0) return [];
  if (n >= items.length) {
    return [...items].sort(compare);
  }

  // Create an array to hold the top N items
  const top: T[] = [];

  for (const item of items) {
    if (top.length < n) {
      top.push(item);
      // Keep sorted as we build up to N
      if (top.length === n) {
        top.sort(compare);
      }
    } else {
      // If the current item is "better" than the worst item in our top N
      // (which is at the end of the array due to our sorting direction)
      if (compare(item, top[n - 1]) < 0) {
        // Find where to insert it to keep the array sorted
        let i = 0;
        while (i < n && compare(item, top[i]) >= 0) {
          i++;
        }

        // Shift items down to make room, discarding the worst one
        for (let j = n - 1; j > i; j--) {
          top[j] = top[j - 1];
        }
        top[i] = item;
      }
    }
  }

  return top;
}
