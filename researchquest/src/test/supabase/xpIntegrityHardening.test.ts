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
    expect(award).toMatch(/interval\s+'6 hours'/i);
    expect(award).toMatch(/interval\s+'48 hours'/i);
    expect(award).toMatch(/interval\s+'23 hours'/i);
    expect(award).toMatch(/interval\s+'1 hour'/i);
    expect(award).toMatch(/v_widen_min/i);
    expect(award).toMatch(/rest_days\s*=\s*v_rest/i);
    expect(award).toMatch(/streak_credit_at/i);
    expect(award).toMatch(/streak_prev_inc_at/i);
    expect(award).toMatch(
      /interval\s+'23 hours'[\s\S]{0,500}v_new_streak\s*:=\s*v_new_streak\s*\+\s*1[\s\S]{0,250}v_tz_set_at\s*:=\s*v_now/i,
    );
    expect(award).toMatch(/-\s*720/i);
    expect(award).toMatch(/840/i);
    expect(award).not.toMatch(/-\s*180/i);
    expect(award).not.toMatch(/interval\s+'12 hours'/i);
    expect(award).not.toMatch(/interval\s+'72 hours'/i);
    expect(award).toMatch(
      /GREATEST\s*\(\s*-720\s*,\s*LEAST\s*\(\s*v_tz_lo\s*,\s*v_claim_lo\s*\)\s*\)/i,
    );
    expect(award).toMatch(
      /LEAST\s*\(\s*840\s*,\s*GREATEST\s*\(\s*v_tz_hi\s*,\s*v_claim_hi\s*\)\s*\)/i,
    );
    expect(award).toMatch(/v_today\s*<=\s*v_last/i);
    expect(award).not.toMatch(/v_gap_last/);
    expect(award).not.toMatch(/v_would_fr/);
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
    expect(grant.toLowerCase()).not.toMatch(/streak_credit/);
    expect(grant.toLowerCase()).not.toMatch(/streak_inc/);
    expect(grant.toLowerCase()).not.toMatch(/streak_prev/);
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
    expect(raw).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+streak_credit_at\s+timestamptz/i);
    expect(raw).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+streak_inc_at\s+timestamptz/i);
    expect(raw).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+streak_prev_inc_at\s+timestamptz/i);
    expect(raw).toMatch(
      /DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_tz_lo_min[\s\S]*DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_tz_hi_min[\s\S]*DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_tz_set_at[\s\S]*DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_credit_at[\s\S]*DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_inc_at[\s\S]*DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_prev_inc_at/i,
    );
  });

  it("revokes INSERT on user_profiles and blocks freeze/rest minting by role", () => {
    expect(sql).toMatch(/REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.user_profiles\s+FROM\s+authenticated/i);
    expect(sql).toMatch(/REVOKE\s+INSERT\s+ON\s+TABLE\s+public\.user_profiles\s+FROM\s+anon/i);
    expect(sql).toMatch(/current_user\s+IN\s*\(\s*'authenticated'\s*,\s*'anon'\s*\)/i);
    expect(sql).toMatch(/cannot mint streak freeze tokens or rest days/i);
    expect(sql).toMatch(/cannot update locked streak columns/i);
    expect(sql).toMatch(
      /BEFORE UPDATE OF streak_freeze_tokens,\s*rest_days,\s*streak_credit_at,\s*streak_inc_at,\s*streak_prev_inc_at/i,
    );
    expect(raw).toMatch(/COMMENT ON COLUMN public\.user_profiles\.streak_credit_at IS/i);
    expect(raw).toMatch(/COMMENT ON COLUMN public\.user_profiles\.streak_inc_at IS/i);
    expect(raw).toMatch(/COMMENT ON COLUMN public\.user_profiles\.streak_prev_inc_at IS/i);
    expect(sql).toMatch(/CHECK\s*\(\s*streak_freeze_tokens\s*>=\s*0\s*\)\s*NOT\s+VALID/i);
    expect(sql).toMatch(/CHECK\s*\(\s*rest_days\s*>=\s*0\s*\)\s*NOT\s+VALID/i);
  });

  it("revokes TRUNCATE/TRIGGER/REFERENCES/MAINTAIN and user_profiles DELETE from anon and authenticated", () => {
    expect(sql).toMatch(
      /REVOKE\s+TRUNCATE\s*,\s*TRIGGER\s*,\s*REFERENCES\s*,\s*MAINTAIN\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+FROM\s+anon\s*,\s*authenticated/i,
    );
    expect(sql).toMatch(
      /REVOKE\s+DELETE\s+ON\s+TABLE\s+public\.user_profiles\s+FROM\s+anon\s*,\s*authenticated/i,
    );
    expect(sql).toMatch(
      /ALTER\s+DEFAULT\s+PRIVILEGES[\s\S]*REVOKE\s+TRUNCATE\s*,\s*TRIGGER\s*,\s*REFERENCES\s*,\s*MAINTAIN\s+ON\s+TABLES\s+FROM\s+anon\s*,\s*authenticated/i,
    );
    expect(raw).not.toMatch(
      /GRANT\s+INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+ON\s+TABLE\s+public\.xp_events\s+TO\s+authenticated/i,
    );
    expect(raw).not.toMatch(
      /GRANT\s+TRUNCATE\s*,\s*TRIGGER\s*,\s*REFERENCES\s*,\s*MAINTAIN\s+ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public[\s\S]*TO\s+anon\s*,\s*authenticated/i,
    );
    expect(raw).toMatch(/c\.relname\s+NOT\s+IN/i);
    expect(raw).toMatch(/'atlas_identities'/i);
    expect(raw).toMatch(/'atlas_link_checks'/i);
    expect(raw).toMatch(
      /GRANT\s+%s\s+ON\s+TABLE\s+public\.%I\s+TO\s+anon\s*,\s*authenticated/i,
    );
    expect(raw).toMatch(
      /GRANT\s+DELETE\s+ON\s+TABLE\s+public\.user_profiles\s+TO\s+anon\s*,\s*authenticated/i,
    );
    expect(raw).toMatch(
      /DROP\s+TRIGGER\s+IF\s+EXISTS\s+lock_freeze_rest_no_mint[\s\S]*DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.enforce_freeze_rest_no_mint/i,
    );
    expect(raw).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.award_xp\s*\(/i);
    expect(raw).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.award_achievement_xp\s*\(/i,
    );
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

describe("1765800000 round 10 pending date (static)", () => {
  it("r11: the token path counts missed days from the last CLAIMED date (valid pending, else last)", () => {
    const award = functionBlock(sql, "award_xp");
    expect(award).toMatch(
      /v_need\s*:=\s*GREATEST\s*\(\s*1\s*,\s*v_today\s*-\s*COALESCE\s*\(\s*v_pending\s*,\s*v_last\s*\)\s*-\s*1\s*\)/i,
    );
    expect(award).not.toMatch(/v_need\s*:=\s*GREATEST\s*\(\s*1\s*,\s*v_gap\s*-\s*1\s*\)/i);
    // v_pending is only ever non-NULL when it is later than last (read side) and is cleared on reset/self-heal
    expect(award).toMatch(/WHEN\s+v_profile\.streak_pending_date\s*>\s*v_last\s+THEN\s+v_profile\.streak_pending_date/i);
  });

  it("r10: adds a server-owned streak_pending_date used only to bridge dates already claimed XP only", () => {
    expect(raw).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+streak_pending_date\s+date/i);
    expect(sql).toMatch(/REVOKE\s+UPDATE\s*\(\s*streak_pending_date\s*\)\s+ON\s+TABLE\s+public\.user_profiles\s+FROM\s+authenticated/i);
    expect(sql).toMatch(/NEW\.streak_pending_date\s+IS\s+DISTINCT\s+FROM\s+OLD\.streak_pending_date/i);
    expect(sql).toMatch(
      /BEFORE UPDATE OF streak_freeze_tokens,\s*rest_days,\s*streak_credit_at,\s*streak_inc_at,\s*streak_prev_inc_at,\s*streak_pending_date/i,
    );
    expect(raw).toMatch(/COMMENT ON COLUMN public\.user_profiles\.streak_pending_date IS/i);
    expect(raw).toMatch(/DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_prev_inc_at,\s*\n--\s+DROP\s+COLUMN\s+IF\s+EXISTS\s+streak_pending_date/i);
    const award = functionBlock(sql, "award_xp");
    expect(award).toMatch(/v_pending\s+IS\s+NOT\s+NULL\s+AND\s+v_pending\s*>=\s*v_today\s*-\s*1/i);
    expect(award).toMatch(/v_today\s*=\s*COALESCE\s*\(\s*v_pending\s*,\s*v_last\s*\)\s*\+\s*1/i);
    expect(award).toMatch(/streak_pending_date\s*=\s*CASE\s+WHEN\s+v_pending\s*>\s*v_last\s+THEN\s+v_pending\s+ELSE\s+NULL\s+END/i);
    expect(raw).toMatch(/back\s+(?:--\s+)?to\s+back\s+in\s+ONE\s+session/i);
    expect(raw).not.toMatch(/Apply ONLY this file/i);
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

  it("X4: 61-minute D-1/D midnight-minute may +1 once; D+1 empty so no second advance", () => {
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
    // Inclusive midnight minute can +1 on D-1→D. Same-instant bursts stay
    // capped because those intersections are empty (n_lo > n_hi), not a
    // shared minute. D+1 at 12:00 must not add a second advance.
    expect(s2.current_streak).toBeLessThanOrEqual(2);
    expect(s4.current_streak).toBe(s2.current_streak);
  });

  it("midnight-minute UTC+2 [30,120] at 22:00:30Z increments +1", () => {
    setXpNow(replica, "2026-06-10T21:00:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '2026-06-10'::date,
          current_streak = 1,
          longest_streak = 1,
          streak_tz_lo_min = 30,
          streak_tz_hi_min = 120,
          streak_tz_set_at = public.xp_server_now(),
          total_xp = 10
      WHERE id = '${USER_A}';
    `);
    setXpNow(replica, "2026-06-10T22:00:30.000Z");
    const row = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "mid-utc2",
      localDay: "2026-06-11",
    });
    expect(row.xp_credited).toBe(10);
    expect(row.current_streak).toBe(2);
    expect(row.last_activity_date).toBe("2026-06-11");
  });

  it("two claims 2ms apart around the 6h gate credit at most +1 streak", () => {
    // stored [-720,-35], last=D. A D+1 claim ~12h later advances and stamps
    // set_at. A D+2 claim 2ms later is inconsistent with the gate closed.
    const d = "2026-06-10";
    const plus = "2026-06-11";
    const plus2 = "2026-06-12";
    setXpNow(replica, "2026-06-11T09:35:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '${d}'::date,
          current_streak = 1,
          longest_streak = 1,
          streak_tz_lo_min = -720,
          streak_tz_hi_min = -35,
          streak_tz_set_at = public.xp_server_now(),
          total_xp = 10
      WHERE id = '${USER_A}';
    `);
    setXpNow(replica, "2026-06-11T21:34:59.999Z");
    const first = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "gate-a",
      localDay: plus,
    });
    expect(first.xp_credited).toBe(10);
    expect(first.current_streak).toBe(2);
    expect(first.last_activity_date).toBe(plus);
    setXpNow(replica, "2026-06-11T21:35:00.001Z");
    const second = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "gate-b",
      localDay: plus2,
    });
    expect(second.xp_credited).toBe(10);
    expect(second.current_streak - first.current_streak).toBeLessThanOrEqual(1);
    expect(second.current_streak).toBe(2);
    expect(second.last_activity_date).toBe(plus);
  });

  it("midnight-minute UTC+14 [780,840] at 10:00:30Z increments +1", () => {
    setXpNow(replica, "2026-06-11T09:00:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '2026-06-11'::date,
          current_streak = 1,
          longest_streak = 1,
          streak_tz_lo_min = 780,
          streak_tz_hi_min = 840,
          streak_tz_set_at = public.xp_server_now(),
          total_xp = 10
      WHERE id = '${USER_A}';
    `);
    setXpNow(replica, "2026-06-11T10:00:30.000Z");
    const row = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "mid-utc14",
      localDay: "2026-06-12",
    });
    expect(row.xp_credited).toBe(10);
    expect(row.current_streak).toBe(2);
    expect(row.last_activity_date).toBe("2026-06-12");
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

  it("X8: 4-day 12:30 walk of (day-1) then (day+1) ends at 2", () => {
    // r9 removes rule 4; this walk still cannot free-skip missed home days.
    // Keep the assertion; if r9 changes it the live9/T9 cases are the source.
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

    expect([s1.current_streak, s2.current_streak, s3.current_streak, s4.current_streak]).toEqual([
      1, 2, 3, 4,
    ]);
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

  it("keeps the streak across a DST +1h shift via union-widen near a day boundary", () => {
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

    // Arrive 2026-06-11 02:00Z = UTC+10 noon. Union-widen on the first
    // gated-open inconsistent claim; they must be advancing again within
    // 3 real days of arriving.
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

  it("traveller +9h outbound then home next day: freeze covers the missed dest day, return day counts", () => {
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
    expect(homecoming.current_streak).toBe(4);
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

  it("A3: UTC+5:30 [330,330] streak 6, daily 21:00 UTC-5 claims go 6,6,7,8,9", () => {
    // IST last is one civil day ahead of the first UTC-5 p=(ts-5h)::date.
    setXpNow(replica, "2026-09-27T10:00:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '2026-09-28'::date,
          current_streak = 6,
          longest_streak = 6,
          streak_tz_lo_min = 330,
          streak_tz_hi_min = 330,
          streak_tz_set_at = public.xp_server_now(),
          streak_freeze_tokens = 0,
          total_xp = 60
      WHERE id = '${USER_A}';
    `);
    const instants = [
      "2026-09-28T02:00:00.000Z",
      "2026-09-29T02:00:00.000Z",
      "2026-09-30T02:00:00.000Z",
      "2026-10-01T02:00:00.000Z",
      "2026-10-02T02:00:00.000Z",
    ];
    const expected = [6, 6, 7, 8, 9];
    const streaks: number[] = [];
    for (let i = 0; i < instants.length; i += 1) {
      setXpNow(replica, instants[i]);
      const ts = new Date(instants[i]);
      const p = new Date(ts.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const row = awardXp(replica, USER_A, 10, "create_note", {
        entityId: `a3-${i}`,
        localDay: p,
      });
      expect(row.xp_credited).toBe(10);
      streaks.push(row.current_streak);
    }
    expect(streaks).toEqual(expected);
  });

  it("B3: [60,60] streak 3 last=D0-1 set_at=D0-16h, UTC+10 claims 4 then 5 then 6", () => {
    setXpNow(replica, "2026-09-27T10:00:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '2026-09-27'::date,
          current_streak = 3,
          longest_streak = 3,
          streak_tz_lo_min = 60,
          streak_tz_hi_min = 60,
          streak_tz_set_at = public.xp_server_now(),
          streak_freeze_tokens = 0,
          total_xp = 30
      WHERE id = '${USER_A}';
    `);
    setXpNow(replica, "2026-09-28T02:00:00.000Z");
    const s0 = awardXp(replica, USER_A, 25, "create_note", {
      entityId: "rb3-0",
      localDay: "2026-09-28",
    });
    expect(s0.xp_credited).toBeGreaterThan(0);
    expect(s0.current_streak).toBe(4);

    setXpNow(replica, "2026-09-28T15:00:00.000Z");
    const s1 = awardXp(replica, USER_A, 25, "create_task", {
      entityId: "rb3-1",
      localDay: "2026-09-29",
    });
    expect(s1.xp_credited).toBeGreaterThan(0);
    expect(s1.current_streak).toBe(5);

    setXpNow(replica, "2026-09-29T15:00:00.000Z");
    const s2 = awardXp(replica, USER_A, 25, "create_paper", {
      entityId: "rb3-2",
      localDay: "2026-09-30",
    });
    expect(s2.xp_credited).toBeGreaterThan(0);
    expect(s2.current_streak).toBe(6);
  });

  function seedQr(
    streak: number,
    last: string,
    freeze: number,
    lo: number | null,
    hi: number | null,
    setAt: string | null,
    extras?: {
      creditAt?: string | null;
      incAt?: string | null;
      prevIncAt?: string | null;
      restDays?: number;
      pendingDate?: string | null;
    },
  ): void {
    const ts = (v: string | null | undefined, fallback: string | null): string => {
      const x = v === undefined ? fallback : v;
      return x == null ? "NULL" : `'${x}'::timestamptz`;
    };
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '${last}'::date,
          current_streak = ${streak},
          longest_streak = ${streak},
          streak_freeze_tokens = ${freeze},
          rest_days = ${extras?.restDays ?? 0},
          streak_tz_lo_min = ${lo == null ? "NULL" : String(lo)},
          streak_tz_hi_min = ${hi == null ? "NULL" : String(hi)},
          streak_tz_set_at = ${ts(setAt, setAt)},
          streak_credit_at = ${ts(extras?.creditAt, setAt)},
          streak_inc_at = ${ts(extras?.incAt, null)},
          streak_prev_inc_at = ${ts(extras?.prevIncAt, null)},
          streak_pending_date = ${extras?.pendingDate ? `'${extras.pendingDate}'::date` : "NULL"},
          total_xp = ${streak * 10}
      WHERE id = '${USER_A}';
    `);
  }

  function claimStreak(when: string, localDay: string, tag: string): number {
    setXpNow(replica, when);
    return awardXp(replica, USER_A, 10, "create_note", {
      entityId: tag,
      localDay,
    }).current_streak;
  }

  function profileBits(): {
    fr: number;
    rs: number;
    la: string;
    lo: string;
    hi: string;
    ia: string;
  } {
    const row = replica
      .exec(
        `SELECT streak_freeze_tokens, rest_days, last_activity_date,
                streak_tz_lo_min, streak_tz_hi_min, streak_inc_at
         FROM public.user_profiles WHERE id = '${USER_A}'`,
      )
      .trim()
      .split("|");
    return {
      fr: Number(row[0]),
      rs: Number(row[1]),
      la: row[2],
      lo: row[3],
      hi: row[4],
      ia: row[5],
    };
  }

  function r10Bits(): {
    pd: string;
    sa: string;
    ca: string;
    ia: string;
    pa: string;
    lo: string;
    hi: string;
  } {
    const row = replica
      .exec(
        `SELECT COALESCE(streak_pending_date::text, 'NULL'),
                COALESCE(to_char(streak_tz_set_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'NULL'),
                COALESCE(to_char(streak_credit_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'NULL'),
                COALESCE(to_char(streak_inc_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'NULL'),
                COALESCE(to_char(streak_prev_inc_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'NULL'),
                COALESCE(streak_tz_lo_min::text, 'NULL'), COALESCE(streak_tz_hi_min::text, 'NULL')
         FROM public.user_profiles WHERE id = '${USER_A}'`,
      )
      .trim()
      .split("|");
    return { pd: row[0], sa: row[1], ca: row[2], ia: row[3], pa: row[4], lo: row[5], hi: row[6] };
  }

  const iso = (v: string): string => new Date(v).toISOString();

  it("QA1: g=1 at e=48h exactly resets to 1; 5ms later D0 advances to 2", () => {
    const d0 = "2026-09-28";
    const d0m1 = "2026-09-27";
    const d0m2 = "2026-09-26";
    seedQr(5, d0m2, 0, 120, 120, "2026-09-26T07:00:00.000Z");
    setXpNow(replica, "2026-09-28T07:00:00.000Z");
    const first = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "qa1-0",
      localDay: d0m1,
    });
    expect(first.xp_credited).toBe(10);
    expect(first.current_streak).toBe(1);
    setXpNow(replica, "2026-09-28T07:00:05.000Z");
    const second = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "qa1-1",
      localDay: d0,
    });
    expect(second.xp_credited).toBe(10);
    expect(second.current_streak).toBe(2);
  });

  it("QA2: first 48h reset then UTC-7..-12 resident continues 1,2 / 3,4 / 5,6 / 7,8", () => {
    const d0 = "2026-09-28";
    seedQr(5, addDays(d0, -1), 0, 120, 120, "2026-09-27T07:00:00.000Z");
    const streaks: number[] = [];
    for (const extra of [1, 3, 5, 7]) {
      const day = addDays(d0, extra);
      setXpNow(replica, `${day}T07:00:00.000Z`);
      streaks.push(
        awardXp(replica, USER_A, 10, "create_note", {
          entityId: `qa2-${extra}a`,
          localDay: addDays(day, -1),
        }).current_streak,
      );
      setXpNow(replica, `${day}T13:00:00.000Z`);
      streaks.push(
        awardXp(replica, USER_A, 10, "create_note", {
          entityId: `qa2-${extra}b`,
          localDay: day,
        }).current_streak,
      );
    }
    expect(streaks).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("QA3: 11:59/17:59/23:59 bursts on D0+1,+4,+7 => 5,1,2,1,2,2,1,2,2", () => {
    const d0 = "2026-09-28";
    seedQr(5, d0, 0, 1, 840, "2026-09-27T10:00:00.000Z");
    const seen: number[] = [];
    for (const extra of [1, 4, 7]) {
      const day = addDays(d0, extra);
      const claims: Array<[string, string]> = [
        [`${day}T11:59:00.000Z`, addDays(day, -1)],
        [`${day}T17:59:00.000Z`, day],
        [`${day}T23:59:00.000Z`, addDays(day, 1)],
      ];
      for (let i = 0; i < claims.length; i += 1) {
        const [when, p] = claims[i];
        setXpNow(replica, when);
        seen.push(
          awardXp(replica, USER_A, 10, "create_note", {
            entityId: `qa3-${extra}-${i}`,
            localDay: p,
          }).current_streak,
        );
      }
    }
    expect(seen).toEqual([5, 1, 2, 1, 2, 2, 1, 2, 2]);
  });

  it("QA4: 73h55m idle gap resets to 1", () => {
    const d0 = "2026-09-28";
    seedQr(5, d0, 0, 120, 120, "2026-09-28T07:00:00.000Z");
    setXpNow(replica, "2026-10-01T08:55:00.000Z");
    const row = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "qa4",
      localDay: "2026-10-01",
    });
    expect(row.xp_credited).toBe(10);
    expect(row.current_streak).toBe(1);
  });

  it("QA5: D0-1 at 00:00Z, D0 at 06:00Z, D0+1 at 10:00Z => 6,7,7 with last = D0+1 (hold)", () => {
    // Western seed so D0 at 06:00Z (6h gate open) union-widens to include
    // +840; D0+1 at 10:00Z then fits without another widen and HOLDs.
    const d0 = "2026-09-28";
    seedQr(5, addDays(d0, -2), 0, -720, -720, "2026-09-26T12:00:00.000Z");
    setXpNow(replica, "2026-09-28T00:00:00.000Z");
    const a = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "qa5-0",
      localDay: addDays(d0, -1),
    });
    expect(a.current_streak).toBe(6);
    setXpNow(replica, "2026-09-28T06:00:00.000Z");
    const b = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "qa5-1",
      localDay: d0,
    });
    expect(b.current_streak).toBe(7);
    setXpNow(replica, "2026-09-28T10:00:00.000Z");
    const c = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "qa5-2",
      localDay: addDays(d0, 1),
    });
    expect(c.xp_credited).toBe(10);
    expect(c.current_streak).toBe(7);
    expect(c.last_activity_date).toBe(addDays(d0, 1));
    const heldLog = replica
      .exec(
        `SELECT streak_count FROM public.daily_logs WHERE user_id = '${USER_A}' AND date = '${addDays(d0, 1)}'::date`,
      )
      .trim();
    expect(heldLog).toBe("7");
  });

  it("QA6: legacy NULL band and timestamps; 11:00 burst then 17:00 D0 then 23:59 D0+1 => 6,6,6,7,7", () => {
    const d0 = "2026-09-28";
    seedQr(5, addDays(d0, -2), 0, null, null, null, {
      creditAt: null,
      incAt: null,
      prevIncAt: null,
    });
    setXpNow(replica, "2026-09-28T11:00:00.000Z");
    const s0 = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "qa6-0",
      localDay: addDays(d0, -1),
    });
    const s1 = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "qa6-1",
      localDay: d0,
    });
    const s2 = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "qa6-2",
      localDay: addDays(d0, 1),
    });
    expect([s0.current_streak, s1.current_streak, s2.current_streak]).toEqual([6, 6, 6]);
    setXpNow(replica, "2026-09-28T17:00:00.001Z");
    const s3 = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "qa6-3",
      localDay: d0,
    });
    expect(s3.current_streak).toBe(7);
    setXpNow(replica, "2026-09-28T23:59:00.000Z");
    const s4 = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "qa6-4",
      localDay: addDays(d0, 1),
    });
    expect(s4.current_streak).toBe(7);
  });

  it("fixed-tz midnight: D 23:59:59.999 then D+1 23:59:59.999 (24h later) both advance", () => {
    const d = "2026-09-28";
    const plus = "2026-09-29";
    seedQr(4, addDays(d, -1), 0, 0, 0, "2026-09-28T12:00:00.000Z");
    setXpNow(replica, "2026-09-28T23:59:59.999Z");
    const a = awardXp(replica, USER_A, 10, "create_note", { entityId: "midn-0", localDay: d });
    expect(a.current_streak).toBe(5);
    // 1ms later would HOLD on the 23h burst clock; honest consecutive midnights are ~24h apart.
    setXpNow(replica, "2026-09-29T23:59:59.999Z");
    const b = awardXp(replica, USER_A, 10, "create_note", { entityId: "midn-1", localDay: plus });
    expect(b.current_streak).toBe(6);
    expect(b.last_activity_date).toBe(plus);
  });

  it("liveness: g=1 at 48h-1ms advances; at 48h the 1h DST margin still advances", () => {
    const d0 = "2026-09-28";
    seedQr(5, addDays(d0, -1), 1, 0, 0, "2026-09-26T07:00:00.000Z");
    setXpNow(replica, "2026-09-28T06:59:59.999Z");
    const early = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "live-early",
      localDay: d0,
    });
    expect(early.current_streak).toBe(6);
    expect(early.streak_freeze_tokens).toBe(1);

    resetUser(replica, USER_A);
    seedQr(5, addDays(d0, -1), 1, 0, 0, "2026-09-26T07:00:00.000Z");
    setXpNow(replica, "2026-09-28T07:00:00.000Z");
    const exact = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "live-exact",
      localDay: d0,
    });
    expect(exact.current_streak).toBe(6);
    expect(exact.streak_freeze_tokens).toBe(1);
    expect(exact.last_activity_date).toBe(d0);
  });

  it("liveness: token covers a dead g=1 chain inside 24h*(m+2)+margin; 73h resets", () => {
    const d0 = "2026-09-28";
    seedQr(5, addDays(d0, -1), 1, 0, 0, "2026-09-26T07:00:00.000Z");
    setXpNow(replica, "2026-09-28T08:00:00.000Z");
    const mid = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "live-mid",
      localDay: d0,
    });
    expect(mid.current_streak).toBe(6);
    expect(mid.streak_freeze_tokens).toBe(0);

    resetUser(replica, USER_A);
    seedQr(5, addDays(d0, -1), 1, 0, 0, "2026-09-25T07:00:00.000Z");
    setXpNow(replica, "2026-09-28T08:00:00.000Z");
    const late = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "live-73",
      localDay: d0,
    });
    expect(late.current_streak).toBe(1);
    expect(late.streak_freeze_tokens).toBe(1);
    expect(late.last_activity_date).toBe(d0);
  });

  it("rate: third increment at prev_inc + 23h exactly is a hold; +1ms advances", () => {
    seedQr(5, "2026-10-05", 0, 120, 120, "2026-10-05T08:00:00.000Z", {
      creditAt: "2026-10-05T08:00:00.000Z",
      incAt: "2026-10-05T08:00:00.000Z",
      prevIncAt: "2026-10-04T23:00:00.000Z",
    });
    setXpNow(replica, "2026-10-05T22:00:00.000Z");
    const held = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "rate-hold",
      localDay: "2026-10-06",
    });
    expect(held.current_streak).toBe(5);
    expect(held.last_activity_date).toBe("2026-10-06");

    resetUser(replica, USER_A);
    seedQr(5, "2026-10-05", 0, 120, 120, "2026-10-05T08:00:00.000Z", {
      creditAt: "2026-10-05T08:00:00.000Z",
      incAt: "2026-10-05T08:00:00.000Z",
      prevIncAt: "2026-10-04T23:00:00.000Z",
    });
    setXpNow(replica, "2026-10-05T22:00:00.001Z");
    const go = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "rate-go",
      localDay: "2026-10-06",
    });
    expect(go.current_streak).toBe(6);
    expect(go.last_activity_date).toBe("2026-10-06");
  });

  it("rule 4 removed: widened g=3 at e=10h is a reset (or token/+1), not XP-only", () => {
    const d0 = "2026-09-28";
    seedQr(5, addDays(d0, -3), 0, 60, 60, "2026-09-28T13:00:00.000Z", {
      creditAt: "2026-09-28T13:00:00.000Z",
    });
    setXpNow(replica, "2026-09-28T23:00:00.000Z");
    const early = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "r4-early",
      localDay: d0,
    });
    expect(early.xp_credited).toBe(10);
    expect(early.current_streak).toBe(1);
    expect(early.last_activity_date).toBe(d0);

    resetUser(replica, USER_A);
    seedQr(5, addDays(d0, -3), 0, 60, 60, "2026-09-28T13:00:00.000Z", {
      creditAt: "2026-09-26T23:00:00.000Z",
    });
    setXpNow(replica, "2026-09-28T23:00:00.000Z");
    const late = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "r4-late",
      localDay: d0,
    });
    expect(late.xp_credited).toBe(10);
    expect(late.current_streak).toBe(1);
    expect(late.last_activity_date).toBe(d0);
  });

  it("flight: UTC+1 at 21:00Z then UTC+10 7h later for the next local day advances", () => {
    // Seed [60,60]: an unseeded 21:00Z first claim stores [-720,179], which
    // still overlaps D+1. Dest 15:00Z = 01:00 at UTC+10 is the next local
    // day and is inconsistent with UTC+1. 7h after set_at opens the gate.
    const d0 = "2026-06-10";
    const d1 = "2026-06-11";
    setXpNow(replica, "2026-06-10T08:00:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '${d0}'::date,
          current_streak = 1,
          longest_streak = 1,
          streak_tz_lo_min = 60,
          streak_tz_hi_min = 60,
          streak_tz_set_at = public.xp_server_now(),
          total_xp = 10
      WHERE id = '${USER_A}';
    `);
    setXpNow(replica, "2026-06-10T15:00:00.000Z");
    const dest = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "fly-7h",
      localDay: d1,
    });
    expect(dest.xp_credited).toBe(10);
    expect(dest.current_streak).toBe(2);
    expect(dest.last_activity_date).toBe(d1);
  });

  it("flight: UTC+10 5h later credits XP without advancing; next day does not reset", () => {
    const d0 = "2026-06-10";
    const d1 = "2026-06-11";
    setXpNow(replica, "2026-06-10T10:00:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '${d0}'::date,
          current_streak = 1,
          longest_streak = 1,
          streak_tz_lo_min = 60,
          streak_tz_hi_min = 60,
          streak_tz_set_at = public.xp_server_now(),
          total_xp = 10
      WHERE id = '${USER_A}';
    `);
    setXpNow(replica, "2026-06-10T15:00:00.000Z");
    const blocked = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "fly5-5h",
      localDay: d1,
    });
    expect(blocked.xp_credited).toBe(10);
    expect(blocked.current_streak).toBe(1);
    expect(blocked.last_activity_date).toBe(d0);

    // Next UTC day, still last=d0. 23:00Z makes D+1 inconsistent with [60,60],
    // so the gate is open, the band union-widens, then consecutive rules apply
    // (no reset).
    setXpNow(replica, "2026-06-11T23:00:30.000Z");
    const next = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "fly5-next",
      localDay: d1,
    });
    expect(next.xp_credited).toBe(10);
    expect(next.current_streak).toBe(2);
    expect(next.last_activity_date).toBe(d1);
  });

  it("same-instant D+1 after a union-widen never advances, including 2ms later", () => {
    const d = "2026-06-10";
    const plus = "2026-06-11";
    const plus2 = "2026-06-12";
    setXpNow(replica, "2026-06-10T07:00:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '${d}'::date,
          current_streak = 2,
          longest_streak = 2,
          streak_tz_lo_min = 60,
          streak_tz_hi_min = 60,
          streak_tz_set_at = public.xp_server_now(),
          total_xp = 20
      WHERE id = '${USER_A}';
    `);
    setXpNow(replica, "2026-06-10T15:00:00.000Z");
    const first = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "uw-d1",
      localDay: plus,
    });
    expect(first.current_streak).toBe(3);
    const second = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "uw-d2",
      localDay: plus2,
    });
    expect(second.xp_credited).toBe(10);
    expect(second.current_streak).toBe(3);
    setXpNow(replica, "2026-06-10T15:00:00.002Z");
    const third = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "uw-d2b",
      localDay: plus2,
    });
    expect(third.xp_credited).toBe(10);
    expect(third.current_streak).toBe(3);
  });

  it("full-range D+1 is XP-only at set_at; 2ms later a DST nudge may +1", () => {
    const d = "2026-06-10";
    const plus = "2026-06-11";
    setXpNow(replica, "2026-06-10T12:00:00.000Z");
    replica.exec(`
      UPDATE public.user_profiles
      SET last_activity_date = '${d}'::date,
          current_streak = 4,
          longest_streak = 4,
          streak_tz_lo_min = -720,
          streak_tz_hi_min = 840,
          streak_tz_set_at = public.xp_server_now(),
          total_xp = 40
      WHERE id = '${USER_A}';
    `);
    const first = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "fr-d",
      localDay: d,
    });
    expect(first.current_streak).toBe(4);
    const burst = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "fr-d1",
      localDay: plus,
    });
    expect(burst.xp_credited).toBe(10);
    expect(burst.current_streak).toBe(4);
    setXpNow(replica, "2026-06-10T12:00:00.002Z");
    const later = awardXp(replica, USER_A, 10, "create_note", {
      entityId: "fr-d1b",
      localDay: plus,
    });
    expect(later.xp_credited).toBe(10);
    expect(later.current_streak).toBe(5);
  });

  it("T9 Q1 DST fall-back Berlin, 0 token (e=48h58m)", () => {
    seedQr(5, "2026-10-23", 0, 120, 120, "2026-10-22T22:00:30Z", { creditAt: "2026-10-22T22:00:30Z", incAt: "2026-10-22T22:00:30Z", prevIncAt: "2026-10-21T22:00:30Z", restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-23T22:00:30Z", "2026-10-24", "t9-50999-0"));
    seen.push(claimStreak("2026-10-25T22:59:00Z", "2026-10-25", "t9-50999-1"));
    expect(seen).toEqual([6, 7]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    expect(bits.la).toBe("2026-10-25");
  });

  it("T9 Q1b DST fall-back, 1 token (token kept, 7 mints)", () => {
    seedQr(5, "2026-10-23", 1, 120, 120, "2026-10-22T22:00:30Z", { creditAt: "2026-10-22T22:00:30Z", incAt: "2026-10-22T22:00:30Z", prevIncAt: "2026-10-21T22:00:30Z", restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-23T22:00:30Z", "2026-10-24", "t9-75217-0"));
    seen.push(claimStreak("2026-10-25T22:59:00Z", "2026-10-25", "t9-75217-1"));
    expect(seen).toEqual([6, 7]);
    const bits = profileBits();
    expect(bits.fr).toBe(2);
  });

  it("T9 Q2 DST spring-forward (23h day)", () => {
    seedQr(5, "2027-03-26", 0, 60, 60, "2027-03-26T11:00:00Z", { creditAt: "2027-03-26T11:00:00Z", incAt: "2027-03-26T11:00:00Z", prevIncAt: "2027-03-25T11:00:00Z", restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2027-03-27T22:59:00Z", "2027-03-27", "t9-83271-0"));
    seen.push(claimStreak("2027-03-28T10:00:00Z", "2027-03-28", "t9-83271-1"));
    seen.push(claimStreak("2027-03-28T22:00:30Z", "2027-03-29", "t9-83271-2"));
    expect(seen).toEqual([6, 7, 8]);
    const bits = profileBits();
    expect(bits.la).toBe("2027-03-29");
  });

  it("T9 Q3 band still on winter time [60,60]", () => {
    seedQr(24, "2027-04-01", 0, 60, 60, "2027-04-01T10:00:00Z", { creditAt: "2027-04-01T10:00:00Z", incAt: "2027-04-01T10:00:00Z", prevIncAt: "2027-03-31T10:00:00Z", restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2027-04-02T21:50:00Z", "2027-04-02", "t9-10361-0"));
    seen.push(claimStreak("2027-04-02T22:20:00Z", "2027-04-03", "t9-10361-1"));
    seen.push(claimStreak("2027-04-04T10:00:00Z", "2027-04-04", "t9-10361-2"));
    expect(seen).toEqual([25, 26, 27]);
    const bits = profileBits();
    expect(bits.la).toBe("2027-04-04");
  });

  it("T9 Q4 TRIP1 Berlin->NY (real gap 39h)", () => {
    seedQr(3, "2026-10-14", 0, 90, 120, "2026-10-13T22:30:00Z", { creditAt: "2026-10-13T22:30:00Z", incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-14T10:00:00Z", "2026-10-14", "t9-42424-0"));
    seen.push(claimStreak("2026-10-16T01:00:00Z", "2026-10-15", "t9-42424-1"));
    expect(seen).toEqual([3, 4]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-10-15");
  });

  it("T9 Q5 TRIP2 Kiritimati->Pago Pago", () => {
    seedQr(4, "2026-05-06", 0, 840, 840, "2026-05-05T10:01:00Z", { creditAt: "2026-05-05T10:01:00Z", incAt: "2026-05-05T10:01:00Z", prevIncAt: "2026-05-04T10:01:00Z", restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-05-06T10:01:00Z", "2026-05-07", "t9-67795-0"));
    seen.push(claimStreak("2026-05-07T00:30:00Z", "2026-05-06", "t9-67795-1"));
    seen.push(claimStreak("2026-05-07T10:00:00Z", "2026-05-06", "t9-67795-2"));
    seen.push(claimStreak("2026-05-07T11:01:00Z", "2026-05-07", "t9-67795-3"));
    seen.push(claimStreak("2026-05-07T22:00:00Z", "2026-05-07", "t9-67795-4"));
    seen.push(claimStreak("2026-05-08T11:01:00Z", "2026-05-08", "t9-67795-5"));
    expect(seen).toEqual([5, 5, 5, 5, 5, 6]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-05-08");
  });

  it("T9 Q6 lifetime-lead repro (lead < 2+1/24)", () => {
    seedQr(2, "2026-10-24", 0, 756, 840, "2026-10-23T11:24:44.240Z", { creditAt: "2026-10-23T11:24:44.240Z", incAt: "2026-10-23T11:24:44.240Z", prevIncAt: "2026-10-17T16:27:46Z", restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-26T11:24:44.239Z", "2026-10-25", "t9-51825-0"));
    seen.push(claimStreak("2026-10-26T11:24:44.239Z", "2026-10-26", "t9-51825-1"));
    seen.push(claimStreak("2026-10-26T22:17:39.528Z", "2026-10-27", "t9-51825-2"));
    seen.push(claimStreak("2026-10-27T11:24:28.182Z", "2026-10-26", "t9-51825-3"));
    seen.push(claimStreak("2026-10-28T04:23:56.399Z", "2026-10-28", "t9-51825-4"));
    seen.push(claimStreak("2026-10-28T10:25:56.398Z", "2026-10-29", "t9-51825-5"));
    expect(seen).toEqual([1, 2, 2, 2, 3, 4]);
    const lead = Number(
      replica
        .exec(
          `SELECT current_streak - extract(epoch from (timestamptz '2026-10-28T10:25:56.398Z' - timestamptz '2026-10-26T11:24:44.239Z'))/86400.0 FROM public.user_profiles WHERE id = '${USER_A}'`,
        )
        .trim(),
    );
    expect(lead).toBeLessThan(2 + 1 / 24);
  });

  it("T9 c1 exactly 48h, big widen, no margin", () => {
    seedQr(5, "2026-09-26", 0, 120, 120, "2026-09-26T07:00:00Z", { creditAt: "2026-09-26T07:00:00Z", incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-28T07:00:00Z", "2026-09-27", "t9-27455-0"));
    seen.push(claimStreak("2026-09-28T07:00:05Z", "2026-09-28", "t9-27455-1"));
    expect(seen).toEqual([1, 2]);
  });

  it("T9 c2 two claims every other day", () => {
    seedQr(5, "2026-09-27", 0, 120, 120, "2026-09-27T07:00:00Z", { creditAt: "2026-09-27T07:00:00Z", incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-29T07:00:00Z", "2026-09-28", "t9-77091-0"));
    seen.push(claimStreak("2026-09-29T13:00:00Z", "2026-09-29", "t9-77091-1"));
    seen.push(claimStreak("2026-10-01T07:00:00Z", "2026-09-30", "t9-77091-2"));
    seen.push(claimStreak("2026-10-01T13:00:00Z", "2026-10-01", "t9-77091-3"));
    seen.push(claimStreak("2026-10-03T07:00:00Z", "2026-10-02", "t9-77091-4"));
    seen.push(claimStreak("2026-10-03T13:00:00Z", "2026-10-03", "t9-77091-5"));
    seen.push(claimStreak("2026-10-05T07:00:00Z", "2026-10-04", "t9-77091-6"));
    seen.push(claimStreak("2026-10-05T13:00:00Z", "2026-10-05", "t9-77091-7"));
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("T9 c3 three claims every third day (blocked)", () => {
    seedQr(5, "2026-09-28", 0, 1, 840, "2026-09-27T10:00:00Z", { creditAt: "2026-09-27T10:00:00Z", incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-29T11:59:00Z", "2026-09-28", "t9-88023-0"));
    seen.push(claimStreak("2026-09-29T17:59:00Z", "2026-09-29", "t9-88023-1"));
    seen.push(claimStreak("2026-09-29T23:59:00Z", "2026-09-30", "t9-88023-2"));
    seen.push(claimStreak("2026-10-02T11:59:00Z", "2026-10-01", "t9-88023-3"));
    seen.push(claimStreak("2026-10-02T17:59:00Z", "2026-10-02", "t9-88023-4"));
    seen.push(claimStreak("2026-10-02T23:59:00Z", "2026-10-03", "t9-88023-5"));
    seen.push(claimStreak("2026-10-05T11:59:00Z", "2026-10-04", "t9-88023-6"));
    seen.push(claimStreak("2026-10-05T17:59:00Z", "2026-10-05", "t9-88023-7"));
    seen.push(claimStreak("2026-10-05T23:59:00Z", "2026-10-06", "t9-88023-8"));
    expect(seen).toEqual([5, 1, 2, 1, 2, 2, 1, 2, 2]);
  });

  it("T9 c4", () => {
    seedQr(5, "2026-09-28", 0, 120, 120, "2026-09-28T07:00:00Z", { creditAt: "2026-09-28T07:00:00Z", incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-01T08:55:00Z", "2026-10-01", "t9-71230-0"));
    expect(seen).toEqual([1]);
  });

  it("T9 c5", () => {
    seedQr(5, "2026-09-26", 0, -720, -720, "2026-09-26T12:00:00Z", { creditAt: "2026-09-26T12:00:00Z", incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-28T00:00:00Z", "2026-09-27", "t9-91710-0"));
    seen.push(claimStreak("2026-09-28T06:00:00Z", "2026-09-28", "t9-91710-1"));
    seen.push(claimStreak("2026-09-28T10:00:00Z", "2026-09-29", "t9-91710-2"));
    expect(seen).toEqual([6, 7, 7]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-09-29");
  });

  it("T9 c6 legacy all-NULL", () => {
    seedQr(5, "2026-09-26", 0, null, null, null, { creditAt: null, incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-28T11:00:00Z", "2026-09-27", "t9-8284-0"));
    seen.push(claimStreak("2026-09-28T11:00:00Z", "2026-09-28", "t9-8284-1"));
    seen.push(claimStreak("2026-09-28T11:00:00Z", "2026-09-29", "t9-8284-2"));
    seen.push(claimStreak("2026-09-28T17:00:00.001Z", "2026-09-28", "t9-8284-3"));
    seen.push(claimStreak("2026-09-28T23:59:00Z", "2026-09-29", "t9-8284-4"));
    expect(seen).toEqual([6, 6, 6, 7, 7]);
  });

  it("T9 A3 credit NULL westward", () => {
    seedQr(6, "2026-09-28", 0, 330, 330, "2026-09-27T10:00:00Z", { creditAt: null, incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-28T02:00:00Z", "2026-09-27", "t9-42147-0"));
    seen.push(claimStreak("2026-09-29T02:00:00Z", "2026-09-28", "t9-42147-1"));
    seen.push(claimStreak("2026-09-30T02:00:00Z", "2026-09-29", "t9-42147-2"));
    seen.push(claimStreak("2026-10-01T02:00:00Z", "2026-09-30", "t9-42147-3"));
    seen.push(claimStreak("2026-10-02T02:00:00Z", "2026-10-01", "t9-42147-4"));
    expect(seen).toEqual([6, 6, 7, 8, 9]);
  });

  it("T9 B3 credit NULL", () => {
    seedQr(3, "2026-09-27", 0, 60, 60, "2026-09-27T10:00:00Z", { creditAt: null, incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-28T02:00:00Z", "2026-09-28", "t9-84428-0"));
    seen.push(claimStreak("2026-09-28T15:00:00Z", "2026-09-29", "t9-84428-1"));
    seen.push(claimStreak("2026-09-29T15:00:00Z", "2026-09-30", "t9-84428-2"));
    expect(seen).toEqual([4, 5, 6]);
  });

  it("T9 L49- g=1 at 49h-1ms (DST margin) advances", () => {
    seedQr(5, "2026-10-05", 0, 60, 120, "2026-10-04T22:00:30Z", { creditAt: "2026-10-04T22:00:30Z", incAt: "2026-10-04T22:00:30Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T23:00:29.999Z", "2026-10-06", "t9-86558-0"));
    expect(seen).toEqual([6]);
  });

  it("T9 L49 g=1 at exactly 49h resets (0 token)", () => {
    seedQr(5, "2026-10-05", 0, 60, 120, "2026-10-04T22:00:30Z", { creditAt: "2026-10-04T22:00:30Z", incAt: "2026-10-04T22:00:30Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T23:00:30Z", "2026-10-06", "t9-63652-0"));
    expect(seen).toEqual([1]);
    const bits = profileBits();
    const iaMatch = replica
      .exec(
        `SELECT streak_inc_at = '2026-10-06T23:00:30Z'::timestamptz FROM public.user_profiles WHERE id = '${USER_A}'`,
      )
      .trim();
    expect(iaMatch).toBe("t");
  });

  it("T9 L49t g=1 at exactly 49h with 1 token: token spent, then +1", () => {
    seedQr(5, "2026-10-05", 1, 60, 120, "2026-10-04T22:00:30Z", { creditAt: "2026-10-04T22:00:30Z", incAt: "2026-10-04T22:00:30Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T23:00:30Z", "2026-10-06", "t9-21849-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
    expect(bits.la).toBe("2026-10-06");
  });

  it("T9 W48- big widen (no margin) at 48h-1ms advances", () => {
    seedQr(5, "2026-09-26", 0, 120, 120, "2026-09-26T07:00:00Z", { creditAt: "2026-09-26T07:00:00Z", incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-28T06:59:59.999Z", "2026-09-27", "t9-70516-0"));
    expect(seen).toEqual([6]);
  });

  it("T9 F73- g=2 at 73h-1ms (margin): token spent, then +1", () => {
    seedQr(5, "2026-10-05", 1, 60, 120, "2026-10-04T22:00:30Z", { creditAt: "2026-10-04T22:00:30Z", incAt: "2026-10-04T22:00:30Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-07T23:00:29.999Z", "2026-10-07", "t9-27331-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
  });

  it("T9 F73 g=2 at exactly 73h resets, token kept", () => {
    seedQr(5, "2026-10-05", 1, 60, 120, "2026-10-04T22:00:30Z", { creditAt: "2026-10-04T22:00:30Z", incAt: "2026-10-04T22:00:30Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-07T23:00:30Z", "2026-10-07", "t9-60599-0"));
    expect(seen).toEqual([1]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
  });

  it("T9 B48h home band g=2 at 48h-1ms (real missed day, 0 token): reset", () => {
    seedQr(5, "2026-10-05", 0, 120, 120, "2026-10-04T22:00:30Z", { creditAt: "2026-10-04T22:00:30Z", incAt: "2026-10-04T22:00:30Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T22:00:29.999Z", "2026-10-07", "t9-88281-0"));
    expect(seen).toEqual([1]);
  });

  it("T9 B48 home band g=2 (real missed day): token spent, then +1", () => {
    seedQr(5, "2026-10-05", 1, 120, 120, "2026-10-04T22:00:30Z", { creditAt: "2026-10-04T22:00:30Z", incAt: "2026-10-04T22:00:30Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T22:00:30Z", "2026-10-07", "t9-16010-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
  });

  it("T9 B48z g=2 at exactly 48h: reset (0 token)", () => {
    seedQr(5, "2026-10-05", 0, 120, 120, "2026-10-04T22:00:30Z", { creditAt: "2026-10-04T22:00:30Z", incAt: "2026-10-04T22:00:30Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T22:00:30Z", "2026-10-07", "t9-19303-0"));
    expect(seen).toEqual([1]);
    const bits = profileBits();
    const iaMatch = replica
      .exec(
        `SELECT streak_inc_at = '2026-10-06T22:00:30Z'::timestamptz FROM public.user_profiles WHERE id = '${USER_A}'`,
      )
      .trim();
    expect(iaMatch).toBe("t");
  });

  it("T9 B3g g=3 at 47h (real gap < 48h, fixed offset impossible; band [-720,840])", () => {
    seedQr(5, "2026-10-05", 0, -720, 840, "2026-10-05T11:00:00Z", { creditAt: "2026-10-05T11:00:00Z", incAt: "2026-10-05T11:00:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-07T10:00:00Z", "2026-10-08", "t9-32672-0"));
    expect(seen).toEqual([6]);
  });

  it("T9 R23 increment at prev+23h exactly: HOLD", () => {
    seedQr(5, "2026-10-05", 0, 120, 120, "2026-10-05T08:00:00Z", { creditAt: "2026-10-05T08:00:00Z", incAt: "2026-10-05T08:00:00Z", prevIncAt: "2026-10-04T23:00:00Z", restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-05T22:00:00Z", "2026-10-06", "t9-28726-0"));
    expect(seen).toEqual([5]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-10-06");
  });

  it("T9 R23+ increment at prev+23h+1ms: advances", () => {
    seedQr(5, "2026-10-05", 0, 120, 120, "2026-10-05T08:00:00Z", { creditAt: "2026-10-05T08:00:00Z", incAt: "2026-10-05T08:00:00Z", prevIncAt: "2026-10-04T23:00:00.000Z", restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-05T22:00:00.001Z", "2026-10-06", "t9-79399-0"));
    expect(seen).toEqual([6]);
  });

  it("T9 LC at C-1h exactly: HOLD", () => {
    seedQr(5, "2026-10-05", 0, 120, 120, "2026-10-05T08:00:00Z", { creditAt: "2026-10-05T08:00:00Z", incAt: "2026-10-06T12:00:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T11:00:00Z", "2026-10-06", "t9-83869-0"));
    expect(seen).toEqual([5]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-10-06");
    const iaMatch = replica
      .exec(
        `SELECT streak_inc_at = '2026-10-06T12:00:00Z'::timestamptz FROM public.user_profiles WHERE id = '${USER_A}'`,
      )
      .trim();
    expect(iaMatch).toBe("t");
  });

  it("T9 LC+ at C-1h+1ms: advances, C += 24h", () => {
    seedQr(5, "2026-10-05", 0, 120, 120, "2026-10-05T08:00:00Z", { creditAt: "2026-10-05T08:00:00Z", incAt: "2026-10-06T12:00:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T11:00:00.001Z", "2026-10-06", "t9-13972-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    const iaMatch = replica
      .exec(
        `SELECT streak_inc_at = '2026-10-07T12:00:00Z'::timestamptz FROM public.user_profiles WHERE id = '${USER_A}'`,
      )
      .trim();
    expect(iaMatch).toBe("t");
  });

  it("T9 N0 1-min inconsistent claim at the same instant as set_at: XP only", () => {
    seedQr(5, "2026-10-05", 0, 120, 120, "2026-10-05T21:59:30Z", { creditAt: "2026-10-05T21:59:30Z", incAt: "2026-10-05T21:59:30Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-05T21:59:30Z", "2026-10-06", "t9-18301-0"));
    expect(seen).toEqual([5]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-10-05");
    expect(bits.lo).toBe("120");
    expect(bits.hi).toBe("120");
  });

  it("T9 N0+ same 1 ms later: nudge, advances", () => {
    seedQr(5, "2026-10-05", 0, 120, 120, "2026-10-05T21:59:30Z", { creditAt: "2026-10-05T21:59:30Z", incAt: "2026-10-05T21:59:30Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-05T21:59:30.001Z", "2026-10-06", "t9-58242-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.lo).toBe("121");
    expect(bits.hi).toBe("180");
  });

  it("T9 RFd no refresh once dead (e >= 48h), break remembered", () => {
    seedQr(5, "2026-10-06", 0, -720, 840, "2026-10-04T21:59:00Z", { creditAt: "2026-10-04T21:59:00Z", incAt: "2026-10-04T21:59:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T23:00:00Z", "2026-10-06", "t9-95808-0"));
    seen.push(claimStreak("2026-10-06T23:00:01Z", "2026-10-07", "t9-95808-1"));
    expect(seen).toEqual([5, 1]);
  });

  it("T9 R8-2b legacy all-NULL sessions, 49h+1ms idle", () => {
    seedQr(5, "2026-09-27", 0, null, null, null, { creditAt: null, incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-28T07:00:00.000Z", "2026-09-27", "t9-30376-0"));
    seen.push(claimStreak("2026-09-28T13:00:00.000Z", "2026-09-28", "t9-30376-1"));
    seen.push(claimStreak("2026-09-30T14:00:00.001Z", "2026-09-29", "t9-30376-2"));
    seen.push(claimStreak("2026-09-30T20:00:00.001Z", "2026-09-30", "t9-30376-3"));
    seen.push(claimStreak("2026-10-02T21:00:00.002Z", "2026-10-01", "t9-30376-4"));
    seen.push(claimStreak("2026-10-03T03:00:00.002Z", "2026-10-02", "t9-30376-5"));
    seen.push(claimStreak("2026-10-05T04:00:00.003Z", "2026-10-04", "t9-30376-6"));
    seen.push(claimStreak("2026-10-05T10:00:00.003Z", "2026-10-05", "t9-30376-7"));
    seen.push(claimStreak("2026-10-07T11:00:00.004Z", "2026-10-06", "t9-30376-8"));
    seen.push(claimStreak("2026-10-07T17:00:00.004Z", "2026-10-07", "t9-30376-9"));
    expect(seen).toEqual([5, 6, 6, 1, 1, 1, 1, 2, 1, 2]);
  });

  it("T9 BE- east skip (offset artefact) at 48h-1ms: bridged +1, no token", () => {
    seedQr(5, "2026-10-05", 0, 60, 120, "2026-10-04T20:00:00Z", { creditAt: "2026-10-04T20:00:00Z", incAt: "2026-10-04T20:00:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T19:59:59.999Z", "2026-10-07", "t9-89254-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-10-07");
  });

  it("T9 BE east skip at exactly 48h, 0 token: reset", () => {
    seedQr(5, "2026-10-05", 0, 60, 120, "2026-10-04T20:00:00Z", { creditAt: "2026-10-04T20:00:00Z", incAt: "2026-10-04T20:00:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T20:00:00Z", "2026-10-07", "t9-15388-0"));
    expect(seen).toEqual([1]);
  });

  it("T9 BEt east skip at exactly 48h, 1 token: token spent, +1", () => {
    seedQr(5, "2026-10-05", 1, 60, 120, "2026-10-04T20:00:00Z", { creditAt: "2026-10-04T20:00:00Z", incAt: "2026-10-04T20:00:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T20:00:00Z", "2026-10-07", "t9-82719-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
  });

  it("T9 TK2 #827 R1: UTC+10, 2 freeze, misses 10-14/10-15, claims 10-16: 2 tokens, +1", () => {
    seedQr(5, "2026-10-13", 2, 600, 600, "2026-10-13T02:00:00Z", { creditAt: "2026-10-13T02:00:00Z", incAt: "2026-10-13T02:00:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-16T02:00:00Z", "2026-10-16", "t9-73949-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
    expect(bits.rs).toBe(0);
    expect(bits.la).toBe("2026-10-16");
  });

  it("T9 TK1 same with 1 freeze: reset, token kept", () => {
    seedQr(5, "2026-10-13", 1, 600, 600, "2026-10-13T02:00:00Z", { creditAt: "2026-10-13T02:00:00Z", incAt: "2026-10-13T02:00:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-16T02:00:00Z", "2026-10-16", "t9-1731-0"));
    expect(seen).toEqual([1]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    expect(bits.rs).toBe(0);
  });

  it("T9 TKr #827 R2: UTC+10, 0 freeze 1 rest, misses 10-14: rest spent, +1", () => {
    seedQr(5, "2026-10-13", 0, 600, 600, "2026-10-13T02:00:00Z", { creditAt: "2026-10-13T02:00:00Z", incAt: "2026-10-13T02:00:00Z", prevIncAt: null, restDays: 1 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-15T02:00:00Z", "2026-10-15", "t9-29701-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
    expect(bits.rs).toBe(0);
  });

  it("T9 TKm g=3, 1 freeze + 1 rest: freeze first then rest, +1", () => {
    seedQr(5, "2026-10-13", 1, 600, 600, "2026-10-13T02:00:00Z", { creditAt: "2026-10-13T02:00:00Z", incAt: "2026-10-13T02:00:00Z", prevIncAt: null, restDays: 1 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-16T02:00:00Z", "2026-10-16", "t9-60424-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
    expect(bits.rs).toBe(0);
  });

  it("T9 TKf g=2, 1 freeze + 1 rest: freeze used, rest kept", () => {
    seedQr(5, "2026-10-13", 1, 600, 600, "2026-10-13T02:00:00Z", { creditAt: "2026-10-13T02:00:00Z", incAt: "2026-10-13T02:00:00Z", prevIncAt: null, restDays: 1 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-15T02:00:00Z", "2026-10-15", "t9-80330-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
    expect(bits.rs).toBe(1);
  });

  it("T9 HM home Berlin misses 10-07 (21:15 -> 06:45, real gap 33.5h), 0 token: reset", () => {
    seedQr(5, "2026-10-06", 0, 120, 120, "2026-10-06T19:15:00Z", { creditAt: "2026-10-06T19:15:00Z", incAt: "2026-10-06T19:15:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-08T04:45:00Z", "2026-10-08", "t9-51085-0"));
    expect(seen).toEqual([1]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
    expect(bits.rs).toBe(0);
  });

  it("T9 HMr same with 1 rest day: rest spent, +1", () => {
    seedQr(5, "2026-10-06", 0, 120, 120, "2026-10-06T19:15:00Z", { creditAt: "2026-10-06T19:15:00Z", incAt: "2026-10-06T19:15:00Z", prevIncAt: null, restDays: 1 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-08T04:45:00Z", "2026-10-08", "t9-26591-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.rs).toBe(0);
  });

  it("T9 SY Sydney spring-forward, misses 10-04 (00:30 claims), stale band [600,600], 0 token: reset (no DST bridge)", () => {
    seedQr(5, "2026-10-03", 0, 600, 600, "2026-10-02T14:30:00Z", { creditAt: "2026-10-02T14:30:00Z", incAt: "2026-10-02T14:30:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-04T13:30:00Z", "2026-10-05", "t9-73747-0"));
    expect(seen).toEqual([1]);
  });

  it("T9 SYt same with 1 freeze: token spent, +1", () => {
    seedQr(5, "2026-10-03", 1, 600, 600, "2026-10-02T14:30:00Z", { creditAt: "2026-10-02T14:30:00Z", incAt: "2026-10-02T14:30:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-04T13:30:00Z", "2026-10-05", "t9-35360-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
  });

  it("T9 BM wide band [-600,840], g=2 bridgeable date, e=48h30m (margin 1h, wd 0): strict 48h -> reset", () => {
    seedQr(5, "2026-10-05", 0, -600, 840, "2026-10-05T06:00:00Z", { creditAt: "2026-10-05T06:00:00Z", incAt: "2026-10-05T06:00:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-07T06:30:00Z", "2026-10-07", "t9-37917-0"));
    expect(seen).toEqual([1]);
  });

  it("T9 BMt same at e=47h30m: claim inside the wide stored band (no evidence of an eastward move, e > 23h) -> not bridged, 0 token: reset", () => {
    seedQr(5, "2026-10-05", 0, -600, 840, "2026-10-05T06:00:00Z", { creditAt: "2026-10-05T06:00:00Z", incAt: "2026-10-05T06:00:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-07T05:30:00Z", "2026-10-07", "t9-24876-0"));
    expect(seen).toEqual([1]);
  });

  it("T9 TW g=3, 2 freeze, e=90h (< 24h*(2+2)+1h): 2 tokens, +1", () => {
    seedQr(5, "2026-10-05", 2, 60, 120, "2026-10-04T22:00:30Z", { creditAt: "2026-10-04T22:00:30Z", incAt: "2026-10-04T22:00:30Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-08T16:00:30Z", "2026-10-08", "t9-95986-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
  });

  it("T9 BN band [0,120], claim 30 min east of hi (east move, nudge -> margin 1h), g=2, e=48h30m: strict 48h -> reset", () => {
    seedQr(5, "2026-10-05", 0, 0, 120, "2026-10-04T21:00:00Z", { creditAt: "2026-10-04T21:00:00Z", incAt: "2026-10-04T21:00:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T21:30:00Z", "2026-10-07", "t9-48829-0"));
    expect(seen).toEqual([1]);
  });

  it("T9 BNt same at e=47h30m: bridged +1, no token", () => {
    seedQr(5, "2026-10-05", 0, 0, 120, "2026-10-04T22:00:00Z", { creditAt: "2026-10-04T22:00:00Z", incAt: "2026-10-04T22:00:00Z", prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T21:30:00Z", "2026-10-07", "t9-49371-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
    expect(bits.la).toBe("2026-10-07");
  });

  it("T9 BW wide band [-720,840] (N5b): Kiritimati misses 10-13, returns 10-14 00:30 local (e=36.5h), 0 token: reset", () => {
    seedQr(2, "2026-10-12", 0, -720, 840, "2026-10-11T22:00:00Z", { creditAt: "2026-10-11T22:00:00Z", incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-13T10:30:00Z", "2026-10-14", "t9-78303-0"));
    expect(seen).toEqual([1]);
  });

  it("T9 BWt same with 1 rest day: rest spent, +1", () => {
    seedQr(2, "2026-10-12", 0, -720, 840, "2026-10-11T22:00:00Z", { creditAt: "2026-10-11T22:00:00Z", incAt: null, prevIncAt: null, restDays: 1 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-13T10:30:00Z", "2026-10-14", "t9-65613-0"));
    expect(seen).toEqual([3]);
    const bits = profileBits();
    expect(bits.rs).toBe(0);
  });

  it("T9 BG g=3 within 47h (impossible for any fixed zone), wide band: bridged +1", () => {
    seedQr(5, "2026-10-05", 0, -720, 840, "2026-10-05T11:00:00Z", { creditAt: "2026-10-05T11:00:00Z", incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-07T10:00:00Z", "2026-10-08", "t9-70105-0"));
    expect(seen).toEqual([6]);
  });

  it("T9 BS stationary Berlin noon-claimer, loose band [-600,839], misses 10-06, returns 10-07 00:30 local (e=36.5h), 0 token: reset (no free skip)", () => {
    seedQr(5, "2026-10-05", 0, -600, 839, "2026-10-05T10:00:00Z", { creditAt: "2026-10-05T10:00:00Z", incAt: null, prevIncAt: null, restDays: 0 });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T22:30:00Z", "2026-10-07", "t9-13950-0"));
    expect(seen).toEqual([1]);
  });

  it("property: random adversary never exceeds lead 2+1/24 or +2 in 23h", () => {
    const report = replica.exec(`
RESET ROLE;
SELECT set_config('app.uid', '${USER_A}', false);
CREATE TABLE IF NOT EXISTS public._xp_prop_clock (t timestamptz NOT NULL);
TRUNCATE public._xp_prop_clock;
INSERT INTO public._xp_prop_clock (t) VALUES (timestamptz '2026-03-01 08:00:00+00');
CREATE OR REPLACE FUNCTION public.xp_server_now() RETURNS timestamptz
LANGUAGE sql VOLATILE SET search_path = ''
AS $fn$ SELECT t FROM public._xp_prop_clock LIMIT 1; $fn$;
REVOKE ALL ON FUNCTION public.xp_server_now() FROM PUBLIC, anon, authenticated, service_role;
DO $prop$
DECLARE
  run int;
  day int;
  v_now timestamptz;
  v_first timestamptz;
  v_utc date;
  v_p date;
  v_prev int;
  v_streak int;
  v_lead numeric;
  v_inc1 timestamptz;
  v_inc2 timestamptz;
  v_uid uuid := '${USER_A}'::uuid;
BEGIN
  PERFORM setseed(0.42);
  -- 400 seeds × 30 days × 2 same-instant claims (~24k awards).
  FOR run IN 1..400 LOOP
    DELETE FROM public.xp_events WHERE user_id = v_uid;
    DELETE FROM public.daily_logs WHERE user_id = v_uid;
    UPDATE public.user_profiles
    SET total_xp = 0, current_level = 1, current_streak = 0, longest_streak = 0,
        last_activity_date = NULL, streak_freeze_tokens = 0, rest_days = 0,
        streak_tz_lo_min = NULL, streak_tz_hi_min = NULL, streak_tz_set_at = NULL,
        streak_credit_at = NULL, streak_inc_at = NULL, streak_prev_inc_at = NULL
    WHERE id = v_uid;
    v_inc1 := NULL;
    v_inc2 := NULL;
    v_first := timestamptz '2026-03-01 08:00:00+00'
      + ((random() * 400)::int) * interval '1 hour';
    FOR day IN 0..29 LOOP
      v_now := v_first + day * interval '1 day'
        + ((random() * 24)::int) * interval '1 hour'
        + ((random() * 60)::int) * interval '1 minute'
        + ((random() * 1000)::int) * interval '1 millisecond';
      UPDATE public._xp_prop_clock SET t = v_now;
      v_utc := (v_now AT TIME ZONE 'UTC')::date;
      v_p := v_utc + (floor(random() * 3)::int - 1);
      SELECT current_streak INTO v_prev
      FROM public.user_profiles WHERE id = v_uid;
      PERFORM set_config('app.uid', v_uid::text, false);
      SET LOCAL ROLE authenticated;
      SELECT a.current_streak INTO v_streak FROM public.award_xp(
        v_uid, 10, NULL, 'create_note', 'p' || run || '-' || day, v_p, NULL
      ) AS a;
      RESET ROLE;
      v_lead := v_streak - EXTRACT(EPOCH FROM (v_now - v_first)) / 86400.0;
      IF v_lead >= 2 + 1.0/24 THEN
        RAISE EXCEPTION 'run % day % lead % >= 2+1/24', run, day, v_lead;
      END IF;
      IF v_streak - v_prev >= 2 THEN
        RAISE EXCEPTION 'run % day % gained % in one instant (prev %, now %)',
          run, day, v_streak - v_prev, v_prev, v_streak;
      END IF;
      IF v_streak > v_prev AND v_prev > 0 THEN
        IF v_inc1 IS NOT NULL AND (v_now - v_inc1) <= interval '23 hours' THEN
          RAISE EXCEPTION 'run % day % more than +2 increments in 23h', run, day;
        END IF;
        v_inc1 := v_inc2;
        v_inc2 := v_now;
      END IF;
      v_prev := v_streak;
      v_p := v_utc + (floor(random() * 3)::int - 1);
      PERFORM set_config('app.uid', v_uid::text, false);
      SET LOCAL ROLE authenticated;
      SELECT a.current_streak INTO v_streak FROM public.award_xp(
        v_uid, 10, NULL, 'create_task', 'q' || run || '-' || day, v_p, NULL
      ) AS a;
      RESET ROLE;
      IF v_streak - v_prev >= 2 THEN
        RAISE EXCEPTION 'run % day % second claim +% in one instant',
          run, day, v_streak - v_prev;
      END IF;
      IF v_streak > v_prev AND v_prev > 0 THEN
        IF v_inc1 IS NOT NULL AND (v_now - v_inc1) <= interval '23 hours' THEN
          RAISE EXCEPTION 'run % day % second claim more than +2 in 23h', run, day;
        END IF;
        v_inc1 := v_inc2;
        v_inc2 := v_now;
      END IF;
      v_lead := v_streak - EXTRACT(EPOCH FROM (v_now - v_first)) / 86400.0;
      IF v_lead >= 2 + 1.0/24 THEN
        RAISE EXCEPTION 'run % day % lead % >= 2+1/24 after second claim', run, day, v_lead;
      END IF;
    END LOOP;
  END LOOP;
END
$prop$;
DROP TABLE public._xp_prop_clock;
SELECT 'ok';
    `);
    expect(report.trim().split("\n").filter(Boolean).at(-1)).toBe("ok");
  }, 90_000);

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
        `UPDATE public.user_profiles SET streak_tz_lo_min = 0, streak_tz_hi_min = 0, streak_tz_set_at = now(), streak_credit_at = now(), streak_inc_at = now(), streak_prev_inc_at = now() WHERE id = '${USER_A}'`,
      ),
    ).toThrow(/permission denied|must be owner/i);
  });

  it("T10 P1 QA repro London->Auckland owl: 09-06 23:59, 02:58 09-07 (XP only, pending), 20:23 09-08 (e=44.4h) -> 6,6,7 (r9: 6,6,1)", () => {
    seedQr(6, "2026-09-06", 0, 15, 356, "2026-09-06T11:59:32.456Z", { creditAt: "2026-09-06T11:59:32.456Z", incAt: "2026-09-06T09:28:52.555Z", prevIncAt: "2026-09-05T03:19:42.078Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-06T11:59:48.577Z", "2026-09-06", "t10-0-0"));
    seen.push(claimStreak("2026-09-06T14:58:23.589Z", "2026-09-07", "t10-0-1"));
    seen.push(claimStreak("2026-09-08T08:23:35.075Z", "2026-09-08", "t10-0-2"));
    expect(seen).toEqual([6, 6, 7]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-09-08");
    expect(bits.fr).toBe(1);
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T10 P2 QA repro with 1 token: token kept (7 mints) -> 6,6,7 fr=2 (r9: fr=1, burned)", () => {
    seedQr(6, "2026-09-06", 1, 15, 356, "2026-09-06T11:59:32.456Z", { creditAt: "2026-09-06T11:59:32.456Z", incAt: "2026-09-06T09:28:52.555Z", prevIncAt: "2026-09-05T03:19:42.078Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-06T11:59:48.577Z", "2026-09-06", "t10-1-0"));
    seen.push(claimStreak("2026-09-06T14:58:23.589Z", "2026-09-07", "t10-1-1"));
    seen.push(claimStreak("2026-09-08T08:23:35.075Z", "2026-09-08", "t10-1-2"));
    expect(seen).toEqual([6, 6, 7]);
    const bits = profileBits();
    expect(bits.fr).toBe(2);
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T10 P3 QA full itinerary from a fresh profile ends 7 (r9: ...,6,6,6,1)", () => {
    // fresh profile (resetUser in beforeEach)
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-01T09:28:52.555Z", "2026-09-01", "t10-2-0"));
    seen.push(claimStreak("2026-09-01T11:30:29.000Z", "2026-09-01", "t10-2-1"));
    seen.push(claimStreak("2026-09-01T13:58:07.966Z", "2026-09-01", "t10-2-2"));
    seen.push(claimStreak("2026-09-02T18:03:06.854Z", "2026-09-02", "t10-2-3"));
    seen.push(claimStreak("2026-09-02T23:45:43.913Z", "2026-09-03", "t10-2-4"));
    seen.push(claimStreak("2026-09-03T23:49:56.775Z", "2026-09-04", "t10-2-5"));
    seen.push(claimStreak("2026-09-04T00:45:37.940Z", "2026-09-04", "t10-2-6"));
    seen.push(claimStreak("2026-09-04T09:38:13.702Z", "2026-09-04", "t10-2-7"));
    seen.push(claimStreak("2026-09-05T03:19:42.078Z", "2026-09-05", "t10-2-8"));
    seen.push(claimStreak("2026-09-05T05:21:17.299Z", "2026-09-05", "t10-2-9"));
    seen.push(claimStreak("2026-09-05T07:04:29.149Z", "2026-09-05", "t10-2-10"));
    seen.push(claimStreak("2026-09-06T11:59:32.456Z", "2026-09-06", "t10-2-11"));
    seen.push(claimStreak("2026-09-06T11:59:48.577Z", "2026-09-06", "t10-2-12"));
    seen.push(claimStreak("2026-09-06T14:58:23.589Z", "2026-09-07", "t10-2-13"));
    seen.push(claimStreak("2026-09-08T08:23:35.075Z", "2026-09-08", "t10-2-14"));
    expect(seen).toEqual([1, 1, 1, 2, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-09-08");
  });

  it("T10 P4 pending claim writes only streak_pending_date + streak_credit_at (streak, last, band, set_at, rate clocks, tokens unchanged)", () => {
    seedQr(6, "2026-09-06", 0, 15, 356, "2026-09-06T11:59:32.456Z", { creditAt: "2026-09-06T11:59:32.456Z", incAt: "2026-09-06T09:28:52.555Z", prevIncAt: "2026-09-05T03:19:42.078Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-06T11:59:48.577Z", "2026-09-06", "t10-3-0"));
    seen.push(claimStreak("2026-09-06T14:58:23.589Z", "2026-09-07", "t10-3-1"));
    expect(seen).toEqual([6, 6]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-09-06");
    expect(bits.fr).toBe(0);
    const r10 = r10Bits();
    expect(r10.lo).toBe("15");
    expect(r10.hi).toBe("356");
    expect(r10.sa).toBe(iso("2026-09-06T11:59:32.456Z"));
    expect(r10.ca).toBe(iso("2026-09-06T14:58:23.589Z"));
    expect(r10.ia).toBe(iso("2026-09-06T09:28:52.555Z"));
    expect(r10.pa).toBe(iso("2026-09-05T03:19:42.078Z"));
    expect(r10.pd).toBe("2026-09-07");
    const logs = replica.exec(`SELECT count(*) FROM public.daily_logs WHERE user_id = '${USER_A}' AND date = '2026-09-07'::date`).trim();
    expect(Number(logs)).toBe(0);
  });

  it("T10 P5 no steal: pending 09-07, then a band-consistent 09-07 claim after the gate and 09-08 -> 6,6,7,8 (same as r9)", () => {
    seedQr(6, "2026-09-06", 0, 15, 356, "2026-09-06T11:59:32.456Z", { creditAt: "2026-09-06T11:59:32.456Z", incAt: "2026-09-06T09:28:52.555Z", prevIncAt: "2026-09-05T03:19:42.078Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-06T11:59:48.577Z", "2026-09-06", "t10-4-0"));
    seen.push(claimStreak("2026-09-06T14:58:23.589Z", "2026-09-07", "t10-4-1"));
    seen.push(claimStreak("2026-09-06T20:30:00Z", "2026-09-07", "t10-4-2"));
    seen.push(claimStreak("2026-09-08T08:23:35.075Z", "2026-09-08", "t10-4-3"));
    expect(seen).toEqual([6, 6, 7, 8]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-09-08");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T10 P6 two-date pending chain (UTC-10 band, D+1 and D+2 claimed XP only inside the 6h gate), then D+2 at home 23.5h later: bridge via pending (r9: west clause fails -> reset)", () => {
    seedQr(5, "2026-10-05", 0, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t10-5-0"));
    seen.push(claimStreak("2026-10-06T10:30:00Z", "2026-10-07", "t10-5-1"));
    seen.push(claimStreak("2026-10-07T10:00:00Z", "2026-10-07", "t10-5-2"));
    expect(seen).toEqual([5, 5, 6]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-10-07");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T10 P6c same with 1 token: token kept (r9: token burned)", () => {
    seedQr(5, "2026-10-05", 1, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t10-6-0"));
    seen.push(claimStreak("2026-10-06T10:30:00Z", "2026-10-07", "t10-6-1"));
    seen.push(claimStreak("2026-10-07T10:00:00Z", "2026-10-07", "t10-6-2"));
    expect(seen).toEqual([5, 5, 6]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    expect(bits.la).toBe("2026-10-07");
  });

  it("T10 P6b pending chain state: pending = D+2 after two XP-only claims", () => {
    seedQr(5, "2026-10-05", 0, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t10-7-0"));
    seen.push(claimStreak("2026-10-06T10:30:00Z", "2026-10-07", "t10-7-1"));
    expect(seen).toEqual([5, 5]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-10-05");
    const r10 = r10Bits();
    expect(r10.pd).toBe("2026-10-07");
    expect(r10.ca).toBe(iso("2026-10-06T10:30:00Z"));
    expect(r10.sa).toBe(iso("2026-10-06T06:00:00Z"));
  });

  it("T10 P7 forgery bound: P6 chain with the lead clock ahead (C = 10-08 06:00Z) -> the pending bridge is a HOLD, streak stays 5, last moves", () => {
    seedQr(5, "2026-10-05", 0, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-08T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t10-8-0"));
    seen.push(claimStreak("2026-10-06T10:30:00Z", "2026-10-07", "t10-8-1"));
    seen.push(claimStreak("2026-10-07T10:00:00Z", "2026-10-07", "t10-8-2"));
    expect(seen).toEqual([5, 5, 5]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-10-07");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T10 P8 dead chain (e >= 48h): gate-closed XP-only claim does not record a pending date or refresh credit_at", () => {
    seedQr(6, "2026-09-06", 0, 15, 356, "2026-09-06T11:59:32.456Z", { creditAt: "2026-09-04T11:00:00Z", incAt: null, prevIncAt: null, restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-06T14:58:23.589Z", "2026-09-07", "t10-9-0"));
    expect(seen).toEqual([6]);
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
    expect(r10.ca).toBe(iso("2026-09-04T11:00:00Z"));
  });

  it("T10 P9 not the next date: gate-closed XP-only claim for last+2 does not record a pending date", () => {
    seedQr(5, "2026-10-05", 0, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T10:30:00Z", "2026-10-07", "t10-10-0"));
    expect(seen).toEqual([5]);
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
    expect(r10.ca).toBe(iso("2026-10-06T06:00:00Z"));
  });

  it("T10 P10 [r11 flipped] pending D+1, real miss of D+2, claim D+3: m counted from pending = 1 (r10: m = g-1 = 2), 1 token spent", () => {
    seedQr(5, "2026-10-05", 2, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t10-11-0"));
    seen.push(claimStreak("2026-10-08T10:30:00Z", "2026-10-08", "t10-11-1"));
    expect(seen).toEqual([5, 6]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    expect(bits.la).toBe("2026-10-08");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T10 P10b [r11 flipped] pending D+1 then claim D+3 at e=41.5h (skipped D+2 not claimed): pending does not bridge; m = 1 from pending, 1 token spent (r10: 2)", () => {
    seedQr(5, "2026-10-05", 2, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t10-12-0"));
    seen.push(claimStreak("2026-10-08T00:30:00Z", "2026-10-08", "t10-12-1"));
    expect(seen).toEqual([5, 6]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    expect(bits.la).toBe("2026-10-08");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T10 P10c same with 0 tokens: reset (pending is not a free skip)", () => {
    seedQr(5, "2026-10-05", 0, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t10-13-0"));
    seen.push(claimStreak("2026-10-08T00:30:00Z", "2026-10-08", "t10-13-1"));
    expect(seen).toEqual([5, 1]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-10-08");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T10 P11 reset clears pending", () => {
    seedQr(5, "2026-10-05", 0, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t10-14-0"));
    seen.push(claimStreak("2026-10-09T12:00:00Z", "2026-10-09", "t10-14-1"));
    expect(seen).toEqual([5, 1]);
    const bits = profileBits();
    expect(bits.la).toBe("2026-10-09");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T10 P12 stale pending <= last is ignored: g=2 home-band miss still needs a token (0 tokens -> reset)", () => {
    seedQr(5, "2026-10-05", 0, 120, 120, "2026-10-05T07:00:00Z", { creditAt: "2026-10-05T07:00:00Z", incAt: null, prevIncAt: null, restDays: 0, pendingDate: "2026-10-05" });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-07T06:00:00Z", "2026-10-07", "t10-15-0"));
    expect(seen).toEqual([1]);
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });
  it("T11 P13 QA repro_pending_token 1 freeze: XP-only 09-07 (pending), 09-08 missed, 09-09 noon NZST -> 6,7, 1 spent (+1 minted at 7) (r10: 6,1 reset)", () => {
    seedQr(6, "2026-09-06", 1, 15, 356, "2026-09-06T11:59:32.456Z", { creditAt: "2026-09-06T11:59:32.456Z", incAt: "2026-09-06T09:28:52.555Z", prevIncAt: "2026-09-05T03:19:42.078Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-06T14:58:23.589Z", "2026-09-07", "t11-16-0"));
    seen.push(claimStreak("2026-09-09T00:00:00.000Z", "2026-09-09", "t11-16-1"));
    expect(seen).toEqual([6, 7]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    expect(bits.rs).toBe(0);
    expect(bits.la).toBe("2026-09-09");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P13b QA repro 1 rest day -> 6,7, rest spent (r10: 6,1)", () => {
    seedQr(6, "2026-09-06", 0, 15, 356, "2026-09-06T11:59:32.456Z", { creditAt: "2026-09-06T11:59:32.456Z", incAt: "2026-09-06T09:28:52.555Z", prevIncAt: "2026-09-05T03:19:42.078Z", restDays: 1, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-06T14:58:23.589Z", "2026-09-07", "t11-17-0"));
    seen.push(claimStreak("2026-09-09T00:00:00.000Z", "2026-09-09", "t11-17-1"));
    expect(seen).toEqual([6, 7]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    expect(bits.rs).toBe(0);
    expect(bits.la).toBe("2026-09-09");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P13c QA repro 2 freeze -> 6,7, exactly 1 spent (r10: 2 spent)", () => {
    seedQr(6, "2026-09-06", 2, 15, 356, "2026-09-06T11:59:32.456Z", { creditAt: "2026-09-06T11:59:32.456Z", incAt: "2026-09-06T09:28:52.555Z", prevIncAt: "2026-09-05T03:19:42.078Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-06T14:58:23.589Z", "2026-09-07", "t11-18-0"));
    seen.push(claimStreak("2026-09-09T00:00:00.000Z", "2026-09-09", "t11-18-1"));
    expect(seen).toEqual([6, 7]);
    const bits = profileBits();
    expect(bits.fr).toBe(2);
    expect(bits.rs).toBe(0);
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P13d QA repro 2 rest days -> 6,7, exactly 1 rest spent (r10: 2 spent)", () => {
    seedQr(6, "2026-09-06", 0, 15, 356, "2026-09-06T11:59:32.456Z", { creditAt: "2026-09-06T11:59:32.456Z", incAt: "2026-09-06T09:28:52.555Z", prevIncAt: "2026-09-05T03:19:42.078Z", restDays: 2, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-06T14:58:23.589Z", "2026-09-07", "t11-19-0"));
    seen.push(claimStreak("2026-09-09T00:00:00.000Z", "2026-09-09", "t11-19-1"));
    expect(seen).toEqual([6, 7]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    expect(bits.rs).toBe(1);
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P13e QA repro 0 tokens -> 6,1 reset (one date really missed)", () => {
    seedQr(6, "2026-09-06", 0, 15, 356, "2026-09-06T11:59:32.456Z", { creditAt: "2026-09-06T11:59:32.456Z", incAt: "2026-09-06T09:28:52.555Z", prevIncAt: "2026-09-05T03:19:42.078Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-06T14:58:23.589Z", "2026-09-07", "t11-20-0"));
    seen.push(claimStreak("2026-09-09T00:00:00.000Z", "2026-09-09", "t11-20-1"));
    expect(seen).toEqual([6, 1]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
    expect(bits.rs).toBe(0);
    expect(bits.la).toBe("2026-09-09");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P13f QA control: no 09-07 claim, 1 freeze -> reset, token kept (2 dates missed, pending does not exist)", () => {
    seedQr(6, "2026-09-06", 1, 15, 356, "2026-09-06T11:59:32.456Z", { creditAt: "2026-09-06T11:59:32.456Z", incAt: "2026-09-06T09:28:52.555Z", prevIncAt: "2026-09-05T03:19:42.078Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-09T00:00:00.000Z", "2026-09-09", "t11-21-0"));
    expect(seen).toEqual([1]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P13g QA control: fixed NZ band, 09-07 credited, 1 freeze -> 7,8 (unchanged)", () => {
    seedQr(6, "2026-09-06", 1, 720, 720, "2026-09-06T11:59:32.456Z", { creditAt: "2026-09-06T11:59:32.456Z", incAt: "2026-09-06T09:28:52.555Z", prevIncAt: "2026-09-05T03:19:42.078Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-09-07T08:00:00.000Z", "2026-09-07", "t11-22-0"));
    seen.push(claimStreak("2026-09-09T00:00:00.000Z", "2026-09-09", "t11-22-1"));
    expect(seen).toEqual([7, 8]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P14 pending chain to D+2, claim D+3 at e=48.5h (dead for the bridge, nothing missed): 1 liveness token (r10: 2 -> reset with 1)", () => {
    seedQr(5, "2026-10-05", 1, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t11-23-0"));
    seen.push(claimStreak("2026-10-06T10:30:00Z", "2026-10-07", "t11-23-1"));
    seen.push(claimStreak("2026-10-08T11:00:00Z", "2026-10-08", "t11-23-2"));
    expect(seen).toEqual([5, 5, 6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
    expect(bits.la).toBe("2026-10-08");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P14b same with 0 tokens: reset (liveness still needs a token)", () => {
    seedQr(5, "2026-10-05", 0, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t11-24-0"));
    seen.push(claimStreak("2026-10-06T10:30:00Z", "2026-10-07", "t11-24-1"));
    seen.push(claimStreak("2026-10-08T11:00:00Z", "2026-10-08", "t11-24-2"));
    expect(seen).toEqual([5, 5, 1]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
    expect(bits.la).toBe("2026-10-08");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P15 forgery bound: pending D+1 then D+2, D+3 unclaimed, claim D+4 (e=77h): m = 2 real unclaimed dates, 2 spent", () => {
    seedQr(5, "2026-10-05", 2, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t11-25-0"));
    seen.push(claimStreak("2026-10-09T12:00:00Z", "2026-10-09", "t11-25-1"));
    expect(seen).toEqual([5, 6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
    expect(bits.la).toBe("2026-10-09");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P15b same with 1 token: reset, token kept (pending cannot cover a date nobody claimed)", () => {
    seedQr(5, "2026-10-05", 1, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t11-26-0"));
    seen.push(claimStreak("2026-10-09T12:00:00Z", "2026-10-09", "t11-26-1"));
    expect(seen).toEqual([5, 1]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    expect(bits.la).toBe("2026-10-09");
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P15c 1 token, pending D+1, claim D+3 after the 72h window (e=73.5h from the pending claim): reset, token kept (window counted from pending with m = 1)", () => {
    seedQr(5, "2026-10-05", 1, -600, -600, "2026-10-06T06:00:00Z", { creditAt: "2026-10-06T06:00:00Z", incAt: "2026-10-06T06:00:00Z", prevIncAt: "2026-10-05T05:00:00Z", restDays: 0, pendingDate: null });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-06T07:00:00Z", "2026-10-06", "t11-27-0"));
    seen.push(claimStreak("2026-10-09T08:30:00Z", "2026-10-08", "t11-27-1"));
    expect(seen).toEqual([5, 1]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P16 stale pending <= last ignored by the token count: g=3 home-band claim with 1 token -> reset (needs 2)", () => {
    seedQr(5, "2026-10-05", 1, 120, 120, "2026-10-05T07:00:00Z", { creditAt: "2026-10-05T07:00:00Z", incAt: null, prevIncAt: null, restDays: 0, pendingDate: "2026-10-05" });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-08T06:00:00Z", "2026-10-08", "t11-28-0"));
    expect(seen).toEqual([1]);
    const bits = profileBits();
    expect(bits.fr).toBe(1);
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T11 P16b stale pending < last (10-03 < 10-05) is not read by the token count: g=2 home-band claim with 1 token -> 6, 1 spent (a raw-pending read would need 3 and reset)", () => {
    seedQr(5, "2026-10-05", 1, 120, 120, "2026-10-05T07:00:00Z", { creditAt: "2026-10-05T07:00:00Z", incAt: null, prevIncAt: null, restDays: 0, pendingDate: "2026-10-03" });
    const seen: number[] = [];
    seen.push(claimStreak("2026-10-07T06:00:00Z", "2026-10-07", "t11-29-0"));
    expect(seen).toEqual([6]);
    const bits = profileBits();
    expect(bits.fr).toBe(0);
    const r10 = r10Bits();
    expect(r10.pd).toBe("NULL");
  });

  it("T10 L1 denies an authenticated UPDATE of the server-owned streak_pending_date", () => {
    awardXp(replica, USER_A, 10, "create_note");
    expect(() =>
      replica.execAs(
        USER_A,
        `UPDATE public.user_profiles SET streak_pending_date = CURRENT_DATE + 1 WHERE id = '${USER_A}'`,
      ),
    ).toThrow(/permission denied|42501/i);
    const pd = replica.exec(`SELECT COALESCE(streak_pending_date::text, 'NULL') FROM public.user_profiles WHERE id = '${USER_A}'`).trim();
    expect(pd).toBe("NULL");
    const priv = replica
      .exec(
        `SELECT has_column_privilege('authenticated', 'public.user_profiles', 'streak_pending_date', 'UPDATE')::text || '|' ||
                has_column_privilege('anon', 'public.user_profiles', 'streak_pending_date', 'UPDATE')::text`,
      )
      .trim();
    expect(priv).toBe("false|false");
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

  it("denies authenticated TRUNCATE of user_profiles, research_achievements and xp_events, and DELETE from user_profiles", () => {
    expect(() => replica.execAs(USER_A, "TRUNCATE public.user_profiles")).toThrow(
      /42501|permission denied/i,
    );
    expect(() => replica.execAs(USER_A, "TRUNCATE public.research_achievements")).toThrow(
      /42501|permission denied/i,
    );
    expect(() => replica.execAs(USER_A, "TRUNCATE public.xp_events")).toThrow(
      /42501|permission denied/i,
    );
    expect(() =>
      replica.execAs(USER_A, `DELETE FROM public.user_profiles WHERE id = '${USER_A}'`),
    ).toThrow(/42501|permission denied/i);
    expect(() =>
      replica.execAs(USER_A, "LOCK TABLE public.user_profiles IN ACCESS EXCLUSIVE MODE"),
    ).toThrow(/42501|permission denied/i);
    const stillThere = replica
      .exec(`SELECT count(*) FROM public.user_profiles WHERE id = '${USER_A}'`)
      .trim();
    expect(Number(stillThere)).toBe(1);
  });
});
