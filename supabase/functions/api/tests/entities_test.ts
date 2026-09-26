import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  matchEntityRoute,
  requiredScopeForRoute,
  validateBatchItems,
  validateEntityPayload,
  verifyIdeaLinkOwnership,
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

const OWNED_NOTE = "00000000-0000-4000-8000-000000000011";
const FOREIGN_NOTE = "00000000-0000-4000-8000-000000000012";
const OWNED_PAPER = "00000000-0000-4000-8000-000000000021";

// Stub service-role client: only rows owned by USER_ID are "visible".
function stubAdminContext() {
  const ownedByTable: Record<string, string[]> = {
    notes: [OWNED_NOTE],
    papers: [OWNED_PAPER],
  };
  const supabaseAdmin = {
    from: (table: string) => ({
      select: () => ({
        in: (_column: string, ids: string[]) => ({
          eq: async (_column: string, _userId: string) => ({
            data: ids
              .filter((id) => ownedByTable[table]?.includes(id))
              .map((id) => ({ id })),
            error: null,
          }),
        }),
      }),
    }),
  };
  return {
    userId: USER_ID,
    apiKeyId: "key-id",
    scopes: ["ideas:write"],
    authMode: "api_key",
    supabaseAdmin,
    supabaseUser: supabaseAdmin,
    // deno-lint-ignore no-explicit-any
  } as any;
}

Deno.test("idea link ownership accepts owned links, rejects foreign ones", async () => {
  const ctx = stubAdminContext();
  // Legit links (rows owned by the caller) pass unchanged — no regression.
  assertEquals(
    await verifyIdeaLinkOwnership(ctx, {
      linked_note_ids: [OWNED_NOTE],
      linked_paper_ids: [OWNED_PAPER],
    }),
    null,
  );
  // Empty/absent link arrays are trivially fine.
  assertEquals(await verifyIdeaLinkOwnership(ctx, {}), null);
  assertEquals(
    await verifyIdeaLinkOwnership(ctx, {
      linked_note_ids: [],
      linked_paper_ids: [],
    }),
    null,
  );
  // Another user's note id is rejected.
  const foreign = await verifyIdeaLinkOwnership(ctx, {
    linked_note_ids: [OWNED_NOTE, FOREIGN_NOTE],
  });
  assert(foreign !== null && foreign.includes("linked_note_ids"));
  const foreignPaper = await verifyIdeaLinkOwnership(ctx, {
    linked_paper_ids: [FOREIGN_NOTE],
  });
  assert(foreignPaper !== null && foreignPaper.includes("linked_paper_ids"));
});
