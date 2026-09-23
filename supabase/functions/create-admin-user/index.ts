// create-admin-user — retired. Production is a hard 410 Gone stub with
// platform JWT verification on. Do not restore Admin API user-creation here
// without a dedicated review. Create users from the Supabase Dashboard / CLI.

const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const PRODUCTION_APP_ORIGINS = [
  "https://research-quest-wine.vercel.app",
  "https://rq.arudchayan.com",
];

function getAllowedOrigins(): string[] {
  const fromEnv = Deno.env.get("ALLOWED_ORIGINS");
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
  }
  return [...PRODUCTION_APP_ORIGINS, ...DEV_ORIGINS];
}

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = getAllowedOrigins();
  const allowOrigin = origin && allowed.includes(origin)
    ? origin
    : allowed[0] ?? "http://localhost:5173";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-application-name, x-request-id, x-user-agent",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "false",
    Vary: "Origin",
  };
}

Deno.serve((req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  return new Response(
    JSON.stringify({
      error: {
        code: "GONE",
        message:
          "create-admin-user has been retired. Create users from the Supabase Dashboard or CLI.",
      },
    }),
    {
      status: 410,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
});
