/**
 * Citation text to insert at `from` in markdown `doc`.
 * At the start of a heading, list, blockquote, or fence, the citation goes
 * on its own line so the block prefix stays at column 0.
 */
export function citationInsertText(
  doc: string,
  from: number,
  citation: string,
): string {
  const lineFrom = doc.lastIndexOf("\n", from - 1) + 1;
  if (from !== lineFrom) return citation;

  const lineTo = doc.indexOf("\n", lineFrom);
  const line = doc.slice(lineFrom, lineTo === -1 ? doc.length : lineTo);
  if (isBlockLevelMarkdownLine(line)) {
    return `${citation}\n`;
  }
  return citation;
}

/** Heading, list item, blockquote, or fenced code opener/closer. */
function isBlockLevelMarkdownLine(line: string): boolean {
  const text = line.trimStart();
  return (
    /^#{1,6}(?:\s|$)/.test(text) ||
    /^(?:[-*+]|\d+[.)])(?:\s|$)/.test(text) ||
    text.startsWith(">") ||
    /^(?:`{3,}|~{3,})/.test(text)
  );
}
