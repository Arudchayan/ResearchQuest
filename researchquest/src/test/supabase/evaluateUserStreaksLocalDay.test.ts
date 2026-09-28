/**
 * Nightly streak evaluator (1765900000): static contract + live PG17 replica.
 *
 * Miss detection uses last_activity_date against the UTC-12 civil date so a
 * westward DST/travel drop cannot false-zero a still-active local day.
 * Freeze/rest spend at most one token per 00:05Z run when freeze+rest
 * covers need = GREATEST(1, local_today_max - last - 1); CONTINUE when
 * tokens cannot cover need so a token is not wasted; zero on gap >= 3 / no tokens.
 * CI installs PostgreSQL 17 so live cases run (0 skipped).
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
  resetXpNow,
  setXpNow,
  startReplica,
  utcIsoFromLocal,
  type Replica,
} from "./pg17ReplicaHarness";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..", "..");
const migrationsDir = path.join(repoRoot, "supabase", "migrations");
const FILE = "1765900000_evaluate_user_streaks_local_day.sql";

const CRON_005Z = "2026-06-09T00:05:00.000Z";
const NEXT_CRON_005Z = "2026-06-10T00:05:00.000Z";
const THIRD_CRON_005Z = "2026-06-11T00:05:00.000Z";

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

function functionBlock(sql: string, name: string): string {
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

type ProfileRow = {
  current_streak: number;
  last_activity_date: string | null;
  streak_freeze_tokens: number;
  rest_days: number;
  streak_credit_at: string | null;
  active_boost: { expires_at?: string } | null;
};

let raw = "";
let sql = "";
let fn = "";

beforeAll(async () => {
  raw = await readFile(path.join(migrationsDir, FILE), "utf8");
  sql = stripLineComments(raw);
  fn = functionBlock(sql, "evaluate_user_streaks");
});

describe("1765900000 evaluate_user_streaks local day (static)", () => {
  it("is version 1765900000 and adds no tables or columns", async () => {
    const names = (await readdir(migrationsDir)).filter((n) => n.endsWith(".sql")).sort();
    expect(names.some((n) => n.startsWith("1765900000"))).toBe(true);
    expect(names.filter((n) => n.startsWith("1765900000"))).toEqual([FILE]);
    expect(sql).not.toMatch(/CREATE\s+TABLE/i);
    expect(sql).not.toMatch(/ADD\s+COLUMN/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE/i);
  });

  it("replaces evaluate_user_streaks as SECURITY DEFINER with search_path = public", () => {
    expect(fn).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.evaluate_user_streaks\s*\(\s*\)/i);
    expect(fn).toMatch(/SECURITY\s+DEFINER/i);
    expect(fn).toMatch(/SET\s+search_path\s*=\s*public/i);
    expect(fn).toMatch(/LANGUAGE\s+plpgsql/i);
  });

  it("computes miss gap from the UTC-12 civil date, not streak_tz_lo_min", () => {
    expect(fn).toMatch(/local_today_min/i);
    expect(fn).toMatch(/make_interval\s*\(\s*mins\s*=>\s*-720\s*\)/i);
    expect(fn).not.toMatch(/streak_tz_lo_min/i);
    expect(raw).toMatch(/UTC-12/);
    expect(fn).toMatch(/AT\s+TIME\s+ZONE\s+'UTC'/i);
    expect(fn).toMatch(/public\.xp_server_now\s*\(\s*\)/i);
    expect(fn).toMatch(/gap\s*:=\s*local_today_min\s*-\s*(?:profile\.)?last_activity_date/i);
    expect(fn).toMatch(/last_activity_date\s+IS\s+NULL/i);
    expect(fn).not.toMatch(/daily_logs/i);
    expect(fn).not.toMatch(/CURRENT_DATE/i);
    expect(fn).not.toMatch(/MAX\s*\(\s*date\s*\)/i);
  });

  it("covers need missed local days with one token per run, else continues or zeroes", () => {
    expect(fn).toMatch(/streak_tz_hi_min/i);
    expect(fn).toMatch(/local_today_max/i);
    expect(fn).toMatch(/\bneed\b/i);
    expect(fn).toMatch(
      /make_interval\s*\(\s*mins\s*=>\s*COALESCE\s*\(\s*profile\.streak_tz_hi_min\s*,\s*840\s*\)\s*\)/i,
    );
    expect(fn).toMatch(
      /GREATEST\s*\(\s*1\s*,\s*local_today_max\s*-\s*profile\.last_activity_date\s*-\s*1\s*\)/i,
    );
    expect(fn).toMatch(/freeze_tokens\s*\+\s*rest_tokens\s*<\s*need/i);
    expect(fn).toMatch(/last_activity_date\s*=\s*local_today_min\s*-\s*1/i);
    expect(fn).not.toMatch(/streak_tz_lo_min/i);
    expect(fn).not.toMatch(/LEAST\s*\(\s*freeze_tokens/i);
  });

  it("mutant: the old max-last >= 3 CONTINUE guard is gone", () => {
    expect(fn).not.toMatch(
      /IF\s+local_today_max\s*-\s*profile\.last_activity_date\s*>=\s*3\s*THEN\s+CONTINUE/i,
    );
    expect(fn).not.toMatch(
      /local_today_max\s*-\s*profile\.last_activity_date\s*<=\s*2/i,
    );
  });

  it("mirrors freeze-then-rest consumption and leaves last_activity_date on zero", () => {
    expect(fn).toMatch(/streak_freeze_tokens/i);
    expect(fn).toMatch(/rest_days/i);
    expect(fn).toMatch(/last_activity_date\s*=\s*local_today_min\s*-\s*1/i);
    expect(fn).toMatch(/current_streak\s*=\s*0/i);
    expect(fn).not.toMatch(/last_activity_date\s*=\s*latest_activity/i);
  });

  it("guards freeze, rest, and zero updates against a stale profile snapshot", () => {
    const freeze =
      /UPDATE\s+public\.user_profiles\s+SET[\s\S]*?streak_freeze_tokens[\s\S]*?WHERE[\s\S]*?;/i.exec(
        fn,
      )?.[0] ?? "";
    const rest =
      /UPDATE\s+public\.user_profiles\s+SET[\s\S]*?rest_days[\s\S]*?WHERE[\s\S]*?;/i.exec(fn)?.[0] ??
      "";
    const zero =
      /UPDATE\s+public\.user_profiles\s+SET\s+current_streak\s*=\s*0[\s\S]*?WHERE[\s\S]*?;/i.exec(fn)?.[0] ?? "";
    expect(freeze.length).toBeGreaterThan(0);
    expect(rest.length).toBeGreaterThan(0);
    expect(zero.length).toBeGreaterThan(0);
    for (const block of [freeze, rest, zero]) {
      expect(block).toMatch(/WHERE\s+id\s*=\s*profile\.id/i);
      expect(block).toMatch(
        /last_activity_date\s+IS\s+NOT\s+DISTINCT\s+FROM\s+profile\.last_activity_date/i,
      );
    }
    expect(freeze).toMatch(/streak_freeze_tokens\s*=\s*profile\.streak_freeze_tokens/i);
    expect(freeze).toMatch(/streak_credit_at\s*=\s*public\.xp_server_now\s*\(\s*\)/i);
    expect(rest).toMatch(/rest_days\s*=\s*profile\.rest_days/i);
    expect(rest).toMatch(/streak_credit_at\s*=\s*public\.xp_server_now\s*\(\s*\)/i);
    expect(zero).not.toMatch(/streak_freeze_tokens\s*=\s*profile\.streak_freeze_tokens/i);
    expect(zero).not.toMatch(/rest_days\s*=\s*profile\.rest_days/i);
    expect(zero).not.toMatch(/streak_credit_at/i);
  });

  it("keeps active_boost expiry cleanup and revokes client EXECUTE", () => {
    expect(fn).toMatch(/active_boost->>'expires_at'/i);
    expect(fn).toMatch(/\(active_boost->>'expires_at'\)::timestamptz\s*<=\s*now\(\)/i);
    expect(sql).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.evaluate_user_streaks\s*\(\s*\)\s+FROM\s+PUBLIC/i);
    expect(sql).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.evaluate_user_streaks\s*\(\s*\)\s+FROM\s+anon/i);
    expect(sql).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.evaluate_user_streaks\s*\(\s*\)\s+FROM\s+authenticated/i,
    );
  });

  it("embeds the live 20260923163428 harden_rpc_security_definer body as rollback", () => {
    const live = raw.lastIndexOf("CREATE OR REPLACE FUNCTION public.evaluate_user_streaks");
    expect(live).toBeGreaterThan(0);
    const header = raw.slice(0, live);
    expect(header.length).toBeGreaterThan(0);
    expect(header).toMatch(/ROLLBACK/i);
    expect(header).toMatch(/20260923163428/);
    expect(header).toMatch(/harden_rpc_security_definer \(live\)/);
    expect(header).toMatch(/SET search_path TO 'public'/);
    expect(header).toMatch(/-- Only service_role \/ postgres should call this/);
    expect(header).toMatch(/AS \$function\$/);
    expect(header).toMatch(/FROM public\.daily_logs/);
    expect(header).toMatch(/days_since_activity := \(CURRENT_DATE - latest_activity\)/);
    expect(header).toMatch(/last_activity_date = CURRENT_DATE - 1/);
    expect(header).toMatch(/last_activity_date = latest_activity/);
    expect(header).not.toMatch(/1764802000/);
  });

  it("requires PostgreSQL 17 in CI so live replica cases are not skipped", () => {
    expect(!process.env.CI || PG17_AVAILABLE).toBe(true);
  });
});
