const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

/** Live app hosts. Keep these in ALLOWED_ORIGINS; also used as a fallback so
 *  an unset secret does not break production browser calls. */
export const PRODUCTION_APP_ORIGINS = [
  "https://research-quest-wine.vercel.app",
  "https://rq.arudchayan.com",
];

/** Exact format: comma-separated `scheme://host` entries, no paths/wildcards. */
const ORIGIN_PATTERN = /^https?:\/\/[^/,\s]+$/;

export interface AllowedOriginsStatus {
  /** True when the secret holds at least one well-formed origin. */
  configured: boolean;
  origins: string[];
  /** Raw entries that will never match an Origin header (no scheme, path, …). */
  malformed: string[];
}

export function getAllowedOriginsStatus(
  raw: string | undefined = Deno.env.get("ALLOWED_ORIGINS"),
): AllowedOriginsStatus {
  const entries = (raw ?? "")
    .split(",")
    .map((part) => part.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const origins = entries.filter((entry) => ORIGIN_PATTERN.test(entry));
  const malformed = entries.filter((entry) => !ORIGIN_PATTERN.test(entry));
  return { configured: origins.length > 0, origins, malformed };
}

let allowedOriginsWarned = false;

/** Loud cold-start warning (once per isolate) when the secret is unset/malformed. */
function warnAllowedOriginsOnce(status: AllowedOriginsStatus): void {
  if (allowedOriginsWarned) return;
  allowedOriginsWarned = true;
  if (!status.configured) {
    console.warn(
      `[RQ] ALLOWED_ORIGINS is unset or has no well-formed origin — CORS falls back to ${[...PRODUCTION_APP_ORIGINS, ...DEV_ORIGINS].join(", ")}. ` +
        `Set ALLOWED_ORIGINS="https://app.example.com,https://other.example.com" (comma-separated scheme://host, no trailing slash, no wildcard) on the deployed functions.`,
    );
  } else if (status.malformed.length > 0) {
    console.warn(
      `[RQ] ALLOWED_ORIGINS has ${status.malformed.length} malformed entr${status.malformed.length === 1 ? "y" : "ies"} that will never match an Origin header: ${status.malformed.join(", ")}. ` +
        `Expected format: "https://app.example.com,https://other.example.com" (comma-separated scheme://host, no trailing slash, no wildcard).`,
    );
  }
}

export function getAllowedOrigins(): string[] {
  const status = getAllowedOriginsStatus();
  warnAllowedOriginsOnce(status);
  if (!status.configured) {
    return [...PRODUCTION_APP_ORIGINS, ...DEV_ORIGINS];
  }
  return status.origins;
}

/**
 * Fail-closed variant: throws a clear error when ALLOWED_ORIGINS is
 * unset/malformed instead of falling back. Opt-in — the request path keeps
 * the fallback above so existing deploys do not break (see getAllowedOrigins).
 */
export function requireAllowedOrigins(
  raw: string | undefined = Deno.env.get("ALLOWED_ORIGINS"),
): string[] {
  const status = getAllowedOriginsStatus(raw);
  if (!status.configured) {
    throw new Error(
      '[RQ] fail-closed: ALLOWED_ORIGINS is unset or has no well-formed origin. Set ALLOWED_ORIGINS="https://app.example.com,https://other.example.com" (comma-separated scheme://host, no trailing slash, no wildcard).',
    );
  }
  if (status.malformed.length > 0) {
    throw new Error(
      `[RQ] fail-closed: ALLOWED_ORIGINS has malformed entries that will never match an Origin header: ${status.malformed.join(", ")}. Expected format: "https://app.example.com,https://other.example.com".`,
    );
  }
  return status.origins;
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = getAllowedOrigins();
  const allowOrigin =
    origin && allowed.includes(origin) ? origin : allowed[0] ?? "http://localhost:5173";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "false",
    Vary: "Origin",
  };
}
