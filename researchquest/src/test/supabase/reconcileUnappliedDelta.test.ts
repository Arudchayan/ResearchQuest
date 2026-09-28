/**
 * Static audit of 1765700000_reconcile_unapplied_master_delta.sql.
 *
 * The migration replaces nine unapplied master files (1764800000..1765300000)
 * with one hardened delta. These checks pin the security properties without a
 * live database (the behaviour itself was exercised on a local PG17 replica):
 *  1. xp_events has no INSERT policy (effective across the whole chain) and
 *     client writes + MAINTAIN are revoked; CHECK (xp >= 0).
 *  2. The entity dedupe index is partial (WHERE entity_id <> '') so repeat
 *     no-entity awards do not raise 23505.
 *  3. Every SECURITY DEFINER function in the file pins SET search_path.
 *  4. RPCs are revoked from anon; trigger functions from authenticated too.
 *  5. award_xp caps mirror XP_DAILY_CAPS (client actions nonzero) and unknown
 *     actions fall to ELSE 0; no 'generic' bucket.
 *  6. award_achievement_xp uses a server catalogue mirroring ACHIEVEMENTS.
 *  7. No one-argument NULLIF (the 42601 that broke 1765003000).
 *  8. Only the canonical 7-arg award_xp survives.
 *  9. Section K revokes PG17 MAINTAIN on the atlas_* tables + xp_events.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  PG17_AVAILABLE,
  USER_A,
  awardXp,
  resetUser,
  startReplica,
  type Replica,
} from "./pg17ReplicaHarness";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..", "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const gamificationPath = path.join(
  repoRoot,
  "researchquest",
  "src",
  "utils",
  "gamification.ts",
);
const FILE = "1765700000_reconcile_unapplied_master_delta.sql";

const SUPERSEDED = [
  "1764800000",
  "1764801000",
  "1764802000",
  "1764900000",
  "1764910000",
  "1765001000",
  "1765002000",
  "1765003000",
  "1765300000",
];

const ATLAS_TABLES = [
  "atlas_identities",
  "atlas_progress_snapshots",
  "atlas_proof_drafts",
  "atlas_fresh_check_attempts",
  "atlas_validation_sessions",
  "atlas_validation_scores",
  "atlas_link_checks",
];

let raw = "";
let sql = "";
let chain: Array<{ name: string; sql: string }> = [];
let gamification = "";

/** Strip -- line comments (not inside dollar/single quotes; good enough here). */
function stripLineComments(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("--");
      if (idx === -1) return line;
      const before = line.slice(0, idx);
      const quotes = (before.match(/'/g) ?? []).length;
      return quotes % 2 === 0 ? before : line;
    })
    .join("\n");
}

/** Body of `CREATE FUNCTION public.<name>(` up to its closing `$$;`. */
function functionBlock(name: string): string {
  const start = new RegExp(
    `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${name}\\s*\\(`,
    "i",
  ).exec(sql);
  if (!start) return "";
  const tail = sql.slice(start.index);
  const bodyOpen = tail.search(/AS\s+\$\$/i);
  const bodyClose = tail.indexOf("$$;", bodyOpen + 4);
  return tail.slice(0, bodyClose + 3);
}

/** Every NULLIF( ... ) call with its top-level argument count. */
function nullifArgCounts(text: string): number[] {
  const counts: number[] = [];
  const re = /\bNULLIF\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let depth = 1;
    let args = 1;
    let inQuote = false;
    for (let i = m.index + m[0].length; i < text.length && depth > 0; i++) {
      const ch = text[i];
      if (ch === "'") inQuote = !inQuote;
      if (inQuote) continue;
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 1) args++;
    }
    counts.push(args);
  }
  return counts;
}

beforeAll(async () => {
  raw = await readFile(path.join(migrationsDir, FILE), "utf8");
  sql = stripLineComments(raw);
  const names = (await readdir(migrationsDir))
    .filter((n) => n.endsWith(".sql"))
    .sort();
  chain = await Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(path.join(migrationsDir, name), "utf8"),
    })),
  );
  gamification = await readFile(gamificationPath, "utf8");
});

