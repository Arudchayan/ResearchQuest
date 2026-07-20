/**
 * Lightweight OpenAPI contract coverage for the API gateway stub.
 * Run: deno test --allow-env supabase/functions/api/tests/
 */

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getOpenApiDocument } from "../_shared/openapi.ts";

const HTTP_METHODS = new Set([
  "delete",
  "get",
  "patch",
  "post",
  "put",
]);

type OpenApiOperation = {
  path: string;
  method: string;
  operationId: string;
  responses: Record<string, unknown>;
};

type SmokeFixture = {
  path: string;
  method: string;
  operationId: string;
  expectedStatuses: string[];
};

const OPERATION_SMOKE_FIXTURES: SmokeFixture[] = [
  {
    path: "/health",
    method: "get",
    operationId: "getHealth",
    expectedStatuses: ["200"],
  },
  {
    path: "/openapi.json",
    method: "get",
    operationId: "getOpenApi",
    expectedStatuses: ["200"],
  },
  {
    path: "/keys",
    method: "get",
    operationId: "listApiKeys",
    expectedStatuses: ["200", "401"],
  },
  {
    path: "/keys",
    method: "post",
    operationId: "createApiKey",
    expectedStatuses: ["201", "400", "401", "403"],
  },
  {
    path: "/keys/{id}",
    method: "delete",
    operationId: "revokeApiKey",
    expectedStatuses: ["204", "401", "404"],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function operationKey(operation: { path: string; method: string }): string {
  return `${operation.method.toUpperCase()} ${operation.path}`;
}

function collectOperations(doc: Record<string, unknown>): OpenApiOperation[] {
  assert(isRecord(doc.paths), "OpenAPI document must define paths");

  const operations: OpenApiOperation[] = [];

  for (const [path, pathItem] of Object.entries(doc.paths)) {
    assert(isRecord(pathItem), `${path} path item must be an object`);

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) {
        continue;
      }

      assert(
        isRecord(operation),
        `${method.toUpperCase()} ${path} must be an object`,
      );
      assert(
        typeof operation.operationId === "string" &&
          operation.operationId.length > 0,
        `${method.toUpperCase()} ${path} must define operationId`,
      );
      assert(
        isRecord(operation.responses),
        `${method.toUpperCase()} ${path} must define responses`,
      );

      operations.push({
        path,
        method,
        operationId: operation.operationId,
        responses: operation.responses,
      });
    }
  }

  return operations;
}

Deno.test("generated OpenAPI operations are covered by smoke fixtures", () => {
  const generatedDoc = getOpenApiDocument(
    "https://example.com/functions/v1/api/v1",
  );
  const generatedOperations = collectOperations(generatedDoc);

  const smokeByOperation = new Map(
    OPERATION_SMOKE_FIXTURES.map((fixture) => [
      operationKey(fixture),
      fixture,
    ]),
  );

  assertEquals(
    generatedOperations.map(operationKey).sort(),
    [...smokeByOperation.keys()].sort(),
  );

  for (const operation of generatedOperations) {
    const smokeFixture = smokeByOperation.get(operationKey(operation));
    assertExists(
      smokeFixture,
      `${operationKey(operation)} must have a smoke fixture`,
    );
    assertEquals(smokeFixture.operationId, operation.operationId);

    for (const status of smokeFixture.expectedStatuses) {
      assertExists(
        operation.responses[status],
        `${operation.operationId} should document ${status}`,
      );
    }
  }
});

Deno.test("generated OpenAPI operationIds are unique", () => {
  const operations = collectOperations(
    getOpenApiDocument("https://example.com/functions/v1/api/v1"),
  );
  const operationIds = operations.map((operation) => operation.operationId);

  assertEquals(new Set(operationIds).size, operationIds.length);
});
