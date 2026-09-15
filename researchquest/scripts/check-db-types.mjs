#!/usr/bin/env node
/**
 * PR21 item 94 — offline drift check for hand-maintained DB types.
 *
 * Compares `supabase/tables/*.sql` (schema source of truth) against the
 * checked-in `src/types/database.ts`:
 *   1. every mapped table must have a matching exported TS interface;
 *   2. every column of a mapped table must appear as a property of that
 *      interface (optional `?` allowed).
 *
 * Tables without a TS equivalent yet are reported as warnings, not failures.
 * Live regeneration: `pnpm db:types` (requires SUPABASE_PROJECT_ID).
 * See docs/runbook.md ("Database types").
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const tablesDir = join(repoRoot, "supabase", "tables");
const dbTypesPath = join(here, "..", "src", "types", "database.ts");

// table.sql (without extension) -> exported TS interface name.
const TABLE_INTERFACE_MAP = {
  daily_logs: "DailyLog",
  feed_items: "FeedItem",
  feed_sources: "FeedSource",
  ideas: "Idea",
  links: "Link",
  notes: "Note",
  papers: "Paper",
  tasks: "Task",
  topics: "Topic",
  topic_quests: "TopicQuest",
  user_profiles: "UserProfile",
};

const COLUMN_TYPE_RE =
  /^\s*([a-z][a-z0-9_]*)\s+(TEXT|VARCHAR|UUID|TIMESTAMPTZ|TIMESTAMP|BOOLEAN|BOOL|JSONB|INTEGER|INT|BIGINT|NUMERIC|DATE|SMALLINT)\b/i;

function parseTableColumns(sql) {
  const columns = [];
  for (const line of sql.split("\n")) {
    const match = line.match(COLUMN_TYPE_RE);
    if (match) columns.push(match[1]);
  }
  return columns;
}

function extractInterfaceBody(source, interfaceName) {
  const marker = `export interface ${interfaceName} `;
  const start = source.indexOf(marker);
  if (start === -1) return null;
  const open = source.indexOf("{", start);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

function interfaceHasProperty(body, column) {
  const re = new RegExp(`(^|[\\s{;,])${column}\\s*\\??:`);
  return re.test(body);
}

const dbTypes = readFileSync(dbTypesPath, "utf8");
const tableFiles = readdirSync(tablesDir).filter((f) => f.endsWith(".sql"));

const errors = [];
const warnings = [];

for (const file of tableFiles.sort()) {
  const table = file.replace(/\.sql$/, "");
  const interfaceName = TABLE_INTERFACE_MAP[table];
  if (!interfaceName) {
    warnings.push(
      `${table}: no TS interface mapped (add one or extend TABLE_INTERFACE_MAP)`,
    );
    continue;
  }
  const body = extractInterfaceBody(dbTypes, interfaceName);
  if (body === null) {
    errors.push(`${table}: expected interface "${interfaceName}" not found`);
    continue;
  }
  const columns = parseTableColumns(readFileSync(join(tablesDir, file), "utf8"));
  for (const column of columns) {
    if (!interfaceHasProperty(body, column)) {
      errors.push(`${table}.${column}: missing from interface "${interfaceName}"`);
    }
  }
}

for (const warning of warnings) console.warn(`warn: ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`drift: ${error}`);
  console.error(
    "\nChecked-in src/types/database.ts is stale vs supabase/tables/*.sql.\n" +
      "Regenerate with `pnpm db:types` (needs SUPABASE_PROJECT_ID) or update the\n" +
      "interface by hand to match the schema, then re-run `pnpm db:types:check`.",
  );
  process.exit(1);
}
console.log(
  `db types OK: ${tableFiles.length} tables checked (${warnings.length} unmapped).`,
);
