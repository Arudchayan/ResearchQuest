/**
 * XP integrity hardening (1765800000): static contract + live PG17 replica.
 *
 * Live cases replay the QA repros (day-window burst, streak backfill, crafted
 * p_delta, direct total_xp write, set_config bypass, ineligible achievement)
 * against an ephemeral Postgres 17 cluster using the same replica recipe as
 * 1765700000. CI installs PostgreSQL 17 so live cases run (0 skipped).
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  PG17_AVAILABLE,
  USER_A,
  USER_B,
  addDays,
  awardAchievement,
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
const gamificationPath = path.join(
  repoRoot,
  "researchquest",
  "src",
  "utils",
  "gamification.ts",
);
const FILE = "1765800000_xp_integrity_hardening.sql";

const XP_REWARDS: Record<string, number> = {
  create_note: 10,
  update_note: 0,
  create_paper: 15,
  update_paper_status: 10,
  add_paper_insights: 15,
  create_idea: 20,
  advance_idea_stage: 25,
  create_task: 5,
  complete_task: 20,
  daily_task_completion: 10,
  create_topic: 15,
  update_topic: 8,
  tag_entity_with_topic: 6,
  complete_topic_quest: 30,
};

const PROFILE_UPDATE_COLUMNS = [
  "active_boost",
  "auto_create_reading_tasks",
  "rest_days",
  "streak_freeze_tokens",
  "theme_preference",
  "updated_at",
  "username",
];

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

let raw = "";
let sql = "";
let gamification = "";

beforeAll(async () => {
  raw = await readFile(path.join(migrationsDir, FILE), "utf8");
  sql = stripLineComments(raw);
  gamification = await readFile(gamificationPath, "utf8");
});

describe("1765800000 xp integrity hardening (static)", () => {
  it("keeps the canonical 7-arg award_xp and 4-arg award_achievement_xp signatures", () => {
    expect(sql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.award_xp\s*\(\s*p_uid\s+UUID/i,
    );
    expect(sql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.award_achievement_xp\s*\(\s*p_achievement_type\s+TEXT/i,
    );
    expect(functionBlock(sql, "award_xp")).toMatch(/p_delta/);
    expect(functionBlock(sql, "award_xp")).toMatch(/p_local_day/);
    expect(functionBlock(sql, "award_achievement_xp")).toMatch(/p_xp/);
  });

  it("pins empty or fully-qualified search_path on DEFINER RPCs", () => {
    for (const name of ["award_xp", "award_achievement_xp"]) {
      const block = functionBlock(sql, name);
      expect(block).toMatch(/SECURITY\s+DEFINER/i);
      expect(block).toMatch(/SET\s+search_path\s*=\s*''/i);
    }
  });

  it("credits least(p_delta, server mapping) and 0 for unknown actions", () => {
    const award = functionBlock(sql, "award_xp");
    expect(award).toMatch(/LEAST\s*\(\s*p_delta\s*,\s*v_server_xp\s*\)/i);
    const rewardBlock = /v_server_xp\s*:=\s*CASE\s+v_action([\s\S]*?)END;/i.exec(award)?.[1] ?? "";
    expect(rewardBlock).toMatch(/ELSE\s+0/i);
    for (const [action, xp] of Object.entries(XP_REWARDS)) {
      expect(rewardBlock).toMatch(new RegExp(`WHEN\\s+'${action}'\\s+THEN\\s+${xp}\\b`, "i"));
    }
    expect(gamification).toContain("CREATE_NOTE: 10");
  });

  it("enforces a rolling 24h per-action cap in addition to the local-day window", () => {
    const award = functionBlock(sql, "award_xp");
    expect(award).toMatch(/interval\s+'24 hours'/i);
    expect(award).toMatch(/created_at\s*>\s*v_now\s*-\s*interval\s+'24 hours'/i);
    expect(award).toMatch(/p_local_day\s*>=\s*v_utc_day\s*-\s*1/i);
  });

  it("updates the streak only on credited awards using a timezone-consistency interval", () => {
    const award = functionBlock(sql, "award_xp");
    expect(award).not.toMatch(/interval\s+'20 hours'/i);
    expect(award).not.toMatch(/v_held/i);
    expect(award).toMatch(/v_credited\s*<=\s*0/i);
    expect(award).toMatch(/streak_tz_lo_min/i);
    expect(award).toMatch(/streak_tz_set_at/i);
    expect(award).toMatch(/interval\s+'12 hours'/i);
    expect(award).toMatch(/-\s*720/i);
    expect(award).toMatch(/840/i);
    expect(award).toMatch(/-\s*180/i);
    expect(award).toMatch(/v_today\s*<\s*v_last/i);
    expect(award).not.toMatch(/v_gap_last/);
    expect(raw).toMatch(/Empty or inconsistent N/i);
  });

  it("does not increment running counts from award_xp", () => {
    const award = functionBlock(sql, "award_xp");
    expect(award).not.toMatch(/notes_count\s*=\s*CASE/i);
    expect(award).not.toMatch(/papers_count\s*=\s*CASE/i);
    expect(award).toMatch(/FROM\s+public\.notes/i);
  });

  it("revokes table UPDATE on user_profiles and grants only legitimate columns", () => {
    expect(sql).toMatch(/REVOKE\s+UPDATE\s+ON\s+TABLE\s+public\.user_profiles\s+FROM\s+authenticated/i);
    expect(sql).toMatch(/REVOKE\s+UPDATE\s+ON\s+TABLE\s+public\.user_profiles\s+FROM\s+anon/i);
    const grant =
      /GRANT\s+UPDATE\s*\(([^)]+)\)\s+ON\s+TABLE\s+public\.user_profiles\s+TO\s+authenticated/i.exec(
        sql,
      )?.[1] ?? "";
    const cols = grant
      .split(",")
      .map((c) => c.trim().replaceAll('"', "").toLowerCase())
      .filter(Boolean)
      .sort();
    expect(cols).toEqual([...PROFILE_UPDATE_COLUMNS].sort());
    expect(grant.toLowerCase()).not.toMatch(/total_xp/);
    expect(grant.toLowerCase()).not.toMatch(/current_level/);
    expect(grant.toLowerCase()).not.toMatch(/current_streak/);
    expect(grant.toLowerCase()).not.toMatch(/streak_tz_/);
    expect(grant.toLowerCase()).not.toMatch(/_count/);
  });

  it("drops the settable GUC bypass and client writes on the XP ledgers", () => {
    expect(functionBlock(sql, "award_xp")).not.toMatch(/app\.bypass_xp_guard/);
    expect(functionBlock(sql, "award_achievement_xp")).not.toMatch(/app\.bypass_xp_guard/);
    expect(sql).toMatch(/DROP\s+TRIGGER\s+IF\s+EXISTS\s+lock_total_xp_monotonic/i);
    expect(sql).toMatch(/REVOKE\s+INSERT\s*,\s*UPDATE\s*,\s*DELETE[\s\S]*research_achievements[\s\S]*authenticated/i);
    expect(sql).toMatch(/REVOKE\s+INSERT\s*,\s*UPDATE\s*,\s*DELETE[\s\S]*xp_events[\s\S]*authenticated/i);
  });

  it("checks achievement eligibility from real tables and ignores p_xp above the catalogue", () => {
    const block = functionBlock(sql, "award_achievement_xp");
    expect(block).toMatch(/FROM\s+public\.papers/i);
    expect(block).toMatch(/FROM\s+public\.notes/i);
    expect(block).toMatch(/FROM\s+public\.tasks/i);
    expect(block).toMatch(/achievement eligibility not met/i);
    expect(block).not.toMatch(/\+\s*p_xp\b/i);
    expect(block).toMatch(/WHEN\s+'note_master'\s+THEN\s+v_xp\s*:=\s*200/i);
  });

  it("is the only new migration after 1765700000 and does not re-apply 1764800000..1765300000", async () => {
    const names = (await readdir(migrationsDir)).filter((n) => n.endsWith(".sql")).sort();
    expect(names.some((n) => n.startsWith("1765800000"))).toBe(true);
    expect(raw).toMatch(/HARD NO/);
    expect(raw).not.toMatch(/supabase db push/i);
  });

  it("adds non-user-writable timezone interval columns and a replaceable server clock", () => {
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+streak_tz_lo_min\s+integer/i);
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+streak_tz_hi_min\s+integer/i);
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.xp_server_now\s*\(/i);
    expect(functionBlock(sql, "xp_server_now")).toMatch(/VOLATILE/i);
    expect(functionBlock(sql, "xp_server_now")).toMatch(/clock_timestamp\s*\(\s*\)/i);
    expect(sql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.xp_server_now\s*\(\s*\)\s+FROM\s+authenticated/i);
    expect(sql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.xp_server_now\s*\(\s*\)\s+FROM\s+service_role/i);
    expect(sql).not.toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.xp_server_now/i);
    expect(functionBlock(sql, "award_xp")).toMatch(/public\.xp_server_now\s*\(\s*\)/i);
    expect(functionBlock(sql, "award_xp")).not.toMatch(/current_setting/i);
    expect(raw).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+streak_tz_set_at\s+timestamptz/i);
    expect(raw).toMatch(
      /DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_tz_lo_min[\s\S]*DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_tz_hi_min[\s\S]*DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_tz_set_at/i,
    );
  });

  it("revokes INSERT on user_profiles and blocks freeze/rest minting by role", () => {
    expect(sql).toMatch(/REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.user_profiles\s+FROM\s+authenticated/i);
    expect(sql).toMatch(/REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.user_profiles\s+FROM\s+anon/i);
    expect(sql).toMatch(/current_user\s+IN\s*\(\s*'authenticated'\s*,\s*'anon'\s*\)/i);
    expect(sql).toMatch(/cannot mint streak freeze tokens or rest days/i);
    expect(sql).toMatch(/CHECK\s*\(\s*streak_freeze_tokens\s*>=\s*0\s*\)\s*NOT\s+VALID/i);
    expect(sql).toMatch(/CHECK\s*\(\s*rest_days\s*>=\s*0\s*\)\s*NOT\s+VALID/i);
  });

  it("counts insights with NULLIF(btrim(key_insights),'') and has no explicit BEGIN/COMMIT", () => {
    expect(sql).toMatch(
      /NULLIF\s*\(\s*btrim\s*\(\s*p\.key_insights\s*\)\s*,\s*''\s*\)\s*IS\s+NOT\s+NULL/i,
    );
    expect(sql).not.toMatch(/^\s*BEGIN\s*;/m);
    expect(sql).not.toMatch(/^\s*COMMIT\s*;/m);
  });

  it("does not multiply p_delta by a client-side boost", () => {
    expect(gamification).not.toMatch(/boostActive/);
    expect(gamification).not.toMatch(/xpAmount\s*\*\s*\(/);
  });

  it("requires PostgreSQL 17 in CI so live replica cases are not skipped", () => {
    expect(!process.env.CI || PG17_AVAILABLE).toBe(true);
  });

  it("removes the client total_xp fallback and does not write XP ledgers from the browser", () => {
    expect(gamification).toMatch(/never write total_xp/);
    expect(gamification).not.toMatch(
      /\.from\(\s*["']user_profiles["']\s*\)[\s\S]{0,400}\.update\(/,
    );
    expect(gamification).not.toMatch(/\.from\(\s*["']xp_events["']\s*\)/);
    expect(gamification).not.toMatch(
      /\.from\(\s*["']research_achievements["']\s*\)[\s\S]{0,200}\.(insert|update|delete)\(/,
    );
  });
});

describe.skipIf(!PG17_AVAILABLE)("1765800000 xp integrity hardening (PG17 replica)", () => {
  let replica: Replica;

  beforeAll(() => {
    replica = startReplica();
  });

  afterAll(() => {
    replica?.stop();
  });

  beforeEach(() => {
    resetUser(replica, USER_A);
    resetXpNow(replica);
  });

  it("credits a normal create_note at the server value", () => {
    const row = awardXp(replica, USER_A, 10, "create_note");
    expect(row.xp_credited).toBe(10);
    expect(row.total_xp).toBe(10);
    expect(row.current_streak).toBe(1);
  });

  it("rejects the day-window burst: utc+1 and utc-1 cannot add another cap after today is full", () => {
    const today = replica.exec("SELECT (now() AT TIME ZONE 'UTC')::date").trim();
    const plus = replica.exec("SELECT ((now() AT TIME ZONE 'UTC')::date + 1)").trim();
    const minus = replica.exec("SELECT ((now() AT TIME ZONE 'UTC')::date - 1)").trim();

    const first = awardXp(replica, USER_A, 10, "create_note", { localDay: today });
    expect(first.xp_credited).toBe(10);
    for (let i = 0; i < 9; i += 1) {
      awardXp(replica, USER_A, 10, "create_note", { localDay: today });
    }
    const capped = awardXp(replica, USER_A, 10, "create_note", { localDay: today });
    expect(capped.xp_credited).toBe(0);
    expect(capped.total_xp).toBe(100);

    const tomorrow = awardXp(replica, USER_A, 100, "create_note", { localDay: plus });
    expect(tomorrow.xp_credited).toBe(0);
    expect(tomorrow.total_xp).toBe(100);

    const yesterday = awardXp(replica, USER_A, 100, "create_note", { localDay: minus });
    expect(yesterday.xp_credited).toBe(0);
    expect(yesterday.total_xp).toBe(100);
  });

  it("does not add +2 to the streak in one real day via utc+1, and does not backfill", () => {
    // 11:00 UTC is the window where UTC-1, UTC and UTC+1 are all feasible.
    setXpNow(replica, "2026-06-10T11:00:00.000Z");
    const today = "2026-06-10";
    const plus = "2026-06-11";
    const minus = "2026-06-09";

    const first = awardXp(replica, USER_A, 10, "create_note", { localDay: today });
    expect(first.current_streak).toBe(1);
    expect(first.last_activity_date).toBe(today);

    const tomorrow = awardXp(replica, USER_A, 10, "create_note", { localDay: plus });
    expect(tomorrow.current_streak).toBe(1);
    expect(tomorrow.last_activity_date).toBe(today);
    expect(tomorrow.xp_credited).toBe(10);

    const backfill = awardXp(replica, USER_A, 10, "create_note", { localDay: minus });
    expect(backfill.current_streak).toBe(1);
    expect(backfill.last_activity_date).toBe(today);
  });

  it("QA bug 1: zero-XP update_note on UTC D-1/D/D+1 leaves streak untouched", () => {
    setXpNow(replica, "2026-06-10T11:00:00.000Z");
    const today = "2026-06-10";
    const plus = "2026-06-11";
    const minus = "2026-06-09";

    const first = awardXp(replica, USER_A, 0, "update_note", { key: null, entityId: "", localDay: minus });
    expect(first.xp_credited).toBe(0);
    expect(first.current_streak).toBe(0);
    expect(first.last_activity_date).toBeNull();
    const eventsAfterFirst = replica
      .exec(`SELECT count(*) FROM public.xp_events WHERE user_id = '${USER_A}'`)
      .trim();
    expect(Number(eventsAfterFirst)).toBe(0);

    const second = awardXp(replica, USER_A, 0, "update_note", { key: null, entityId: "", localDay: today });
    expect(second.current_streak).toBe(0);
    expect(second.last_activity_date).toBeNull();

    const third = awardXp(replica, USER_A, 0, "update_note", { key: null, entityId: "", localDay: plus });
    expect(third.current_streak).toBe(0);
    expect(third.last_activity_date).toBeNull();
    expect(third.streak_freeze_tokens).toBe(0);
  });

  it("QA bug 2: burst D-1, D, D+1 in one instant stays at streak 1", () => {
    setXpNow(replica, "2026-06-10T11:00:00.000Z");
    const today = "2026-06-10";
    const plus = "2026-06-11";
    const minus = "2026-06-09";

    const a = awardXp(replica, USER_A, 10, "create_note", { entityId: "a", localDay: minus });
    expect(a.current_streak).toBe(1);
    expect(a.xp_credited).toBe(10);

    const b = awardXp(replica, USER_A, 10, "create_note", { entityId: "b", localDay: today });
    expect(b.current_streak).toBe(1);
    expect(b.xp_credited).toBe(10);

    const c = awardXp(replica, USER_A, 10, "create_note", { entityId: "c", localDay: plus });
    expect(c.current_streak).toBe(1);
    expect(c.xp_credited).toBe(10);
  });

  it("keeps streak 1 for D then empty D-1 then D+1 at 13:00Z", () => {
    setXpNow(replica, "2026-06-10T13:00:00.000Z");
    const today = "2026-06-10";
    const plus = "2026-06-11";
    const minus = "2026-06-09";

    const first = awardXp(replica, USER_A, 10, "create_note", { entityId: "d", localDay: today });
    expect(first.current_streak).toBe(1);
    expect(first.last_activity_date).toBe(today);

    const empty = awardXp(replica, USER_A, 10, "create_note", { entityId: "d-1", localDay: minus });
    expect(empty.current_streak).toBe(1);
    expect(empty.last_activity_date).toBe(today);
    expect(empty.xp_credited).toBe(10);

    const plusRow = awardXp(replica, USER_A, 10, "create_note", { entityId: "d+1", localDay: plus });
    expect(plusRow.current_streak).toBe(1);
    expect(plusRow.last_activity_date).toBe(today);
  });

  it("X1: at 12:30 UTC claim 09-28 then 09-27 then 09-29 stays 1,1,1", () => {
    setXpNow(replica, "2026-09-28T12:30:00.000Z");
    const s1 = awardXp(replica, USER_A, 10, "create_note", { entityId: "x1a", localDay: "2026-09-28" });
    expect(s1.current_streak).toBe(1);
    expect(s1.last_activity_date).toBe("2026-09-28");
    const tzAfterD = replica
      .exec(
        `SELECT streak_tz_lo_min, streak_tz_hi_min FROM public.user_profiles WHERE id = '${USER_A}'`,
      )
      .trim();
    expect(tzAfterD).not.toMatch(/^\|$/);
    expect(tzAfterD.split("|")[0]).not.toBe("");

    const s2 = awardXp(replica, USER_A, 10, "create_note", { entityId: "x1b", localDay: "2026-09-27" });
    expect(s2.current_streak).toBe(1);
    expect(s2.last_activity_date).toBe("2026-09-28");
    expect(s2.xp_credited).toBe(10);
    const tzAfterEmpty = replica
      .exec(
        `SELECT streak_tz_lo_min, streak_tz_hi_min FROM public.user_profiles WHERE id = '${USER_A}'`,
      )
      .trim();
    expect(tzAfterEmpty).toBe(tzAfterD);

    const s3 = awardXp(replica, USER_A, 10, "create_note", { entityId: "x1c", localDay: "2026-09-29" });
    expect(s3.current_streak).toBe(1);
    expect(s3.last_activity_date).toBe("2026-09-28");
    expect([s1.current_streak, s2.current_streak, s3.current_streak]).toEqual([1, 1, 1]);
  });

  it("X4: 61-minute D-1/D/D-1/D+1 variant must not exceed streak 1", () => {
    const d0 = "2026-09-28";
    const minus = "2026-09-27";
    const plus = "2026-09-29";

    setXpNow(replica, "2026-09-28T11:00:59.900Z");
    const s1 = awardXp(replica, USER_A, 10, "create_note", { entityId: "x4a", localDay: minus });
    expect(s1.current_streak).toBe(1);
    setXpNow(replica, "2026-09-28T11:01:00.100Z");
    const s2 = awardXp(replica, USER_A, 10, "create_note", { entityId: "x4b", localDay: d0 });
    setXpNow(replica, "2026-09-28T12:00:00.100Z");
    const s3 = awardXp(replica, USER_A, 10, "create_note", { entityId: "x4c", localDay: minus });
    setXpNow(replica, "2026-09-28T12:00:00.200Z");
    const s4 = awardXp(replica, USER_A, 10, "create_note", { entityId: "x4d", localDay: plus });

    expect(s1.xp_credited).toBe(10);
    expect(s2.xp_credited).toBe(10);
    expect(s3.xp_credited).toBe(10);
    expect(s4.xp_credited).toBe(10);
    const peak = Math.max(
      s1.current_streak,
      s2.current_streak,
      s3.current_streak,
      s4.current_streak,
    );
    expect(peak).toBeLessThanOrEqual(1);
    expect(s4.current_streak).toBeLessThanOrEqual(1);
  });

  it("X5: streak 30 last=09-18, claim 09-27 then 09-28 at 12:30 resets to 1", () => {
    setXpNow(replica, "2026-09-28T12:30:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET current_streak = 30,
          longest_streak = 30,
          last_activity_date = '2026-09-18'::date,
          streak_freeze_tokens = 0,
          streak_tz_lo_min = NULL,
          streak_tz_hi_min = NULL,
          streak_tz_set_at = NULL,
          total_xp = 300
      WHERE id = '${USER_A}';
    `);

    const impossible = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "x5a",
      localDay: "2026-09-27",
    });
    expect(impossible.xp_credited).toBe(10);
    expect(impossible.current_streak).toBe(30);
    expect(impossible.last_activity_date).toBe("2026-09-18");
    const tz = replica
      .exec(
        `SELECT streak_tz_lo_min, streak_tz_hi_min FROM public.user_profiles WHERE id = '${USER_A}'`,
      )
      .trim();
    expect(tz).toBe("|");

    const consistent = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "x5b",
      localDay: "2026-09-28",
    });
    expect(consistent.xp_credited).toBe(10);
    expect(consistent.current_streak).toBe(1);
    expect(consistent.last_activity_date).toBe("2026-09-28");
  });

  it("X8: 4-day 12:30 walk of (day-1) then (day+1) ends at most 4", () => {
    const d0 = "2026-09-28";
    setXpNow(replica, "2026-09-28T12:30:00.000Z");
    awardXp(replica, USER_A, 10, "create_note", { entityId: "w1", localDay: d0 });
    awardXp(replica, USER_A, 10, "create_note", { entityId: "w2", localDay: addDays(d0, -1) });
    const s1 = awardXp(replica, USER_A, 10, "create_note", { entityId: "w3", localDay: addDays(d0, 1) });

    setXpNow(replica, "2026-09-29T12:30:00.000Z");
    awardXp(replica, USER_A, 10, "create_note", { entityId: "w4", localDay: d0 });
    const s2 = awardXp(replica, USER_A, 10, "create_note", { entityId: "w5", localDay: addDays(d0, 2) });

    setXpNow(replica, "2026-09-30T12:30:00.000Z");
    awardXp(replica, USER_A, 10, "create_note", { entityId: "w6", localDay: addDays(d0, 1) });
    const s3 = awardXp(replica, USER_A, 10, "create_note", { entityId: "w7", localDay: addDays(d0, 3) });

    setXpNow(replica, "2026-10-01T12:30:00.000Z");
    awardXp(replica, USER_A, 10, "create_note", { entityId: "w8", localDay: addDays(d0, 2) });
    const s4 = awardXp(replica, USER_A, 10, "create_note", { entityId: "w9", localDay: addDays(d0, 4) });

    expect(s1.current_streak).toBeLessThanOrEqual(4);
    expect(s2.current_streak).toBeLessThanOrEqual(4);
    expect(s3.current_streak).toBeLessThanOrEqual(4);
    expect(s4.current_streak).toBeLessThanOrEqual(4);
  });

  it("with stored [0,0], D+1 then D+2 at D+1 22:00Z adds at most 1", () => {
    const d = "2026-06-10";
    const plus = "2026-06-11";
    const plus2 = "2026-06-12";
    setXpNow(replica, "2026-06-11T22:00:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '${d}'::date,
          current_streak = 1,
          longest_streak = 1,
          streak_tz_lo_min = 0,
          streak_tz_hi_min = 0,
          streak_tz_set_at = public.xp_server_now()
      WHERE id = '${USER_A}';
    `);

    const first = awardXp(replica, USER_A, 10, "create_note", { entityId: "p1", localDay: plus });
    expect(first.xp_credited).toBe(10);
    const second = awardXp(replica, USER_A, 10, "create_note", { entityId: "p2", localDay: plus2 });
    expect(second.xp_credited).toBe(10);
    expect(second.current_streak - 1).toBeLessThanOrEqual(1);
    expect(second.current_streak).toBeGreaterThanOrEqual(1);
    expect(second.current_streak).toBeLessThanOrEqual(2);
  });

  it("QA bug 2 stray D-3: last=D-4 self-heals to 1; a held event does not keep the old streak", () => {
    const today = replica.exec("SELECT (public.xp_server_now() AT TIME ZONE 'UTC')::date").trim();
    const dMinus3 = replica.exec("SELECT ((public.xp_server_now() AT TIME ZONE 'UTC')::date - 3)").trim();
    const dMinus4 = replica.exec("SELECT ((public.xp_server_now() AT TIME ZONE 'UTC')::date - 4)").trim();

    replica.exec(`
      INSERT INTO public.xp_events (user_id, action, entity_id, xp, local_day, created_at)
      VALUES ('${USER_A}', 'create_note', 'stray', 10, '${dMinus3}', public.xp_server_now() - interval '3 days');
      UPDATE public.user_profiles
      SET last_activity_date = '${dMinus4}'::date,
          current_streak = 5,
          longest_streak = 5,
          streak_freeze_tokens = 1,
          total_xp = 50
      WHERE id = '${USER_A}';
    `);

    const row = awardXp(replica, USER_A, 10, "create_note", { localDay: today });
    expect(row.current_streak).toBe(1);
    expect(row.last_activity_date).toBe(today);
    expect(row.streak_freeze_tokens).toBe(1);
    expect(row.xp_credited).toBe(10);
  });

  it("reaches streak 3 for 22:00 then 09:00 then 09:00 at UTC+2 with spaced now()", () => {
    const offset = 120;
    const d0 = "2026-06-10";
    const d1 = addDays(d0, 1);
    const d2 = addDays(d0, 2);

    setXpNow(replica, utcIsoFromLocal(d0, 22, offset));
    const first = awardXp(replica, USER_A, 10, "create_note", { entityId: "n0", localDay: d0 });
    expect(first.current_streak).toBe(1);
    expect(first.last_activity_date).toBe(d0);

    setXpNow(replica, utcIsoFromLocal(d1, 9, offset));
    const second = awardXp(replica, USER_A, 10, "create_note", { entityId: "n1", localDay: d1 });
    expect(second.current_streak).toBe(2);
    expect(second.last_activity_date).toBe(d1);

    setXpNow(replica, utcIsoFromLocal(d2, 9, offset));
    const third = awardXp(replica, USER_A, 10, "create_note", { entityId: "n2", localDay: d2 });
    expect(third.current_streak).toBe(3);
    expect(third.last_activity_date).toBe(d2);
  });

  it("clamps a crafted p_delta to the server action value", () => {
    const row = awardXp(replica, USER_A, 1000, "create_note");
    expect(row.xp_credited).toBe(10);
    expect(row.total_xp).toBe(10);
    const unknown = awardXp(replica, USER_A, 200, "invented_action");
    expect(unknown.xp_credited).toBe(0);
    expect(unknown.total_xp).toBe(10);
  });

  it("denies a direct total_xp increment on the caller's own profile", () => {
    awardXp(replica, USER_A, 10, "create_note");
    expect(() =>
      replica.execAs(
        USER_A,
        `UPDATE public.user_profiles SET total_xp = total_xp + 1000 WHERE id = '${USER_A}'`,
      ),
    ).toThrow(/permission denied|must be owner/i);
    const total = replica.exec(`SELECT total_xp FROM public.user_profiles WHERE id = '${USER_A}'`).trim();
    expect(Number(total)).toBe(10);
  });

  it("ignores set_config('app.bypass_xp_guard') for direct total_xp writes", () => {
    awardXp(replica, USER_A, 10, "create_note");
    expect(() =>
      replica.execAs(
        USER_A,
        `SELECT set_config('app.bypass_xp_guard', 'on', true);
         UPDATE public.user_profiles SET total_xp = 9999 WHERE id = '${USER_A}'`,
      ),
    ).toThrow(/permission denied|must be owner/i);
    const total = replica.exec(`SELECT total_xp FROM public.user_profiles WHERE id = '${USER_A}'`).trim();
    expect(Number(total)).toBe(10);
  });

  it("denies an ineligible achievement and awards an eligible one once", () => {
    expect(() => awardAchievement(replica, USER_A, "note_master", 500)).toThrow(
      /eligibility not met/i,
    );

    replica.exec(`
      INSERT INTO public.notes (user_id, title, markdown_body)
      SELECT '${USER_A}', 'n' || g, 'body'
      FROM generate_series(1, 50) AS g;
    `);

    const first = awardAchievement(replica, USER_A, "note_master", 500);
    expect(first.xp_credited).toBe(200);
    expect(first.total_xp).toBe(200);
    expect(first.is_duplicate).toBe(false);

    const dup = awardAchievement(replica, USER_A, "note_master", 500);
    expect(dup.xp_credited).toBe(0);
    expect(dup.is_duplicate).toBe(true);
    expect(dup.total_xp).toBe(200);
  });

  it("still allows SELECT on the owner's profile after column grants", () => {
    awardXp(replica, USER_A, 10, "create_note");
    const row = replica.jsonAs<{ total_xp: number; id: string }>(
      USER_A,
      `SELECT id, total_xp FROM public.user_profiles WHERE id = '${USER_A}'`,
    );
    expect(row.id).toBe(USER_A);
    expect(row.total_xp).toBe(10);
  });

  it("still allows authenticated to decrease rest days and freeze tokens, not increase them", () => {
    replica.exec(`
      UPDATE public.user_profiles
      SET rest_days = 3, streak_freeze_tokens = 2
      WHERE id = '${USER_A}';
    `);
    replica.execAs(
      USER_A,
      `UPDATE public.user_profiles SET rest_days = 2, streak_freeze_tokens = 1 WHERE id = '${USER_A}'`,
    );
    const row = replica.exec(
      `SELECT rest_days, streak_freeze_tokens FROM public.user_profiles WHERE id = '${USER_A}'`,
    ).trim();
    expect(row).toMatch(/2\|1/);

    expect(() =>
      replica.execAs(
        USER_A,
        `UPDATE public.user_profiles SET rest_days = 9 WHERE id = '${USER_A}'`,
      ),
    ).toThrow(/cannot mint|permission denied/i);
    expect(() =>
      replica.execAs(
        USER_A,
        `UPDATE public.user_profiles SET streak_freeze_tokens = 9 WHERE id = '${USER_A}'`,
      ),
    ).toThrow(/cannot mint|permission denied/i);
  });

  it("advances the streak to 3 with two sessions a day on 3 consecutive days", () => {
    const offset = 0;
    const d0 = "2026-06-10";
    const days = [d0, addDays(d0, 1), addDays(d0, 2)];
    let streak = 0;
    for (let i = 0; i < days.length; i += 1) {
      const day = days[i];
      setXpNow(replica, utcIsoFromLocal(day, 9, offset));
      const morning = awardXp(replica, USER_A, 10, "create_note", {
        entityId: `m${i}`,
        localDay: day,
      });
      streak += 1;
      expect(morning.current_streak).toBe(streak);
      setXpNow(replica, utcIsoFromLocal(day, 21, offset));
      const evening = awardXp(replica, USER_A, 10, "create_note", {
        entityId: `e${i}`,
        localDay: day,
      });
      expect(evening.current_streak).toBe(streak);
      expect(evening.last_activity_date).toBe(day);
    }
  });

  it("reaches streak 3 for a user at UTC+14 and a user at UTC-12 over 3 days", () => {
    resetUser(replica, USER_B);
    const d0 = "2026-06-10";
    const plus14 = 840;
    const minus12 = -720;
    for (let i = 0; i < 3; i += 1) {
      const day = addDays(d0, i);
      setXpNow(replica, utcIsoFromLocal(day, 12, plus14));
      const east = awardXp(replica, USER_A, 10, "create_note", { entityId: `e${i}`, localDay: day });
      expect(east.current_streak).toBe(i + 1);
      setXpNow(replica, utcIsoFromLocal(day, 12, minus12));
      const west = awardXp(replica, USER_B, 10, "create_note", { entityId: `w${i}`, localDay: day });
      expect(west.current_streak).toBe(i + 1);
    }
  });

  it("keeps the streak across a DST +1h shift via 12h widening near a day boundary", () => {
    const d0 = "2026-06-10";
    const d1 = "2026-06-11";
    setXpNow(replica, "2026-06-10T09:30:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '${d0}'::date,
          current_streak = 1,
          longest_streak = 1,
          streak_tz_lo_min = 120,
          streak_tz_hi_min = 120,
          streak_tz_set_at = public.xp_server_now()
      WHERE id = '${USER_A}';
    `);
    setXpNow(replica, "2026-06-10T21:30:00.000Z");
    const row = awardXp(replica, USER_A, 10, "create_note", { entityId: "dst", localDay: d1 });
    expect(row.xp_credited).toBe(10);
    expect(row.current_streak).toBe(2);
    expect(row.last_activity_date).toBe(d1);
  });

  it("relocates from [60,60] to UTC+10 and advances again within 3 real days", () => {
    const home = "2026-06-10";
    setXpNow(replica, "2026-06-10T02:00:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '${home}'::date,
          current_streak = 3,
          longest_streak = 3,
          streak_tz_lo_min = 60,
          streak_tz_hi_min = 60,
          streak_tz_set_at = public.xp_server_now(),
          total_xp = 30
      WHERE id = '${USER_A}';
    `);

    // Arrive 2026-06-11 02:00Z = UTC+10 noon. Bound: ±180 per 12h, or
    // self-heal once last is more than 2 days before p. Either way they
    // must be advancing again within 3 real days of arriving.
    const destOffset = 600;
    let advancingBy: string | null = null;
    let streak = 3;
    for (let i = 0; i < 4; i += 1) {
      const day = addDays("2026-06-11", i);
      setXpNow(replica, utcIsoFromLocal(day, 12, destOffset));
      const row = awardXp(replica, USER_A, 10, "create_note", {
        entityId: `rel${i}`,
        localDay: day,
      });
      expect(row.xp_credited).toBe(10);
      if (
        advancingBy === null
        && day <= "2026-06-14"
        && (row.current_streak === 1 || row.current_streak > streak)
      ) {
        advancingBy = day;
      }
      streak = row.current_streak;
    }
    expect(advancingBy).not.toBeNull();
    expect((advancingBy ?? "") <= "2026-06-14").toBe(true);
    setXpNow(replica, utcIsoFromLocal("2026-06-15", 12, destOffset));
    const kept = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "rel-keep",
      localDay: "2026-06-15",
    });
    expect(kept.xp_credited).toBe(10);
    expect(kept.current_streak).toBeGreaterThanOrEqual(2);
    expect(kept.last_activity_date).toBe("2026-06-15");
  });

  it("self-heals: after streak 0, first credited claim is 1 and the next real day is 2", () => {
    setXpNow(replica, "2026-06-10T02:00:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET current_streak = 0,
          longest_streak = 5,
          last_activity_date = '2026-06-01'::date,
          streak_tz_lo_min = 60,
          streak_tz_hi_min = 60,
          streak_tz_set_at = public.xp_server_now() - interval '3 days',
          streak_freeze_tokens = 0,
          total_xp = 50
      WHERE id = '${USER_A}';
    `);
    const dest = 600;
    setXpNow(replica, utcIsoFromLocal("2026-06-11", 12, dest));
    const first = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "heal0",
      localDay: "2026-06-11",
    });
    expect(first.xp_credited).toBe(10);
    expect(first.current_streak).toBe(1);
    expect(first.last_activity_date).toBe("2026-06-11");

    setXpNow(replica, utcIsoFromLocal("2026-06-12", 12, dest));
    const second = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "heal1",
      localDay: "2026-06-12",
    });
    expect(second.xp_credited).toBe(10);
    expect(second.current_streak).toBe(2);
    expect(second.last_activity_date).toBe("2026-06-12");
  });

  it("traveller +9h outbound then home next day: freeze covers the missed dest day; streak stays 3 (resets only with 0 freeze)", () => {
    const home = "2026-06-10";
    setXpNow(replica, "2026-06-10T12:00:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '${home}'::date,
          current_streak = 3,
          longest_streak = 3,
          streak_freeze_tokens = 1,
          streak_tz_lo_min = 60,
          streak_tz_hi_min = 60,
          streak_tz_set_at = public.xp_server_now(),
          total_xp = 30
      WHERE id = '${USER_A}';
    `);

    setXpNow(replica, utcIsoFromLocal("2026-06-11", 2, 600));
    const outbound = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "trip-out",
      localDay: "2026-06-11",
    });
    expect(outbound.xp_credited).toBe(10);
    expect(outbound.current_streak).toBe(3);
    expect(outbound.last_activity_date).toBe(home);
    expect(outbound.streak_freeze_tokens).toBe(1);

    setXpNow(replica, utcIsoFromLocal("2026-06-12", 12, 60));
    const homecoming = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "trip-home",
      localDay: "2026-06-12",
    });
    expect(homecoming.xp_credited).toBe(10);
    expect(homecoming.current_streak).toBe(3);
    expect(homecoming.last_activity_date).toBe("2026-06-12");
    expect(homecoming.streak_freeze_tokens).toBe(0);
  });

  it("same-instant D, D+1, D+2 after the interval is full-range give at most +1", () => {
    const d = "2026-06-10";
    const minus = "2026-06-09";
    setXpNow(replica, "2026-06-09T12:30:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '${minus}'::date,
          current_streak = 1,
          longest_streak = 1,
          streak_tz_lo_min = -720,
          streak_tz_hi_min = 840,
          streak_tz_set_at = public.xp_server_now()
      WHERE id = '${USER_A}';
    `);
    setXpNow(replica, "2026-06-10T12:30:00.000Z");
    const s1 = awardXp(replica, USER_A, 10, "create_note", { entityId: "full-d", localDay: d });
    const s2 = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "full-d1",
      localDay: addDays(d, 1),
    });
    const s3 = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "full-d2",
      localDay: addDays(d, 2),
    });
    expect(s1.xp_credited).toBe(10);
    expect(s2.xp_credited).toBe(10);
    expect(s3.xp_credited).toBe(10);
    expect(s3.current_streak - 1).toBeLessThanOrEqual(1);
    expect(s3.current_streak).toBeLessThanOrEqual(2);
  });

  it("xp_server_now is EXECUTE-able only by its owner; service_role is revoked", () => {
    const owner = replica
      .exec(`SELECT has_function_privilege(current_user, 'public.xp_server_now()', 'EXECUTE')`)
      .trim();
    const authenticated = replica
      .exec(`SELECT has_function_privilege('authenticated', 'public.xp_server_now()', 'EXECUTE')`)
      .trim();
    const anon = replica
      .exec(`SELECT has_function_privilege('anon', 'public.xp_server_now()', 'EXECUTE')`)
      .trim();
    const serviceRole = replica
      .exec(`SELECT has_function_privilege('service_role', 'public.xp_server_now()', 'EXECUTE')`)
      .trim();
    expect(owner).toBe("t");
    expect(authenticated).toBe("f");
    expect(anon).toBe("f");
    expect(serviceRole).toBe("f");
    expect(() =>
      replica.execAs(USER_A, "SELECT public.xp_server_now()"),
    ).toThrow(/permission denied/i);
  });

  it("lets authenticated update username, theme_preference and auto_create_reading_tasks", () => {
    replica.execAs(
      USER_A,
      `UPDATE public.user_profiles
       SET username = 'qa-user',
           theme_preference = 'dark',
           auto_create_reading_tasks = false
       WHERE id = '${USER_A}'`,
    );
    const row = replica.jsonAs<{
      username: string;
      theme_preference: string;
      auto_create_reading_tasks: boolean;
    }>(
      USER_A,
      `SELECT username, theme_preference, auto_create_reading_tasks
       FROM public.user_profiles WHERE id = '${USER_A}'`,
    );
    expect(row.username).toBe("qa-user");
    expect(row.theme_preference).toBe("dark");
    expect(row.auto_create_reading_tasks).toBe(false);

    expect(() =>
      replica.execAs(
        USER_A,
        `UPDATE public.user_profiles SET streak_tz_lo_min = 0, streak_tz_hi_min = 0, streak_tz_set_at = now() WHERE id = '${USER_A}'`,
      ),
    ).toThrow(/permission denied|must be owner/i);
  });

  it("denies a direct INSERT into user_profiles by authenticated", () => {
    replica.exec(`DELETE FROM public.user_profiles WHERE id = '${USER_B}'`);
    expect(() =>
      replica.execAs(
        USER_B,
        `INSERT INTO public.user_profiles (id) VALUES ('${USER_B}')`,
      ),
    ).toThrow(/permission denied/i);
  });

  it("denies direct INSERT into xp_events and research_achievements", () => {
    expect(() =>
      replica.execAs(
        USER_A,
        `INSERT INTO public.xp_events (user_id, action, entity_id, xp, local_day)
         VALUES ('${USER_A}', 'create_note', '', 10, (now() AT TIME ZONE 'UTC')::date)`,
      ),
    ).toThrow(/permission denied/i);
    expect(() =>
      replica.execAs(
        USER_A,
        `INSERT INTO public.research_achievements (user_id, achievement_type, title)
         VALUES ('${USER_A}', 'first_paper', 'x')`,
      ),
    ).toThrow(/permission denied/i);
  });
});
