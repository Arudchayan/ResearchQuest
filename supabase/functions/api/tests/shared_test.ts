/**
 * Deno unit tests for API gateway shared modules.
 * Run: deno test --allow-env supabase/functions/api/tests/
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  generateApiKeySecret,
  hasScope,
  parseBearerToken,
  secureCompare,
  sha256Hex,
} from "../_shared/http.ts";
import {
  _resetRateLimitBuckets,
  checkRateLimit,
  rateLimitHeaders,
} from "../_shared/rateLimit.ts";
import { getOpenApiDocument } from "../_shared/openapi.ts";
import { buildCorsHeaders, getAllowedOrigins } from "../_shared/cors.ts";
import {
  planFeedItemBatch,
  validateFeedItemBatchCreate,
  validateFeedItemCreate,
  validateFeedItemPatch,
} from "../_shared/feeds.ts";

Deno.test("secureCompare equal strings", () => {
  assertEquals(secureCompare("abc", "abc"), true);
});

Deno.test("secureCompare unequal strings", () => {
  assertEquals(secureCompare("abc", "abd"), false);
  assertEquals(secureCompare("abc", "ab"), false);
});

Deno.test("sha256Hex is stable", async () => {
  const a = await sha256Hex("rq_test");
  const b = await sha256Hex("rq_test");
  assertEquals(a, b);
  assertEquals(a.length, 64);
});

Deno.test("generateApiKeySecret format", () => {
  const { rawKey, prefix } = generateApiKeySecret();
  assertEquals(rawKey.startsWith("rq_"), true);
  assertEquals(rawKey.length, 3 + 64);
  assertEquals(prefix, rawKey.slice(0, 11));
});

Deno.test("hasScope matching and wildcards", () => {
  assertEquals(hasScope(["notes:write"], "notes:write"), true);
  assertEquals(hasScope(["notes:write"], "notes:read"), false);
  assertEquals(hasScope(["notes:*"], "notes:read"), true);
  assertEquals(hasScope(["*"], "feeds:ingest"), true);
  assertEquals(hasScope(["*:*"], "tasks:write"), true);
});

Deno.test("parseBearerToken", () => {
  assertEquals(parseBearerToken("Bearer rq_abc"), "rq_abc");
  assertEquals(parseBearerToken("bearer jwt.token"), "jwt.token");
  assertEquals(parseBearerToken(null), null);
  assertEquals(parseBearerToken("Token x"), null);
});

Deno.test("rate limit allows then blocks", () => {
  _resetRateLimitBuckets();
  const key = "test-rl";
  for (let i = 0; i < 3; i++) {
    const r = checkRateLimit(key, 3, 60_000);
    assertEquals(r.allowed, true);
  }
  const blocked = checkRateLimit(key, 3, 60_000);
  assertEquals(blocked.allowed, false);
  assertEquals(blocked.remaining, 0);
  const headers = rateLimitHeaders(blocked);
  assertExists(headers["X-RateLimit-Limit"]);
  _resetRateLimitBuckets();
});

Deno.test("openapi stub contains health, keys, and feeds paths", () => {
  const doc = getOpenApiDocument("https://example.com/functions/v1/api/v1");
  assertEquals(doc.openapi, "3.1.0");
  const paths = doc.paths as Record<string, unknown>;
  assertExists(paths["/health"]);
  assertExists(paths["/openapi.json"]);
  assertExists(paths["/keys"]);
  assertExists(paths["/keys/{id}"]);
  assertExists(paths["/feed-sources"]);
  assertExists(paths["/feed-sources/{id}"]);
  assertExists(paths["/feed-items"]);
  assertExists(paths["/feed-items:batchCreate"]);
  assertExists(paths["/feed-items/{id}"]);
  assertExists(paths["/feed-items/{id}/promote"]);
});

Deno.test("cors allowlist from env", () => {
  Deno.env.set(
    "ALLOWED_ORIGINS",
    "https://app.example.com,https://other.example.com",
  );
  const origins = getAllowedOrigins();
  assertEquals(origins.includes("https://app.example.com"), true);
  const req = new Request("https://example.com", {
    headers: { Origin: "https://app.example.com" },
  });
  const headers = buildCorsHeaders(req);
  assertEquals(
    headers["Access-Control-Allow-Origin"],
    "https://app.example.com",
  );
  Deno.env.delete("ALLOWED_ORIGINS");
});

Deno.test("validateFeedItemCreate normalizes item input", () => {
  const result = validateFeedItemCreate({
    type: "paper",
    title: "  Example Paper  ",
    summary: "  summary  ",
    external_id: "  arxiv:123  ",
    published_at: "2025-01-02T03:04:05Z",
    payload: { doi: "10.1000/example" },
  });

  assertEquals(result.error, undefined);
  assertEquals(result.value?.title, "Example Paper");
  assertEquals(result.value?.summary, "summary");
  assertEquals(result.value?.external_id, "arxiv:123");
  assertEquals(result.value?.published_at, "2025-01-02T03:04:05.000Z");
});

Deno.test("validateFeedItemCreate rejects invalid type and payload", () => {
  const result = validateFeedItemCreate({
    type: "event",
    title: "Conference",
    payload: [],
  });

  assertEquals(result.error, "type must be one of: paper, job, news, custom");
});

Deno.test("validateFeedItemBatchCreate reports item indexes", () => {
  const result = validateFeedItemBatchCreate({
    items: [
      { type: "news", title: "Valid" },
      { type: "paper", title: "" },
    ],
  });

  assertEquals(result.error, "Invalid feed items");
  assertEquals(result.details, [{ index: 1, error: "title is required" }]);
});

Deno.test("validateFeedItemPatch only allows triage statuses", () => {
  assertEquals(
    validateFeedItemPatch({ status: "triaged" }).value?.status,
    "triaged",
  );
  assertEquals(
    validateFeedItemPatch({ status: "promoted" }).error,
    "status must be one of: new, triaged, archived",
  );
});

Deno.test("planFeedItemBatch skips existing and in-request external_id duplicates", () => {
  const items = [
    { title: "Existing", external_id: "ext-1" },
    { title: "New", external_id: "ext-2" },
    { title: "Duplicate", external_id: "ext-2" },
    { title: "No external id" },
  ];

  const plan = planFeedItemBatch(items, new Set(["ext-1"]));

  assertEquals(plan.externalIds, ["ext-1", "ext-2"]);
  assertEquals(plan.insertable.map((item) => item.title), [
    "New",
    "No external id",
  ]);
  assertEquals(plan.skipped, [
    { index: 0, external_id: "ext-1", reason: "already_exists" },
    { index: 2, external_id: "ext-2", reason: "duplicate_in_request" },
  ]);
});
