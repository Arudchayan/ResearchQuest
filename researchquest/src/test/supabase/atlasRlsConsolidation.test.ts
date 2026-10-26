/**
 * Static audit for 1765600000_atlas_rls_consolidation (atlas_* RLS).
 *
 * The atlas_* tables were created on live by migrations that are not in this
 * repo. This test therefore pins the *intent* of the consolidation migration
 * without a database:
 *  1. It is stamped after every earlier migration and each table block is
 *     guarded by to_regclass (a no-op on a fresh replay).
 *  2. Legacy TO public policies (atlas_owner_rw / atlas_linked_read /
 *     atlas_identities_owner / atlas_identities_linked_read) are dropped.
 *  3. Every CREATE POLICY targets TO authenticated (never public/anon).
 *  4. Exactly one permissive SELECT policy per table (lint 0006), and it
 *     keeps both access paths: owner (client claim) OR linked (auth.uid()).
 *  5. INSERT / UPDATE / DELETE are owner-bound; UPDATE has USING + WITH CHECK
 *     and linked users get no write policy.
 *  6. auth.uid() / current_setting() are wrapped in (select …) (lint 0003).
 *  7. Covering indexes exist for the two FKs flagged by lint 0001.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..", "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const MIGRATION = "1765600000_atlas_rls_consolidation.sql";

const ATLAS_TABLES = [
  "atlas_identities",
  "atlas_progress_snapshots",
  "atlas_proof_drafts",
  "atlas_fresh_check_attempts",
  "atlas_validation_sessions",
  "atlas_validation_scores",
  "atlas_link_checks",
] as const;

const LEGACY_POLICIES: Record<string, string[]> = {
  atlas_identities: ["atlas_identities_owner", "atlas_identities_linked_read"],
};
for (const table of ATLAS_TABLES) {
  if (table !== "atlas_identities") {
    LEGACY_POLICIES[table] = ["atlas_owner_rw", "atlas_linked_read"];
  }
}

interface Policy {
  name: string;
  table: string;
  command: string;
  roles: string;
  statement: string;
}

async function loadMigration(): Promise<string> {
  return readFile(path.join(migrationsDir, MIGRATION), "utf8");
}

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

function parsePolicies(sql: string): Policy[] {
  const policies: Policy[] = [];
  const pattern =
    /CREATE\s+POLICY\s+([A-Za-z_]\w*)\s+ON\s+public\.([A-Za-z_]\w*)\s+FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\s+TO\s+([A-Za-z_,\s]+?)\s+(USING|WITH\s+CHECK)([^;]*);/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql)) !== null) {
    policies.push({
      name: match[1],
      table: match[2],
      command: match[3].toUpperCase(),
      roles: match[4].trim().toLowerCase(),
      statement: match[0],
    });
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

const OWNER_CLAIM =
  /client_uuid\s*=\s*NULLIF\(\s*\(\s*SELECT\s+current_setting\(\s*'app\.current_atlas_client'\s*,\s*true\s*\)\s*\)\s*,\s*''\s*\)::uuid/i;
const LINKED_UID = /auth_user_id\s*=\s*\(\s*SELECT\s+auth\.uid\(\)\s*\)/i;

describe("atlas_* RLS consolidation (1765600000)", () => {
  it("is stamped after every other migration and guards each table with to_regclass", async () => {
    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(files).toContain(MIGRATION);
    const stamp = Number(MIGRATION.split("_")[0]);
    // Unique stamp, later than master's 1765300000 batch3 and the concurrent
    // save_idea_with_links migration (1765500000).
    expect(files.filter((name) => name.startsWith(`${stamp}_`))).toEqual([MIGRATION]);
    expect(stamp).toBeGreaterThan(1765500000);

    const sql = await loadMigration();
    for (const table of ATLAS_TABLES) {
      expect(sql).toMatch(
        new RegExp(`to_regclass\\('public\\.${table}'\\)\\s+IS\\s+NOT\\s+NULL`, "i"),
      );
    }
  });

  it("drops every legacy TO public atlas policy", async () => {
    const sql = stripComments(await loadMigration());
    const missing: string[] = [];
    for (const [table, names] of Object.entries(LEGACY_POLICIES)) {
      for (const name of names) {
        const drop = new RegExp(
          `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+${name}\\s+ON\\s+public\\.${table}\\s*;`,
          "i",
        );
        if (!drop.test(sql)) missing.push(`${table}::${name}`);
        const recreate = new RegExp(
          `CREATE\\s+POLICY\\s+${name}\\s+ON\\s+public\\.${table}\\b`,
          "i",
        );
        if (recreate.test(sql)) missing.push(`${table}::${name} recreated`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("scopes every atlas policy TO authenticated", async () => {
    const sql = stripComments(await loadMigration());
    const createCount = (sql.match(/CREATE\s+POLICY/gi) ?? []).length;
    const policies = parsePolicies(sql);
    expect(policies.length).toBe(createCount);
    expect(policies.length).toBe(ATLAS_TABLES.length * 4);
    const wrongRoles = policies
      .filter((policy) => policy.roles !== "authenticated")
      .map((policy) => `${policy.table}::${policy.name} -> ${policy.roles}`);
    expect(wrongRoles).toEqual([]);
    expect(/\bTO\s+(public|anon)\b/i.test(sql)).toBe(false);
  });

  it("keeps exactly one SELECT policy per table covering owner OR linked", async () => {
    const policies = parsePolicies(stripComments(await loadMigration()));
    const problems: string[] = [];
    for (const table of ATLAS_TABLES) {
      const owned = policies.filter((policy) => policy.table === table);
      const selects = owned.filter((policy) => policy.command === "SELECT");
      const alls = owned.filter((policy) => policy.command === "ALL");
      if (selects.length !== 1) problems.push(`${table}: ${selects.length} SELECT policies`);
      if (alls.length !== 0) problems.push(`${table}: FOR ALL policy present`);
      const select = selects[0]?.statement ?? "";
      if (!OWNER_CLAIM.test(select)) problems.push(`${table}: SELECT lost owner path`);
      if (!LINKED_UID.test(select)) problems.push(`${table}: SELECT lost linked path`);
      if (!/\bOR\b/i.test(select)) problems.push(`${table}: SELECT not owner OR linked`);
    }
    expect(problems).toEqual([]);
  });

  it("binds INSERT / UPDATE / DELETE to the owner claim only", async () => {
    const policies = parsePolicies(stripComments(await loadMigration()));
    const problems: string[] = [];
    for (const table of ATLAS_TABLES) {
      for (const command of ["INSERT", "UPDATE", "DELETE"]) {
        const matches = policies.filter(
          (policy) => policy.table === table && policy.command === command,
        );
        if (matches.length !== 1) {
          problems.push(`${table}: ${matches.length} ${command} policies`);
          continue;
        }
        const statement = matches[0].statement;
        if (!OWNER_CLAIM.test(statement)) problems.push(`${table}: ${command} not owner-bound`);
        if (LINKED_UID.test(statement) || /auth\.uid\(\)/i.test(statement)) {
          problems.push(`${table}: ${command} grants linked users write access`);
        }
        if (command === "INSERT" && !/WITH\s+CHECK/i.test(statement)) {
          problems.push(`${table}: INSERT missing WITH CHECK`);
        }
        if (command === "UPDATE") {
          if (!/\bUSING\b/i.test(statement)) problems.push(`${table}: UPDATE missing USING`);
          if (!/WITH\s+CHECK/i.test(statement)) problems.push(`${table}: UPDATE missing WITH CHECK`);
        }
        if (/\b(?:USING|WITH\s+CHECK)\s*\(\s*true\s*\)/i.test(statement)) {
          problems.push(`${table}: ${command} permissive (true)`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("wraps auth.uid() and current_setting() in (select …) for initPlan", async () => {
    const policies = parsePolicies(stripComments(await loadMigration()));
    const unwrapped = policies
      .filter((policy) => hasUnwrappedInitPlanCall(policy.statement))
      .map((policy) => `${policy.table}::${policy.name}`);
    expect(unwrapped).toEqual([]);
  });

  it("adds covering indexes for the two unindexed atlas FKs", async () => {
    const sql = stripComments(await loadMigration());
    expect(sql).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+public\.atlas_identities\s*\(\s*auth_user_id\s*\)/i,
    );
    expect(sql).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+public\.atlas_validation_sessions\s*\(\s*identity_id\s*\)/i,
    );
  });

  it("leaves service_role and unrelated objects alone", async () => {
    const sql = stripComments(await loadMigration());
    expect(/service_role/i.test(sql)).toBe(false);
    expect(/save_idea_with_links/i.test(sql)).toBe(false);
    expect(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql)).toBe(false);
    expect(/DROP\s+TABLE/i.test(sql)).toBe(false);
  });
});
