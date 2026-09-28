/**
 * Local Postgres 17 replica used by XP-integrity tests.
 *
 * Matches the 1765700000 replica recipe: master's table shapes, auth.uid()
 * stubbed from a session GUC, Supabase default privileges, then 1765700000
 * followed by 1765800000. Spawns an ephemeral initdb cluster. CI installs
 * PostgreSQL 17 so live cases run with 0 skipped.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..", "..", "..");

export const USER_A = "11111111-1111-1111-1111-111111111111";
export const USER_B = "22222222-2222-2222-2222-222222222222";

const PG17_BIN_CANDIDATES = [
  "/usr/lib/postgresql/17/bin",
  "/usr/pgsql-17/bin",
  "/opt/homebrew/opt/postgresql@17/bin",
];

export function pg17BinDir(): string | null {
  for (const dir of PG17_BIN_CANDIDATES) {
    if (existsSync(path.join(dir, "initdb")) && existsSync(path.join(dir, "psql"))) {
      return dir;
    }
  }
  const which = spawnSync("which", ["initdb"], { encoding: "utf8" });
  if (which.status === 0) {
    const initdb = which.stdout.trim();
    const ver = spawnSync(initdb, ["--version"], { encoding: "utf8" });
    if ((ver.stdout || "").includes(" 17.")) {
      return path.dirname(initdb);
    }
  }
  return null;
}

export const PG17_AVAILABLE = pg17BinDir() !== null;

export interface Replica {
  exec: (sql: string) => string;
  execAs: (uid: string | null, sql: string) => string;
  jsonAs: <T>(uid: string | null, sql: string) => T;
  stop: () => void;
}

const BOOTSTRAP_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $$;

GRANT anon, authenticated, service_role TO CURRENT_USER;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $fn$
  SELECT NULLIF(current_setting('app.uid', true), '')::uuid
$fn$;

GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username varchar(255),
  total_xp integer DEFAULT 0,
  current_level integer DEFAULT 1,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_activity_date date,
  streak_freeze_tokens integer DEFAULT 0,
  active_boost jsonb,
  rest_days integer DEFAULT 0,
  auto_create_reading_tasks boolean DEFAULT true,
  theme_preference varchar(20) DEFAULT 'light',
  notes_count integer DEFAULT 0,
  papers_count integer DEFAULT 0,
  tasks_completed_count integer DEFAULT 0,
  papers_with_insights_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title varchar(255),
  markdown_body text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  abstract text,
  status varchar(50) DEFAULT 'To Read',
  key_insights text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  completed boolean NOT NULL DEFAULT false,
  priority varchar(20) NOT NULL DEFAULT 'medium',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.topic_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE CASCADE
);

CREATE TABLE public.feed_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.feed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id uuid
);

CREATE TABLE public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  xp_earned integer DEFAULT 0,
  streak_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE TABLE public.research_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_type varchar(50) NOT NULL,
  title text NOT NULL,
  description text,
  xp_awarded integer DEFAULT 0,
  earned_at timestamptz DEFAULT now()
);

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
CREATE TABLE public.api_key_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING ((select auth.uid()) = id);
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can view own notes"
  ON public.notes FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own notes"
  ON public.notes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can view own papers"
  ON public.papers FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own papers"
  ON public.papers FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can view own tasks"
  ON public.tasks FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own tasks"
  ON public.tasks FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can view own achievements"
  ON public.research_achievements FOR SELECT
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own achievements"
  ON public.research_achievements FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own achievements"
  ON public.research_achievements FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own achievements"
  ON public.research_achievements FOR DELETE
  USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
`;

export function startReplica(opts?: { through?: "1765700000" | "1765800000" }): Replica {
  const bin = pg17BinDir();
  if (!bin) {
    throw new Error("PostgreSQL 17 binaries not found");
  }
  const root = mkdtempSync(path.join(tmpdir(), "rq-pg17-"));
  const dataDir = path.join(root, "data");
  const sockDir = path.join(root, "sock");
  const logFile = path.join(root, "pg.log");
  const initdb = path.join(bin, "initdb");
  const pgCtl = path.join(bin, "pg_ctl");
  const psql = path.join(bin, "psql");

  execFileSync("mkdir", ["-p", sockDir]);
  execFileSync(initdb, [
    "-D",
    dataDir,
    "--auth-local=trust",
    "--auth-host=trust",
    "--no-sync",
    "--locale=C",
    "--encoding=UTF8",
  ]);

  execFileSync(pgCtl, [
    "-D",
    dataDir,
    "-l",
    logFile,
    "-o",
    `-k ${sockDir} -c listen_addresses='' -c unix_socket_directories=${sockDir}`,
    "start",
    "-w",
  ]);

  const psqlArgs = [
    "-h",
    sockDir,
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "--no-psqlrc",
    "-q",
  ];

  const exec = (sql: string): string => {
    try {
      return execFileSync(psql, [...psqlArgs, "-t", "-A", "-c", sql], {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      const err = error as { stderr?: string; stdout?: string; message?: string };
      const detail = `${err.stderr ?? ""}${err.stdout ?? ""}${err.message ?? ""}`;
      throw new Error(detail);
    }
  };

  const execFile = (file: string) => {
    execFileSync(psql, [...psqlArgs, "-f", file], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  };

  const bootstrapFile = path.join(root, "bootstrap.sql");
  writeFileSync(bootstrapFile, BOOTSTRAP_SQL);
  execFile(bootstrapFile);
  execFile(path.join(repoRoot, "supabase/migrations/1765700000_reconcile_unapplied_master_delta.sql"));
  if ((opts?.through ?? "1765800000") === "1765800000") {
    execFile(path.join(repoRoot, "supabase/migrations/1765800000_xp_integrity_hardening.sql"));
  }
  exec(`
    INSERT INTO auth.users (id) VALUES ('${USER_A}'), ('${USER_B}')
    ON CONFLICT (id) DO NOTHING;
  `);

  const execAs = (uid: string | null, sql: string): string => {
    const prelude =
      uid === null
        ? "RESET ROLE; SELECT set_config('app.uid', '', false); SET ROLE anon;"
        : `RESET ROLE; SELECT set_config('app.uid', '${uid}', false); SET ROLE authenticated;`;
    const body = sql.trim().endsWith(";") ? sql.trim() : `${sql.trim()};`;
    return exec(`${prelude}\n${body}\nRESET ROLE;`);
  };

  const jsonAs = <T>(uid: string | null, sql: string): T => {
    const raw = execAs(
      uid,
      `SELECT COALESCE((SELECT row_to_json(t) FROM (${sql}) AS t), 'null'::json)`,
    );
    const line = raw.trim().split("\n").filter(Boolean).at(-1) ?? "null";
    return JSON.parse(line) as T;
  };

  const stop = () => {
    try {
      execFileSync(pgCtl, ["-D", dataDir, "stop", "-m", "fast", "-w"]);
    } catch {
      /* cluster already gone */
    }
    rmSync(root, { recursive: true, force: true });
  };

  return { exec, execAs, jsonAs, stop };
}

