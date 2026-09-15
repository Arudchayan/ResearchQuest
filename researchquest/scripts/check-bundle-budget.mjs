#!/usr/bin/env node
/**
 * Bundle-size budget gate (PR9 item 14).
 *
 * Sums gzipped bytes of `dist/assets/*.js` after `pnpm run build` and fails
 * when the total exceeds BUDGET_BYTES.
 *
 * Baseline (measured, not claimed): 661,651 gz bytes on base 997625b3.
 * Budget: 770,000 gz bytes (~16% headroom over measured).
 * NOTE: the README "~80KB gzipped for main app" line describes the initial
 * route chunk (CodeMirror excluded, on-demand); this gate instead tracks the
 * whole-JS total to catch regressions anywhere. Leave the README as is.
 *
 * Run: `pnpm run build && pnpm run check:bundle-budget` (from researchquest/)
 * Exit 0 under budget, 1 over budget (or when dist is missing).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(here, "..", "dist", "assets");

// Measured 661,651 gz bytes total JS; budget = measured + ~16% headroom.
const BUDGET_BYTES = 770_000;

let distStat;
try {
  distStat = statSync(assetsDir);
} catch {
  distStat = null;
}
if (!distStat?.isDirectory()) {
  console.error(
    `bundle-budget gate FAILED: ${assetsDir} missing — run "pnpm run build" first.`,
  );
  process.exit(1);
}

const files = readdirSync(assetsDir).filter((f) => f.endsWith(".js"));
if (files.length === 0) {
  console.error("bundle-budget gate FAILED: no .js bundles in dist/assets.");
  process.exit(1);
}

let total = 0;
const rows = files.map((f) => {
  const raw = readFileSync(path.join(assetsDir, f));
  const gz = gzipSync(raw).length;
  total += gz;
  return { f, raw: raw.length, gz };
});
rows.sort((a, b) => b.gz - a.gz);
for (const { f, gz } of rows.slice(0, 5)) {
  console.log(`  top chunk: ${f} ${(gz / 1024).toFixed(1)} KB gz`);
}
console.log(
  `bundle total: ${files.length} JS files, ${(total / 1024).toFixed(1)} KB gz ` +
    `(budget ${(BUDGET_BYTES / 1024).toFixed(1)} KB gz)`,
);

if (total > BUDGET_BYTES) {
  console.error(
    `bundle-budget gate FAILED: ${total} gz bytes exceeds budget ${BUDGET_BYTES}. ` +
      "Split chunks, lazy-load, or raise the budget with a measured justification.",
  );
  process.exit(1);
}

console.log("bundle-budget gate OK: under budget.");
