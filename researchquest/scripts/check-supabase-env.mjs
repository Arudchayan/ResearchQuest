#!/usr/bin/env node
/**
 * Supabase env fail-fast guard (PR9 item 3).
 *
 * Asserts VITE_SUPABASE_URL shape before CI spends time on install/build:
 *  - rejects empty / unset values (unless an explicit no-backend mode is
 *    declared via PLAYWRIGHT_TEST_NO_SUPABASE=1 or VITE_DEMO_MODE=1)
 *  - rejects the `.env.example` placeholder value (and obvious placeholders)
 *  - otherwise requires an https://<project>.supabase.co shaped URL
 *    (http://127.0.0.1 / localhost allowed for local dev)
 *
 * The `.env.example` placeholder is read from researchquest/.env.example so
 * the guard tracks the documented placeholder instead of hard-coding drift.
 *
 * Run: `pnpm run check:supabase-env` (from researchquest/)
 * Exit 0 on pass, 1 with a diagnostic on failure.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");

const NO_BACKEND =
  process.env.PLAYWRIGHT_TEST_NO_SUPABASE === "1" ||
  process.env.VITE_DEMO_MODE === "1";

const url =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";

function examplePlaceholder() {
  try {
    const text = readFileSync(path.join(appDir, ".env.example"), "utf8");
    const m = text.match(/^\s*VITE_SUPABASE_URL\s*=\s*(.+?)\s*$/m);
    return (m?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

function fail(msg) {
  console.error(`supabase-env guard FAILED: ${msg}`);
  process.exit(1);
}

if (!url) {
  if (NO_BACKEND) {
    console.log(
      "supabase-env guard OK: no URL, but an explicit no-backend mode is declared.",
    );
    process.exit(0);
  }
  fail(
    "VITE_SUPABASE_URL is empty. Set it (or NEXT_PUBLIC_SUPABASE_URL), or declare " +
      "no-backend mode with PLAYWRIGHT_TEST_NO_SUPABASE=1 / VITE_DEMO_MODE=1.",
  );
}

const placeholder = examplePlaceholder();
const lowered = url.toLowerCase();
if (
  (placeholder && url === placeholder) ||
  lowered.includes("your-project") ||
  lowered.includes("changeme") ||
  lowered.includes("placeholder") ||
  lowered.includes("<") ||
  lowered.includes("your-anon-key")
) {
  fail(
    `VITE_SUPABASE_URL looks like a placeholder ("${url}"). ` +
      "Copy .env.example to .env and fill in a real project URL.",
  );
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  fail(`VITE_SUPABASE_URL is not a valid URL ("${url}").`);
}
const host = parsed.hostname.toLowerCase();
const shaped =
  (parsed.protocol === "https:" && host.endsWith(".supabase.co")) ||
  host === "127.0.0.1" ||
  host === "localhost";
if (!shaped) {
  fail(
    `VITE_SUPABASE_URL has an unexpected shape ("${url}"). ` +
      "Expected https://<project>.supabase.co (http localhost allowed for dev).",
  );
}

console.log("supabase-env guard OK: VITE_SUPABASE_URL shape is valid.");
