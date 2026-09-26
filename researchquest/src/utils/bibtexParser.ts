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
  originalId?: string;
  [key: string]: any;
}

export interface BibTeXWarnings {
  duplicateKeys: string[];
  stringYears: string[];
}

export interface BibTeXParseResult {
  entries: BibTeXEntry[];
  warnings: BibTeXWarnings;
}

/**
 * Robust BibTeX parser.
 * Handles nested braces, quoted strings, and mixed types.
 */
export function parseBibTeX(input: string): BibTeXEntry[] {
  return parseBibTeXWithWarnings(input).entries;
}

export function parseBibTeXWithWarnings(input: string): BibTeXParseResult {
  const warnings: BibTeXWarnings = { duplicateKeys: [], stringYears: [] };
  if (!input || typeof input !== "string") return { entries: [], warnings };

  // First pass: collect @string macro definitions (case-insensitive keys).
  const stringMacros = collectStringMacros(input);

  const entries: BibTeXEntry[] = [];
  const seenIds = new Map<string, number>();
  const duplicateKeySet = new Set<string>();
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

    // Find the end of the entry (matching brace), honoring backslash escapes.
    let braceCount = 1;
    let blockEnd = -1;

    // We start scanning from current pos (inside the entry)
    let scanPos = pos;

    while (scanPos < input.length) {
      const char = input[scanPos];
      if (char === "\\") {
        // Skip escaped char (guard trailing backslash).
        scanPos++;
        if (scanPos < input.length) scanPos++;
        continue;
      }
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
      const rawId = id;
      let finalId = rawId;
      // CASE-SENSITIVE duplicate handling: first keeps id, repeats get -2, -3...
      if (seenIds.has(rawId)) {
        const count = (seenIds.get(rawId) ?? 1) + 1;
        seenIds.set(rawId, count);
        let suffix = count;
        let candidate = `${rawId}-${suffix}`;
        // Ensure generated id does not collide with an existing id.
        while (seenIds.has(candidate)) {
          suffix++;
          candidate = `${rawId}-${suffix}`;
        }
        seenIds.set(rawId, suffix);
        seenIds.set(candidate, 1);
        finalId = candidate;
        duplicateKeySet.add(rawId);
      } else {
        seenIds.set(rawId, 1);
      }

      const entry: BibTeXEntry = {
        id: finalId,
        type,
        raw: input.substring(entryStart, blockEnd + 1),
      };
      if (finalId !== rawId) {
        entry.originalId = rawId;
      }

      const stringYearVanished = parseFields(body, entry, stringMacros);
      if (stringYearVanished) {
        warnings.stringYears.push(finalId);
      }
      entries.push(entry);
    }

    pos = blockEnd + 1;
  }

  warnings.duplicateKeys = [...duplicateKeySet];

  return { entries, warnings };
}

/**
 * Scan the input for @string{...} definitions and return a map of
 * lowercased macro name -> resolved value.
 */
function collectStringMacros(input: string): Map<string, string> {
  const macros = new Map<string, string>();
  let pos = 0;
  while (pos < input.length) {
    const atIndex = input.indexOf("@", pos);
    if (atIndex === -1) break;
    pos = atIndex + 1;
    const typeMatch = input.substring(pos).match(/^([a-zA-Z]+)\s*\{/);
    if (!typeMatch) {
      pos++;
      continue;
    }
    const type = typeMatch[1]!.toLowerCase();
    pos += typeMatch[0]!.length;
    let braceCount = 1;
    let blockEnd = -1;
    let scanPos = pos;
    while (scanPos < input.length) {
      const char = input[scanPos];
      if (char === "\\") {
        scanPos++;
        if (scanPos < input.length) scanPos++;
        continue;
      }
      if (char === "{") braceCount++;
      else if (char === "}") braceCount--;
      if (braceCount === 0) {
        blockEnd = scanPos;
        break;
      }
      scanPos++;
    }
    if (blockEnd === -1) {
      pos = atIndex + 1;
      continue;
    }
    const content = input.substring(pos, blockEnd);
    if (type === "string") {
      // @string bodies are one or more key = value pairs.
      const fields = parseRawFields(content);
      for (const [rawKey, rawValue] of fields) {
        macros.set(rawKey.toLowerCase(), rawValue);
      }
    }
    pos = blockEnd + 1;
  }
  return macros;
}

/**
 * Parse a @string body (or any field list) into raw key/value pairs
 * without post-processing. Used for macro collection.
 */
function parseRawFields(body: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  let cursor = 0;
  while (cursor < body.length) {
    while (cursor < body.length && /[\s,]/.test(body[cursor]!)) cursor++;
    if (cursor >= body.length) break;
    const keyMatch = body.substring(cursor).match(/^([a-zA-Z0-9\-_.:]+)\s*=/);
    if (!keyMatch) {
      cursor++;
      continue;
    }
    const key = keyMatch[1]!;
    cursor += keyMatch[0]!.length;
    while (cursor < body.length && /\s/.test(body[cursor]!)) cursor++;
    if (cursor >= body.length) break;
    const { value, nextCursor } = readFieldValue(body, cursor);
    cursor = nextCursor;
    pairs.push([key, value]);
  }
  return pairs;
}

/**
 * Read a single field value starting at cursor. Returns the unescaped,
 * whitespace-normalized value and the cursor after the value.
 */
function readFieldValue(
  body: string,
  cursor: number
): { value: string; nextCursor: number; wasBareWord: boolean } {
  let value = "";
  let wasBareWord = false;
  const char = body[cursor];

  if (char === "{") {
    // Braced value: { ... } with backslash-escape-aware scanning.
    let balance = 1;
    const start = cursor + 1;
    cursor++; // Enter brace

    while (cursor < body.length && balance > 0) {
      const c = body[cursor];
      if (c === "\\") {
        // Skip escaped char (guard trailing backslash).
        cursor++;
        if (cursor < body.length) cursor++;
        continue;
      }
      if (c === "{") balance++;
      else if (c === "}") balance--;

      if (balance > 0) cursor++;
    }

    // cursor is at closing brace
    value = body.substring(start, cursor);
    cursor++; // consume closing brace
    value = unescapeBibTeXValue(value);
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
      if (body[cursor] === "\\") {
        cursor++; // Skip escape (guard trailing backslash below)
        if (cursor >= body.length) break;
      }
      cursor++;
    }
    value = body.substring(start, cursor);
    cursor++; // consume closing quote
    value = unescapeBibTeXValue(value);
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
    wasBareWord = true;
    // Bare words are macro references or numbers; unescape harmless but apply for consistency.
    value = unescapeBibTeXValue(value);
  }

  // Normalize whitespace in value
  const cleanValue = value.replace(/[\r\n\s]+/g, " ").trim();
  return { value: cleanValue, nextCursor: cursor, wasBareWord };
}

