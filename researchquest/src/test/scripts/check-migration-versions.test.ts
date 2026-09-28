/**
 * @vitest-environment node
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MIGRATIONS_DIR,
  RESERVED_VERSION_MAX,
  RESERVED_VERSION_MIN,
  checkMigrationVersions,
  formatReport,
  nextSafeVersion,
  parseGitLsTreeNames,
  parseVersionPrefix,
  readMigrationFilenames,
  runCheck,
} from "../../../scripts/check-migration-versions.mjs";

const MASTER_TREE = [
  "1762555347_enable_rls_and_policies.sql",
  "1764700000_feeds.sql",
  "1764800000_security_perf_hardening.sql",
  "1764801000_round2_security_hardening.sql",
  "1764802000_update_with_check_hardening.sql",
  "1764900000_api_keys_rls_intent.sql",
  "1765000000_harden_rpc_security_definer.sql",
  "1765300000_batch3_checks_realtime_triggers.sql",
];

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function fixtureDir(filenames: readonly string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), "rq-migration-versions-"));
  tempDirs.push(dir);
  for (const name of filenames) {
    writeFileSync(path.join(dir, name), "-- fixture\n");
  }
  return dir;
}

describe("parseVersionPrefix", () => {
  it("reads the leading timestamp from a migration filename", () => {
    expect(parseVersionPrefix("1764802000_increment_xp.sql")).toBe(1764802000);
    expect(
      parseVersionPrefix("supabase/migrations/1764900000_paper_topics_authority.sql"),
    ).toBe(1764900000);
  });

  it("returns null when the filename has no version prefix", () => {
    expect(parseVersionPrefix("README.md")).toBeNull();
    expect(parseVersionPrefix("hotfix.sql")).toBeNull();
  });
});

describe("nextSafeVersion", () => {
  it("is reserved-max + 1 when that is the ceiling", () => {
    expect(nextSafeVersion([1764802000, 1764900000])).toBe(
      RESERVED_VERSION_MAX + 1,
    );
  });

  it("is highest + 1 when master is already past the reserved range", () => {
    expect(nextSafeVersion([1765300000])).toBe(1765300001);
  });
});

describe("checkMigrationVersions", () => {
  it("fails a duplicate 1764802000 pair (PRs #760 and #756)", () => {
    const result = checkMigrationVersions({
      currentFiles: [
        "1764802000_add_task_paper_link.sql",
        "1764802000_increment_xp.sql",
      ],
      baseFiles: ["1764700000_feeds.sql"],
    });

    expect(result.ok).toBe(false);
    const report = formatReport(result);
    expect(report).toContain("Duplicate migration version 1764802000");
    expect(report).toContain("1764802000_add_task_paper_link.sql");
    expect(report).toContain("1764802000_increment_xp.sql");
    expect(report).toContain(`Use version ${result.nextSafeVersion} or higher`);
    expect(result.nextSafeVersion).toBe(RESERVED_VERSION_MAX + 1);
  });

  it("fails a new 1764900000 file (PR #762 reserved range)", () => {
    const result = checkMigrationVersions({
      currentFiles: [
        "1764700000_feeds.sql",
        "1764900000_paper_topics_authority.sql",
      ],
      baseFiles: ["1764700000_feeds.sql"],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("reserved version 1764900000"))).toBe(
      true,
    );
    expect(formatReport(result)).toContain("1764900000_paper_topics_authority.sql");
    expect(formatReport(result)).toContain(
      `${RESERVED_VERSION_MIN}–${RESERVED_VERSION_MAX}`,
    );
    expect(result.nextSafeVersion).toBe(RESERVED_VERSION_MAX + 1);
  });

  it("fails a new file whose version is <= the highest version on master", () => {
    const result = checkMigrationVersions({
      currentFiles: [
        "1765300000_batch3_checks_realtime_triggers.sql",
        "1764000000_too_early.sql",
      ],
      baseFiles: ["1765300000_batch3_checks_realtime_triggers.sql"],
    });

    expect(result.ok).toBe(false);
    const report = formatReport(result);
    expect(report).toContain("1764000000_too_early.sql");
    expect(report).toContain("out of order");
    expect(report).toContain("1765300000");
    expect(report).toContain("1765300000_batch3_checks_realtime_triggers.sql");
    expect(report).not.toContain("reserved version");
    expect(result.nextSafeVersion).toBe(1765300001);
  });

  it("fails when a new file reuses master's highest version with a different name", () => {
    const result = checkMigrationVersions({
      currentFiles: ["1765300000_another_batch.sql"],
      baseFiles: ["1765300000_batch3_checks_realtime_triggers.sql"],
    });

    expect(result.ok).toBe(false);
    expect(formatReport(result)).toContain("out of order");
    expect(result.nextSafeVersion).toBe(1765300001);
  });

  it("passes the current master tree (including existing reserved-range files)", () => {
    const result = checkMigrationVersions({
      currentFiles: MASTER_TREE,
      baseFiles: MASTER_TREE,
    });

    expect(result.ok).toBe(true);
    expect(result.newFiles).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(formatReport(result)).toMatch(/migration-version guard OK/);
  });

  it("passes a correctly numbered new migration after the highest master version", () => {
    const result = checkMigrationVersions({
      currentFiles: [...MASTER_TREE, "1765400000_next_change.sql"],
      baseFiles: MASTER_TREE,
    });

    expect(result.ok).toBe(true);
    expect(result.newFiles).toEqual(["1765400000_next_change.sql"]);
    expect(result.nextSafeVersion).toBe(1765400001);
  });

  it("does not flag reserved-range files that already exist on master", () => {
    const result = checkMigrationVersions({
      currentFiles: [
        "1764800000_security_perf_hardening.sql",
        "1764900000_api_keys_rls_intent.sql",
        "1765000000_harden_rpc_security_definer.sql",
        "1765300000_batch3_checks_realtime_triggers.sql",
      ],
      baseFiles: [
        "1764800000_security_perf_hardening.sql",
        "1764900000_api_keys_rls_intent.sql",
        "1765000000_harden_rpc_security_definer.sql",
        "1765300000_batch3_checks_realtime_triggers.sql",
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.errors.join("\n")).not.toContain("reserved");
  });

  it("flags reserved-range endpoints for NEW files only", () => {
    const minHit = checkMigrationVersions({
      currentFiles: ["1764800000_brand_new.sql"],
      baseFiles: ["1764700000_feeds.sql"],
    });
    const maxHit = checkMigrationVersions({
      currentFiles: ["1765000000_brand_new.sql"],
      baseFiles: ["1764700000_feeds.sql"],
    });

    expect(minHit.ok).toBe(false);
    expect(maxHit.ok).toBe(false);
    expect(minHit.errors.join("\n")).toContain("reserved version 1764800000");
    expect(maxHit.errors.join("\n")).toContain("reserved version 1765000000");
  });
});

describe("runCheck against fixture directories", () => {
  it("reads a fixture dir and fails the #760/#756 duplicate pair", () => {
    const dir = fixtureDir([
      "1764802000_add_task_paper_link.sql",
      "1764802000_increment_xp.sql",
    ]);
    const result = runCheck({
      migrationsDir: dir,
      repoRoot: dir,
      env: {},
      listBase: () => ["1764700000_feeds.sql"],
    });

    expect(result.ok).toBe(false);
    expect(result.text).toContain("1764802000_add_task_paper_link.sql");
    expect(result.text).toContain("1764802000_increment_xp.sql");
    expect(result.text).toContain("Next safe version:");
  });

  it("passes a fixture dir that only adds a correctly numbered file", () => {
    const dir = fixtureDir([...MASTER_TREE, "1765400000_next_change.sql"]);
    const result = runCheck({
      migrationsDir: dir,
      repoRoot: dir,
      env: { MIGRATION_VERSION_BASE: "origin/master" },
      listBase: (_repo, ref) => {
        expect(ref).toBe("origin/master");
        return [...MASTER_TREE];
      },
    });

    expect(result.ok).toBe(true);
    expect(result.newFiles).toEqual(["1765400000_next_change.sql"]);
  });

  it("fails CI-style when the explicit base ref cannot be listed", () => {
    const dir = fixtureDir(["1765400000_next_change.sql"]);
    const result = runCheck({
      migrationsDir: dir,
      repoRoot: dir,
      env: { MIGRATION_VERSION_BASE: "deadbeef" },
      listBase: () => null,
    });

    expect(result.ok).toBe(false);
    expect(result.baseUnavailable).toBe(true);
    expect(result.text).toContain("Failed to list supabase/migrations at deadbeef");
  });
});

describe("live supabase/migrations tree", () => {
  it("passes on the current checkout when compared with itself (master-shaped tree)", () => {
    const files = readMigrationFilenames(DEFAULT_MIGRATIONS_DIR);
    expect(files.length).toBeGreaterThan(0);
    const result = checkMigrationVersions({
      currentFiles: files,
      baseFiles: files,
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("git ls-tree parsing", () => {
  it("accepts both bare names and tree-relative paths", () => {
    expect(
      parseGitLsTreeNames(
        "1764802000_increment_xp.sql\nsupabase/migrations/1764900000_paper_topics_authority.sql\n",
      ),
    ).toEqual([
      "1764802000_increment_xp.sql",
      "1764900000_paper_topics_authority.sql",
    ]);
  });
});

describe("repo root resolution", () => {
  it("points DEFAULT_MIGRATIONS_DIR at the real migrations folder", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const expected = path.resolve(here, "../../../../supabase/migrations");
    expect(DEFAULT_MIGRATIONS_DIR).toBe(expected);
  });
});