describe("1765700000 reconcile unapplied master delta", () => {
  it("documents the superseded files and the no-re-apply rule", () => {
    for (const stamp of SUPERSEDED) expect(raw).toContain(stamp);
    expect(raw).toMatch(/HARD NO/);
    expect(raw).toMatch(/must NOT be re-applied live/);
  });

  it("leaves xp_events without any INSERT policy across the whole chain", () => {
    const token =
      /\b(DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?|CREATE\s+POLICY\s+)"([^"]+)"\s+ON\s+(?:public\s*\.\s*)?xp_events\b([^;]*)/gi;
    const effective = new Map<string, string>();
    for (const file of chain) {
      const body = stripLineComments(file.sql);
      token.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = token.exec(body)) !== null) {
        if (/^DROP/i.test(m[1])) effective.delete(m[2]);
        else effective.set(m[2], m[3]);
      }
    }
    const insertPolicies = [...effective.entries()].filter(([, rest]) =>
      /FOR\s+(?:INSERT|ALL)\b/i.test(rest),
    );
    expect(insertPolicies).toEqual([]);
    expect(effective.get("Users view own xp events")).toMatch(
      /FOR\s+SELECT[\s\S]*\(\s*select\s+auth\.uid\(\)\s*\)\s*=\s*user_id/i,
    );
  });

  it("revokes client writes on xp_events and keeps xp non-negative", () => {
    expect(sql).toMatch(/REVOKE\s+ALL\s+ON\s+TABLE\s+public\.xp_events\s+FROM\s+anon/i);
    expect(sql).toMatch(
      /REVOKE\s+INSERT,\s*UPDATE,\s*DELETE,\s*TRUNCATE,\s*REFERENCES,\s*TRIGGER\s+ON\s+TABLE\s+public\.xp_events\s+FROM\s+authenticated/i,
    );
    expect(sql).toMatch(/CHECK\s*\(\s*xp\s*>=\s*0\s*\)/i);
  });

  it("uses a partial unique index for entity-scoped XP dedupe", () => {
    expect(sql).toMatch(
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+uq_xp_events_user_action_entity\s+ON\s+public\.xp_events\s*\(\s*user_id\s*,\s*action\s*,\s*entity_id\s*\)\s*WHERE\s+entity_id\s*<>\s*''/i,
    );
    // No full-width UNIQUE(user_id, action, entity_id) and no global key unique.
    expect(sql).not.toMatch(/UNIQUE\s*\(\s*user_id\s*,\s*action\s*,\s*entity_id\s*\)/i);
    expect(sql).not.toMatch(/UNIQUE\s*\(\s*idempotency_key\s*\)/i);
    expect(sql).toMatch(/UNIQUE\s*\(\s*user_id\s*,\s*idempotency_key\s*\)/i);
  });

  it("pins SET search_path on every SECURITY DEFINER function in the file", () => {
    const createFn = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.(\w+)\s*\(/gi;
    const definers: string[] = [];
    const violations: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = createFn.exec(sql)) !== null) {
      const tail = sql.slice(m.index);
      const header = tail.slice(0, tail.search(/AS\s+\$\$/i));
      if (/SECURITY\s+DEFINER/i.test(header)) {
        definers.push(m[1]);
        if (!/SET\s+search_path\s*=\s*public/i.test(header)) violations.push(m[1]);
      }
    }
    expect(definers.sort()).toEqual([
      "award_achievement_xp",
      "award_xp",
      "enforce_feed_item_source_ownership",
      "enforce_topic_quest_topic_ownership",
    ]);
    expect(violations).toEqual([]);
    expect(functionBlock("enforce_total_xp_monotonic")).toMatch(/SECURITY\s+INVOKER/i);
  });

  it("revokes RPC EXECUTE from anon and trigger EXECUTE from authenticated", () => {
    const rpcs = [
      "award_xp\\(UUID, INTEGER, TEXT, TEXT, TEXT, DATE, INTEGER\\)",
      "award_achievement_xp\\(TEXT, INTEGER, TEXT, TEXT\\)",
      "global_search\\(uuid, text, int\\)",
    ];
    for (const sig of rpcs) {
      expect(sql).toMatch(new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${sig}\\s+FROM\\s+PUBLIC`, "i"));
      expect(sql).toMatch(new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${sig}\\s+FROM\\s+anon`, "i"));
      expect(sql).toMatch(new RegExp(`GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${sig}\\s+TO\\s+authenticated`, "i"));
    }
    for (const fn of [
      "enforce_total_xp_monotonic",
      "enforce_topic_quest_topic_ownership",
      "enforce_feed_item_source_ownership",
    ]) {
      for (const role of ["PUBLIC", "anon", "authenticated"]) {
        expect(sql).toMatch(
          new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${fn}\\(\\)\\s+FROM\\s+${role}\\b`, "i"),
        );
      }
    }
    expect(sql).not.toMatch(/GRANT\s+[^;]*\bTO\s+anon\b/i);
  });

  it("binds award_xp to auth.uid() and keeps only the 7-arg signature", () => {
    const awardXp = functionBlock("award_xp");
    expect(awardXp).toMatch(/v_uid\s+UUID\s*:=\s*auth\.uid\(\)/i);
    expect(awardXp).toMatch(/p_uid\s*<>\s*v_uid/i);
    const creates = sql.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.award_xp\s*\(/gi) ?? [];
    expect(creates).toHaveLength(1);
    expect(sql).toMatch(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.award_xp\(INTEGER, TEXT, TEXT\)/i);
    expect(sql).toMatch(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.award_xp\(UUID, INTEGER, TEXT, TEXT, TEXT\)/i);
    // Client contract (tryAwardXpRpc) param names.
    for (const p of ["p_uid", "p_delta", "p_idempotency_key", "p_action", "p_entity_id", "p_local_day", "p_duration_minutes"]) {
      expect(awardXp).toContain(p);
      expect(gamification).toContain(`${p}:`);
    }
  });

  it("mirrors XP_DAILY_CAPS with ELSE 0 for unknown actions", () => {
    const capsBlock = /XP_DAILY_CAPS[^=]*=\s*\{([\s\S]*?)\};/.exec(gamification)?.[1] ?? "";
    const clientCaps = Object.fromEntries(
      [...capsBlock.matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]),
    );
    expect(Object.keys(clientCaps).length).toBeGreaterThan(10);

    const caseBlock = /v_cap\s*:=\s*CASE\s+v_action([\s\S]*?)END;/i.exec(functionBlock("award_xp"))?.[1] ?? "";
    const serverCaps = Object.fromEntries(
      [...caseBlock.matchAll(/WHEN\s+'(\w+)'\s+THEN\s+(\d+)/gi)].map((m) => [m[1], Number(m[2])]),
    );
    expect(caseBlock).toMatch(/ELSE\s+0\s*$/i);
    expect(serverCaps).not.toHaveProperty("generic");
    for (const [action, cap] of Object.entries(clientCaps)) {
      if (action === "generic") continue;
      expect({ action, serverCap: serverCaps[action] }).toEqual({
        action,
        serverCap: cap,
      });
    }
  });

  it("gives every action the client sends a nonzero server cap", async () => {
    const callers = [
      "hooks/useTopics.ts",
      "hooks/usePapers.ts",
      "hooks/useTasks.ts",
      "hooks/useIdeas.ts",
      "hooks/useNotes.ts",
      "components/focus/FocusWorkspace.tsx",
    ];
    const actions = new Set<string>();
    for (const rel of callers) {
      const src = await readFile(path.join(repoRoot, "researchquest", "src", rel), "utf8");
      for (const m of src.matchAll(/awardXP(?:AndNotify)?\(\s*\w+\s*,\s*[\w.]+\s*,\s*"(\w+)"/g)) actions.add(m[1]);
      for (const m of src.matchAll(/action:\s*"(\w+)"/g)) actions.add(m[1]);
    }
    expect(actions.size).toBeGreaterThanOrEqual(13);
    const caseBlock = /v_cap\s*:=\s*CASE\s+v_action([\s\S]*?)END;/i.exec(functionBlock("award_xp"))?.[1] ?? "";
    const zeroByDesign = new Set(["update_note"]);
    for (const action of actions) {
      const m = new RegExp(`WHEN\\s+'${action}'\\s+THEN\\s+(\\d+)`, "i").exec(caseBlock);
      expect({ action, found: Boolean(m) }).toEqual({ action, found: true });
      expect(Number(m?.[1])).toBeGreaterThan(zeroByDesign.has(action) ? -1 : 0);
    }
  });

  it("uses a server-owned achievement catalogue mirroring ACHIEVEMENTS", () => {
    const block = functionBlock("award_achievement_xp");
    const client = [...gamification.matchAll(/type:\s*"(\w+)"[\s\S]*?xp:\s*(\d+)/g)].map(
      (m) => [m[1], Number(m[2])] as const,
    );
    expect(client.length).toBe(5);
    for (const [type, xp] of client) {
      expect(block).toMatch(new RegExp(`WHEN\\s+'${type}'\\s+THEN\\s+v_xp\\s*:=\\s*${xp};`, "i"));
    }
    expect(block).toMatch(/ELSE\s+RAISE\s+EXCEPTION\s+'unknown achievement type/i);
    expect(block).toMatch(/ON\s+CONFLICT\s*\(\s*user_id\s*,\s*achievement_type\s*\)\s+DO\s+NOTHING/i);
    // Client-supplied XP is never written.
    expect(block).not.toMatch(/\+\s*p_xp\b/i);
    expect(block).not.toMatch(/VALUES\s*\([^)]*p_xp/i);
  });

  it("never calls NULLIF with a single argument", () => {
    const counts = nullifArgCounts(sql);
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.filter((n) => n !== 2)).toEqual([]);
  });

  it("revokes PG17 MAINTAIN from authenticated on atlas_* tables and xp_events (guarded)", () => {
    const sectionK = /K\.\s+Revoke PG17 MAINTAIN[\s\S]*$/.exec(raw)?.[0] ?? "";
    expect(sectionK).not.toBe("");
    for (const table of [...ATLAS_TABLES, "xp_events"]) expect(sectionK).toContain(`'${table}'`);
    expect(sectionK).toMatch(/to_regclass\(format\('public\.%I', t\)\)\s+IS\s+NOT\s+NULL/i);
    expect(sectionK).toMatch(/REVOKE MAINTAIN ON TABLE public\.%I FROM authenticated/);
    expect(sectionK).toMatch(/server_version_num/);
  });

  it("requires PostgreSQL 17 in CI so live replica cases are not skipped", () => {
    expect(!process.env.CI || PG17_AVAILABLE).toBe(true);
  });
});

describe.skipIf(!PG17_AVAILABLE)("1765700000 reconcile unapplied master delta (PG17 replica)", () => {
  let replica: Replica;

  beforeAll(() => {
    replica = startReplica({ through: "1765700000" });
  });

  afterAll(() => {
    replica?.stop();
  });

  beforeEach(() => {
    resetUser(replica, USER_A);
  });

  it("credits create_note through award_xp", () => {
    const row = awardXp(replica, USER_A, 10, "create_note");
    expect(row.xp_credited).toBe(10);
    expect(row.total_xp).toBe(10);
  });

  it("denies authenticated INSERT into xp_events", () => {
    expect(() =>
      replica.execAs(
        USER_A,
        `INSERT INTO public.xp_events (user_id, action, entity_id, xp, local_day)
         VALUES ('${USER_A}', 'create_note', '', 10, (now() AT TIME ZONE 'UTC')::date)`,
      ),
    ).toThrow(/permission denied/i);
  });
});