export type AwardRow = {
  total_xp: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  notes_count: number;
  papers_count: number;
  tasks_completed_count: number;
  papers_with_insights_count: number;
  streak_freeze_tokens: number;
  xp_credited: number;
  is_duplicate: boolean;
};

export type AchievementRow = {
  total_xp: number;
  current_level: number;
  xp_credited: number;
  is_duplicate: boolean;
};

export function awardXp(
  replica: Replica,
  uid: string,
  delta: number,
  action: string,
  opts?: {
    key?: string | null;
    entityId?: string;
    localDay?: string | null;
    duration?: number | null;
  },
): AwardRow {
  const key = opts?.key === undefined ? "NULL" : opts.key === null ? "NULL" : `'${opts.key}'`;
  const entity = opts?.entityId ?? "";
  const day = opts?.localDay === undefined || opts.localDay === null ? "NULL" : `'${opts.localDay}'::date`;
  const dur = opts?.duration === undefined || opts.duration === null ? "NULL" : String(opts.duration);
  return replica.jsonAs<AwardRow>(
    uid,
    `SELECT * FROM public.award_xp('${uid}'::uuid, ${delta}, ${key}, '${action}', '${entity}', ${day}, ${dur})`,
  );
}

export function awardAchievement(
  replica: Replica,
  uid: string,
  type: string,
  xp = 500,
): AchievementRow {
  return replica.jsonAs<AchievementRow>(
    uid,
    `SELECT * FROM public.award_achievement_xp('${type}', ${xp}, 'x', 'y')`,
  );
}

export function resetUser(replica: Replica, uid: string): void {
  replica.exec(`
    DELETE FROM public.xp_events WHERE user_id = '${uid}';
    DELETE FROM public.daily_logs WHERE user_id = '${uid}';
    DELETE FROM public.notes WHERE user_id = '${uid}';
    DELETE FROM public.papers WHERE user_id = '${uid}';
    DELETE FROM public.tasks WHERE user_id = '${uid}';
    DELETE FROM public.research_achievements WHERE user_id = '${uid}';
    DELETE FROM public.user_profiles WHERE id = '${uid}';
    INSERT INTO public.user_profiles (id, total_xp, current_level, current_streak, longest_streak)
    VALUES ('${uid}', 0, 1, 0, 0)
    ON CONFLICT (id) DO UPDATE SET
      total_xp = 0, current_level = 1, current_streak = 0, longest_streak = 0,
      last_activity_date = NULL, streak_freeze_tokens = 0,
      notes_count = 0, papers_count = 0, tasks_completed_count = 0,
      papers_with_insights_count = 0;
  `);
  replica.exec(`
    DO $tz$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'user_profiles'
          AND column_name = 'streak_tz_lo_min'
      ) THEN
        EXECUTE format(
          'UPDATE public.user_profiles SET streak_tz_lo_min = NULL, streak_tz_hi_min = NULL WHERE id = %L',
          '${uid}'
        );
      END IF;
    END
    $tz$;
  `);
}

/** Inclusive YYYY-MM-DD plus N calendar days in UTC. */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * UTC instant for a local civil datetime at an east-positive UTC offset
 * in minutes. Example: 2026-06-10 22:00 at UTC+2 → 2026-06-10T20:00:00.000Z.
 */
export function utcIsoFromLocal(
  date: string,
  hour: number,
  offsetMin: number,
  minute = 0,
): string {
  const [year, month, day] = date.split("-").map(Number);
  const ms = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMin * 60 * 1000;
  return new Date(ms).toISOString();
}

export function setXpNow(replica: Replica, iso: string): void {
  const ts = new Date(iso).toISOString().replace("T", " ").replace("Z", "+00");
  replica.exec(`
    CREATE OR REPLACE FUNCTION public.xp_server_now()
    RETURNS timestamptz
    LANGUAGE sql
    STABLE
    SET search_path = ''
    AS $fn$ SELECT TIMESTAMPTZ '${ts}'; $fn$;
  `);
}

export function resetXpNow(replica: Replica): void {
  replica.exec(`
    CREATE OR REPLACE FUNCTION public.xp_server_now()
    RETURNS timestamptz
    LANGUAGE sql
    STABLE
    SET search_path = ''
    AS $fn$ SELECT clock_timestamp(); $fn$;
  `);
}
