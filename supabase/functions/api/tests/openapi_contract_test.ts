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

const ENTITY_FIXTURES = [
  ["notes", "Notes"],
  ["papers", "Papers"],
  ["ideas", "Ideas"],
  ["topics", "Topics"],
  ["tasks", "Tasks"],
  ["goals", "Goals"],
  ["research_goals", "ResearchGoals"],
] as const;

function entitySmokeFixtures(): SmokeFixture[] {
  return ENTITY_FIXTURES.flatMap(([path, operationName]) => [
    {
      path: `/${path}`,
      method: "get",
      operationId: `list${operationName}`,
      expectedStatuses: ["200", "403"],
    },
    {
      path: `/${path}`,
      method: "post",
      operationId: `create${operationName}`,
      expectedStatuses: ["201", "400"],
    },
    {
      path: `/${path}/{id}`,
      method: "get",
      operationId: `get${operationName}`,
      expectedStatuses: ["200", "404"],
    },
    {
      path: `/${path}/{id}`,
      method: "patch",
      operationId: `update${operationName}`,
      expectedStatuses: ["200", "400", "404"],
    },
    {
      path: `/${path}/{id}`,
      method: "delete",
      operationId: `delete${operationName}`,
      expectedStatuses: ["204", "404"],
    },
    {
      path: `/${path}:batchCreate`,
      method: "post",
      operationId: `batchCreate${operationName}`,
      expectedStatuses: ["201", "207", "400"],
    },
  ]);
}

function feedSmokeFixtures(): SmokeFixture[] {
  return [
    {
      path: "/feed-sources",
      method: "get",
      operationId: "listFeedSources",
      expectedStatuses: ["200", "401", "403"],
    },
    {
      path: "/feed-sources",
      method: "post",
      operationId: "createFeedSource",
      expectedStatuses: ["201", "400", "401", "403"],
    },
    {
      path: "/feed-sources/{id}",
      method: "get",
      operationId: "getFeedSource",
      expectedStatuses: ["200", "400", "404"],
    },
    {
      path: "/feed-sources/{id}",
      method: "patch",
      operationId: "updateFeedSource",
      expectedStatuses: ["200", "400", "404"],
    },
    {
      path: "/feed-sources/{id}",
      method: "delete",
      operationId: "deleteFeedSource",
      expectedStatuses: ["204", "400", "404"],
    },
    {
      path: "/feed-items",
      method: "get",
      operationId: "listFeedItems",
      expectedStatuses: ["200", "400", "401", "403"],
    },
    {
      path: "/feed-items",
      method: "post",
      operationId: "createFeedItem",
      expectedStatuses: ["201", "400", "401", "403", "409"],
    },
    {
      path: "/feed-items:batchCreate",
      method: "post",
      operationId: "batchCreateFeedItems",
      expectedStatuses: ["201", "400", "401", "403"],
    },
    {
      path: "/feed-items/{id}",
      method: "patch",
      operationId: "patchFeedItem",
      expectedStatuses: ["200", "400", "401", "403", "404"],
    },
    {
      path: "/feed-items/{id}/promote",
      method: "post",
      operationId: "promoteFeedItem",
      expectedStatuses: ["201", "400", "401", "403", "404", "409"],
    },
  ];
}

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
    path: "/explore",
    method: "get",
    operationId: "getExplore",
    expectedStatuses: ["200", "400"],
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
  ...entitySmokeFixtures(),
  {
    path: "/topics/{id}/attach",
    method: "post",
    operationId: "attachTopic",
    expectedStatuses: ["200", "400", "404"],
  },
  {
    path: "/topics/{id}/detach",
    method: "post",
    operationId: "detachTopic",
    expectedStatuses: ["200", "400", "404"],
  },
  ...feedSmokeFixtures(),
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
