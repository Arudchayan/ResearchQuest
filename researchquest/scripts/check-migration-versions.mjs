#!/usr/bin/env node
/**
 * Supabase migration version guard.
 *
 * Fails when:
 *  1. Two files in supabase/migrations share the same numeric version prefix
 *     (the PR #760 / #756 1764802000 collision).
 *  2. A file added vs master (filename not on the base ref) has a version
 *     <= the highest version already on master (out of order).
 *  3. A NEW file uses a version in the reserved range 1764800000–1765000000
 *     inclusive (the PR #762 1764900000 case). Files already on master in
 *     that range are allowed.
 *
 * No network and no Supabase access. Git is used only to list files at the
 * base ref (local).
 *
 * Run: `pnpm run check:migration-versions` (from researchquest/)
 * Exit 0 on pass, 1 with a diagnostic list on failure.
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RESERVED_VERSION_MIN = 1764800000;
export const RESERVED_VERSION_MAX = 1765000000;
export const VERSION_PREFIX_RE = /^(\d+)_/;
export const ZERO_SHA = "0000000000000000000000000000000000000000";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = path.resolve(here, "..", "..");
export const DEFAULT_MIGRATIONS_DIR = path.join(
  DEFAULT_REPO_ROOT,
  "supabase",
  "migrations",
);

/**
 * @param {string} filename
 * @returns {number | null}
 */
export function parseVersionPrefix(filename) {
  const base = path.basename(filename);
  const match = VERSION_PREFIX_RE.exec(base);
  if (!match) return null;
  const version = Number(match[1]);
  return Number.isSafeInteger(version) ? version : null;
}

/**
 * Next version that is strictly above every seen version and outside the
 * reserved collision range.
 *
 * @param {Iterable<number>} versions
 */
export function nextSafeVersion(versions) {
  let maxSeen = 0;
  for (const version of versions) {
    if (version > maxSeen) maxSeen = version;
  }
  return Math.max(maxSeen, RESERVED_VERSION_MAX) + 1;
}

/**
 * @param {string} filename
 */
function basenameSql(filename) {
  return path.basename(filename);
}

/**
 * @param {object} input
 * @param {readonly string[]} input.currentFiles
 * @param {readonly string[]} [input.baseFiles]
 * @returns {{
 *   ok: boolean,
 *   errors: string[],
 *   nextSafeVersion: number,
 *   highestOnMaster: number | null,
 *   highestOnMasterFile: string | null,
 *   newFiles: string[],
 * }}
 */
