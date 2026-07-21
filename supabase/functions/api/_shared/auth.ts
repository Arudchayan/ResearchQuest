import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  errorResponse,
  hasScope,
  parseBearerToken,
  sha256Hex,
} from "./http.ts";
import { checkRateLimit, rateLimitHeaders } from "./rateLimit.ts";

export interface AuthContext {
  userId: string;
  apiKeyId: string | null;
  scopes: string[];
  authMode: "api_key" | "jwt";
  supabaseAdmin: SupabaseClient;
  supabaseUser: SupabaseClient;
}

let serviceClient: SupabaseClient | null = null;
let anonBaseClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  serviceClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

function getAnonBaseClient(): SupabaseClient {
  if (anonBaseClient) return anonBaseClient;
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  anonBaseClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonBaseClient;
}

function getAnonClient(jwt: string): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticateRequest(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthContext | Response> {
  const token = parseBearerToken(req.headers.get("Authorization"));
  if (!token) {
    return errorResponse(
      "UNAUTHORIZED",
      "Missing or invalid Authorization header",
      401,
      corsHeaders,
    );
  }

  try {
    const supabaseAdmin = getServiceClient();

    // API key path: rq_...
    if (token.startsWith("rq_")) {
      const keyHash = await sha256Hex(token);
      const { data: keyRow, error } = await supabaseAdmin
        .from("api_keys")
        .select("id, user_id, scopes, expires_at, revoked_at")
        .eq("key_hash", keyHash)
        .maybeSingle();

      if (error || !keyRow) {
        return errorResponse(
          "UNAUTHORIZED",
          "Invalid API key",
          401,
          corsHeaders,
        );
      }
      if (keyRow.revoked_at) {
        return errorResponse(
          "UNAUTHORIZED",
          "API key revoked",
          401,
          corsHeaders,
        );
      }
      if (
        keyRow.expires_at && new Date(keyRow.expires_at).getTime() < Date.now()
      ) {
        return errorResponse(
          "UNAUTHORIZED",
          "API key expired",
          401,
          corsHeaders,
        );
      }

      const rl = checkRateLimit(`key:${keyRow.id}`);
      if (!rl.allowed) {
        return errorResponse(
          "RATE_LIMITED",
          "Rate limit exceeded",
          429,
          { ...corsHeaders, ...rateLimitHeaders(rl), "Retry-After": "60" },
        );
      }

      // Fire-and-forget last_used update
      void supabaseAdmin
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyRow.id);

      return {
        userId: keyRow.user_id,
        apiKeyId: keyRow.id,
        scopes: keyRow.scopes ?? [],
        authMode: "api_key",
        supabaseAdmin,
        supabaseUser: supabaseAdmin,
      };
    }

    // JWT session path (for key management from the app)
    const supabaseAnon = getAnonBaseClient();
    const supabaseUser = getAnonClient(token);
    const { data: userData, error: userError } = await supabaseAnon.auth
      .getUser(token);
    if (userError || !userData?.user) {
      return errorResponse(
        "UNAUTHORIZED",
        "Invalid session token",
        401,
        corsHeaders,
      );
    }

    const rl = checkRateLimit(`jwt:${userData.user.id}`);
    if (!rl.allowed) {
      return errorResponse(
        "RATE_LIMITED",
        "Rate limit exceeded",
        429,
        { ...corsHeaders, ...rateLimitHeaders(rl), "Retry-After": "60" },
      );
    }

    return {
      userId: userData.user.id,
      apiKeyId: null,
      scopes: ["*"],
      authMode: "jwt",
      supabaseAdmin,
      supabaseUser,
    };
  } catch (err) {
    console.error("auth error", err);
    return errorResponse(
      "CONFIG_ERROR",
      "Authentication configuration error",
      500,
      corsHeaders,
    );
  }
}

export function requireScopes(
  ctx: AuthContext,
  required: string[],
  corsHeaders: Record<string, string>,
): Response | null {
  for (const scope of required) {
    if (!hasScope(ctx.scopes, scope)) {
      return errorResponse(
        "FORBIDDEN",
        `Missing required scope: ${scope}`,
        403,
        corsHeaders,
      );
    }
  }
  return null;
}

export async function writeAudit(
  ctx: AuthContext,
  action: string,
  resource: string | undefined,
  statusCode: number,
  req: Request,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await ctx.supabaseAdmin.from("api_key_audit").insert({
      api_key_id: ctx.apiKeyId,
      user_id: ctx.userId,
      action,
      resource: resource ?? null,
      status_code: statusCode,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
      metadata,
    });
  } catch (err) {
    console.error("audit write failed", err);
  }
}
