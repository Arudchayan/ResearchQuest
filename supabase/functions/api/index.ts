import { authenticateRequest, requireScopes, writeAudit } from "./_shared/auth.ts";
import { buildCorsHeaders } from "./_shared/cors.ts";
import {
  ALL_SCOPES,
  errorResponse,
  generateApiKeySecret,
  jsonResponse,
  sha256Hex,
  type ApiScope,
} from "./_shared/http.ts";
import { getOpenApiDocument } from "./_shared/openapi.ts";
import type { AuthContext } from "./_shared/auth.ts";

const API_VERSION = "1.0.0";

function normalizePath(pathname: string): string {
  // Supabase invokes as /api or /api/... ; also support /functions/v1/api/v1/...
  let path = pathname;
  const markers = ["/functions/v1/api", "/api"];
  for (const marker of markers) {
    const idx = path.indexOf(marker);
    if (idx >= 0) {
      path = path.slice(idx + marker.length);
      break;
    }
  }
  if (path.startsWith("/v1")) path = path.slice(3);
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
}

function isValidScope(scope: string): scope is ApiScope {
  return (ALL_SCOPES as readonly string[]).includes(scope);
}

async function handleHealth(corsHeaders: Record<string, string>): Promise<Response> {
  return jsonResponse(
    {
      status: "ok",
      version: API_VERSION,
      timestamp: new Date().toISOString(),
    },
    200,
    corsHeaders,
  );
}

async function handleOpenApi(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const url = new URL(req.url);
  const baseUrl = `${url.origin}/functions/v1/api/v1`;
  return jsonResponse(getOpenApiDocument(baseUrl), 200, corsHeaders);
}

async function handleListKeys(
  ctx: AuthContext,
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const denied = requireScopes(ctx, ["keys:read"], corsHeaders);
  if (denied) return denied;

  const { data, error } = await ctx.supabaseAdmin
    .from("api_keys")
    .select(
      "id, name, key_prefix, scopes, expires_at, revoked_at, last_used_at, created_at",
    )
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("list keys", error);
    return errorResponse("INTERNAL_ERROR", "Failed to list API keys", 500, corsHeaders);
  }

  await writeAudit(ctx, "keys.list", "api_keys", 200, req);
  return jsonResponse({ data: data ?? [] }, 200, corsHeaders);
}

async function handleCreateKey(
  ctx: AuthContext,
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // Only JWT sessions may mint keys — prevents key sprawl from compromised agent keys
  if (ctx.authMode !== "jwt") {
    return errorResponse(
      "FORBIDDEN",
      "API key minting requires a user session (JWT)",
      403,
      corsHeaders,
    );
  }

  let body: { name?: string; scopes?: string[]; expires_at?: string | null };
  try {
    body = await req.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 400, corsHeaders);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) {
    return errorResponse(
      "VALIDATION_ERROR",
      "name is required (1-100 characters)",
      400,
      corsHeaders,
    );
  }

  const scopes = Array.isArray(body.scopes) ? body.scopes : [];
  if (scopes.length === 0 || !scopes.every(isValidScope)) {
    return errorResponse(
      "VALIDATION_ERROR",
      `scopes must be a non-empty subset of: ${ALL_SCOPES.join(", ")}`,
      400,
      corsHeaders,
    );
  }

  let expiresAt: string | null = null;
  if (body.expires_at != null) {
    const parsed = Date.parse(body.expires_at);
    if (Number.isNaN(parsed)) {
      return errorResponse("VALIDATION_ERROR", "expires_at must be ISO-8601", 400, corsHeaders);
    }
    expiresAt = new Date(parsed).toISOString();
  }

  const { rawKey, prefix } = generateApiKeySecret();
  const keyHash = await sha256Hex(rawKey);

  const { data, error } = await ctx.supabaseAdmin
    .from("api_keys")
    .insert({
      user_id: ctx.userId,
      name,
      key_prefix: prefix,
      key_hash: keyHash,
      scopes,
      expires_at: expiresAt,
    })
    .select(
      "id, name, key_prefix, scopes, expires_at, revoked_at, last_used_at, created_at",
    )
    .single();

  if (error || !data) {
    console.error("create key", error);
    return errorResponse("INTERNAL_ERROR", "Failed to create API key", 500, corsHeaders);
  }

  await writeAudit(ctx, "keys.create", `api_keys/${data.id}`, 201, req, {
    scopes,
  });

  return jsonResponse({ key: rawKey, api_key: data }, 201, corsHeaders);
}

async function handleRevokeKey(
  ctx: AuthContext,
  req: Request,
  id: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // JWT sessions carry "*" scopes; API keys need keys:write
  const denied = requireScopes(ctx, ["keys:write"], corsHeaders);
  if (denied) return denied;

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) {
    return errorResponse("VALIDATION_ERROR", "Invalid key id", 400, corsHeaders);
  }

  const { data, error } = await ctx.supabaseAdmin
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("revoke key", error);
    return errorResponse("INTERNAL_ERROR", "Failed to revoke API key", 500, corsHeaders);
  }
  if (!data) {
    return errorResponse("NOT_FOUND", "API key not found", 404, corsHeaders);
  }

  await writeAudit(ctx, "keys.revoke", `api_keys/${id}`, 204, req);
  return new Response(null, { status: 204, headers: corsHeaders });
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = normalizePath(url.pathname);

  try {
    if (req.method === "GET" && (path === "/health" || path === "/v1/health")) {
      return await handleHealth(corsHeaders);
    }

    if (
      req.method === "GET" &&
      (path === "/openapi.json" || path === "/v1/openapi.json")
    ) {
      return await handleOpenApi(req, corsHeaders);
    }

    // Authenticated routes
    const authResult = await authenticateRequest(req, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const ctx = authResult;

    if (req.method === "GET" && path === "/keys") {
      return await handleListKeys(ctx, req, corsHeaders);
    }
    if (req.method === "POST" && path === "/keys") {
      return await handleCreateKey(ctx, req, corsHeaders);
    }

    const revokeMatch = /^\/keys\/([^/]+)$/.exec(path);
    if (req.method === "DELETE" && revokeMatch) {
      return await handleRevokeKey(ctx, req, revokeMatch[1], corsHeaders);
    }

    return errorResponse("NOT_FOUND", `No route for ${req.method} ${path}`, 404, corsHeaders);
  } catch (err) {
    console.error("unhandled", err);
    return errorResponse("INTERNAL_ERROR", "Unexpected server error", 500, corsHeaders);
  }
});