export function checkMigrationVersions({ currentFiles, baseFiles = [] }) {
  const currentNames = currentFiles.map(basenameSql);
  const baseNames = baseFiles.map(basenameSql);
  const baseSet = new Set(baseNames);

  const currentParsed = currentNames.map((name) => ({
    name,
    version: parseVersionPrefix(name),
  }));
  const baseParsed = baseNames.map((name) => ({
    name,
    version: parseVersionPrefix(name),
  }));

  /** @type {string[]} */
  const errors = [];

  for (const file of currentParsed) {
    if (file.version === null) {
      errors.push(
        `Cannot parse version prefix from ${file.name}. Expected <timestamp>_<name>.sql.`,
      );
    }
  }

  const currentWithVersion = currentParsed.filter(
    (file) => file.version !== null,
  );
  const baseWithVersion = baseParsed.filter((file) => file.version !== null);

  /** @type {Map<number, string[]>} */
  const byVersion = new Map();
  for (const file of currentWithVersion) {
    const names = byVersion.get(file.version) ?? [];
    names.push(file.name);
    byVersion.set(file.version, names);
  }

  const allVersions = [
    ...currentWithVersion.map((file) => file.version),
    ...baseWithVersion.map((file) => file.version),
  ];
  const suggested = nextSafeVersion(allVersions);

  for (const [version, names] of [...byVersion.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    if (names.length > 1) {
      const listed = names.map((name) => `    - ${name}`).join("\n");
      errors.push(
        `Duplicate migration version ${version}:\n${listed}\n  Use version ${suggested} or higher.`,
      );
    }
  }

  let highestOnMaster = null;
  let highestOnMasterFile = null;
  for (const file of baseWithVersion) {
    if (highestOnMaster === null || file.version > highestOnMaster) {
      highestOnMaster = file.version;
      highestOnMasterFile = file.name;
    }
  }

  const newFiles = currentWithVersion.filter((file) => !baseSet.has(file.name));

  for (const file of newFiles) {
    if (highestOnMaster !== null && file.version <= highestOnMaster) {
      errors.push(
        `New migration ${file.name} is out of order: version ${file.version} is <= the highest version already on master (${highestOnMaster} in ${highestOnMasterFile}). Use version ${suggested} or higher.`,
      );
    }
    if (
      file.version >= RESERVED_VERSION_MIN &&
      file.version <= RESERVED_VERSION_MAX
    ) {
      errors.push(
        `New migration ${file.name} uses reserved version ${file.version} (reserved range ${RESERVED_VERSION_MIN}–${RESERVED_VERSION_MAX} inclusive, collision band from PRs such as #756/#760/#762). Existing master files in this range are allowed; new files are not. Use version ${suggested} or higher.`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    nextSafeVersion: suggested,
    highestOnMaster,
    highestOnMasterFile,
    newFiles: newFiles.map((file) => file.name),
  };
}

/**
 * @param {ReturnType<typeof checkMigrationVersions>} result
 */
export function formatReport(result) {
  if (result.ok) {
    const newCount = result.newFiles.length;
    return (
      `migration-version guard OK: no duplicate prefixes; ` +
      `${newCount} new file(s) vs master; next safe version is ${result.nextSafeVersion}.`
    );
  }
  const header = `migration-version guard FAILED (${result.errors.length} problem(s)):`;
  const body = result.errors.map((error) => `  - ${error}`).join("\n");
  const footer = `\nNext safe version: ${result.nextSafeVersion} (strictly higher than every existing version and outside reserved range ${RESERVED_VERSION_MIN}–${RESERVED_VERSION_MAX}).`;
  return `${header}\n${body}${footer}`;
}

/**
 * @param {string} stdout
 * @returns {string[]}
 */
export function parseGitLsTreeNames(stdout) {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".sql"))
    .map((line) => path.basename(line));
}

/**
 * @param {string} repoRoot
 * @param {string} ref
 * @returns {string[] | null}
 */
export function listMigrationsAtGitRef(repoRoot, ref) {
  try {
    execFileSync("git", ["rev-parse", "--verify", `${ref}^{commit}`], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
  try {
    const stdout = execFileSync(
      "git",
      ["ls-tree", "--name-only", `${ref}:supabase/migrations`],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return parseGitLsTreeNames(stdout);
  } catch {
    // Ref exists but supabase/migrations does not in that tree.
    return [];
  }
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | null}
 */
export function resolveBaseRefFromEnv(env = process.env) {
  const explicit = (env.MIGRATION_VERSION_BASE ?? "").trim();
  if (explicit && explicit !== ZERO_SHA) return explicit;
  return null;
}

/**
 * @param {string} repoRoot
 * @returns {string | null}
 */
export function resolveDefaultGitBase(repoRoot) {
  for (const ref of ["origin/master", "origin/main", "master", "main"]) {
    try {
      execFileSync("git", ["rev-parse", "--verify", ref], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return ref;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
export function readMigrationFilenames(dir) {
  return readdirSync(dir).filter((name) => name.endsWith(".sql"));
}

/**
 * @param {object} [options]
 * @param {string} [options.migrationsDir]
 * @param {string} [options.repoRoot]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {(repoRoot: string, ref: string) => string[] | null} [options.listBase]
 * @returns {ReturnType<typeof checkMigrationVersions> & {
 *   text: string,
 *   baseRef: string | null,
 *   baseUnavailable: boolean,
 * }}
 */
export function runCheck(options = {}) {
  const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
  const migrationsDir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
  const env = options.env ?? process.env;
  const listBase = options.listBase ?? listMigrationsAtGitRef;

  const currentFiles = readMigrationFilenames(migrationsDir);
  const explicitBase = resolveBaseRefFromEnv(env);
  const baseRef = explicitBase ?? resolveDefaultGitBase(repoRoot);

  let baseFiles = currentFiles;
  let baseUnavailable = false;

  if (baseRef) {
    const listed = listBase(repoRoot, baseRef);
    if (listed === null) {
      if (explicitBase) {
        const result = {
          ok: false,
          errors: [
            `Failed to list supabase/migrations at ${baseRef}. Fetch the base ref (git fetch origin master) and retry, or unset MIGRATION_VERSION_BASE.`,
          ],
          nextSafeVersion: nextSafeVersion(
            currentFiles
              .map(parseVersionPrefix)
              .filter((version) => version !== null),
          ),
          highestOnMaster: null,
          highestOnMasterFile: null,
          newFiles: [],
        };
        return {
          ...result,
          text: formatReport(result),
          baseRef,
          baseUnavailable: true,
        };
      }
      baseUnavailable = true;
      baseFiles = currentFiles;
    } else {
      baseFiles = listed;
    }
  } else {
    baseUnavailable = true;
    baseFiles = currentFiles;
  }

  const result = checkMigrationVersions({ currentFiles, baseFiles });
  let text = formatReport(result);
  if (baseUnavailable && result.ok) {
    text +=
      " (no git base ref; skipped new-file order/reserved checks, duplicate check only)";
  }
  return { ...result, text, baseRef: baseRef ?? null, baseUnavailable };
}

function isExecutedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isExecutedDirectly()) {
  const result = runCheck();
  if (result.ok) {
    console.log(result.text);
    process.exit(0);
  }
  console.error(result.text);
  process.exit(1);
}
