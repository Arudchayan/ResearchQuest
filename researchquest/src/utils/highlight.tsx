import { Fragment, type ReactNode } from "react";

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

export function highlightMatch(text: string, query: string): ReactNode {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return text;
  }

  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.toLowerCase() === normalized.toLowerCase()) {
      return (
        <mark
          key={`highlight-${index}`}
          className="rounded-sm bg-primary-200 px-0.5 py-0.5 text-primary-900 dark:bg-primary-900/50 dark:text-primary-100"
        >
          {part}
        </mark>
      );
    }
    return <Fragment key={`text-${index}`}>{part}</Fragment>;
  });
}
