export const formatTimeUntil = (dateString: string) => {
  const due = new Date(dateString)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()

  if (diffMs <= 0) {
    return 'due now'
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  if (diffMinutes < 60) {
    return `${diffMinutes}m`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h`
  }

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

export const formatDateLabel = (dateString: string) => {
  const due = new Date(dateString)
  return due.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
