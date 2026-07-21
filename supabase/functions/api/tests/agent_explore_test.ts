/**
 * Agent explore endpoint document tests.
 * Run: deno test --allow-env supabase/functions/api/tests/
 */

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ALL_SCOPES } from "../_shared/http.ts";
import {
  EXPLORE_ACTIONS,
  EXPLORE_INCLUDES,
  EXPLORE_RESOURCES,
  getAgentExploreDocument,
  parseExploreFilters,
} from "../_shared/agentExplore.ts";

const BASE_URL = "https://example.com/functions/v1/api/v1";

Deno.test("explore document has required top-level keys", () => {
  const { data } = getAgentExploreDocument(BASE_URL);

  assertExists(data.api);
  assertExists(data.auth);
  assertExists(data.domain);
  assertExists(data.endpoints);
  assertExists(data.workflows);
  assertEquals(data.api.name, "ResearchQuest Agent API");
  assertEquals(data.api.base_url, BASE_URL);
});

Deno.test("every entity create endpoint lists at least one required field", () => {
  const { data } = getAgentExploreDocument(BASE_URL);
  const createEndpoints = data.endpoints.filter(
    (endpoint) => endpoint.action === "create" && endpoint.resource !== "keys",
  );

  assert(createEndpoints.length > 0, "expected create endpoints");
  for (const endpoint of createEndpoints) {
    assertExists(endpoint.request, `${endpoint.operation_id} should have request`);
    assert(
      endpoint.request!.required_fields &&
        endpoint.request!.required_fields.length > 0,
      `${endpoint.operation_id} should list required fields`,
    );
  }
});

Deno.test("resource=notes filter returns only note-related endpoints", () => {
  const { data } = getAgentExploreDocument(BASE_URL, {
    resource: "notes",
    include: new Set(EXPLORE_INCLUDES),
  });

  assert(data.endpoints.length > 0);
  for (const endpoint of data.endpoints) {
    assertEquals(endpoint.resource, "notes");
  }

  const domainKeys = Object.keys(data.domain ?? {});
  assertEquals(domainKeys, ["notes"]);
});

Deno.test("action=create filter narrows to create operations", () => {
  const { data } = getAgentExploreDocument(BASE_URL, {
    action: "create",
    include: new Set(EXPLORE_INCLUDES),
  });

  assert(data.endpoints.length > 0);
  for (const endpoint of data.endpoints) {
    assertEquals(endpoint.action, "create");
  }
});

Deno.test("include filter omits workflows when not requested", () => {
  const { data } = getAgentExploreDocument(BASE_URL, {
    include: new Set(["schemas", "examples", "scopes"]),
  });

  assertExists(data.auth);
  assertExists(data.domain);
  assertEquals(data.workflows, undefined);
});

Deno.test("include filter omits examples when not requested", () => {
  const { data } = getAgentExploreDocument(BASE_URL, {
    include: new Set(["schemas", "workflows", "scopes"]),
  });

  for (const endpoint of data.endpoints) {
    if (endpoint.request?.example !== undefined) {
      throw new Error(
        `${endpoint.operation_id} should not include example when examples omitted`,
      );
    }
  }
});

Deno.test("all required_scope values are valid or documented exceptions", () => {
  const { data } = getAgentExploreDocument(BASE_URL);
  const scopeSet = new Set<string>(ALL_SCOPES);

  for (const endpoint of data.endpoints) {
    if (endpoint.required_scope === null) continue;
    if (endpoint.required_scope.includes("+")) continue;
    if (endpoint.required_scope === "JWT only (not API key)") continue;

    assert(
      scopeSet.has(endpoint.required_scope),
      `invalid scope on ${endpoint.operation_id}: ${endpoint.required_scope}`,
    );
  }
});

Deno.test("create endpoints include copy-paste examples", () => {
  const { data } = getAgentExploreDocument(BASE_URL);
  const createWithExamples = data.endpoints.filter(
    (endpoint) =>
      endpoint.action === "create" &&
      endpoint.request?.example !== undefined,
  );

  assert(createWithExamples.length >= 6);
});

Deno.test("parseExploreFilters rejects invalid resource", async () => {
  const params = new URLSearchParams({ resource: "invalid" });
  const result = parseExploreFilters(params);

  assert(result instanceof Response);
  assertEquals(result.status, 400);
  const body = await result.json();
  assertEquals(body.error.code, "VALIDATION_ERROR");
});

Deno.test("parseExploreFilters rejects invalid action", async () => {
  const params = new URLSearchParams({ action: "destroy" });
  const result = parseExploreFilters(params);

  assert(result instanceof Response);
  assertEquals(result.status, 400);
});

Deno.test("parseExploreFilters rejects invalid include", async () => {
  const params = new URLSearchParams({ include: "schemas,invalid" });
  const result = parseExploreFilters(params);

  assert(result instanceof Response);
  assertEquals(result.status, 400);
});

Deno.test("parseExploreFilters accepts valid filters", () => {
  const params = new URLSearchParams({
    resource: "notes",
    action: "create",
    include: "schemas,examples",
  });
  const result = parseExploreFilters(params);

  assert(!(result instanceof Response));
  assertEquals(result.resource, "notes");
  assertEquals(result.action, "create");
  assertEquals(result.include.has("schemas"), true);
  assertEquals(result.include.has("examples"), true);
  assertEquals(result.include.has("workflows"), false);
});

Deno.test("workflows reference valid resources", () => {
  const { data } = getAgentExploreDocument(BASE_URL);
  const validResources = new Set<string>(EXPLORE_RESOURCES);

  for (const workflow of data.workflows ?? []) {
    for (const resource of workflow.resources) {
      assert(validResources.has(resource), `invalid workflow resource: ${resource}`);
    }
    assert(workflow.steps.length > 0);
  }
});

Deno.test("explore documents itself in meta endpoints", () => {
  const { data } = getAgentExploreDocument(BASE_URL, {
    resource: "meta",
    include: new Set(EXPLORE_INCLUDES),
  });

  const exploreEndpoint = data.endpoints.find(
    (endpoint) => endpoint.operation_id === "getExplore",
  );
  assertExists(exploreEndpoint);
  assertEquals(exploreEndpoint.path, "/explore");
  assertEquals(exploreEndpoint.auth_required, false);
});

Deno.test("EXPLORE_ACTIONS covers all endpoint actions in full document", () => {
  const { data } = getAgentExploreDocument(BASE_URL);
  const actionSet = new Set<string>(EXPLORE_ACTIONS);

  for (const endpoint of data.endpoints) {
    assert(
      actionSet.has(endpoint.action),
      `endpoint ${endpoint.operation_id} uses undocumented action: ${endpoint.action}`,
    );
  }
});
