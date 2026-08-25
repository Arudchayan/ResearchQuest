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
  return items
    .filter((item) => !filterFn || filterFn(item))
    .sort(compareFn)
    .slice(0, limit);
}
