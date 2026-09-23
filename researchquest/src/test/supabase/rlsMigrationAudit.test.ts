/**
 * Static RLS/migration audit (plan item 88, PR3-rls).
 *
 * Verifies, without a live database, that the migration chain leaves the
 * schema in a hardened state:
 *  1. Every table declared in supabase/tables/*.sql has ENABLE ROW LEVEL
 *     SECURITY plus CREATE POLICY coverage in supabase/migrations/*.sql.
 *  2. Owner-scoped UPDATE policies on the core tables carry WITH CHECK in the
 *     initPlan-friendly (select auth.uid()) form (plan item 81).
 *  3. Effective CREATE POLICY expressions wrap auth.* / current_setting() as
 *     (select …) so auth_rls_initplan stays clear (Supabase lint 0003).
 *  4. Topic junction FKs used by RLS have covering indexes.
 *  5. No migration (re)creates an exec_sql RPC (removed in 1764410000).
 *  6. Every SECURITY DEFINER function's *effective* (last-in-chain)
 *     definition pins SET search_path.
 *
 * Checks 2-6 evaluate the concatenated migrations in filename order so later
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

/** Tables flagged live for auth_rls_initplan (planner_catalog USING (true) omitted). */
const AUTH_RLS_INITPLAN_TABLES = [
  "api_key_audit",
  "api_keys",
  "daily_logs",
  "feed_items",
  "feed_sources",
  "focus_sessions",
  "ideas",
  "links",
  "notes",
  "papers",
  "planner_state",
  "research_achievements",
  "research_goals",
  "research_milestones",
  "research_projects",
  "tasks",
  "topic_ideas",
  "topic_notes",
  "topic_papers",
  "topic_quests",
  "topics",
  "user_profiles",
] as const;

function policyKey(table: string, policyName: string): string {
  return `${table}::${policyName}`;
}

/**
 * Last CREATE POLICY per (table, name) after applying DROP/CREATE in file order.
 * Dynamic EXECUTE format(...) policy DDL is ignored; those tables must still
 * have a literal CREATE POLICY in a later migration for this audit.
 */
function effectivePolicies(migrations: SqlFile[]): Map<string, string> {
  const policies = new Map<string, string>();
  const token =
    /\b(?:DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?|CREATE\s+POLICY\s+)("([^"]+)"|[A-Za-z_]\w*)\s+ON\s+((?:public\s*\.\s*)?[A-Za-z_"]+)([^;]*)/gi;

  for (const { sql } of migrations) {
    token.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = token.exec(sql)) !== null) {
      const isDrop = /^\s*DROP\s+POLICY/i.test(match[0]);
      const policyName = match[2] ?? match[1];
      const table = normalizeTableName(match[3]);
      const key = policyKey(table, policyName);
      if (isDrop) {
        policies.delete(key);
        continue;
      }
      policies.set(key, match[0]);
    }
  }
  return policies;
}

function hasUnwrappedInitPlanCall(statement: string): boolean {
  const withoutWrapped = statement
    .replace(/\(\s*select\s+auth\.[A-Za-z_]+\s*\(\s*\)\s*\)/gi, "")
    .replace(
      /\(\s*select\s+current_setting\s*\((?:[^()]|\([^()]*\))*\)\s*\)/gi,
      "",
    );
  return (
    /\bauth\.[A-Za-z_]+\s*\(/i.test(withoutWrapped) ||
    /\bcurrent_setting\s*\(/i.test(withoutWrapped)
  );
}

function hasLeadingIndex(
  migrationsSql: string,
  table: string,
  column: string,
): boolean {
  const pattern = new RegExp(
    `CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?[\\s\\S]{0,120}?ON\\s+${tableRefPattern(table)}\\s*\\(\\s*${column}\\b`,
    "i",
  );
  return pattern.test(migrationsSql);
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
    expect(tables.size).toBe(21);

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

  it("wraps effective RLS auth helpers as (select auth.uid()) for initPlan", async () => {
    const migrations = await readSqlDir(migrationsDir);
    const policies = effectivePolicies(migrations);
    const missing: string[] = [];
    const unwrapped: string[] = [];

    for (const table of AUTH_RLS_INITPLAN_TABLES) {
      const owned = [...policies.entries()].filter(([key]) =>
        key.startsWith(`${table}::`),
      );
      if (owned.length === 0) {
        missing.push(table);
        continue;
      }
      for (const [key, statement] of owned) {
        if (hasUnwrappedInitPlanCall(statement)) unwrapped.push(key);
      }
    }

    expect(missing).toEqual([]);
    expect(unwrapped).toEqual([]);
  });

  it("covers topic junction FK columns used by RLS", async () => {
    const migrations = await readSqlDir(migrationsDir);
    const allMigrations = migrations.map((file) => file.sql).join("\n");
    const missing: string[] = [];
    const required: Array<[string, string]> = [
      ["topic_ideas", "idea_id"],
      ["topic_ideas", "user_id"],
      ["topic_notes", "note_id"],
      ["topic_notes", "user_id"],
      ["topic_papers", "paper_id"],
      ["topic_papers", "user_id"],
      ["topic_quests", "topic_id"],
    ];
    for (const [table, column] of required) {
      if (!hasLeadingIndex(allMigrations, table, column)) {
        missing.push(`${table}.${column}`);
      }
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

  it("mirrors prod harden_rpc_security_definer (auth-bound RPCs + revoked trigger EXECUTE)", async () => {
    const migrations = await readSqlDir(migrationsDir);
    const hardening = migrations.find((file) =>
      file.name.includes("harden_rpc_security_definer"),
    );
    expect(hardening).toBeDefined();
    expect(hardening?.sql).toMatch(/auth\.uid\(\)/);
    expect(hardening?.sql).toMatch(/REVOKE\s+EXECUTE[\s\S]*evaluate_user_streaks/i);
    expect(hardening?.sql).toMatch(/REVOKE\s+EXECUTE[\s\S]*ensure_user_id/i);
    expect(hardening?.sql).toMatch(/search_path\s*=\s*public/i);
  });
});
