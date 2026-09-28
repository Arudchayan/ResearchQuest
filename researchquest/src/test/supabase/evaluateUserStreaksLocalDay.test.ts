/**
 * Nightly streak evaluator (1765900000): static contract + live PG17 replica.
 *
 * Pins the 00:05Z pg_cron path to last_activity_date + streak_tz_lo_min so a
 * UTC-5 user active at 20:00 local is not zeroed, and a future daily_logs
 * row cannot spoof the gap. CI installs PostgreSQL 17 so live cases run
 * (0 skipped).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  PG17_AVAILABLE,
  USER_A,
  resetUser,
  resetXpNow,
  setXpNow,
  startReplica,
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

  it("computes local_today_min from streak_tz_lo_min and last_activity_date only", () => {
    expect(fn).toMatch(/local_today_min/i);
    expect(fn).toMatch(/make_interval\s*\(\s*mins\s*=>\s*COALESCE\s*\(\s*(?:profile\.)?streak_tz_lo_min\s*,\s*-720\s*\)\s*\)/i);
    expect(fn).toMatch(/AT\s+TIME\s+ZONE\s+'UTC'/i);
    expect(fn).toMatch(/public\.xp_server_now\s*\(\s*\)/i);
    expect(fn).toMatch(/gap\s*:=\s*local_today_min\s*-\s*(?:profile\.)?last_activity_date/i);
    expect(fn).toMatch(/last_activity_date\s+IS\s+NULL/i);
    expect(fn).not.toMatch(/daily_logs/i);
    expect(fn).not.toMatch(/CURRENT_DATE/i);
    expect(fn).not.toMatch(/MAX\s*\(\s*date\s*\)/i);
  });

  it("mirrors freeze-then-rest consumption and leaves last_activity_date on zero", () => {
    expect(fn).toMatch(/gap\s*=\s*2/i);
    expect(fn).toMatch(/streak_freeze_tokens/i);
    expect(fn).toMatch(/rest_days/i);
    expect(fn).toMatch(/last_activity_date\s*=\s*local_today_min\s*-\s*1/i);
    expect(fn).toMatch(/current_streak\s*=\s*0/i);
    expect(fn).not.toMatch(/last_activity_date\s*=\s*latest_activity/i);
  });

  it("guards freeze, rest, and zero updates against a stale profile snapshot", () => {
    const freeze =
      /UPDATE\s+public\.user_profiles\s+SET\s+streak_freeze_tokens[\s\S]*?WHERE[\s\S]*?;/i.exec(fn)?.[0] ?? "";
    const rest =
      /UPDATE\s+public\.user_profiles\s+SET\s+rest_days[\s\S]*?WHERE[\s\S]*?;/i.exec(fn)?.[0] ?? "";
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
    expect(rest).toMatch(/rest_days\s*=\s*profile\.rest_days/i);
    expect(zero).not.toMatch(/streak_freeze_tokens\s*=\s*profile\.streak_freeze_tokens/i);
    expect(zero).not.toMatch(/rest_days\s*=\s*profile\.rest_days/i);
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
    return replica.jsonAs<ProfileRow>(
      USER_A,
      `SELECT current_streak, last_activity_date, streak_freeze_tokens, rest_days, active_boost
       FROM public.user_profiles WHERE id = '${USER_A}'`,
    );
  }

  function seed(opts: {
    lastActivity: string | null;
    streak?: number;
    freeze?: number;
    rest?: number;
    tzLo: number | null;
  }): void {
    const last = opts.lastActivity === null ? "NULL" : `'${opts.lastActivity}'::date`;
    const tz = opts.tzLo === null ? "NULL" : String(opts.tzLo);
    replica.exec(`
      UPDATE public.user_profiles
      SET current_streak = ${opts.streak ?? 5},
          longest_streak = ${opts.streak ?? 5},
          last_activity_date = ${last},
          streak_freeze_tokens = ${opts.freeze ?? 0},
          rest_days = ${opts.rest ?? 0},
          streak_tz_lo_min = ${tz},
          streak_tz_hi_min = ${tz},
          streak_tz_set_at = public.xp_server_now()
      WHERE id = '${USER_A}';
    `);
  }

  it("(a) UTC-5 user active at 20:00 local is never zeroed at the 00:05Z run", () => {
    // Tue 00:05Z = Mon 19:05 UTC-5, before the 20:00 local habit.
    // Last 20:00 local was Sun (2026-06-07). UTC gap is 2; local gap is 1.
    seed({ lastActivity: "2026-06-07", streak: 5, freeze: 1, tzLo: -300 });
    setXpNow(replica, CRON_005Z);
    replica.exec("SELECT public.evaluate_user_streaks();");
    let row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-06-07");
    expect(row.streak_freeze_tokens).toBe(1);

    // User logs in at 20:00 local (Tue 01:00Z) and the next 00:05Z run is safe.
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

    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '2026-06-09'::date
      WHERE id = '${USER_A}';
    `);
    setXpNow(replica, THIRD_CRON_005Z);
    replica.exec("SELECT public.evaluate_user_streaks();");
    row = readProfile();
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe("2026-06-09");
    expect(row.streak_freeze_tokens).toBe(1);
  });

  it("(b) UTC+10 user who missed a day is zeroed", () => {
    // Tue 00:05Z = Tue 10:05 UTC+10. Last activity Sun → local gap 2, no token.
    seed({ lastActivity: "2026-06-07", streak: 9, freeze: 0, rest: 0, tzLo: 600 });
    setXpNow(replica, CRON_005Z);
    replica.exec("SELECT public.evaluate_user_streaks();");
    const row = readProfile();
    expect(row.current_streak).toBe(0);
    expect(row.last_activity_date).toBe("2026-06-07");
    expect(row.streak_freeze_tokens).toBe(0);
  });

  it("(c) one missed day with a freeze token keeps the streak and consumes exactly one", () => {
    // UTC-5 at 00:05Z: local_today_min = Mon 8. last=Sat 6 → gap 2.
    seed({ lastActivity: "2026-06-06", streak: 12, freeze: 2, rest: 4, tzLo: -300 });
    setXpNow(replica, CRON_005Z);
    replica.exec("SELECT public.evaluate_user_streaks();");
    const row = readProfile();
    expect(row.current_streak).toBe(12);
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.rest_days).toBe(4);
    expect(row.last_activity_date).toBe("2026-06-07");
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

  it("consumes rest_days only when freeze tokens are exhausted", () => {
    seed({ lastActivity: "2026-06-06", streak: 4, freeze: 0, rest: 2, tzLo: -300 });
    setXpNow(replica, CRON_005Z);
    replica.exec("SELECT public.evaluate_user_streaks();");
    const row = readProfile();
    expect(row.current_streak).toBe(4);
    expect(row.streak_freeze_tokens).toBe(0);
    expect(row.rest_days).toBe(1);
    expect(row.last_activity_date).toBe("2026-06-07");
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

  it("does not overwrite last_activity_date when award_xp raced after the snapshot", () => {
    // Architect repro: cron reads last=D-2/freeze=2, award_xp then sets last=D
    // and freeze=1, cron must not write last=D-1 from the stale snapshot.
    seed({ lastActivity: "2026-06-06", streak: 12, freeze: 2, rest: 4, tzLo: -300 });
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
            streak_freeze_tokens = 1
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
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.rest_days).toBe(4);
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
});
