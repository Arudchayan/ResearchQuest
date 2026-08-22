export interface BibTeXEntry {
  id: string;
  type: string;
  title?: string;
  authors?: string[];
  year?: string;
  journal?: string;
  booktitle?: string;
  publisher?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  raw?: string;
  [key: string]: any;
}

/**
 * Robust BibTeX parser.
 * Handles nested braces, quoted strings, and mixed types.
 */
export function parseBibTeX(input: string): BibTeXEntry[] {
  if (!input || typeof input !== "string") return [];

  const entries: BibTeXEntry[] = [];
  let pos = 0;

  while (pos < input.length) {
    // Find start of entry '@'
    const atIndex = input.indexOf("@", pos);
    if (atIndex === -1) break;

    // Check if it's a comment or preamble (ignore for now)
    // We assume @type{...

    // Update raw start position
    const entryStart = atIndex;
    pos = atIndex + 1;

    // Parse type
    // Match @type{
    const typeMatch = input.substring(pos).match(/^([a-zA-Z]+)\s*\{/);
    if (!typeMatch) {
      // Not a valid entry start, skip
      pos++;
      continue;
    }

    const type = typeMatch[1]!.toLowerCase();

    // Move pos to after '{'
    pos += typeMatch[0]!.length;

    // Find the end of the entry (matching brace)
    let braceCount = 1;
    let blockEnd = -1;

    // We start scanning from current pos (inside the entry)
    let scanPos = pos;

    while (scanPos < input.length) {
      const char = input[scanPos];
      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;
      }

      if (braceCount === 0) {
        blockEnd = scanPos;
        break;
      }
      scanPos++;
    }

    if (blockEnd === -1) {
      // Unclosed entry, abort parsing this chunk
      // Try to recover by searching for next @
      pos = atIndex + 1;
      continue;
    }

    // Extract content inside the main braces
    const content = input.substring(pos, blockEnd);

    // Find the ID (first token before comma)
    const firstCommaIndex = content.indexOf(",");
    let id = "";
    let body = "";

    if (firstCommaIndex !== -1) {
      id = content.substring(0, firstCommaIndex).trim();
      body = content.substring(firstCommaIndex + 1);
    } else {
      // Maybe entry has no fields? @misc{key}
      id = content.trim();
      body = "";
    }

    // Skip if we shouldn't parse this type
    if (type !== "comment" && type !== "preamble" && type !== "string") {
      const entry: BibTeXEntry = {
        id,
        type,
        raw: input.substring(entryStart, blockEnd + 1),
      };

      parseFields(body, entry);
      entries.push(entry);
    }

    pos = blockEnd + 1;
  }

  return entries;
}

function parseFields(body: string, entry: BibTeXEntry) {
  let cursor = 0;

  while (cursor < body.length) {
    // Skip whitespace and commas
    while (cursor < body.length && /[\s,]/.test(body[cursor]!)) cursor++;
    if (cursor >= body.length) break;

    // Parse key
    // Key is alphanumeric + - _ . :
    const keyMatch = body.substring(cursor).match(/^([a-zA-Z0-9\-_.:]+)\s*=/);
    if (!keyMatch) {
      cursor++; // Skip invalid character and try again
      continue;
    }

    const key = keyMatch[1]!.toLowerCase();
    cursor += keyMatch[0]!.length;

    // Skip whitespace after =
    while (cursor < body.length && /\s/.test(body[cursor]!)) cursor++;

    if (cursor >= body.length) break;

    // Parse value
    let value = "";
    const char = body[cursor];

    if (char === "{") {
      // Braced value: { ... }
      let balance = 1;
      const start = cursor + 1;
      cursor++; // Enter brace

      while (cursor < body.length && balance > 0) {
        if (body[cursor] === "{") balance++;
        else if (body[cursor] === "}") balance--;

        if (balance > 0) cursor++;
      }

      // cursor is at closing brace
      value = body.substring(start, cursor);
      cursor++; // consume closing brace
    } else if (char === '"') {
      // Quoted value: " ... "
      const start = cursor + 1;
      cursor++;
      while (cursor < body.length) {
        if (body[cursor] === '"') {
          // Check for escaped quote? BibTeX doesn't strictly support \" inside "..."
          // but usually relies on braces inside quotes for special chars.
          break;
        }
        if (body[cursor] === "\\") cursor++; // Skip escape
        cursor++;
      }
      value = body.substring(start, cursor);
      cursor++; // consume closing quote
    } else {
      // Numeric or raw string (up to comma or closing brace of entry - but we are processing body)
      // Basically read until comma or whitespace or } (though } shouldn't appear if not braced)
      // Standard says: run of chars not containing space, comma, brace, quote, equals
      // But here we rely on simple delimiter scan
      let end = cursor;
      while (end < body.length && !/[\s,}]/.test(body[end]!)) {
        end++;
      }
      value = body.substring(cursor, end);
      cursor = end;
    }

    // Normalize whitespace in value
    const cleanValue = value.replace(/[\r\n\s]+/g, " ").trim();

    // Post-process specific fields
    if (key === "author") {
      entry.authors = parseAuthors(cleanValue);
    } else if (key === "year" || key === "date") {
      const yearMatch = cleanValue.match(/\d{4}/);
      entry.year = yearMatch ? yearMatch[0] : cleanValue;
    } else {
      // Handle common "double brace" issue in BibTeX titles {{Title}} -> {Title}
      // Our parser stripped the outer {}. So {{Title}} became {Title}.
      // We typically want "Title".
      // But actually, {Title} means "preserve case".
      // If we strip it, we get Title.
      // Let's strip one level if present.
      let processed = cleanValue;
      if (processed.startsWith("{") && processed.endsWith("}")) {
        processed = processed.substring(1, processed.length - 1);
      }

      // Prevent prototype pollution
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }

      entry[key] = processed;
    }
  }
}

function parseAuthors(authorString: string): string[] {
  // Split by " and " (case insensitive)
  return authorString.split(/\s+and\s+/i).map((a) => {
    // Clean up extra whitespace
    let clean = a.trim();
    // Remove outer braces if any (e.g. {Corporate Author})
    if (clean.startsWith("{") && clean.endsWith("}")) {
      clean = clean.substring(1, clean.length - 1);
    }
    return clean;
  });
}
