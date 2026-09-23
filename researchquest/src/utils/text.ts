export const PLACEHOLDER_NOTE_TITLE = "Untitled Note";

export function isPlaceholderNoteTitle(title: string | null | undefined): boolean {
  return !title?.trim() || title.trim() === PLACEHOLDER_NOTE_TITLE;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

/**
 * Estimates reading time based on word count.
 * Assumes average reading speed of 200 words per minute.
 */
export function estimateReadingTime(text: string): string {
  const wordCount = countWords(text);
  const wordsPerMinute = 200;
  const minutes = Math.ceil(wordCount / wordsPerMinute);

  if (wordCount === 0) return "0 min read";
  if (minutes <= 1) return "1 min read";
  return `${minutes} min read`;
}

/**
 * Extracts a title from markdown content.
 * Finds the first non-empty line and strips leading '#' characters.
 */
export function deriveTitleFromMarkdown(markdownBody: string): string {
  return (
    markdownBody
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l)
      ?.replace(/^#+\s*/, "")
      .trim() || PLACEHOLDER_NOTE_TITLE
  );
}

/** Sidebar / list title: explicit title, else first markdown line. */
export function displayNoteTitle(note: {
  title?: string | null;
  markdown_body?: string | null;
}): string {
  if (!isPlaceholderNoteTitle(note.title)) {
    return note.title!.trim();
  }
  return deriveTitleFromMarkdown(note.markdown_body ?? "");
}

/**
 * Title written to storage. Empty / "Untitled Note" is not a real title —
 * persist a derived first line, or an empty string so the placeholder stays
 * a display-only fallback.
 */
export function persistedNoteTitle(
  title: string | null | undefined,
  markdownBody: string,
): string {
  const trimmed = title?.trim() ?? "";
  if (!isPlaceholderNoteTitle(trimmed)) {
    return trimmed;
  }
  const derived = deriveTitleFromMarkdown(markdownBody);
  return isPlaceholderNoteTitle(derived) ? "" : derived;
}
