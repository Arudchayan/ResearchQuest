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

export function getTopN<T>(
  items: T[],
  limit: number,
  compareFn: (a: T, b: T) => number,
  filterFn?: (item: T) => boolean,
): T[] {
  const result: T[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (filterFn && !filterFn(item)) continue;

    let insertIndex = result.length;
    while (insertIndex > 0 && compareFn(item, result[insertIndex - 1]) < 0) {
      insertIndex--;
    }

    if (insertIndex < limit) {
      result.splice(insertIndex, 0, item);
      if (result.length > limit) {
        result.pop();
      }
    }
  }
  return result;
}