/**
 * Unescape one level of standard BibTeX escapes:
 * `\{` -> `{`, `\}` -> `}`, `\\` -> `\`.
 */
function unescapeBibTeXValue(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === "{" || next === "}" || next === "\\") {
        out += next;
        i++;
        continue;
      }
    }
    out += c;
  }
  return out;
}

function parseFields(
  body: string,
  entry: BibTeXEntry,
  stringMacros?: Map<string, string>
): boolean {
  let cursor = 0;
  let stringYearVanished = false;

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

    const rawKey = keyMatch[1]!;
    const key = rawKey.toLowerCase();
    cursor += keyMatch[0]!.length;

    // Skip whitespace after =
    while (cursor < body.length && /\s/.test(body[cursor]!)) cursor++;

    if (cursor >= body.length) break;

    // Prevent prototype pollution
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      // Still need to consume the value to keep cursor in sync.
      const skipped = readFieldValue(body, cursor);
      cursor = skipped.nextCursor;
      continue;
    }

    const { value: cleanValue, nextCursor, wasBareWord } = readFieldValue(body, cursor);
    cursor = nextCursor;

    // Resolve @string macros for bare-word values (case-insensitive).
    let resolvedValue = cleanValue;
    let wasFromStringMacro = false;
    if (wasBareWord && stringMacros && stringMacros.has(cleanValue.toLowerCase())) {
      resolvedValue = stringMacros.get(cleanValue.toLowerCase())!;
      wasFromStringMacro = true;
    }

    // Post-process specific fields
    if (key === "author") {
      entry.authors = parseAuthors(resolvedValue);
    } else if (key === "year" || key === "date") {
      const trimmed = resolvedValue.trim();
      if (/^\d{4}$/.test(trimmed)) {
        entry.year = trimmed;
      } else {
        // Omit non-4-digit years. Warn if a @string-defined year vanished.
        if (wasFromStringMacro) {
          stringYearVanished = true;
        }
      }
    } else {
      // Handle common "double brace" issue in BibTeX titles {{Title}} -> {Title}
      // Our parser stripped the outer {}. So {{Title}} became {Title}.
      // We typically want "Title".
      // But actually, {Title} means "preserve case".
      // If we strip it, we get Title.
      // Let's strip one level if present.
      let processed = resolvedValue;
      if (processed.startsWith("{") && processed.endsWith("}")) {
        processed = processed.substring(1, processed.length - 1);
      }

      entry[key] = processed;
    }
  }

  return stringYearVanished;
}

function parseAuthors(authorString: string): string[] {
  // Brace-depth-aware split on /\s+and\s+/i at depth 0 only.
  const parts: string[] = [];
  let cur = "";
  let depth = 0;
  let i = 0;
  while (i < authorString.length) {
    const c = authorString[i]!;
    if (c === "\\" && i + 1 < authorString.length) {
      // Preserve escape sequence in current author.
      cur += c + authorString[i + 1]!;
      i += 2;
      continue;
    }
    if (c === "{") {
      depth++;
      cur += c;
      i++;
      continue;
    }
    if (c === "}") {
      if (depth > 0) depth--;
      cur += c;
      i++;
      continue;
    }
    if (depth === 0) {
      // Try to match /\s+and\s+/i at this position.
      const rest = authorString.substring(i);
      const andMatch = rest.match(/^\s+and\s+/i);
      if (andMatch) {
        parts.push(cur);
        cur = "";
        i += andMatch[0].length;
        continue;
      }
    }
    cur += c;
    i++;
  }
  parts.push(cur);
  return parts
    .map((a) => {
      let clean = a.trim().replace(/[\r\n\s]+/g, " ");
      // Strip ONE outer brace pair.
      if (clean.startsWith("{") && clean.endsWith("}") && clean.length >= 2) {
        clean = clean.substring(1, clean.length - 1).trim().replace(/[\r\n\s]+/g, " ");
      }
      return clean;
    })
    .filter((a) => a.length > 0);
}
