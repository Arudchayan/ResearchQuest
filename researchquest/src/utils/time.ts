const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
