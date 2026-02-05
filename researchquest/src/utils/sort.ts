export function sortByUpdatedAt<T extends { updated_at: string | null | undefined }>(items: T[]): T[] {
  // Optimization: Use string comparison for ISO dates to avoid expensive Date object creation
  return [...items].sort((a, b) => {
    const timeA = a.updated_at || ''
    const timeB = b.updated_at || ''
    if (timeA === timeB) return 0
    return timeB > timeA ? 1 : -1
  })
}
