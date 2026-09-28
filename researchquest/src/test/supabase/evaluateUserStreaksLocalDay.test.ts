/**
 * Nightly streak evaluator (1765900000): static contract + live PG17 replica.
 *
 * Lazy cron: UTC-12 missed = local_today_min - last - 1. Zero current_streak
 * only when missed > freeze + rest AND (credit_at IS NULL or e >= 48h).
 * Never spends tokens and never moves last_activity_date or streak_credit_at.
 * award_xp ( #826 round 9 ) spends tokens on the return claim.
 * CI installs PostgreSQL 17 so live cases run. Round-9 claim cases skip
 * until 1765800000 contains r9 award_xp (`requires #826 r9 award_xp`).
 */
import { readFileSync } from "node:fs";
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
const HARDENING_FILE =
  process.env.RQ_XP_HARDENING_SQL ||
  path.join(migrationsDir, "1765800000_xp_integrity_hardening.sql");
const QA_HELPERS = path.join(testDir, "qa827ReproHelpers.sql");

const CRON_005Z = "2026-06-09T00:05:00.000Z";
const NEXT_CRON_005Z = "2026-06-10T00:05:00.000Z";
const C3 = [
  "2026-10-14T00:05:00.000Z",
  "2026-10-15T00:05:00.000Z",
  "2026-10-16T00:05:00.000Z",
] as const;
const R9_REASON = "requires #826 r9 award_xp";

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
  const close = /\$\$\s+LANGUAGE[\s\S]*?;/i.exec(tail.slice(Math.max(bodyOpen, 0)));
  if (bodyOpen < 0 || !close) return tail;
  return tail.slice(0, Math.max(bodyOpen, 0) + close.index + close[0].length);
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
const hasR9AwardXp = /v_need\s*:=\s*GREATEST\s*\(\s*1\s*,\s*v_gap\s*-\s*1\s*\)/i.test(
  readFileSync(HARDENING_FILE, "utf8"),
);

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

  it("computes missed from the UTC-12 civil date, not streak_tz_lo_min", () => {
    expect(fn).toMatch(/local_today_min/i);
    expect(fn).toMatch(/make_interval\s*\(\s*mins\s*=>\s*-720\s*\)/i);
    expect(fn).not.toMatch(/streak_tz_lo_min/i);
    expect(raw).toMatch(/UTC-12/);
    expect(fn).toMatch(/AT\s+TIME\s+ZONE\s+'UTC'/i);
    expect(fn).toMatch(/public\.xp_server_now\s*\(\s*\)/i);
    expect(fn).toMatch(
      /missed\s*:=\s*local_today_min\s*-\s*profile\.last_activity_date\s*-\s*1/i,
    );
    expect(fn).toMatch(/last_activity_date\s+IS\s+NOT\s+NULL/i);
    expect(fn).toMatch(/COALESCE\s*\(\s*current_streak\s*,\s*0\s*\)\s*>\s*0/i);
    expect(fn).not.toMatch(/daily_logs/i);
    expect(fn).not.toMatch(/CURRENT_DATE/i);
    expect(fn).not.toMatch(/MAX\s*\(\s*date\s*\)/i);
  });

  it("is lazy: zeroes only when missed > tokens and e >= 48h; never spends or moves last/credit", () => {
    expect(fn).toMatch(
      /missed\s*>\s*COALESCE\s*\(\s*profile\.streak_freeze_tokens\s*,\s*0\s*\)\s*\+\s*COALESCE\s*\(\s*profile\.rest_days\s*,\s*0\s*\)/i,
    );
    expect(fn).toMatch(/interval\s+'48 hours'/i);
    expect(fn).toMatch(/SET\s+current_streak\s*=\s*0/i);
    expect(fn).not.toMatch(/streak_freeze_tokens\s*=/i);
    expect(fn).not.toMatch(/rest_days\s*=/i);
    expect(fn).not.toMatch(/last_activity_date\s*=/i);
    expect(fn).not.toMatch(/streak_credit_at\s*=/i);
    expect(fn).not.toMatch(/\bneed\b/i);
    expect(fn).not.toMatch(/local_today_max/i);
    expect(fn).not.toMatch(/streak_tz_hi_min/i);
  });

  it("mutant: a cron variant that spends a token is gone", () => {
    // Restoring freeze/rest consumption (81f0c441 / 836fbb02) fails this and
    // X10: tokens would move on a streak the claim then resets or continues.
    expect(fn).not.toMatch(/streak_freeze_tokens\s*=\s*\S+\s*-\s*1/i);
    expect(fn).not.toMatch(/rest_days\s*=\s*\S+\s*-\s*1/i);
    expect(fn).not.toMatch(/last_activity_date\s*=\s*local_today_min\s*-\s*1/i);
    expect(fn).not.toMatch(/streak_credit_at\s*=\s*public\.xp_server_now/i);
  });

  it("guards the zero UPDATE on last_activity_date and streak_credit_at", () => {
    const zero =
      /UPDATE\s+public\.user_profiles\s+SET\s+current_streak\s*=\s*0[\s\S]*?WHERE[\s\S]*?;/i.exec(
        fn,
      )?.[0] ?? "";
    expect(zero.length).toBeGreaterThan(0);
    expect(zero).toMatch(/WHERE\s+id\s*=\s*profile\.id/i);
    expect(zero).toMatch(
      /last_activity_date\s+IS\s+NOT\s+DISTINCT\s+FROM\s+profile\.last_activity_date/i,
    );
    expect(zero).toMatch(
      /streak_credit_at\s+IS\s+NOT\s+DISTINCT\s+FROM\s+profile\.streak_credit_at/i,
    );
  });

  it("keeps active_boost expiry cleanup and revokes client EXECUTE", () => {
    expect(fn).toMatch(/active_boost->>'expires_at'/i);
    expect(fn).toMatch(/\(active_boost->>'expires_at'\)::timestamptz\s*<=\s*now\(\)/i);
    expect(sql).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.evaluate_user_streaks\s*\(\s*\)\s+FROM\s+PUBLIC/i,
    );
    expect(sql).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.evaluate_user_streaks\s*\(\s*\)\s+FROM\s+anon/i,
    );
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

