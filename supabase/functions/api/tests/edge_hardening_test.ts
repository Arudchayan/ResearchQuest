/**
 * PR20-89: Edge hardening contract tests — promote/triage/auth-fail paths.
 *
 * These tests assert status-code + error-message-shape contracts only
 * (promote/triage semantics are owned elsewhere and are not changed here).
 * Run: deno test --allow-env supabase/functions/api/tests/
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { errorResponse } from "../_shared/http.ts";
import { parseBearerToken } from "../_shared/http.ts";
import { requireScopes } from "../_shared/auth.ts";
import type { AuthContext } from "../_shared/auth.ts";
import {
  promotedPaperSourceUrl,
  validateFeedItemPatch,
  validatePromoteRequest,
} from "../_shared/feeds.ts";

const CORS = {};

function fakeCtx(scopes: string[]): AuthContext {
  return { scopes } as unknown as AuthContext;
}

/** Shape contract shared with the frontend `extractApiErrorMessage` helper:
 *  every error body carries `error.code` + string `error.message`. */
function extractMessage(body: unknown, fallback: string): string {
  if (
    typeof body === "object" && body !== null &&
    typeof (body as Record<string, unknown>).error === "object" &&
    (body as Record<string, unknown>).error !== null &&
    typeof ((body as Record<string, unknown>).error as Record<string, unknown>).message ===
      "string"
  ) {
    return ((body as Record<string, unknown>).error as Record<string, unknown>).message as string;
  }
  return fallback;
}

async function readError(res: Response) {
  const body = await res.json();
  assert(typeof body.error?.code === "string", "error.code is a string");
  assert(typeof body.error?.message === "string", "error.message is a string");
  return { status: res.status, body };
}

Deno.test("auth-fail: missing bearer token maps to 401 + message shape", async () => {
  assertEquals(parseBearerToken(null), null);
  const res = errorResponse(
    "UNAUTHORIZED",
    "Missing or invalid Authorization header",
    401,
    CORS,
  );
  const { status, body } = await readError(res);
  assertEquals(status, 401);
  assertEquals(
    extractMessage(body, "fallback"),
    "Missing or invalid Authorization header",
  );
});

Deno.test("auth-fail: invalid session and revoked/expired keys map to 401 shape", async () => {
  for (
    const message of ["Invalid API key", "API key revoked", "API key expired", "Invalid session token"]
  ) {
    const res = errorResponse("UNAUTHORIZED", message, 401, CORS);
    const { status, body } = await readError(res);
    assertEquals(status, 401);
    assertEquals(extractMessage(body, "fallback"), message);
  }
});

Deno.test("auth-fail: missing scope maps to 403 + message shape", async () => {
  const denied = requireScopes(fakeCtx(["notes:read"]), ["notes:write"], CORS);
  assert(denied instanceof Response);
  const { status, body } = await readError(denied);
  assertEquals(status, 403);
  assert(body.error.message.includes("notes:write"));
  assertEquals(extractMessage(body, "fallback"), body.error.message);
});

Deno.test("triage: non-triage statuses are rejected with 400 shape", async () => {
  const parsed = validateFeedItemPatch({ status: "promoted" });
  assertEquals(
    parsed.error,
    "status must be one of: new, triaged, archived",
  );
  const res = errorResponse("VALIDATION_ERROR", parsed.error!, 400, CORS);
  const { status, body } = await readError(res);
  assertEquals(status, 400);
  assert(body.error.message.includes("triaged"));
});

Deno.test("triage: triage statuses are accepted", () => {
  for (const status of ["new", "triaged", "archived"]) {
    const parsed = validateFeedItemPatch({ status });
    assertEquals(parsed.error, undefined);
    assertEquals(parsed.value?.status, status);
  }
});

Deno.test("promote: invalid target is rejected with 400 shape", async () => {
  const parsed = validatePromoteRequest({ target: "event" });
  assert(parsed.error?.includes("target must be one of"));
  const res = errorResponse("VALIDATION_ERROR", parsed.error!, 400, CORS);
  const { status, body } = await readError(res);
  assertEquals(status, 400);
  assertEquals(extractMessage(body, "fallback"), parsed.error);
});

Deno.test("promote: javascript:/data: source_url is rejected with 400 shape", async () => {
  for (
    const sourceUrl of ["javascript:alert(1)", "data:text/html,unsafe", "ftp://example.com/x"]
  ) {
    const result = promotedPaperSourceUrl({ source_url: sourceUrl }, undefined);
    assertEquals(result.error, "source_url must be an http(s) URL");
    const res = errorResponse("VALIDATION_ERROR", result.error!, 400, CORS);
    const { status, body } = await readError(res);
    assertEquals(status, 400);
    assertEquals(extractMessage(body, "fallback"), result.error);
  }
});

Deno.test("error-message-shape: non-shape bodies fall back", () => {
  assertEquals(extractMessage(null, "fallback"), "fallback");
  assertEquals(extractMessage({}, "fallback"), "fallback");
  assertEquals(extractMessage({ error: { code: "X" } }, "fallback"), "fallback");
  assertEquals(
    extractMessage({ error: { code: "X", message: 42 } }, "fallback"),
    "fallback",
  );
});
