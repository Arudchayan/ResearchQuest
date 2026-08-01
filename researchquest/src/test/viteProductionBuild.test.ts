import { execFile } from "node:child_process";
import { readdir, readFile, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const viteEntry = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const sourceIdentifierMarkers = /data-(?:matrix|component)-/;

async function buildJavaScriptAssets(mode: string): Promise<readonly string[]> {
  const outputDirectory = await mkdtemp(
    path.join(tmpdir(), "researchquest-vite-"),
  );

  try {
    await execFileAsync(
      process.execPath,
      [viteEntry, "build", "--mode", mode, "--outDir", outputDirectory],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          PLAYWRIGHT_TEST_NO_SUPABASE: "1",
        },
      },
    );

    const assetsDirectory = path.join(outputDirectory, "assets");
    const entries = await readdir(assetsDirectory, { withFileTypes: true });
    const javascriptEntries = entries.filter(
      (entry) => entry.isFile() && entry.name.endsWith(".js"),
    );

    return Promise.all(
      javascriptEntries.map((entry) =>
        readFile(path.join(assetsDirectory, entry.name), "utf8"),
      ),
    );
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
}

describe("Vite production builds", () => {
  it.each(["production", "prod"])(
    "omit development source markers in %s mode",
    async (mode) => {
      const assets = await buildJavaScriptAssets(mode);

      expect(assets.some((asset) => sourceIdentifierMarkers.test(asset))).toBe(
        false,
      );
    },
    120_000,
  );
});
