const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Canonical "today" key (`YYYY-MM-DD`) — the single date authority (item 42).
 *
 * Every "is it still today / fetch today's rows" decision in the app must
 * derive from this function: daily missions, `daily_logs` lookups, and
 * dashboard day math.
 *
 * Local-vs-UTC decision: LOCAL calendar day (device timezone), consistent
 * with `parseDateInput`'s local handling of date-only strings and the
 * `daily_logs.date` DATE-column semantics (a calendar day, not an instant).
 * This deliberately differs from `new Date().toISOString().split("T")[0]`
 * (UTC day), which would roll missions/XP over at the wrong local hour for
 * users away from UTC around midnight.
 */
export function todayKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const parseDateInput = (
  dateString: string | undefined | null,
): Date | null => {
  if (!dateString) {
    return null;
  }

  if (DATE_ONLY_REGEX.test(dateString)) {
    const [year, month, day] = dateString.split("-").map(Number);
    if (!year || !month || !day) {
      return null;
    }
    // Construct the date in the user's local timezone to avoid UTC offset issues
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatTimeUntil = (dateString: string) => {
  const due = parseDateInput(dateString);
  if (!due) {
    return "unknown";
  }

  const now = new Date();
  const diffMs = due.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "due now";
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
};

export const formatDateLabel = (dateString: string) => {
  const due = parseDateInput(dateString);
  if (!due) {
    return "N/A";
  }

  return due.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};
