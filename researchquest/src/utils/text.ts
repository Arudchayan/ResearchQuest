
/**
 * Counts the number of words in a string.
 * Uses a simple regex to split by whitespace.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  // Match non-whitespace sequences
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
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
