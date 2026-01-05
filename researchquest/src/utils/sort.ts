const getUpdatedAtTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export const sortByUpdatedAt = <T extends { updated_at: string | null | undefined }>(
  items: T[],
): T[] => {
  return [...items].sort(
    (a, b) => getUpdatedAtTimestamp(b.updated_at) - getUpdatedAtTimestamp(a.updated_at),
  )
}
