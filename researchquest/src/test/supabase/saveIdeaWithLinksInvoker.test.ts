/**
 * Static audit for the effective save_idea_with_links definition
 * (1765500000_save_idea_with_links_invoker).
 *
 * Advisor 0029 flagged public.save_idea_with_links as a SECURITY DEFINER RPC
 * executable by `authenticated`. The last CREATE FUNCTION in migration order
 * must be SECURITY INVOKER (RLS applies), pin search_path to '', keep the
 * PostgREST signature, bind writes to auth.uid(), filter linked note/paper
 * ids to rows the caller owns (do not 42501 unowned/deleted ids), and leave
 * EXECUTE revoked from PUBLIC/anon.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..", "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const SIGNATURE =
  /public\.save_idea_with_links\s*\(\s*uuid\s*,\s*uuid\s*,\s*text\s*,\s*text\s*,\s*text\s*,\s*text\[\]\s*,\s*text\[\]\s*\)/i;

async function loadMigrations(): Promise<Array<{ name: string; sql: string }>> {
  const names = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(path.join(migrationsDir, name), "utf8"),
    })),
  );
}

/** Last top-level `CREATE ... FUNCTION public.save_idea_with_links(` statement. */
async function effectiveDefinition(): Promise<{ file: string; sql: string }> {
  const migrations = await loadMigrations();
  let last: { file: string; sql: string } | null = null;
  const createFn =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.save_idea_with_links\s*\(/gi;
  for (const { name, sql } of migrations) {
    createFn.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = createFn.exec(sql)) !== null) {
      const tail = sql.slice(match.index);
      const end = /\n\$\$\s*;/.exec(tail);
      last = { file: name, sql: end ? tail.slice(0, end.index + end[0].length) : tail };
    }
  }
  if (!last) throw new Error("save_idea_with_links definition not found");
  return last;
}

describe("save_idea_with_links (effective definition)", () => {
  it("is defined last by the invoker migration", async () => {
    const def = await effectiveDefinition();
    expect(def.file).toBe("1765500000_save_idea_with_links_invoker.sql");
  });

  it("runs as SECURITY INVOKER with an empty pinned search_path", async () => {
    const { sql } = await effectiveDefinition();
    const header = sql.slice(0, /AS\s*\$\$/i.exec(sql)!.index);
    expect(header).toMatch(/SECURITY\s+INVOKER/i);
    expect(header).not.toMatch(/SECURITY\s+DEFINER/i);
    expect(header).toMatch(/SET\s+search_path\s*=\s*''/i);
    expect(header).toMatch(/RETURNS\s+public\.ideas/i);
  });

  it("keeps the PostgREST parameter list and defaults", async () => {
    const { sql } = await effectiveDefinition();
    for (const param of [
      /p_user_id\s+uuid\s*,/i,
      /p_idea_id\s+uuid\s+DEFAULT\s+NULL/i,
      /p_title\s+text\s+DEFAULT\s+NULL/i,
      /p_description\s+text\s+DEFAULT\s+NULL/i,
      /p_stage\s+text\s+DEFAULT\s+'Seed'/i,
      /p_linked_note_ids\s+text\[\]\s+DEFAULT\s+NULL/i,
      /p_linked_paper_ids\s+text\[\]\s+DEFAULT\s+NULL/i,
    ]) {
      expect(sql).toMatch(param);
    }
  });

  it("binds every write to auth.uid() and rejects spoofed p_user_id", async () => {
    const { sql } = await effectiveDefinition();
    expect(sql).toMatch(/caller\s+uuid\s*:=\s*auth\.uid\(\)/i);
    expect(sql).toMatch(/IF\s+caller\s+IS\s+NULL\s+THEN[\s\S]*?ERRCODE\s*=\s*'42501'/i);
    expect(sql).toMatch(/p_user_id\s+IS\s+DISTINCT\s+FROM\s+caller/i);
    // INSERT VALUES start with caller, never the caller-supplied id.
    expect(sql).toMatch(/VALUES\s*\(\s*caller\s*,/i);
    expect(sql).not.toMatch(/VALUES\s*\(\s*p_user_id/i);
    expect(sql).toMatch(/user_id\s*=\s*caller/i);
  });

  it("keeps 22P02 for non-UUID ids and filters unowned UUID ids instead of 42501", async () => {
    const { sql } = await effectiveDefinition();
    expect(sql).toMatch(/ERRCODE\s*=\s*'22P02'/i);
    expect(sql).not.toMatch(/permission denied: linked note not owned by caller/i);
    expect(sql).not.toMatch(/permission denied: linked paper not owned by caller/i);
    expect(sql).toMatch(/WITH\s+ORDINALITY/i);
    expect(sql).toMatch(/array_agg\s*\(/i);
    expect(sql).toMatch(
      /FROM\s+public\.notes\s+n\s+WHERE\s+n\.id\s*=\s*\S+::uuid\s+AND\s+n\.user_id\s*=\s*(?:caller|auth\.uid\(\))/i,
    );
    expect(sql).toMatch(
      /FROM\s+public\.papers\s+p\s+WHERE\s+p\.id\s*=\s*\S+::uuid\s+AND\s+p\.user_id\s*=\s*(?:caller|auth\.uid\(\))/i,
    );
  });

  it("NULL link arrays on update keep then filter existing ids", async () => {
    const { sql } = await effectiveDefinition();
    expect(sql).toMatch(/coalesce\s*\(\s*p_linked_note_ids\s*,/i);
    expect(sql).toMatch(/coalesce\s*\(\s*p_linked_paper_ids\s*,/i);
  });

  it("revokes EXECUTE from PUBLIC and anon and grants authenticated", async () => {
    const migrations = await loadMigrations();
    const migration = migrations.find(
      (file) => file.name === "1765500000_save_idea_with_links_invoker.sql",
    );
    expect(migration).toBeDefined();
    const statements = migration!.sql.split(";");
    const has = (re: RegExp) =>
      statements.some((s) => re.test(s) && SIGNATURE.test(s));
    expect(has(/REVOKE\s+(?:ALL|EXECUTE)\s+ON\s+FUNCTION[\s\S]*FROM\s+PUBLIC/i)).toBe(true);
    expect(has(/REVOKE\s+(?:ALL|EXECUTE)\s+ON\s+FUNCTION[\s\S]*FROM\s+anon/i)).toBe(true);
    expect(has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION[\s\S]*TO\s+authenticated/i)).toBe(true);
    expect(has(/GRANT\s+EXECUTE\s+ON\s+FUNCTION[\s\S]*TO\s+anon/i)).toBe(false);
  });
});
