/**
 * Static RLS/migration audit (plan item 88, PR3-rls).
 *
 * Verifies, without a live database, that the migration chain leaves the
 * schema in a hardened state:
 *  1. Every table declared in supabase/tables/*.sql has ENABLE ROW LEVEL
 *     SECURITY plus CREATE POLICY coverage in supabase/migrations/*.sql.
 *  2. Owner-scoped UPDATE policies on the core tables carry WITH CHECK in the
 *     initPlan-friendly (select auth.uid()) form (plan item 81).
 *  3. No migration (re)creates an exec_sql RPC (removed in 1764410000).
 *  4. Every SECURITY DEFINER function's *effective* (last-in-chain)
 *     definition pins SET search_path.
 *
 * Checks 2-4 evaluate the concatenated migrations in filename order so later
 * remediations (e.g. 1764802000) count towards the effective state, while
 * historical statements remain untouched.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..", "..");
const tablesDir = path.join(repoRoot, "supabase", "tables");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");

interface SqlFile {
  name: string;
  sql: string;
}

async function readSqlDir(dir: string): Promise<SqlFile[]> {
  const entries = await readdir(dir);
  const names = entries.filter((entry) => entry.endsWith(".sql")).sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(path.join(dir, name), "utf8"),
    })),
  );
}

function normalizeTableName(raw: string): string {
  return raw.replaceAll('"', "").split(".").pop()!.toLowerCase();
}

function tablesFromSchema(sql: string): string[] {
  const names: string[] = [];
  const pattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][\w."]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql)) !== null) {
    names.push(normalizeTableName(match[1]));
  }
  return names;
}

function tableRefPattern(table: string): string {
  return `(?:public\\s*\\.\\s*)?"?${table}"?`;
}

function hasEnableRls(migrationsSql: string, table: string): boolean {
  return new RegExp(
    `ALTER\\s+TABLE\\s+${tableRefPattern(table)}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
    "i",
  ).test(migrationsSql);
}

function hasCreatePolicy(migrationsSql: string, table: string): boolean {
  return new RegExp(
    `CREATE\\s+POLICY\\s+[\\s\\S]{0,300}?ON\\s+${tableRefPattern(table)}\\b`,
    "i",
  ).test(migrationsSql);
}

/** CREATE POLICY statements (split on ;) mentioning table + FOR UPDATE. */
function updatePoliciesFor(migrationsSql: string, table: string): string[] {
  const header = new RegExp(
    `CREATE\\s+POLICY\\b[\\s\\S]*?\\bON\\s+${tableRefPattern(table)}\\b[\\s\\S]*?\\bFOR\\s+UPDATE\\b`,
    "i",
  );
  return migrationsSql
    .split(";")
    .filter((statement) => header.test(statement));
}

interface FunctionOptionState {
  file: string;
  hasSecurityDefiner: boolean;
  hasSearchPath: boolean;
}

/**
 * Map of function name -> options of its last CREATE FUNCTION definition in
 * migration order. Two definition styles exist in the chain, both handled:
 *  - post-body options: `... AS $$ <body> $$ LANGUAGE plpgsql ... ;`
 *    (options read from the `$$ LANGUAGE ... ;` terminator);
 *  - pre-body options: `... LANGUAGE plpgsql ... AS $$ <body> $$;`
 *    (options read from the header between the signature and `AS $$`).
 * EXECUTE-wrapped nested bodies (round2 uses $fn$/$body$ quoting, never a
 * bare `$$ LANGUAGE` terminator) resolve via their pre-body header.
 */
function finalFunctionOptions(migrations: SqlFile[]): Map<string, FunctionOptionState> {
  const byName = new Map<string, FunctionOptionState>();
  const createFn =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([A-Za-z_][\w$."]*)\s*\(/gi;
  const bodyStart = /AS\s*\$[A-Za-z_]*\$/i;
  const optionsTerminator = /\$\$\s*LANGUAGE\s+\w+([^;]*);/i;

  for (const { name, sql } of migrations) {
    let match: RegExpExecArray | null;
    createFn.lastIndex = 0;
    while ((match = createFn.exec(sql)) !== null) {
      const tail = sql.slice(match.index);
      const start = bodyStart.exec(tail);
      if (!start) continue;
      const header = tail.slice(0, start.index);
      if (/LANGUAGE/i.test(header)) {
        byName.set(normalizeTableName(match[1]), {
          file: name,
          hasSecurityDefiner: /SECURITY\s+DEFINER/i.test(header),
          hasSearchPath: /search_path/i.test(header),
        });
        continue;
      }
      const terminator = optionsTerminator.exec(tail);
      if (!terminator) continue;
      const options = terminator[1];
      byName.set(normalizeTableName(match[1]), {
        file: name,
        hasSecurityDefiner: /SECURITY\s+DEFINER/i.test(options),
        hasSearchPath: /search_path/i.test(options),
      });
    }
  }
  return byName;
}

describe("supabase RLS migration audit", () => {
  it("covers every supabase/tables/*.sql table with ENABLE RLS + CREATE POLICY", async () => {
    const [tableFiles, migrations] = await Promise.all([
      readSqlDir(tablesDir),
      readSqlDir(migrationsDir),
    ]);
    expect(tableFiles.length).toBeGreaterThan(0);
    expect(migrations.length).toBeGreaterThan(0);

    const tables = new Set<string>();
    for (const file of tableFiles) {
      for (const table of tablesFromSchema(file.sql)) tables.add(table);
    }
    expect(tables.size).toBeGreaterThan(0);

    const allMigrations = migrations.map((file) => file.sql).join("\n");
    const missing: string[] = [];
    for (const table of [...tables].sort()) {
      if (!hasEnableRls(allMigrations, table)) missing.push(`${table}: ENABLE RLS`);
      if (!hasCreatePolicy(allMigrations, table))
        missing.push(`${table}: CREATE POLICY`);
    }
    expect(missing).toEqual([]);
  });

  it("gives owner-scoped UPDATE policies WITH CHECK in (select auth.uid()) form", async () => {
    const migrations = await readSqlDir(migrationsDir);
    const allMigrations = migrations.map((file) => file.sql).join("\n");

    const tables = ["tasks", "papers", "notes", "ideas", "daily_logs", "links"];
    const missing: string[] = [];
    for (const table of tables) {
      const hardened = updatePoliciesFor(allMigrations, table).some(
        (statement) =>
          /WITH\s+CHECK/i.test(statement) &&
          /\(\s*select\s+auth\.uid\(\)\s*\)/i.test(statement),
      );
      if (!hardened) missing.push(table);
    }
    expect(missing).toEqual([]);
  });

  it("never (re)creates an exec_sql RPC", async () => {
    const migrations = await readSqlDir(migrationsDir);
    const allMigrations = migrations.map((file) => file.sql).join("\n");

    expect(
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION[^;]*?exec_sql/is.test(allMigrations),
    ).toBe(false);
    // The privileged helper stays dropped (1764410000).
    expect(/DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?public\.exec_sql/i.test(
      allMigrations,
    )).toBe(true);
  });

  it("pins SET search_path on every effective SECURITY DEFINER function", async () => {
    const migrations = await readSqlDir(migrationsDir);
    const violations: string[] = [];
    for (const [fn, state] of finalFunctionOptions(migrations)) {
      if (state.hasSecurityDefiner && !state.hasSearchPath) {
        violations.push(`${fn} (${state.file})`);
      }
    }
    expect(violations).toEqual([]);
  });
});
