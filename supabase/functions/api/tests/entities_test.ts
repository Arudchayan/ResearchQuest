import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  matchEntityRoute,
  requiredScopeForRoute,
  validateBatchItems,
  validateEntityPayload,
} from "../routes/entities.ts";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ROW_ID = "00000000-0000-4000-8000-000000000002";

Deno.test("entity route matcher recognizes CRUD, batch, aliases, and topic links", () => {
  assertEquals(matchEntityRoute("GET", "/notes"), {
    action: "list",
    resource: "notes",
  });
  assertEquals(matchEntityRoute("PATCH", `/research_goals/${ROW_ID}`), {
    action: "update",
    resource: "goals",
    id: ROW_ID,
  });
  assertEquals(matchEntityRoute("POST", "/papers:batchCreate"), {
    action: "batchCreate",
    resource: "papers",
  });
  assertEquals(matchEntityRoute("POST", `/topics/${ROW_ID}/attach`), {
    action: "attach",
    resource: "topics",
    id: ROW_ID,
  });
  assertEquals(matchEntityRoute("POST", "/unknown:batchCreate"), null);
});

Deno.test("entity route scopes map read/write operations by resource", () => {
  assertEquals(
    requiredScopeForRoute({ action: "list", resource: "notes" }),
    "notes:read",
  );
  assertEquals(
    requiredScopeForRoute({ action: "get", resource: "papers", id: ROW_ID }),
    "papers:read",
  );
  assertEquals(
    requiredScopeForRoute({ action: "create", resource: "ideas" }),
    "ideas:write",
  );
  assertEquals(
    requiredScopeForRoute({ action: "batchCreate", resource: "goals" }),
    "goals:write",
  );
  assertEquals(
    requiredScopeForRoute({ action: "attach", resource: "topics", id: ROW_ID }),
    "topics:write",
  );
});

Deno.test("batch item validation enforces max 50 and accepts supported envelopes", () => {
  const fifty = Array.from(
    { length: 50 },
    (_, index) => ({ title: `Item ${index}` }),
  );
  assertEquals(validateBatchItems(fifty).ok, true);
  assertEquals(validateBatchItems({ items: fifty }).ok, true);
  assertEquals(validateBatchItems({ data: fifty }).ok, true);

  const tooMany = Array.from(
    { length: 51 },
    (_, index) => ({ title: `Item ${index}` }),
  );
  const result = validateBatchItems(tooMany);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assert(result.error.includes("at most 50"));
  }
});

Deno.test("entity payload validation stamps user id and applies create defaults", () => {
  const note = validateEntityPayload(
    "notes",
    { title: "  Draft  ", markdown_body: "  Body  ", tags: ["api"] },
    "create",
    USER_ID,
  );
  assertEquals(note.ok, true);
  if (note.ok) {
    assertEquals(note.payload.user_id, USER_ID);
    assertEquals(note.payload.title, "Draft");
    assertEquals(note.payload.markdown_body, "Body");
    assertEquals(note.payload.tags, ["api"]);
  }

  const idea = validateEntityPayload(
    "ideas",
    { title: "Seed idea" },
    "create",
    USER_ID,
  );
  assertEquals(idea.ok, true);
  if (idea.ok) {
    assertEquals(idea.payload.stage, "Seed");
  }
});

Deno.test("entity payload validation rejects invalid values", () => {
  const paper = validateEntityPayload(
    "papers",
    { title: "Paper", source_url: "javascript:alert(1)" },
    "create",
    USER_ID,
  );
  assertEquals(paper.ok, false);
  if (!paper.ok) assert(paper.error.includes("source_url"));

  const task = validateEntityPayload(
    "tasks",
    { title: "Task", priority: "urgent" },
    "create",
    USER_ID,
  );
  assertEquals(task.ok, false);
  if (!task.ok) assert(task.error.includes("priority"));
});

Deno.test("entity patch validation does not inject create defaults", () => {
  const taskPatch = validateEntityPayload(
    "tasks",
    { description: "Later" },
    "update",
    USER_ID,
  );
  assertEquals(taskPatch.ok, true);
  if (taskPatch.ok) {
    assertEquals(Object.hasOwn(taskPatch.payload, "priority"), false);
    assertEquals(Object.hasOwn(taskPatch.payload, "completed"), false);
  }

  const emptyPatch = validateEntityPayload("topics", {}, "update", USER_ID);
  assertEquals(emptyPatch.ok, false);
});
