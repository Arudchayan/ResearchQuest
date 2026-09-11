// create-admin-user — privileged bootstrap tool.
//
// UNDEPLOYED BY DEFAULT: do NOT include this function in default deploy-all
// scripts or CI deploy jobs. Prefer the Supabase Dashboard / CLI for user
// creation in normal setups. Deploy it temporarily only when bootstrapping,
// behind a strong ADMIN_API_KEY, then remove it again. See README.md.
const FETCH_TIMEOUT_MS = 10000; // 10 seconds timeout
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_KEY = "create-admin-user:global";

interface RateLimitBucket {
  timestamps: number[];
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

// Inline CORS helper (intentionally self-contained: this bootstrap function
// must not import ../api/_shared/cors.ts so it can be deployed — or excluded
// from deploys — independently of the api gateway).
const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function getAllowedOrigins(): string[] {
  const fromEnv = Deno.env.get("ALLOWED_ORIGINS");
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return DEV_ORIGINS;
}

// Startup guard: ADMIN_API_KEY must be long and non-trivial. Checked once at
// module load (fail-closed visibility in logs) and re-checked per request so
// key rotation without a redeploy stays fail-closed too.
const ADMIN_API_KEY_MIN_LENGTH = 32;

function hasAdminKeyEntropy(key: string): boolean {
  const trimmed = key.trim();
  if (trimmed.length < ADMIN_API_KEY_MIN_LENGTH) return false;
  if (new Set(trimmed).size < 16) return false;
  const lower = trimmed.toLowerCase();
  const weakSubstrings = [
    "test",
    "password",
    "changeme",
    "example",
    "placeholder",
    "admin123",
    "123456",
  ];
  if (weakSubstrings.some((s) => lower.includes(s))) return false;
  return true;
}

function getConfiguredAdminApiKey(): string | null {
  const raw = Deno.env.get("ADMIN_API_KEY")?.trim();
  if (!raw || !hasAdminKeyEntropy(raw)) return null;
  return raw;
}

const adminApiKeyAtStartup = getConfiguredAdminApiKey();
if (!adminApiKeyAtStartup) {
  console.error(
    `create-admin-user misconfigured: ADMIN_API_KEY must be at least ${ADMIN_API_KEY_MIN_LENGTH} chars with sufficient entropy. Requests will fail closed with CONFIG_ERROR until fixed.`,
  );
}

// Role whitelist: reject arbitrary role values instead of storing free text.
const ALLOWED_ROLES = ["authenticated"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

function isAllowedRole(value: unknown): value is AllowedRole {
  return (
    typeof value === "string" &&
    (ALLOWED_ROLES as readonly string[]).includes(value)
  );
}

// This bootstrap function should remain undeployed or explicitly restricted in production.
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
    "Vary": "Origin",
  };
}

function checkRateLimit(): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const bucket = rateLimitBuckets.get(RATE_LIMIT_KEY) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((timestamp) =>
    timestamp > windowStart
  );
  if (bucket.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(RATE_LIMIT_KEY, bucket);
    return false;
  }
  bucket.timestamps.push(now);
  rateLimitBuckets.set(RATE_LIMIT_KEY, bucket);
  return true;
}

// Sentinel: Constant-time string comparison to prevent timing attacks
function secureCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let mismatch = a.length === b.length ? 0 : 1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }
  return mismatch === 0;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = FETCH_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Allow": "POST, OPTIONS",
        },
        status: 405,
      },
    );
  }

  if (!checkRateLimit()) {
    return new Response(
      JSON.stringify({
        error: { code: "RATE_LIMITED", message: "Too many requests" },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
        status: 429,
      },
    );
  }

  try {
    // Get parameters from request body
    // Ensure caller is authorized using a secret key.
    // Fail closed when the server key itself is missing or too weak.
    const authHeader = req.headers.get("Authorization");
    const expectedApiKey = getConfiguredAdminApiKey();

    if (!expectedApiKey) {
      console.error(
        "create-admin-user misconfigured: missing or weak ADMIN_API_KEY",
      );
      return new Response(
        JSON.stringify({
          error: {
            code: "CONFIG_ERROR",
            message: "Server misconfigured",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    if (
      !authHeader ||
      !secureCompare(authHeader, `Bearer ${expectedApiKey}`)
    ) {
      return new Response(
        JSON.stringify({
          error: { code: "UNAUTHORIZED", message: "Unauthorized request" },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    const requestBody = await req.json();
    const { email, password, role = "authenticated" } = requestBody;

    if (!email || !password) {
      return new Response(
        JSON.stringify({
          error: {
            code: "MISSING_PARAMS",
            message: "Email and password are required",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    if (!isAllowedRole(role)) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_ROLE",
            message: `Role must be one of: ${ALLOWED_ROLES.join(", ")}`,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Sentinel: Prevent DoS via excessively large inputs
    if (email.length > 255 || password.length > 72) {
      return new Response(
        JSON.stringify({
          error: {
            code: "INVALID_PARAMS",
            message: "Input values exceed maximum allowed length",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Get environment variables
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!serviceRoleKey || !supabaseUrl) {
      return new Response(
        JSON.stringify({
          error: {
            code: "CONFIG_ERROR",
            message: "Missing Supabase configuration",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    // Use Supabase Admin API to create user
    const adminResponse = await fetchWithTimeout(
      `${supabaseUrl}/auth/v1/admin/users`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
        },
        body: JSON.stringify({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: { role: role },
        }),
      },
    );

    if (!adminResponse.ok) {
      const errorData = await adminResponse.json().catch(() => ({}));
      console.error(
        `Admin API error status ${adminResponse.status}`,
        errorData,
      );
      return new Response(
        JSON.stringify({
          error: {
            code: "USER_CREATION_FAILED",
            message: errorData.error?.message ||
              "Failed to create user. Please check server logs.",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: adminResponse.status === 400 ? 400 : 500,
        },
      );
    }

    const userData = await adminResponse.json();
    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin user created successfully",
        user: {
          id: userData.id,
          email: userData.email,
          created_at: userData.created_at,
          method: "admin_api",
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error(
      "Function error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return new Response(
      JSON.stringify({
        error: {
          code: "FUNCTION_ERROR",
          message: "An internal server error occurred.",
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
