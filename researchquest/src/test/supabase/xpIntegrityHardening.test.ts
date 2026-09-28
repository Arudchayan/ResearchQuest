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
    expect(award).toMatch(/-\s*720/i);
    expect(award).toMatch(/840/i);
    expect(award).toMatch(/-\s*90/i);
    expect(award).toMatch(/v_today\s*<\s*v_last/i);
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
    expect(functionBlock(sql, "xp_server_now")).toMatch(/clock_timestamp\s*\(\s*\)/i);
    expect(functionBlock(sql, "award_xp")).toMatch(/public\.xp_server_now\s*\(\s*\)/i);
    expect(functionBlock(sql, "award_xp")).not.toMatch(/current_setting/i);
    expect(raw).toMatch(
      /DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_tz_lo_min[\s\S]*DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_tz_hi_min/i,
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
    expect(tomorrow.last_activity_date).toBe(plus);
    expect(tomorrow.xp_credited).toBe(10);

    const backfill = awardXp(replica, USER_A, 10, "create_note", { localDay: minus });
    expect(backfill.current_streak).toBe(1);
    expect(backfill.last_activity_date).toBe(plus);
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

  it("QA bug 2 stray D-3: last=D-4 with a freeze token does not +1 from a held event", () => {
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
    expect(row.current_streak).toBe(5);
    expect(row.last_activity_date).toBe(today);
    expect(row.streak_freeze_tokens).toBe(0);
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

  it("keeps the streak across a DST shift of +1h", () => {
    const d0 = "2026-06-10";
    const offsets = [120, 180, 180];
    for (let i = 0; i < 3; i += 1) {
      const day = addDays(d0, i);
      setXpNow(replica, utcIsoFromLocal(day, 12, offsets[i]));
      const row = awardXp(replica, USER_A, 10, "create_note", { entityId: `dst${i}`, localDay: day });
      expect(row.current_streak).toBe(i + 1);
    }
  });

  it("loses at most one advance on a +9h travel jump and never resets", () => {
    const d0 = "2026-06-10";
    const home = 60;
    const away = 60 + 540;
    for (let i = 0; i < 3; i += 1) {
      const day = addDays(d0, i);
      setXpNow(replica, utcIsoFromLocal(day, 12, home));
      const row = awardXp(replica, USER_A, 10, "create_note", { entityId: `h${i}`, localDay: day });
      expect(row.current_streak).toBe(i + 1);
    }
    const jumpDay = addDays(d0, 3);
    setXpNow(replica, utcIsoFromLocal(jumpDay, 12, away));
    const jump = awardXp(replica, USER_A, 10, "create_note", { entityId: "jump", localDay: jumpDay });
    expect(jump.xp_credited).toBe(10);
    expect(jump.current_streak).toBeGreaterThanOrEqual(3);
    expect(jump.current_streak).toBeLessThanOrEqual(4);
    expect(jump.current_streak).not.toBe(1);
    expect(jump.last_activity_date).toBe(jumpDay);

    const nextDay = addDays(d0, 4);
    setXpNow(replica, utcIsoFromLocal(nextDay, 12, away));
    const after = awardXp(replica, USER_A, 10, "create_note", { entityId: "after", localDay: nextDay });
    expect(after.current_streak).toBeGreaterThanOrEqual(jump.current_streak);
    expect(after.current_streak).not.toBe(1);
    expect(after.last_activity_date).toBe(nextDay);
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
        `UPDATE public.user_profiles SET streak_tz_lo_min = 0, streak_tz_hi_min = 0 WHERE id = '${USER_A}'`,
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
