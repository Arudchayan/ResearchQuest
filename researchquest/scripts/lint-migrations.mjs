#!/usr/bin/env node
/**
 * Migration-order lint (PR9 item 12).
 *
 * Verifies that `supabase/migrations/*.sql` apply in filename order with no
 * duplicate timestamps:
 *  - every file matches `<timestamp>_<name>.sql` (numeric timestamp prefix)
 *  - filenames are already in ascending (byte-wise) order
 *  - no two files share the same timestamp prefix
 *
 * Run: `pnpm run lint:migrations` (from researchquest/)
 * Exit 0 on pass, 1 with a diagnostic list on failure.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, "..", "..", "supabase", "migrations");

const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
const sorted = [...files].sort();
const errors = [];

const stampRe = /^(\d+)_([a-z0-9_]+\.sql)$/;
const seen = new Map();
for (const file of files) {
  const match = stampRe.exec(file);
  if (!match) {
    errors.push(`bad filename (expected <timestamp>_<snake_name>.sql): ${file}`);
    continue;
  }
  const [, stamp] = match;
  if (seen.has(stamp)) {
    errors.push(`duplicate timestamp ${stamp}: ${seen.get(stamp)} and ${file}`);
  } else {
    seen.set(stamp, file);
  }
}

const inOrder = files.every((f, i) => f === sorted[i]);
if (!inOrder) {
  const firstMismatch = files.findIndex((f, i) => f !== sorted[i]);
  errors.push(
    `migrations out of filename order at index ${firstMismatch}: ` +
      `found ${files[firstMismatch]}, expected ${sorted[firstMismatch]}`,
  );
}

if (files.length === 0) {
  errors.push("no *.sql migrations found");
}

if (errors.length > 0) {
  console.error(`migration-order lint FAILED (${errors.length} problem(s)):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`migration-order lint OK: ${files.length} migrations in order, no duplicate timestamps.`);
