/**
 * OpenAPI drift check (PR9 item 15).
 *
 * Compares the committed `openapi.fixture.yaml` against the live document
 * produced by `getOpenApiDocument()` (the same generator behind
 * `GET /openapi.json`). Comparison is semantic per operation — `operationId`
 * plus the sorted response status codes. Volatile fields (servers/baseUrl,
 * descriptions, schemas, examples) are intentionally ignored.
 *
 * Run from the repo root:
 *   deno run --allow-read supabase/functions/api/check_openapi_drift.ts
 *
 * Exit 0 when the fixture matches the generator (or SKIP when the generator
 * or YAML parser is unavailable, e.g. no network for the std import).
 * Exit 1 listing drifted operations otherwise.
 *
 * P1 Batch 3 scope note: extending the comparison beyond operationId +
 * status codes (e.g. schemas, required scopes) is deliberately NOT done here —
 * descriptions/examples are volatile by design and schema comparison would
 * turn every additive field into CI noise. Left as-is.
 */

const HTTP_METHODS = new Set(["delete", "get", "patch", "post", "put"]);

type OpSig = {
  key: string;
  operationId: string;
  statuses: string[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function signatures(doc: unknown, label: string): Map<string, OpSig> {
  if (!isRecord(doc) || !isRecord(doc.paths)) {
    throw new Error(`${label}: document has no paths object`);
  }
  const out = new Map<string, OpSig>();
  for (const [p, item] of Object.entries(doc.paths)) {
    if (!isRecord(item)) continue;
    for (const [method, op] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method)) continue;
      if (!isRecord(op) || typeof op.operationId !== "string") {
        throw new Error(`${label}: ${method.toUpperCase()} ${p} lacks operationId`);
      }
      const responses = isRecord(op.responses) ? Object.keys(op.responses).sort() : [];
      out.set(`${method.toUpperCase()} ${p}`, {
        key: `${method.toUpperCase()} ${p}`,
        operationId: op.operationId,
        statuses: responses,
      });
    }
  }
  return out;
}

let parseYaml: (text: string) => unknown;
try {
  ({ parse: parseYaml } = await import("https://deno.land/std@0.224.0/yaml/parse.ts"));
} catch (error) {
  console.log(`SKIP: YAML parser unavailable (${(error as Error)?.message ?? error})`);
  Deno.exit(0);
}

let getOpenApiDocument: (baseUrl: string) => Record<string, unknown>;
try {
  ({ getOpenApiDocument } = await import("./_shared/openapi.ts"));
} catch (error) {
  console.log(`SKIP: openapi generator unavailable (${(error as Error)?.message ?? error})`);
  Deno.exit(0);
}

const dir = new URL(".", import.meta.url);
const fixtureText = await Deno.readTextFile(new URL("openapi.fixture.yaml", dir));
const fixture = parseYaml(fixtureText);
const live = getOpenApiDocument("https://example.com/functions/v1/api/v1");

const fixtureOps = signatures(fixture, "openapi.fixture.yaml");
const liveOps = signatures(live, "getOpenApiDocument()");

const problems: string[] = [];
for (const [key, f] of fixtureOps) {
  const l = liveOps.get(key);
  if (!l) {
    problems.push(`missing in generator: ${key} (fixture operationId ${f.operationId})`);
  } else if (l.operationId !== f.operationId || l.statuses.join(",") !== f.statuses.join(",")) {
    problems.push(
      `changed: ${key} (fixture ${f.operationId} [${f.statuses}] vs generator ${l.operationId} [${l.statuses}])`,
    );
  }
}
for (const key of liveOps.keys()) {
  if (!fixtureOps.has(key)) {
    problems.push(`missing in fixture: ${key} (generator operationId ${liveOps.get(key)!.operationId})`);
  }
}

if (problems.length > 0) {
  console.error(`openapi drift check FAILED (${problems.length} problem(s)):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("Regenerate/refresh openapi.fixture.yaml from getOpenApiDocument() or fix the generator.");
  Deno.exit(1);
}

console.log(
  `openapi drift check OK: fixture matches generator (${liveOps.size} operations).`,
);
