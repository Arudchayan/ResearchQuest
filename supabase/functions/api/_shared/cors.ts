// Reference list for local development. These origins are ONLY allowed when
// explicitly listed in the ALLOWED_ORIGINS env var — they are never used as a
// fallback. When ALLOWED_ORIGINS is unset/empty, no origin is allowed
// (fail closed so production never reflects a localhost origin to browsers).
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

export { DEV_ORIGINS };

export function getAllowedOrigins(): string[] {
  const fromEnv = Deno.env.get("ALLOWED_ORIGINS");
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return [];
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = getAllowedOrigins();

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-request-id",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "false",
    Vary: "Origin",
  };
  // Omit Access-Control-Allow-Origin unless the request origin is explicitly
  // allowed. Never fall back to a localhost/dev origin: reflecting a default
  // origin would look like a working CORS policy while trusting the wrong
  // origin in production.
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
