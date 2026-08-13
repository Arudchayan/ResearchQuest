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
      .trim() || "Untitled Note"
  );
}
