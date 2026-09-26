#!/usr/bin/env node
/**
 * ALLOWED_ORIGINS format guard for edge-function CORS.
 *
 * Validates the server-side secret (Supabase Dashboard → Edge Functions →
 * Secrets) before deploy: comma-separated `scheme://host` entries, no paths,
 * no wildcards, no trailing slashes (those are stripped).
 *
 * Run: `pnpm run check:cors` (from researchquest/), with ALLOWED_ORIGINS
 * exported. Add `--strict` to fail when the secret is unset (CI).
 * Exit 0 on pass (loud console.warn when unset without --strict), 1 on
 * malformed entries or unset-with---strict.
 */
const FORMAT =
  'ALLOWED_ORIGINS="https://app.example.com,https://preview.example.com" ' +
  "(comma-separated scheme://host, no trailing slash, no wildcard, no paths)";

const strict = new Set(process.argv.slice(2)).has("--strict");
const raw = process.env.ALLOWED_ORIGINS ?? "";
const entries = raw
  .split(",")
  .map((part) => part.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const pattern = /^https?:\/\/[^/,\s]+$/;
const origins = entries.filter((entry) => pattern.test(entry));
const malformed = entries.filter((entry) => !pattern.test(entry));

if (malformed.length > 0) {
  console.error(
    `cors guard FAILED: ${malformed.length} malformed ALLOWED_ORIGINS ` +
      `entr${malformed.length === 1 ? "y" : "ies"} that will never match an ` +
      `Origin header: ${malformed.join(", ")}. Expected ${FORMAT}.`,
  );
  process.exit(1);
}

if (origins.length === 0) {
  const detail =
    "edge functions will fall back to the production app origins plus " +
      `localhost (see supabase/functions/api/_shared/cors.ts). Expected ${FORMAT}.`;
  if (strict) {
    console.error(`cors guard FAILED (strict): ALLOWED_ORIGINS is unset — ${detail}`);
    process.exit(1);
  }
  console.warn(`⚠️  cors guard: ALLOWED_ORIGINS is unset — ${detail}`);
  process.exit(0);
}

console.log(`cors guard OK: ALLOWED_ORIGINS=${origins.join(",")}`);
