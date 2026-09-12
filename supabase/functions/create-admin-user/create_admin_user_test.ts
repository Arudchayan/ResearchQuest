/**
 * Deno unit tests for the create-admin-user edge function (pure helpers only;
 * the server entrypoint is guarded by `import.meta.main`).
 * Run: deno test --allow-env supabase/functions/create-admin-user/
 */
import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  _resetRateLimitBuckets,
  buildCorsHeaders,
  checkRateLimit,
  secureCompare,
} from "./index.ts";

Deno.test("secureCompare matches exactly", () => {
  assertEquals(secureCompare("Bearer secret", "Bearer secret"), true);
  assertEquals(secureCompare("Bearer secret", "Bearer other"), false);
  assertEquals(secureCompare("short", "longer"), false);
});

Deno.test("rate limit allows a burst then blocks", () => {
  _resetRateLimitBuckets();
  try {
    for (let i = 0; i < 5; i++) {
      assertEquals(checkRateLimit(), true);
    }
    assertEquals(checkRateLimit(), false);
  } finally {
    _resetRateLimitBuckets();
  }
});

Deno.test("create-admin-user CORS is fail-closed without ALLOWED_ORIGINS", () => {
  Deno.env.delete("ALLOWED_ORIGINS");
  const req = new Request("https://example.com", {
    headers: { Origin: "http://localhost:5173" },
  });
  const headers = buildCorsHeaders(req);
  assertEquals("Access-Control-Allow-Origin" in headers, false);
  assertEquals(headers["Vary"], "Origin");
});

Deno.test("create-admin-user CORS reflects only explicitly allowed origins", () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://app.example.com");
  try {
    const allowed = new Request("https://example.com", {
      headers: { Origin: "https://app.example.com" },
    });
    assertEquals(
      buildCorsHeaders(allowed)["Access-Control-Allow-Origin"],
      "https://app.example.com",
    );
  } finally {
    Deno.env.delete("ALLOWED_ORIGINS");
  }
});