describe.skipIf(!PG17_AVAILABLE)("1765900000 evaluate_user_streaks local day (PG17 replica)", () => {
  let replica: Replica;

  beforeAll(() => {
    replica = startReplica({ through: "1765900000" });
  });

  afterAll(() => {
    replica?.stop();
  });

  beforeEach(() => {
    resetUser(replica, USER_A);
    resetXpNow(replica);
  });

  function readProfile(): ProfileRow {
    return replica.jsonAs(
      USER_A,
      `SELECT current_streak, last_activity_date, streak_freeze_tokens, rest_days,
              streak_credit_at, active_boost
       FROM public.user_profiles WHERE id = '${USER_A}'`,
    );
  }

  function seed(opts: {
    lastActivity: string | null;
    streak?: number;
    freeze?: number;
    rest?: number;
    tzLo: number | null;
    tzHi?: number | null;
    creditAt?: string | null;
    setAt?: string | null;
  }): void {
    const last = opts.lastActivity === null ? "NULL" : `'${opts.lastActivity}'::date`;
    const tzLo = opts.tzLo === null ? "NULL" : String(opts.tzLo);
    const tzHi =
      opts.tzHi === undefined ? tzLo : opts.tzHi === null ? "NULL" : String(opts.tzHi);
    const creditAt =
      opts.creditAt === undefined
        ? "streak_credit_at"
        : opts.creditAt === null
          ? "NULL"
          : `TIMESTAMPTZ '${opts.creditAt}'`;
    const setAt =
      opts.setAt === undefined
        ? "public.xp_server_now()"
        : opts.setAt === null
          ? "NULL"
          : `TIMESTAMPTZ '${opts.setAt}'`;
    replica.exec(`
      UPDATE public.user_profiles
      SET current_streak = ${opts.streak ?? 5},
          longest_streak = ${opts.streak ?? 5},
          last_activity_date = ${last},
          streak_freeze_tokens = ${opts.freeze ?? 0},
          rest_days = ${opts.rest ?? 0},
          streak_tz_lo_min = ${tzLo},
          streak_tz_hi_min = ${tzHi},
          streak_tz_set_at = ${setAt},
          streak_credit_at = ${creditAt}
      WHERE id = '${USER_A}';
    `);
  }

  function runCrons(isos: readonly string[]): void {
    for (const iso of isos) {
      setXpNow(replica, iso);
      replica.exec("SELECT public.evaluate_user_streaks();");
    }
  }

  function claim(atIso: string, localDay: string, entity: string) {
    setXpNow(replica, atIso);
    return awardXp(replica, USER_A, 10, "create_note", { entityId: entity, localDay });
  }

  function qaRun(body: string): string {
    const helpers = readFileSync(QA_HELPERS, "utf8");
    const out = replica.exec(`${helpers}\n${body}\nSELECT pg_temp.q_state('${USER_A}');`);
    resetXpNow(replica);
    return out.trim().split("\n").filter(Boolean).at(-1) ?? "";
  }

  function expectKept(
    row: { current_streak: number; last_activity_date: string | null; streak_freeze_tokens: number },
    last: string,
  ) {
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe(last);
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.current_streak).not.toBe(1);
    expect(readProfile().rest_days).toBe(0);
  }

  it("(a) UTC-5 user active at 20:00 local is never zeroed at the 00:05Z run", () => {
    seed({ lastActivity: "2026-06-07", streak: 5, freeze: 1, tzLo: -300 });
    setXpNow(replica, CRON_005Z);
    replica.exec("SELECT public.evaluate_user_streaks();");
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-06-07");
    expect(row.streak_freeze_tokens).toBe(1);

    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '2026-06-08'::date
      WHERE id = '${USER_A}';
    `);
    setXpNow(replica, NEXT_CRON_005Z);
    replica.exec("SELECT public.evaluate_user_streaks();");
    row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-06-08");
    expect(row.streak_freeze_tokens).toBe(1);
  });

  it("(b) UTC+10 user who missed a day is zeroed after UTC-12 closed the next day", () => {
    const afterUtc12Closed = "2026-06-09T12:05:00.000Z";
    seed({ lastActivity: "2026-06-07", streak: 9, freeze: 0, rest: 0, tzLo: 600 });
    setXpNow(replica, afterUtc12Closed);
    replica.exec("SELECT public.evaluate_user_streaks();");
    let row = readProfile();
    expect(row.current_streak).toBe(0);
    expect(row.last_activity_date).toBe("2026-06-07");
    expect(row.streak_freeze_tokens).toBe(0);

    seed({
      lastActivity: "2026-06-07",
      streak: 9,
      freeze: 1,
      rest: 0,
      tzLo: -300,
      tzHi: -300,
    });
    setXpNow(replica, afterUtc12Closed);
    replica.exec("SELECT public.evaluate_user_streaks();");
    row = readProfile();
    expect(row.current_streak).toBe(9);
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.last_activity_date).toBe("2026-06-07");
  });

  it("(c) one missed day with tokens is not spent and the streak is left for award_xp", () => {
    seed({
      lastActivity: "2026-06-06",
      streak: 12,
      freeze: 2,
      rest: 4,
      tzLo: -300,
      tzHi: -300,
      creditAt: "2026-06-06T17:00:00.000Z",
      setAt: "2026-06-06T17:00:00.000Z",
    });
    setXpNow(replica, CRON_005Z);
    replica.exec("SELECT public.evaluate_user_streaks();");
    const row = readProfile();
    expect(row.current_streak).toBe(12);
    expect(row.streak_freeze_tokens).toBe(2);
    expect(row.rest_days).toBe(4);
    expect(row.last_activity_date).toBe("2026-06-06");
    expect(new Date(row.streak_credit_at ?? "").toISOString()).toBe("2026-06-06T17:00:00.000Z");
  });

  it("(d) a future-dated daily_logs row gains nothing", () => {
    seed({ lastActivity: "2026-06-05", streak: 7, freeze: 0, tzLo: -300 });
    replica.exec(`
      INSERT INTO public.daily_logs (user_id, date, xp_earned, streak_count)
      VALUES ('${USER_A}', '2026-12-31'::date, 99, 99);
    `);
    setXpNow(replica, CRON_005Z);
    replica.exec("SELECT public.evaluate_user_streaks();");
    const row = readProfile();
    expect(row.current_streak).toBe(0);
    expect(row.last_activity_date).toBe("2026-06-05");
    const log = replica
      .exec(`SELECT date::text FROM public.daily_logs WHERE user_id = '${USER_A}'`)
      .trim();
    expect(log).toBe("2026-12-31");
  });

  it("does not consume rest_days; freeze is preferred by award_xp not the cron", () => {
    seed({
      lastActivity: "2026-06-06",
      streak: 4,
      freeze: 0,
      rest: 2,
      tzLo: -300,
      tzHi: -300,
      creditAt: "2026-06-06T17:00:00.000Z",
    });
    setXpNow(replica, CRON_005Z);
    replica.exec("SELECT public.evaluate_user_streaks();");
    const row = readProfile();
    expect(row.current_streak).toBe(4);
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.rest_days).toBe(2);
    expect(row.last_activity_date).toBe("2026-06-06");
  });

  it("does not change a null last_activity_date even when daily_logs has a future row", () => {
    seed({ lastActivity: null, streak: 3, freeze: 0, tzLo: -300 });
    replica.exec(`
      INSERT INTO public.daily_logs (user_id, date, xp_earned, streak_count)
      VALUES ('${USER_A}', '2026-12-31'::date, 1, 1);
    `);
    setXpNow(replica, CRON_005Z);
    replica.exec("SELECT public.evaluate_user_streaks();");
    const row = readProfile();
    expect(row.current_streak).toBe(3);
    expect(row.last_activity_date).toBeNull();
  });

  it("Azores fall-back: 00:05Z on 10-27 does not zero a user last active 10-25", () => {
    seed({
      lastActivity: "2026-10-25",
      streak: 6,
      freeze: 0,
      rest: 0,
      tzLo: -2,
      tzHi: 659,
    });
    setXpNow(replica, "2026-10-27T00:05:00.000Z");
    replica.exec("SELECT public.evaluate_user_streaks();");
    const row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe("2026-10-25");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.rest_days).toBe(0);
  });

  it("Berlin-to-New-York traveller is not zeroed at the first NY evening cron", () => {
    seed({ lastActivity: "2026-01-15", streak: 8, freeze: 0, rest: 0, tzLo: 60 });
    setXpNow(replica, "2026-01-17T00:05:00.000Z");
    replica.exec("SELECT public.evaluate_user_streaks();");
    const row = readProfile();
    expect(row.current_streak).toBe(8);
    expect(row.last_activity_date).toBe("2026-01-15");
    expect(row.streak_freeze_tokens).toBe(0);
  });

  it("never stamps streak_credit_at and never spends a token", () => {
    const credit = "2026-10-13T02:00:00.000Z";
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 2,
      rest: 1,
      tzLo: 600,
      tzHi: 600,
      creditAt: credit,
      setAt: credit,
    });
    runCrons(C3);
    const row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.streak_freeze_tokens).toBe(2);
    expect(row.rest_days).toBe(1);
    expect(row.last_activity_date).toBe("2026-10-13");
    expect(new Date(row.streak_credit_at ?? "").toISOString()).toBe(credit);
  });

  it("zeroes only once missed > N tokens, and not within 48h of credit_at", () => {
    const credit = "2026-10-13T02:00:00.000Z";
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 1,
      rest: 0,
      tzLo: 600,
      tzHi: 600,
      creditAt: credit,
      setAt: credit,
    });
    // 10-15 12:05Z: UTC-12 is 10-15, missed=1, N=1 → not yet.
    runCrons(["2026-10-15T12:05:00.000Z"]);
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.last_activity_date).toBe("2026-10-13");

    // 10-16 12:05Z: missed=2 > 1 and e > 48h → zero, token kept, last/credit stay.
    runCrons(["2026-10-16T12:05:00.000Z"]);
    row = readProfile();
    expect(row.current_streak).toBe(0);
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.last_activity_date).toBe("2026-10-13");
    expect(new Date(row.streak_credit_at ?? "").toISOString()).toBe(credit);

    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 0,
      rest: 0,
      tzLo: 600,
      tzHi: 600,
      creditAt: "2026-10-13T13:00:00.000Z",
      setAt: "2026-10-13T13:00:00.000Z",
    });
    runCrons(["2026-10-15T12:00:00.000Z"]);
    row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-10-13");

    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 0,
      rest: 0,
      tzLo: 600,
      tzHi: 600,
      creditAt: "2026-10-13T11:00:00.000Z",
      setAt: "2026-10-13T11:00:00.000Z",
    });
    runCrons(["2026-10-15T12:00:00.000Z"]);
    row = readProfile();
    expect(row.current_streak).toBe(0);
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.last_activity_date).toBe("2026-10-13");
  });

  it("X10 UTC+10 frz=1 rest=1, last 10-13, crons to 10-16 12:05Z: not zeroed, tokens untouched", () => {
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 1,
      rest: 1,
      tzLo: 600,
      tzHi: 600,
      creditAt: "2026-10-13T02:00:00.000Z",
      setAt: "2026-10-13T02:00:00.000Z",
    });
    runCrons([
      "2026-10-15T00:05:00.000Z",
      "2026-10-16T00:05:00.000Z",
      "2026-10-16T12:05:00.000Z",
    ]);
    const row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-10-13");
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.rest_days).toBe(1);
  });

  it("does not zero when award_xp raced after the snapshot", () => {
    seed({
      lastActivity: "2026-06-06",
      streak: 12,
      freeze: 0,
      rest: 0,
      tzLo: -300,
      creditAt: "2026-06-06T01:00:00.000Z",
    });
    replica.exec(`
      CREATE OR REPLACE FUNCTION public.xp_server_now()
      RETURNS timestamptz
      LANGUAGE plpgsql
      VOLATILE
      SET search_path = public
      AS $fn$
      BEGIN
        UPDATE public.user_profiles
        SET last_activity_date = '2026-06-08'::date,
            streak_credit_at = TIMESTAMPTZ '2026-06-08 00:05:00+00'
        WHERE id = '${USER_A}';
        RETURN TIMESTAMPTZ '2026-06-09 00:05:00+00';
      END;
      $fn$;
      REVOKE ALL ON FUNCTION public.xp_server_now() FROM PUBLIC;
      REVOKE ALL ON FUNCTION public.xp_server_now() FROM anon;
      REVOKE ALL ON FUNCTION public.xp_server_now() FROM authenticated;
      REVOKE ALL ON FUNCTION public.xp_server_now() FROM service_role;
    `);
    replica.exec("SELECT public.evaluate_user_streaks();");
    const row = readProfile();
    expect(row.current_streak).toBe(12);
    expect(row.last_activity_date).toBe("2026-06-08");
    expect(row.streak_freeze_tokens).toBe(0);
  });

  it("expires active_boost on wall-clock now and denies authenticated EXECUTE", () => {
    replica.exec(`
      UPDATE public.user_profiles
      SET active_boost = jsonb_build_object('expires_at', '2000-01-01T00:00:00Z')
      WHERE id = '${USER_A}';
    `);
    replica.exec("SELECT public.evaluate_user_streaks();");
    expect(readProfile().active_boost).toBeNull();

    expect(() => replica.execAs(USER_A, "SELECT public.evaluate_user_streaks();")).toThrow(
      /permission denied/i,
    );
  });

  it.skipIf(!hasR9AwardXp)(`X1 #827 R1 UTC+10 frz=2 (${R9_REASON})`, () => {
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 2,
      rest: 0,
      tzLo: 600,
      tzHi: 600,
      creditAt: "2026-10-13T02:00:00.000Z",
      setAt: "2026-10-13T02:00:00.000Z",
    });
    runCrons(C3);
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-10-13");
    expect(row.streak_freeze_tokens).toBe(2);
    const awarded = claim("2026-10-16T02:00:00.000Z", "2026-10-16", "x1-r1");
    expect(awarded.current_streak).toBe(6);
    expect(awarded.streak_freeze_tokens).toBe(0);
    row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe("2026-10-16");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.rest_days).toBe(0);
  });

  it.skipIf(!hasR9AwardXp)(`X2 R1 with 1 freeze (${R9_REASON})`, () => {
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 1,
      rest: 0,
      tzLo: 600,
      tzHi: 600,
      creditAt: "2026-10-13T02:00:00.000Z",
      setAt: "2026-10-13T02:00:00.000Z",
    });
    runCrons(C3);
    const awarded = claim("2026-10-16T02:00:00.000Z", "2026-10-16", "x2-r1-one");
    expect(awarded.current_streak).toBe(1);
    expect(awarded.streak_freeze_tokens).toBe(1);
    const row = readProfile();
    expect(row.current_streak).toBe(1);
    expect(row.last_activity_date).toBe("2026-10-16");
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.rest_days).toBe(0);
  });

  it.skipIf(!hasR9AwardXp)(`X3 R1 with 2 rest days (${R9_REASON})`, () => {
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 0,
      rest: 2,
      tzLo: 600,
      tzHi: 600,
      creditAt: "2026-10-13T02:00:00.000Z",
      setAt: "2026-10-13T02:00:00.000Z",
    });
    runCrons(C3);
    const awarded = claim("2026-10-16T02:00:00.000Z", "2026-10-16", "x3-r1-rest");
    expect(awarded.current_streak).toBe(6);
    const row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe("2026-10-16");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.rest_days).toBe(0);
  });

  it.skipIf(!hasR9AwardXp)(`X4 R1w UTC-5 control frz=2 (${R9_REASON})`, () => {
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 2,
      rest: 0,
      tzLo: -300,
      tzHi: -300,
      creditAt: "2026-10-13T17:00:00.000Z",
      setAt: "2026-10-13T17:00:00.000Z",
    });
    runCrons(C3);
    const awarded = claim("2026-10-16T17:00:00.000Z", "2026-10-16", "x4-r1w");
    expect(awarded.current_streak).toBe(6);
    expect(awarded.streak_freeze_tokens).toBe(0);
    const row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe("2026-10-16");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.rest_days).toBe(0);
  });

  it.skipIf(!hasR9AwardXp)(`X5 R1w UTC-5 frz=1 N<k (${R9_REASON})`, () => {
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 1,
      rest: 0,
      tzLo: -300,
      tzHi: -300,
      creditAt: "2026-10-13T17:00:00.000Z",
      setAt: "2026-10-13T17:00:00.000Z",
    });
    runCrons(C3);
    const awarded = claim("2026-10-16T17:00:00.000Z", "2026-10-16", "x5-r1w-one");
    expect(awarded.current_streak).toBe(1);
    expect(awarded.streak_freeze_tokens).toBe(1);
    const row = readProfile();
    expect(row.current_streak).toBe(1);
    expect(row.last_activity_date).toBe("2026-10-16");
    expect(row.streak_freeze_tokens).toBe(1);
  });

  it.skipIf(!hasR9AwardXp)(`X6 #827 R2 UTC+10 rest=1, miss 10-14, claim 10-15 (${R9_REASON})`, () => {
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 0,
      rest: 1,
      tzLo: 600,
      tzHi: 600,
      creditAt: "2026-10-13T02:00:00.000Z",
      setAt: "2026-10-13T02:00:00.000Z",
    });
    runCrons(["2026-10-14T00:05:00.000Z", "2026-10-15T00:05:00.000Z"]);
    const awarded = claim("2026-10-15T02:00:00.000Z", "2026-10-15", "x6-r2");
    expect(awarded.current_streak).toBe(6);
    const row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe("2026-10-15");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.rest_days).toBe(0);
  });

  it.skipIf(!hasR9AwardXp)(`mixed 1 freeze + 1 rest on R1 shape (${R9_REASON})`, () => {
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 1,
      rest: 1,
      tzLo: 600,
      tzHi: 600,
      creditAt: "2026-10-13T02:00:00.000Z",
      setAt: "2026-10-13T02:00:00.000Z",
    });
    runCrons(C3);
    const awarded = claim("2026-10-16T02:00:00.000Z", "2026-10-16", "mixed-r1");
    expect(awarded.current_streak).toBe(6);
    const row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe("2026-10-16");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.rest_days).toBe(0);
  });

  it.skipIf(!hasR9AwardXp)(`X7 N>=k keeps streak and spends k; N=k-1 resets with tokens kept (${R9_REASON})`, () => {
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 2,
      rest: 0,
      tzLo: 600,
      tzHi: 600,
      creditAt: "2026-10-13T02:00:00.000Z",
      setAt: "2026-10-13T02:00:00.000Z",
    });
    runCrons(C3);
    let awarded = claim("2026-10-16T02:00:00.000Z", "2026-10-16", "x7-ge");
    expect(awarded.current_streak).toBe(6);
    expect(awarded.streak_freeze_tokens).toBe(0);

    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: 1,
      rest: 0,
      tzLo: 0,
      tzHi: 0,
      creditAt: "2026-10-13T12:00:00.000Z",
      setAt: "2026-10-13T12:00:00.000Z",
    });
    runCrons(C3);
    awarded = claim("2026-10-16T12:00:00.000Z", "2026-10-16", "x7-lt");
    expect(awarded.current_streak).toBe(1);
    expect(awarded.streak_freeze_tokens).toBe(1);
  });

  it.skipIf(!hasR9AwardXp)(`X8 same-instant cron then award equals award then cron (${R9_REASON})`, () => {
    const t = "2026-10-20T00:05:00.000Z";
    const credit = "2026-10-18T01:05:00.000Z";
    seed({
      lastActivity: "2026-10-18",
      streak: 5,
      freeze: 2,
      rest: 0,
      tzLo: 600,
      tzHi: 600,
      creditAt: credit,
      setAt: credit,
    });
    setXpNow(replica, t);
    replica.exec("SELECT public.evaluate_user_streaks();");
    const cronFirst = claim(t, "2026-10-20", "x8-cron-first");
    const a = `${cronFirst.current_streak}/${cronFirst.streak_freeze_tokens}`;

    seed({
      lastActivity: "2026-10-18",
      streak: 5,
      freeze: 2,
      rest: 0,
      tzLo: 600,
      tzHi: 600,
      creditAt: credit,
      setAt: credit,
    });
    const awardFirst = claim(t, "2026-10-20", "x8-award-first");
    setXpNow(replica, t);
    replica.exec("SELECT public.evaluate_user_streaks();");
    const afterCron = readProfile();
    const b = `${afterCron.current_streak}/${afterCron.streak_freeze_tokens}`;
    expect(a).toBe(b);
    expect(awardFirst.current_streak).toBe(cronFirst.current_streak);
  });

  it.skipIf(!hasR9AwardXp)(`X9 NULL band g=2 at e=47h05m is bridged; cron does not zero first (${R9_REASON})`, () => {
    seed({
      lastActivity: "2026-10-18",
      streak: 5,
      freeze: 0,
      rest: 0,
      tzLo: null,
      tzHi: null,
      creditAt: "2026-10-18T13:00:00.000Z",
      setAt: "2026-10-18T13:00:00.000Z",
    });
    setXpNow(replica, "2026-10-20T12:05:00.000Z");
    replica.exec("SELECT public.evaluate_user_streaks();");
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-10-18");
    const cronFirst = claim("2026-10-20T12:05:00.000Z", "2026-10-20", "x9a");
    expect(cronFirst.current_streak).toBe(6);
    expect(cronFirst.last_activity_date).toBe("2026-10-20");

    seed({
      lastActivity: "2026-10-18",
      streak: 5,
      freeze: 0,
      rest: 0,
      tzLo: null,
      tzHi: null,
      creditAt: "2026-10-18T13:00:00.000Z",
      setAt: "2026-10-18T13:00:00.000Z",
    });
    const awardFirst = claim("2026-10-20T12:05:00.000Z", "2026-10-20", "x9b");
    setXpNow(replica, "2026-10-20T12:05:00.000Z");
    replica.exec("SELECT public.evaluate_user_streaks();");
    row = readProfile();
    expect(awardFirst.current_streak).toBe(6);
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe("2026-10-20");
  });

  it.skipIf(!hasR9AwardXp)(`R4 UTC+10 k=2 early return 00:30 local (${R9_REASON})`, () => {
    // QA FAIL at 81f0c441: award_xp g=3 reset s=1 frz=2. Probes X1 is the
    // after-00:05Z twin (s=6 last=10-16 frz=0 rest=0). Same shape here.
    const state = qaRun(`
      SELECT pg_temp.q_reset('${USER_A}'::uuid, 5, DATE '2026-10-13', 2, 0, 600, 600, TIMESTAMPTZ '2026-10-13 02:00Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-14 00:05Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-15 00:05Z');
      SELECT pg_temp.q_award('${USER_A}'::uuid, TIMESTAMPTZ '2026-10-15 14:30Z', DATE '2026-10-16', 'r4');
    `);
    expect(state).toBe("s=6 last=2026-10-16 frz=0 rest=0");
    expect(state).not.toMatch(/^s=1 /);
    expect(state).not.toMatch(/frz=2/);
  });

  it.skipIf(!hasR9AwardXp)(`R5 UTC+14 k=2 return 12:00 local before spending run (${R9_REASON})`, () => {
    const state = qaRun(`
      SELECT pg_temp.q_reset('${USER_A}'::uuid, 5, DATE '2026-10-13', 2, 0, 840, 840, TIMESTAMPTZ '2026-10-12 22:00Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-14 00:05Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-15 00:05Z');
      SELECT pg_temp.q_award('${USER_A}'::uuid, TIMESTAMPTZ '2026-10-15 22:00Z', DATE '2026-10-16', 'r5');
    `);
    expect(state).toBe("s=6 last=2026-10-16 frz=0 rest=0");
    expect(state).not.toMatch(/^s=1 /);
  });

  it.skipIf(!hasR9AwardXp)(`R6 Berlin k=3 return 00:30 local spends all 3 tokens (${R9_REASON})`, () => {
    const state = qaRun(`
      SELECT pg_temp.q_reset('${USER_A}'::uuid, 5, DATE '2026-10-13', 3, 0, 120, 120, TIMESTAMPTZ '2026-10-13 10:00Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-14 00:05Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-15 00:05Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-16 00:05Z');
      SELECT pg_temp.q_award('${USER_A}'::uuid, TIMESTAMPTZ '2026-10-16 22:30Z', DATE '2026-10-17', 'r6');
    `);
    expect(state).toBe("s=6 last=2026-10-17 frz=0 rest=0");
    expect(state).not.toMatch(/^s=1 /);
    expect(state).not.toMatch(/frz=2/);
  });

  it.skipIf(!hasR9AwardXp).each([
    { zone: "Berlin", tz: 120, k: 2, freeze: 2, ret: "2026-10-16", insideH: 0, insideM: 30 },
    { zone: "Kathmandu", tz: 345, k: 2, freeze: 2, ret: "2026-10-16", insideH: 0, insideM: 30 },
    { zone: "Sydney", tz: 660, k: 2, freeze: 2, ret: "2026-10-16", insideH: 0, insideM: 30 },
    { zone: "+10", tz: 600, k: 2, freeze: 2, ret: "2026-10-16", insideH: 0, insideM: 30 },
    { zone: "+13", tz: 780, k: 2, freeze: 2, ret: "2026-10-16", insideH: 12, insideM: 0 },
    { zone: "+14", tz: 840, k: 2, freeze: 2, ret: "2026-10-16", insideH: 12, insideM: 0 },
    { zone: "Berlin-k3", tz: 120, k: 3, freeze: 3, ret: "2026-10-17", insideH: 0, insideM: 30 },
  ])(`early-return window $zone k=$k inside vs after 00:05Z (${R9_REASON})`, ({
    zone,
    tz,
    freeze,
    ret,
    insideH,
    insideM,
  }) => {
    const credit = utcIsoFromLocal("2026-10-13", 12, tz);
    const cronsBefore: string[] = [];
    for (const d of ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"]) {
      if (d >= ret) break;
      cronsBefore.push(`${d}T00:05:00.000Z`);
    }
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze,
      rest: 0,
      tzLo: tz,
      tzHi: tz,
      creditAt: credit,
      setAt: credit,
    });
    runCrons(cronsBefore);
    const inside = claim(utcIsoFromLocal(ret, insideH, tz, insideM), ret, `win-in-${zone}`);
    expectKept(inside, ret);

    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze,
      rest: 0,
      tzLo: tz,
      tzHi: tz,
      creditAt: credit,
      setAt: credit,
    });
    runCrons([...cronsBefore, `${ret}T00:05:00.000Z`]);
    const after = claim(`${ret}T00:06:00.000Z`, ret, `win-after-${zone}`);
    expect(after.current_streak).toBe(inside.current_streak);
    expect(after.streak_freeze_tokens).toBe(inside.streak_freeze_tokens);
    expect(after.last_activity_date).toBe(inside.last_activity_date);
    expectKept(after, ret);
  });
});
