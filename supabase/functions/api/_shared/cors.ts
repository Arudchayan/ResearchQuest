const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

/**
 * Returns the configured CORS allowlist, or `null` when ALLOWED_ORIGINS is
 * unset so callers can preserve open CORS (same posture as deep-research /
 * fetch-paper) until production origins are configured.
 */
export function getAllowedOrigins(): string[] | null {
  const fromEnv = Deno.env.get("ALLOWED_ORIGINS");
  if (!fromEnv || !fromEnv.trim()) {
    return null;
  }
  return fromEnv
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "false",
    Vary: "Origin",
  };

  const origin = req.headers.get("Origin");
  const allowed = getAllowedOrigins();

  if (allowed === null) {
    // Unset → open CORS so deployed production apps are not blocked until
    // ALLOWED_ORIGINS is configured.
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }

  const allowlist = allowed.length > 0 ? allowed : DEV_ORIGINS;
  if (origin && allowlist.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}
