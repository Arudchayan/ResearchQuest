/**
 * Nightly streak evaluator (1765900000): static contract + live PG17 replica.
 *
 * Lazy v2 cron: UTC-12 missed = local_today_min - GREATEST(last, pending) - 1,
 * with pending counting only when later than last. Zero current_streak only
 * when missed > freeze + rest AND (credit_at IS NULL or e >= 48h). Never
 * spends tokens and never moves last, credit_at or pending. award_xp
 * (#826 round 11) spends tokens on the return claim, counting misses from
 * the last claimed date. CI installs PostgreSQL 17 so live cases run
 * (0 skipped).
 */
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  PG17_AVAILABLE,
  USER_A,
  addDays,
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
const QA_HELPERS = path.join(testDir, "qa827ReproHelpers.sql");
const N2A_MATRIX = JSON.parse(
  readFileSync(path.join(testDir, "qa827N2aMatrix180.json"), "utf8"),
) as Array<{
  k: number;
  n: number;
  t: string;
  tz: string;
  used: number;
  final: string;
  log: string;
}>;

/** Fixed October-2026 offsets for QA N2a zones (Etc/GMT is POSIX-inverted). */
const N2A_TZ_MIN: Record<string, number> = {
  "Pacific/Kiritimati": 840,
  "Etc/GMT-13": 780,
  "Etc/GMT-10": 600,
  "Asia/Kathmandu": 345,
  "Australia/Sydney": 660,
  "Europe/Berlin": 120,
  UTC: 0,
  "America/New_York": -240,
  "Etc/GMT+5": -300,
  "Etc/GMT+12": -720,
};

type N2Kind = "freeze" | "rest";
type N2Row = { tz: string; t: string; kind: N2Kind; k: number; n: number };

const N2_TIMES = ["00:30", "12:00", "23:30"] as const;
const N2A_KN = [
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 2],
  [2, 3],
  [3, 3],
] as const;
const N2B_KN = [
  [1, 0],
  [2, 0],
  [2, 1],
  [3, 0],
  [3, 1],
  [3, 2],
] as const;

function n2Grid(kn: readonly (readonly [number, number])[]): N2Row[] {
  const rows: N2Row[] = [];
  for (const tz of Object.keys(N2A_TZ_MIN)) {
    for (const t of N2_TIMES) {
      for (const kind of ["freeze", "rest"] as const) {
        for (const [k, n] of kn) {
          rows.push({ tz, t, kind, k, n });
        }
      }
    }
  }
  return rows;
}

const N2A_ALL = n2Grid(N2A_KN);
const N2B_ALL = n2Grid(N2B_KN);

