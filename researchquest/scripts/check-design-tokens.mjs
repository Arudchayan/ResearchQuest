#!/usr/bin/env node
/**
 * Design-token grep gate (PR9 item 20).
 *
 * Fails on undefined design tokens in `researchquest/src`:
 *   accent | brand-gradient | shadow-card | shadow-lift | coral-soft | gold-soft
 *
 * None of these exist in tailwind.config.js (colors/boxShadow) or src CSS, so
 * Tailwind silently generates no CSS for classes built from them. Findings are
 * suppressed only via `design-tokens.allowlist.txt` (same directory), whose
 * entries have the form:
 *
 *   <relative/path :: trimmed offending line>
 *
 * LEGIT entries cover valid Tailwind utilities the naive pattern also
 * matches (e.g. `accent-primary-500` = accent-color, `outline-focus` =
 * outline-color — both reference defined theme colors). All other entries are
 * grandfathered pre-existing violations (ratchet): remove an entry only by
 * fixing the source to a defined token. Any NEW match fails CI.
 *
 * Run: `pnpm run check:design-tokens` (from researchquest/)
 * Exit 0 on pass, 1 listing non-allow-listed findings.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");
const srcDir = path.join(appDir, "src");
const allowlistFile = path.join(here, "design-tokens.allowlist.txt");

const PATTERN = /accent|brand-gradient|shadow-card|shadow-lift|coral-soft|gold-soft/;
const SCAN_EXT = new Set([".ts", ".tsx", ".css"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out = walk(full, out);
    else if (SCAN_EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

function loadAllowlist() {
  let text = "";
  try {
    text = readFileSync(allowlistFile, "utf8");
  } catch {
    return new Set();
  }
  const entries = new Set();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    entries.add(line.replace(/\\/g, "/"));
  }
  return entries;
}

const allowlist = loadAllowlist();
const failures = [];

for (const full of walk(srcDir)) {
  const rel = path.relative(appDir, full).replace(/\\/g, "/");
  const text = readFileSync(full, "utf8");
  text.split("\n").forEach((rawLine, idx) => {
    if (!PATTERN.test(rawLine)) return;
    const key = `${rel} :: ${rawLine.trim()}`;
    if (!allowlist.has(key)) {
      failures.push(`${rel}:${idx + 1}:${rawLine.trim()}`);
    }
  });
}

if (failures.length > 0) {
  console.error(
    `design-token gate FAILED (${failures.length} non-allow-listed match(es)):\n` +
      failures.map((f) => `  - ${f}`).join("\n") +
      `\nFix the source to use defined tokens, or (LEGIT matches only) extend design-tokens.allowlist.txt.`,
  );
  process.exit(1);
}

console.log("design-token gate OK: no non-allow-listed undefined tokens in researchquest/src.");
