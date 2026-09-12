import { isValidUrl } from "./security";

/**
 * Allowlist transform for markdown link/image destinations rendered via
 * ReactMarkdown (`urlTransform`). Blocks `javascript:`/`data:`/`vbscript:`,
 * protocol-relative URLs, and other non-web schemes that could turn stored
 * `markdown_body`/`abstract` content into an XSS sink. Same-document anchors
 * and relative paths are preserved so note cross-links keep working.
 */
export function sanitizeMarkdownUrl(url: string): string {
  if (typeof url !== "string") return "#";
  const trimmed = url.trim();
  if (!trimmed) return "#";
  if (trimmed.startsWith("#")) return trimmed;
  if (/^\.\.?(\/|$)/.test(trimmed)) return trimmed;
  return isValidUrl(trimmed) ? trimmed : "#";
}