const CRON_005Z = "2026-06-09T00:05:00.000Z";
const NEXT_CRON_005Z = "2026-06-10T00:05:00.000Z";
const C3 = [
  "2026-10-14T00:05:00.000Z",
  "2026-10-15T00:05:00.000Z",
  "2026-10-16T00:05:00.000Z",
] as const;
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
  streak_pending_date: string | null;
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

  it("computes missed from the UTC-12 civil date, not streak_tz_lo_min", () => {
    expect(fn).toMatch(/local_today_min/i);
    expect(fn).toMatch(/make_interval\s*\(\s*mins\s*=>\s*-720\s*\)/i);
    expect(fn).not.toMatch(/streak_tz_lo_min/i);
    expect(raw).toMatch(/UTC-12/);
    expect(fn).toMatch(/AT\s+TIME\s+ZONE\s+'UTC'/i);
    expect(fn).toMatch(/public\.xp_server_now\s*\(\s*\)/i);
    // v2 (r11): missed counts from the last CLAIMED date, pending included only when later than last.
    expect(fn).toMatch(
      /missed\s*:=\s*local_today_min\s*-\s*GREATEST\s*\(\s*profile\.last_activity_date\s*,\s*profile\.streak_pending_date\s*\)\s*-\s*1/i,
    );
    expect(fn).not.toMatch(/missed\s*:=\s*local_today_min\s*-\s*profile\.last_activity_date\s*-\s*1/i);
    expect(fn).not.toMatch(/COALESCE\s*\(\s*profile\.streak_pending_date/i);
    expect(fn).not.toMatch(/streak_pending_date\s*=/i);
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

  it("guards the zero UPDATE on last_activity_date, streak_credit_at and streak_pending_date", () => {
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
    expect(zero).toMatch(
      /streak_pending_date\s+IS\s+NOT\s+DISTINCT\s+FROM\s+profile\.streak_pending_date/i,
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
              streak_credit_at, streak_pending_date, active_boost
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
    pendingDate?: string | null;
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
    const pending =
      opts.pendingDate === undefined || opts.pendingDate === null
        ? "NULL"
        : `'${opts.pendingDate}'::date`;
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
          streak_credit_at = ${creditAt},
          streak_pending_date = ${pending}
      WHERE id = '${USER_A}';
    `);
  }

  function seedWestPending(opts: {
    freeze: number;
    rest?: number;
    pending: string | null;
    creditAt: string;
  }): void {
    seed({
      lastActivity: "2026-10-05",
      streak: 5,
      freeze: opts.freeze,
      rest: opts.rest ?? 0,
      tzLo: -600,
      tzHi: -600,
      creditAt: opts.creditAt,
      setAt: "2026-10-05T22:00:00.000Z",
      pendingDate: opts.pending,
    });
  }

  function seedPendingLondonAuckland(freeze: number): void {
    seed({
      lastActivity: "2026-09-06",
      streak: 6,
      freeze,
      rest: 0,
      tzLo: 15,
      tzHi: 356,
      creditAt: "2026-09-06T11:59:32.456Z",
      setAt: "2026-09-06T11:59:32.456Z",
      pendingDate: "2026-09-07",
    });
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

  function n2Probe(row: N2Row, tag: string) {
    const tzMin = N2A_TZ_MIN[row.tz];
    if (tzMin === undefined) throw new Error(`unknown N2 tz ${row.tz}`);
    const ld = addDays("2026-10-13", row.k + 1);
    const [hh, mm] = row.t.split(":").map(Number);
    const credit = utcIsoFromLocal("2026-10-13", 12, tzMin);
    const claimAt = utcIsoFromLocal(ld, hh, tzMin, mm);
    const crons: string[] = [];
    for (const d of [
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
    ]) {
      const cron = `${d}T00:05:00.000Z`;
      if (cron < claimAt) crons.push(cron);
    }
    const freeze0 = row.kind === "freeze" ? row.n : 0;
    const rest0 = row.kind === "rest" ? row.n : 0;
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: freeze0,
      rest: rest0,
      tzLo: tzMin,
      tzHi: tzMin,
      creditAt: credit,
      setAt: credit,
    });
    runCrons(crons);
    const afterCron = readProfile();
    const cronSpent =
      freeze0 - afterCron.streak_freeze_tokens + (rest0 - afterCron.rest_days);
    claim(claimAt, ld, tag);
    const afterAward = readProfile();
    const awardSpent =
      afterCron.streak_freeze_tokens -
      afterAward.streak_freeze_tokens +
      (afterCron.rest_days - afterAward.rest_days);
    return { ld, afterCron, afterAward, cronSpent, awardSpent, freeze0, rest0 };
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

  it(`X1 #827 R1 UTC+10 frz=2`, () => {
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

  it(`X2 R1 with 1 freeze`, () => {
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

  it(`X3 R1 with 2 rest days`, () => {
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

  it(`X4 R1w UTC-5 control frz=2`, () => {
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

  it(`X5 R1w UTC-5 frz=1 N<k`, () => {
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

  it(`X6 #827 R2 UTC+10 rest=1, miss 10-14, claim 10-15`, () => {
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

  it(`mixed 1 freeze + 1 rest on R1 shape`, () => {
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

  it(`X7 N>=k keeps streak and spends k; N=k-1 resets with tokens kept`, () => {
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

  it(`X8 same-instant cron then award equals award then cron`, () => {
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

  it(`X9 NULL band g=2 at e=47h05m is bridged; cron does not zero first`, () => {
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

  it(`R1 UTC+10 k=2 frz=2 return after 00:05Z`, () => {
    const state = qaRun(`
      SELECT pg_temp.q_reset('${USER_A}'::uuid, 5, DATE '2026-10-13', 2, 0, 600, 600, TIMESTAMPTZ '2026-10-13 02:00Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-14 00:05Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-15 00:05Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-16 00:05Z');
      SELECT pg_temp.q_award('${USER_A}'::uuid, TIMESTAMPTZ '2026-10-16 02:00Z', DATE '2026-10-16', 'r1');
    `);
    expect(state).toBe("s=6 last=2026-10-16 frz=0 rest=0");
  });

  it(`R1w UTC-5 k=2 frz=2 control`, () => {
    const state = qaRun(`
      SELECT pg_temp.q_reset('${USER_A}'::uuid, 5, DATE '2026-10-13', 2, 0, -300, -300, TIMESTAMPTZ '2026-10-13 17:00Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-14 00:05Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-15 00:05Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-16 00:05Z');
      SELECT pg_temp.q_award('${USER_A}'::uuid, TIMESTAMPTZ '2026-10-16 17:00Z', DATE '2026-10-16', 'r1w');
    `);
    expect(state).toBe("s=6 last=2026-10-16 frz=0 rest=0");
  });

  it(`R2 UTC+10 rest=1 one missed local day`, () => {
    const state = qaRun(`
      SELECT pg_temp.q_reset('${USER_A}'::uuid, 5, DATE '2026-10-13', 0, 1, 600, 600, TIMESTAMPTZ '2026-10-13 02:00Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-14 00:05Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-15 00:05Z');
      SELECT pg_temp.q_award('${USER_A}'::uuid, TIMESTAMPTZ '2026-10-15 02:00Z', DATE '2026-10-15', 'r2');
    `);
    expect(state).toBe("s=6 last=2026-10-15 frz=0 rest=0");
  });

  it(`R3 UTC+10 k=2 frz=1 N<k resets and keeps the token`, () => {
    const state = qaRun(`
      SELECT pg_temp.q_reset('${USER_A}'::uuid, 5, DATE '2026-10-13', 1, 0, 600, 600, TIMESTAMPTZ '2026-10-13 02:00Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-14 00:05Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-15 00:05Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-16 00:05Z');
      SELECT pg_temp.q_award('${USER_A}'::uuid, TIMESTAMPTZ '2026-10-16 02:00Z', DATE '2026-10-16', 'r3');
    `);
    expect(state).toBe("s=1 last=2026-10-16 frz=1 rest=0");
  });

  it(`R4 UTC+10 k=2 early return 00:30 local`, () => {
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

  it(`R5 UTC+14 k=2 return 12:00 local before spending run`, () => {
    const state = qaRun(`
      SELECT pg_temp.q_reset('${USER_A}'::uuid, 5, DATE '2026-10-13', 2, 0, 840, 840, TIMESTAMPTZ '2026-10-12 22:00Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-14 00:05Z');
      SELECT pg_temp.q_cron(TIMESTAMPTZ '2026-10-15 00:05Z');
      SELECT pg_temp.q_award('${USER_A}'::uuid, TIMESTAMPTZ '2026-10-15 22:00Z', DATE '2026-10-16', 'r5');
    `);
    expect(state).toBe("s=6 last=2026-10-16 frz=0 rest=0");
    expect(state).not.toMatch(/^s=1 /);
  });

  it(`R6 Berlin k=3 return 00:30 local spends all 3 tokens`, () => {
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

  it(`R7 UTC+10 frz=2 never returns: lazy cron keeps tokens then zeros`, () => {
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
    runCrons([
      "2026-10-16T00:05:00.000Z",
      "2026-10-16T00:05:30.000Z",
      "2026-10-17T00:05:00.000Z",
    ]);
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.streak_freeze_tokens).toBe(2);
    expect(row.last_activity_date).toBe("2026-10-13");
    runCrons(["2026-10-18T00:05:00.000Z"]);
    row = readProfile();
    expect(row.current_streak).toBe(0);
    expect(row.streak_freeze_tokens).toBe(2);
    expect(row.last_activity_date).toBe("2026-10-13");
    expect(row.rest_days).toBe(0);
  });

  // QA N2a-freeze 24/180 FAILs at 81f0c441: east return before 00:05Z on
  // L+k+1. award_xp spends m=g-1 and the return day counts (s=prior+1).
  // leftover freeze = N-k. Crons only before the return-day 00:05Z.
  it.each([
    { zone: "Berlin", tz: 120, k: 2, n: 2, hh: 0, mm: 30, last: "2026-10-16", frz: 0 },
    { zone: "Berlin", tz: 120, k: 2, n: 3, hh: 0, mm: 30, last: "2026-10-16", frz: 1 },
    { zone: "Berlin", tz: 120, k: 3, n: 3, hh: 0, mm: 30, last: "2026-10-17", frz: 0 },
    { zone: "Kathmandu", tz: 345, k: 2, n: 2, hh: 0, mm: 30, last: "2026-10-16", frz: 0 },
    { zone: "Kathmandu", tz: 345, k: 2, n: 3, hh: 0, mm: 30, last: "2026-10-16", frz: 1 },
    { zone: "Kathmandu", tz: 345, k: 3, n: 3, hh: 0, mm: 30, last: "2026-10-17", frz: 0 },
    { zone: "Sydney", tz: 660, k: 2, n: 2, hh: 0, mm: 30, last: "2026-10-16", frz: 0 },
    { zone: "Sydney", tz: 660, k: 2, n: 3, hh: 0, mm: 30, last: "2026-10-16", frz: 1 },
    { zone: "Sydney", tz: 660, k: 3, n: 3, hh: 0, mm: 30, last: "2026-10-17", frz: 0 },
    { zone: "UTC+10", tz: 600, k: 2, n: 2, hh: 0, mm: 30, last: "2026-10-16", frz: 0 },
    { zone: "UTC+10", tz: 600, k: 2, n: 3, hh: 0, mm: 30, last: "2026-10-16", frz: 1 },
    { zone: "UTC+10", tz: 600, k: 3, n: 3, hh: 0, mm: 30, last: "2026-10-17", frz: 0 },
    { zone: "UTC+13", tz: 780, k: 2, n: 2, hh: 0, mm: 30, last: "2026-10-16", frz: 0 },
    { zone: "UTC+13", tz: 780, k: 2, n: 2, hh: 12, mm: 0, last: "2026-10-16", frz: 0 },
    { zone: "UTC+13", tz: 780, k: 2, n: 3, hh: 0, mm: 30, last: "2026-10-16", frz: 1 },
    { zone: "UTC+13", tz: 780, k: 2, n: 3, hh: 12, mm: 0, last: "2026-10-16", frz: 1 },
    { zone: "UTC+13", tz: 780, k: 3, n: 3, hh: 0, mm: 30, last: "2026-10-17", frz: 0 },
    { zone: "UTC+13", tz: 780, k: 3, n: 3, hh: 12, mm: 0, last: "2026-10-17", frz: 0 },
    { zone: "UTC+14", tz: 840, k: 2, n: 2, hh: 0, mm: 30, last: "2026-10-16", frz: 0 },
    { zone: "UTC+14", tz: 840, k: 2, n: 2, hh: 12, mm: 0, last: "2026-10-16", frz: 0 },
    { zone: "UTC+14", tz: 840, k: 2, n: 3, hh: 0, mm: 30, last: "2026-10-16", frz: 1 },
    { zone: "UTC+14", tz: 840, k: 2, n: 3, hh: 12, mm: 0, last: "2026-10-16", frz: 1 },
    { zone: "UTC+14", tz: 840, k: 3, n: 3, hh: 0, mm: 30, last: "2026-10-17", frz: 0 },
    { zone: "UTC+14", tz: 840, k: 3, n: 3, hh: 12, mm: 0, last: "2026-10-17", frz: 0 },
  ])("N2a-east $zone k=$k N=$n @$hh:$mm before 00:05Z", ({
    zone,
    tz,
    k,
    n,
    hh,
    mm,
    last,
    frz,
  }) => {
    const credit = utcIsoFromLocal("2026-10-13", 12, tz);
    const crons: string[] = [];
    for (const d of ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"]) {
      if (d >= last) break;
      crons.push(`${d}T00:05:00.000Z`);
    }
    seed({
      lastActivity: "2026-10-13",
      streak: 5,
      freeze: n,
      rest: 0,
      tzLo: tz,
      tzHi: tz,
      creditAt: credit,
      setAt: credit,
    });
    runCrons(crons);
    const awarded = claim(
      utcIsoFromLocal(last, hh, tz, mm),
      last,
      `n2a-${zone}-k${k}-n${n}-${hh}${mm}`,
    );
    expect(awarded.current_streak).toBe(6);
    expect(awarded.current_streak).not.toBe(1);
    expect(awarded.last_activity_date).toBe(last);
    expect(awarded.streak_freeze_tokens).toBe(frz);
    const row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe(last);
    expect(row.streak_freeze_tokens).toBe(frz);
    expect(row.rest_days).toBe(0);
  });

  // N2a-all: 10 zones × 3 times × {freeze,rest} × (k,N) N>=k = 360.
  // Return day counts (s=prior+1=6); leftover tokens = N-k. Cron spends 0.
  it.each(N2A_ALL)("N2a-all $kind $tz k=$k N=$n t=$t", (row) => {
    const tag = `n2a-${row.kind}-${row.tz}-k${row.k}-n${row.n}-${row.t}`;
    const { ld, afterCron, afterAward, cronSpent, awardSpent, freeze0, rest0 } =
      n2Probe(row, tag);
    expect(cronSpent).toBe(0);
    expect(afterCron.streak_freeze_tokens).toBe(freeze0);
    expect(afterCron.rest_days).toBe(rest0);
    expect(awardSpent).toBe(row.k);
    expect(cronSpent > 0 && awardSpent > 0).toBe(false);
    const leftoverFrz = row.kind === "freeze" ? row.n - row.k : 0;
    const leftoverRest = row.kind === "rest" ? row.n - row.k : 0;
    expect(
      `s=${afterAward.current_streak} last=${afterAward.last_activity_date} frz=${afterAward.streak_freeze_tokens} rest=${afterAward.rest_days}`,
    ).toBe(`s=6 last=${ld} frz=${leftoverFrz} rest=${leftoverRest}`);
  });

  // N2b: N<k, 360 cases. Cron spends 0. Return resets; tokens kept.
  it.each(N2B_ALL)("N2b $kind $tz k=$k N=$n t=$t", (row) => {
    const tag = `n2b-${row.kind}-${row.tz}-k${row.k}-n${row.n}-${row.t}`;
    const { ld, afterCron, afterAward, cronSpent, awardSpent, freeze0, rest0 } =
      n2Probe(row, tag);
    expect(cronSpent).toBe(0);
    expect(afterCron.streak_freeze_tokens).toBe(freeze0);
    expect(afterCron.rest_days).toBe(rest0);
    expect(awardSpent).toBe(0);
    expect(cronSpent > 0 && awardSpent > 0).toBe(false);
    expect(
      `s=${afterAward.current_streak} last=${afterAward.last_activity_date} frz=${afterAward.streak_freeze_tokens} rest=${afterAward.rest_days}`,
    ).toBe(`s=1 last=${ld} frz=${freeze0} rest=${rest0}`);
  });

  it("N2c: 0 double spends; N2a-all=360 N2b=360", () => {
    expect(N2A_ALL).toHaveLength(360);
    expect(N2B_ALL).toHaveLength(360);
    expect(N2A_MATRIX).toHaveLength(180);
  });

  it.each([
    { zone: "Berlin", tz: 120, k: 2, freeze: 2, ret: "2026-10-16", insideH: 0, insideM: 30 },
    { zone: "Kathmandu", tz: 345, k: 2, freeze: 2, ret: "2026-10-16", insideH: 0, insideM: 30 },
    { zone: "Sydney", tz: 660, k: 2, freeze: 2, ret: "2026-10-16", insideH: 0, insideM: 30 },
    { zone: "+10", tz: 600, k: 2, freeze: 2, ret: "2026-10-16", insideH: 0, insideM: 30 },
    { zone: "+13", tz: 780, k: 2, freeze: 2, ret: "2026-10-16", insideH: 12, insideM: 0 },
    { zone: "+14", tz: 840, k: 2, freeze: 2, ret: "2026-10-16", insideH: 12, insideM: 0 },
    { zone: "Berlin-k3", tz: 120, k: 3, freeze: 3, ret: "2026-10-17", insideH: 0, insideM: 30 },
  ])(`early-return window $zone k=$k inside vs after 00:05Z`, ({
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

  it("V1: west UTC-10 last 10-05 pending 10-06, 1 freeze: cron at 10-09 00:05Z (e=65h) keeps; return spends 1 freeze to 6", () => {
    seedWestPending({
      freeze: 1,
      pending: "2026-10-06",
      creditAt: "2026-10-06T07:05:00.000Z",
    });
    runCrons(["2026-10-09T00:05:00.000Z"]);
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-10-05");
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.streak_pending_date).toBe("2026-10-06");
    const awarded = claim("2026-10-09T02:00:00.000Z", "2026-10-08", "v1");
    expect(awarded.current_streak).toBe(6);
    expect(awarded.streak_freeze_tokens).toBe(0);
    row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe("2026-10-08");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.rest_days).toBe(0);
  });

  it("V1r: V1 with 1 rest day instead of freeze", () => {
    seedWestPending({
      freeze: 0,
      rest: 1,
      pending: "2026-10-06",
      creditAt: "2026-10-06T07:05:00.000Z",
    });
    runCrons(["2026-10-09T00:05:00.000Z"]);
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.rest_days).toBe(1);
    const awarded = claim("2026-10-09T02:00:00.000Z", "2026-10-08", "v1r");
    expect(awarded.current_streak).toBe(6);
    row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe("2026-10-08");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.rest_days).toBe(0);
  });

  it("V2: V1 with 0 tokens: zeroed at 10-09 00:05Z (e=65h) not at 10-08 (e=41h); only current_streak changes", () => {
    seedWestPending({
      freeze: 0,
      pending: "2026-10-06",
      creditAt: "2026-10-06T07:05:00.000Z",
    });
    runCrons(["2026-10-08T00:05:00.000Z"]);
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-10-05");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.streak_pending_date).toBe("2026-10-06");
    const credit = row.streak_credit_at;
    runCrons(["2026-10-09T00:05:00.000Z"]);
    row = readProfile();
    expect(row.current_streak).toBe(0);
    expect(row.last_activity_date).toBe("2026-10-05");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.rest_days).toBe(0);
    expect(row.streak_pending_date).toBe("2026-10-06");
    expect(row.streak_credit_at).toBe(credit);
  });

  it("V3: stale pending 10-04 < last 10-05, 1 freeze: kept at 10-08, zeroed at 10-09 (counted from last)", () => {
    seedWestPending({
      freeze: 1,
      pending: "2026-10-04",
      creditAt: "2026-10-05T12:00:00.000Z",
    });
    runCrons(["2026-10-08T00:05:00.000Z"]);
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-10-05");
    expect(row.streak_freeze_tokens).toBe(1);
    runCrons(["2026-10-09T00:05:00.000Z"]);
    row = readProfile();
    expect(row.current_streak).toBe(0);
    expect(row.last_activity_date).toBe("2026-10-05");
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.streak_pending_date).toBe("2026-10-04");
  });

  it("V3b: pending = last behaves as V3 (stale pending ignored)", () => {
    seedWestPending({
      freeze: 1,
      pending: "2026-10-05",
      creditAt: "2026-10-05T12:00:00.000Z",
    });
    runCrons(["2026-10-08T00:05:00.000Z"]);
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.streak_freeze_tokens).toBe(1);
    runCrons(["2026-10-09T00:05:00.000Z"]);
    row = readProfile();
    expect(row.current_streak).toBe(0);
    expect(row.last_activity_date).toBe("2026-10-05");
    expect(row.streak_freeze_tokens).toBe(1);
  });

  it("V3c: valid pending 10-06 > last with 1 freeze: kept at 10-09 00:05Z, zeroed at 10-10", () => {
    seedWestPending({
      freeze: 1,
      pending: "2026-10-06",
      creditAt: "2026-10-06T07:05:00.000Z",
    });
    runCrons(["2026-10-09T00:05:00.000Z"]);
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.streak_pending_date).toBe("2026-10-06");
    runCrons(["2026-10-10T00:05:00.000Z"]);
    row = readProfile();
    expect(row.current_streak).toBe(0);
    expect(row.last_activity_date).toBe("2026-10-05");
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.streak_pending_date).toBe("2026-10-06");
  });

  it("V4: v2 missed 1 > 0 tokens but e=25h: kept", () => {
    seedWestPending({
      freeze: 0,
      pending: "2026-10-06",
      creditAt: "2026-10-07T23:05:00.000Z",
    });
    runCrons(["2026-10-09T00:05:00.000Z"]);
    const row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-10-05");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.streak_pending_date).toBe("2026-10-06");
  });

  it.each([
    {
      id: "W1",
      tz: -600,
      creditAt: "2026-10-06T12:00:00.000Z",
      claimAt: "2026-10-08T06:00:00.000Z",
    },
    {
      id: "W2",
      tz: -300,
      creditAt: "2026-10-06T17:00:00.000Z",
      claimAt: "2026-10-08T03:00:00.000Z",
    },
    {
      id: "W3",
      tz: -480,
      creditAt: "2026-10-06T16:00:00.000Z",
      claimAt: "2026-10-08T04:00:00.000Z",
    },
    {
      id: "W4",
      tz: -720,
      creditAt: "2026-10-06T20:00:00.000Z",
      claimAt: "2026-10-08T06:00:00.000Z",
    },
  ])("$id: west tz=$tz pending bridge: cron keeps, return +1 with 0 tokens", ({
    tz,
    creditAt,
    claimAt,
  }) => {
    seed({
      lastActivity: "2026-10-05",
      streak: 5,
      freeze: 0,
      rest: 0,
      tzLo: tz,
      tzHi: tz,
      creditAt,
      setAt: creditAt,
      pendingDate: "2026-10-06",
    });
    runCrons(["2026-10-08T00:05:00.000Z"]);
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-10-05");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.streak_pending_date).toBe("2026-10-06");
    const awarded = claim(claimAt, "2026-10-07", `w-${tz}`);
    expect(awarded.current_streak).toBe(6);
    expect(awarded.streak_freeze_tokens).toBe(0);
    row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe("2026-10-07");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.rest_days).toBe(0);
  });

  it("E1: missed > tokens but e < 48h: lazy cron keeps (48h clause is load-bearing)", () => {
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
    const row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-10-13");
    expect(row.streak_freeze_tokens).toBe(0);
  });

  it("PD1: pending 09-07, crons are no-ops, return bridges to 7 token-free", () => {
    seedPendingLondonAuckland(0);
    runCrons(["2026-09-07T00:05:00.000Z", "2026-09-08T00:05:00.000Z"]);
    let row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe("2026-09-06");
    expect(row.streak_pending_date).toBe("2026-09-07");
    expect(row.streak_freeze_tokens).toBe(0);
    const awarded = claim("2026-09-08T08:23:35.075Z", "2026-09-08", "pd1");
    expect(awarded.current_streak).toBe(7);
    row = readProfile();
    expect(row.current_streak).toBe(7);
    expect(row.last_activity_date).toBe("2026-09-08");
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.rest_days).toBe(0);
  });

  it("PD2: PD1 with 1 token: token is kept (not spent on the gap)", () => {
    seedPendingLondonAuckland(1);
    runCrons(["2026-09-07T00:05:00.000Z", "2026-09-08T00:05:00.000Z"]);
    let row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.streak_freeze_tokens).toBe(1);
    const awarded = claim("2026-09-08T08:23:35.075Z", "2026-09-08", "pd2");
    expect(awarded.current_streak).toBe(7);
    row = readProfile();
    expect(row.current_streak).toBe(7);
    expect(row.last_activity_date).toBe("2026-09-08");
    expect(row.streak_freeze_tokens).toBe(2);
    expect(row.rest_days).toBe(0);
  });

  it("PD3: pending 09-07 never returns, 0 tokens: kept at 09-08 and 09-09 00:05Z, zeroed at 09-10", () => {
    seedPendingLondonAuckland(0);
    runCrons(["2026-09-08T00:05:00.000Z"]);
    let row = readProfile();
    expect(row.current_streak).toBe(6);
    runCrons(["2026-09-09T00:05:00.000Z"]);
    row = readProfile();
    expect(row.current_streak).toBe(6);
    expect(row.last_activity_date).toBe("2026-09-06");
    expect(row.streak_pending_date).toBe("2026-09-07");
    expect(row.streak_freeze_tokens).toBe(0);
    runCrons(["2026-09-10T00:05:00.000Z"]);
    row = readProfile();
    expect(row.current_streak).toBe(0);
    expect(row.last_activity_date).toBe("2026-09-06");
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.streak_pending_date).toBe("2026-09-07");
  });

  it("PD4: pending 09-07, no-op cron at 09-08 00:05Z, claim at e=48h-1ms bridges to 7", () => {
    seedPendingLondonAuckland(0);
    runCrons(["2026-09-08T00:05:00.000Z"]);
    let row = readProfile();
    expect(row.current_streak).toBe(6);
    const awarded = claim("2026-09-08T11:59:32.455Z", "2026-09-08", "pd4");
    expect(awarded.current_streak).toBe(7);
    row = readProfile();
    expect(row.current_streak).toBe(7);
    expect(row.last_activity_date).toBe("2026-09-08");
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.rest_days).toBe(0);
  });
});
