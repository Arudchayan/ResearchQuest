/**
 * Deno unit tests for the deep-research edge function (pure helpers only; the
 * server entrypoint is guarded by `import.meta.main`).
 * Run: deno test --allow-env supabase/functions/deep-research/
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildCorsHeaders,
  buildFallbackSummary,
  extractKeywords,
  parseAIJson,
  parseAllowedOrigins,
} from "./index.ts";

Deno.test("deep-research CORS is fail-closed without ALLOWED_ORIGINS", () => {
  Deno.env.delete("ALLOWED_ORIGINS");
  assertEquals(parseAllowedOrigins(), []);
  const req = new Request("https://example.com", {
    headers: { Origin: "http://localhost:5173" },
  });
  const headers = buildCorsHeaders(req) as Record<string, string>;
  assertEquals("Access-Control-Allow-Origin" in headers, false);
  assertEquals(headers["Vary"], "Origin");
});

Deno.test("deep-research CORS reflects only explicitly allowed origins", () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://app.example.com");
  try {
    const allowed = new Request("https://example.com", {
      headers: { Origin: "https://app.example.com" },
    });
    const allowedHeaders = buildCorsHeaders(allowed) as Record<string, string>;
    assertEquals(
      allowedHeaders["Access-Control-Allow-Origin"],
      "https://app.example.com",
    );
    assertEquals(allowedHeaders["Vary"], "Origin");
    const denied = new Request("https://example.com", {
      headers: { Origin: "http://localhost:5173" },
    });
    assertEquals(
      "Access-Control-Allow-Origin" in
        (buildCorsHeaders(denied) as Record<string, string>),
      false,
    );
  } finally {
    Deno.env.delete("ALLOWED_ORIGINS");
  }
});

Deno.test("parseAIJson accepts valid payloads and rejects malformed ones", () => {
  assertEquals(parseAIJson('{"summary": "s", "keywords": ["a"]}'), {
    summary: "s",
    keywords: ["a"],
  });
  assertEquals(
    parseAIJson('```json\n{"summary": "s", "keywords": ["a"]}\n```'),
    { summary: "s", keywords: ["a"] },
  );
  assertEquals(parseAIJson("not json"), null);
  assertEquals(parseAIJson('{"summary": 42}'), null);
});

Deno.test("buildFallbackSummary handles the empty-paper case", () => {
  const summary = buildFallbackSummary("quantum dots", []);
  assert(summary.includes("quantum dots"));
});

Deno.test("extractKeywords derives terms from the query", () => {
  const keywords = extractKeywords("quantum computing architectures", []);
  assert(keywords.includes("quantum"));
  assert(keywords.includes("computing"));
});
