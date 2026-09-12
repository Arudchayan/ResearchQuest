/**
 * Deno unit tests for the fetch-paper edge function (pure helpers only; the
 * server entrypoint is guarded by `import.meta.main`).
 * Run: deno test --allow-env supabase/functions/fetch-paper/
 */
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildCorsHeaders,
  formatCrossrefWork,
  MAX_QUERY_LENGTH,
  parseAllowedOrigins,
  sanitizeQuery,
} from "./index.ts";

Deno.test("sanitizeQuery trims surrounding whitespace", () => {
  assertEquals(sanitizeQuery("  quantum computing  "), {
    value: "quantum computing",
  });
});

Deno.test("sanitizeQuery rejects blank and non-string input", () => {
  assert(sanitizeQuery("   ").error !== undefined);
  assert(sanitizeQuery("").error !== undefined);
  assert(sanitizeQuery(undefined).error !== undefined);
  assert(sanitizeQuery(42).error !== undefined);
});

Deno.test("sanitizeQuery enforces the length cap", () => {
  assertEquals(
    sanitizeQuery("x".repeat(MAX_QUERY_LENGTH + 1)).error,
    "Input exceeds maximum allowed length",
  );
  assertEquals(
    sanitizeQuery("x".repeat(MAX_QUERY_LENGTH)).value?.length,
    MAX_QUERY_LENGTH,
  );
});

Deno.test("fetch-paper CORS is fail-closed without ALLOWED_ORIGINS", () => {
  Deno.env.delete("ALLOWED_ORIGINS");
  assertEquals(parseAllowedOrigins(), []);
  const req = new Request("https://example.com", {
    headers: { Origin: "http://localhost:5173" },
  });
  const headers = buildCorsHeaders(req) as Record<string, string>;
  assertEquals("Access-Control-Allow-Origin" in headers, false);
  assertEquals(headers["Vary"], "Origin");
});

Deno.test("fetch-paper CORS reflects only explicitly allowed origins", () => {
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
    const denied = new Request("https://example.com", {
      headers: { Origin: "https://evil.example.com" },
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

Deno.test("formatCrossrefWork maps Crossref fields with fallbacks", () => {
  const formatted = formatCrossrefWork({
    DOI: "10.1000/example",
    title: ["Example Paper"],
    author: [{ given: "Ada", family: "Lovelace" }],
    published: { "date-parts": [[2024, 5, 1]] },
    URL: "https://example.com/paper",
    "container-title": ["Journal of Examples"],
    publisher: "Example Press",
    type: "journal-article",
  });
  assertEquals(formatted.doi, "10.1000/example");
  assertEquals(formatted.title, "Example Paper");
  assertEquals(formatted.authors, ["Ada Lovelace"]);
  assertEquals(formatted.publicationDate, 2024);
  assertEquals(formatted.containerTitle, "Journal of Examples");

  const empty = formatCrossrefWork({});
  assertEquals(empty.title, "Untitled");
  assertEquals(empty.authors, []);
});
