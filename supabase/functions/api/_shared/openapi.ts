import { ALL_SCOPES } from "./http.ts";

const JSON_MEDIA = "application/json";

function jsonContent(schema: Record<string, unknown>): Record<string, unknown> {
  return { content: { [JSON_MEDIA]: { schema } } };
}

function idParam(): Record<string, unknown> {
  return {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
  };
}

function envelope(schemaName: string, list = false): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      data: list
        ? {
          type: "array",
          items: { $ref: `#/components/schemas/${schemaName}` },
        }
        : { $ref: `#/components/schemas/${schemaName}` },
    },
  };
}

const entitySchemas: Record<string, unknown> = {
  Note: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      user_id: { type: "string", format: "uuid" },
      title: { type: ["string", "null"], maxLength: 255 },
      markdown_body: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      linked_entity_ids: { type: "array", items: { type: "string" } },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  Paper: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      user_id: { type: "string", format: "uuid" },
      title: { type: "string", maxLength: 255 },
      authors: { type: "array", items: { type: "string" } },
      doi: { type: ["string", "null"] },
      source_url: { type: ["string", "null"], format: "uri" },
      status: { type: "string", enum: ["To Read", "Reading", "Read"] },
      topic_ids: { type: "array", items: { type: "string" } },
      abstract: { type: ["string", "null"], maxLength: 5000 },
      publication_date: { type: ["string", "null"] },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  Idea: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      user_id: { type: "string", format: "uuid" },
      title: { type: "string", maxLength: 255 },
      description: { type: ["string", "null"], maxLength: 5000 },
      stage: {
        type: "string",
        enum: ["Seed", "Developing", "Supported", "Mature"],
      },
      linked_note_ids: { type: "array", items: { type: "string" } },
      linked_paper_ids: { type: "array", items: { type: "string" } },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  Topic: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      user_id: { type: "string", format: "uuid" },
      name: { type: "string", maxLength: 50 },
      description: { type: ["string", "null"], maxLength: 500 },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  Task: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      user_id: { type: "string", format: "uuid" },
      title: { type: "string", maxLength: 255 },
      description: { type: ["string", "null"], maxLength: 1000 },
      completed: { type: "boolean" },
      priority: { type: "string", enum: ["high", "medium", "low"] },
      category: { type: ["string", "null"] },
      project_id: { type: ["string", "null"], format: "uuid" },
      due_date: { type: ["string", "null"], format: "date-time" },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  ResearchGoal: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      user_id: { type: "string", format: "uuid" },
      title: { type: "string", maxLength: 255 },
      description: { type: ["string", "null"], maxLength: 5000 },
      target_date: { type: ["string", "null"], format: "date" },
      progress: { type: "integer", minimum: 0 },
      target_value: { type: "integer", minimum: 1 },
      status: { type: "string", enum: ["active", "completed", "archived"] },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  NoteInput: {
    type: "object",
    required: ["markdown_body"],
    properties: {
      title: { type: ["string", "null"], maxLength: 255 },
      markdown_body: { type: "string", minLength: 1, maxLength: 100000 },
      tags: { type: "array", items: { type: "string" } },
      linked_entity_ids: { type: "array", items: { type: "string" } },
    },
  },
  PaperInput: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 255 },
      authors: { type: "array", items: { type: "string" } },
      doi: { type: ["string", "null"] },
      source_url: { type: ["string", "null"], format: "uri" },
      status: { type: "string", enum: ["To Read", "Reading", "Read"] },
      topic_ids: { type: "array", items: { type: "string" } },
      abstract: { type: ["string", "null"], maxLength: 5000 },
      publication_date: { type: ["string", "null"] },
    },
  },
  IdeaInput: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 255 },
      description: { type: ["string", "null"], maxLength: 5000 },
      stage: {
        type: "string",
        enum: ["Seed", "Developing", "Supported", "Mature"],
      },
      linked_note_ids: { type: "array", items: { type: "string" } },
      linked_paper_ids: { type: "array", items: { type: "string" } },
    },
  },
  TopicInput: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 50 },
      description: { type: ["string", "null"], maxLength: 500 },
    },
  },
  TaskInput: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 255 },
      description: { type: ["string", "null"], maxLength: 1000 },
      completed: { type: "boolean" },
      priority: { type: "string", enum: ["high", "medium", "low"] },
      category: { type: ["string", "null"] },
      project_id: { type: ["string", "null"], format: "uuid" },
      due_date: { type: ["string", "null"], format: "date-time" },
    },
  },
  ResearchGoalInput: {
    type: "object",
    required: ["title"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 255 },
      description: { type: ["string", "null"], maxLength: 5000 },
      target_date: { type: ["string", "null"], format: "date" },
      progress: { type: "integer", minimum: 0 },
      target_value: { type: "integer", minimum: 1 },
      status: { type: "string", enum: ["active", "completed", "archived"] },
    },
  },
  TopicLinkRequest: {
    type: "object",
    required: ["entity_type", "entity_id"],
    properties: {
      entity_type: { type: "string", enum: ["note", "paper", "idea"] },
      entity_id: { type: "string", format: "uuid" },
    },
  },
  BatchCreateResponse: {
    type: "object",
    required: ["data", "errors"],
    properties: {
      data: { type: "array", items: {} },
      errors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer", minimum: 0 },
            error: { type: "string" },
          },
        },
      },
    },
  },
};

const feedSchemas: Record<string, unknown> = {
  FeedSource: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      user_id: { type: "string", format: "uuid" },
      name: { type: "string" },
      kind: { type: "string" },
      config: { type: "object" },
      enabled: { type: "boolean" },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  FeedSourceInput: {
    type: "object",
    required: ["name", "kind"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 200 },
      kind: { type: "string", minLength: 1, maxLength: 64 },
      config: { type: "object", default: {} },
      enabled: { type: "boolean", default: true },
    },
  },
  FeedItem: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      user_id: { type: "string", format: "uuid" },
      source_id: { type: ["string", "null"], format: "uuid" },
      type: { type: "string", enum: ["paper", "job", "news", "custom"] },
      title: { type: "string" },
      summary: { type: ["string", "null"] },
      url: { type: ["string", "null"] },
      payload: { type: "object" },
      status: {
        type: "string",
        enum: ["new", "triaged", "archived", "promoted"],
      },
      external_id: { type: ["string", "null"] },
      published_at: { type: ["string", "null"], format: "date-time" },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  FeedItemInput: {
    type: "object",
    required: ["type", "title"],
    properties: {
      source_id: { type: ["string", "null"], format: "uuid" },
      type: { type: "string", enum: ["paper", "job", "news", "custom"] },
      title: { type: "string", minLength: 1, maxLength: 500 },
      summary: { type: ["string", "null"] },
      url: { type: ["string", "null"] },
      payload: { type: "object", default: {} },
      external_id: { type: ["string", "null"] },
      published_at: { type: ["string", "null"], format: "date-time" },
    },
  },
  FeedItemBatchCreateRequest: {
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: { $ref: "#/components/schemas/FeedItemInput" },
      },
    },
  },
  FeedItemBatchCreateResponse: {
    type: "object",
    required: ["data", "skipped", "created_count", "skipped_count"],
    properties: {
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/FeedItem" },
      },
      skipped: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer", minimum: 0 },
            external_id: { type: "string" },
            reason: {
              type: "string",
              enum: ["duplicate_in_request", "already_exists"],
            },
          },
        },
      },
      created_count: { type: "integer", minimum: 0 },
      skipped_count: { type: "integer", minimum: 0 },
    },
  },
  FeedItemPatchRequest: {
    type: "object",
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["new", "triaged", "archived"] },
    },
  },
  PromoteFeedItemRequest: {
    type: "object",
    required: ["target"],
    properties: {
      target: { type: "string", enum: ["paper", "task", "note"] },
      fields: { type: "object", default: {} },
    },
    additionalProperties: true,
  },
};

const entities = [
  ["notes", "Notes", "Note", "NoteInput"],
  ["papers", "Papers", "Paper", "PaperInput"],
  ["ideas", "Ideas", "Idea", "IdeaInput"],
  ["topics", "Topics", "Topic", "TopicInput"],
  ["tasks", "Tasks", "Task", "TaskInput"],
  ["goals", "Goals", "ResearchGoal", "ResearchGoalInput"],
  ["research_goals", "ResearchGoals", "ResearchGoal", "ResearchGoalInput"],
] as const;

function entityPaths(
  pathName: string,
  operationName: string,
  schemaName: string,
  inputSchemaName: string,
): Record<string, unknown> {
  const inputRef = `#/components/schemas/${inputSchemaName}`;
  return {
    [`/${pathName}`]: {
      get: {
        operationId: `list${operationName}`,
        summary: `List ${pathName}`,
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "OK",
            ...jsonContent(envelope(schemaName, true)),
          },
          "403": {
            description: "Forbidden",
            ...jsonContent({ $ref: "#/components/schemas/Error" }),
          },
        },
      },
      post: {
        operationId: `create${operationName}`,
        summary: `Create ${pathName}`,
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { [JSON_MEDIA]: { schema: { $ref: inputRef } } },
        },
        responses: {
          "201": {
            description: "Created",
            ...jsonContent(envelope(schemaName)),
          },
          "400": {
            description: "Validation error",
            ...jsonContent({ $ref: "#/components/schemas/Error" }),
          },
        },
      },
    },
    [`/${pathName}/{id}`]: {
      get: {
        operationId: `get${operationName}`,
        summary: `Get ${pathName} by id`,
        security: [{ BearerAuth: [] }],
        parameters: [idParam()],
        responses: {
          "200": { description: "OK", ...jsonContent(envelope(schemaName)) },
          "404": {
            description: "Not found",
            ...jsonContent({ $ref: "#/components/schemas/Error" }),
          },
        },
      },
      patch: {
        operationId: `update${operationName}`,
        summary: `Update ${pathName}`,
        security: [{ BearerAuth: [] }],
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: { [JSON_MEDIA]: { schema: { $ref: inputRef } } },
        },
        responses: {
          "200": {
            description: "Updated",
            ...jsonContent(envelope(schemaName)),
          },
          "400": {
            description: "Validation error",
            ...jsonContent({ $ref: "#/components/schemas/Error" }),
          },
          "404": {
            description: "Not found",
            ...jsonContent({ $ref: "#/components/schemas/Error" }),
          },
        },
      },
      delete: {
        operationId: `delete${operationName}`,
        summary: `Delete ${pathName}`,
        security: [{ BearerAuth: [] }],
        parameters: [idParam()],
        responses: {
          "204": { description: "Deleted" },
          "404": {
            description: "Not found",
            ...jsonContent({ $ref: "#/components/schemas/Error" }),
          },
        },
      },
    },
    [`/${pathName}:batchCreate`]: {
      post: {
        operationId: `batchCreate${operationName}`,
        summary: `Batch create ${pathName}`,
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            [JSON_MEDIA]: {
              schema: {
                oneOf: [{
                  type: "array",
                  maxItems: 50,
                  items: { $ref: inputRef },
                }, {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      maxItems: 50,
                      items: { $ref: inputRef },
                    },
                    data: {
                      type: "array",
                      maxItems: 50,
                      items: { $ref: inputRef },
                    },
                  },
                }],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            ...jsonContent({
              $ref: "#/components/schemas/BatchCreateResponse",
            }),
          },
          "207": {
            description: "Partial success",
            ...jsonContent({
              $ref: "#/components/schemas/BatchCreateResponse",
            }),
          },
          "400": {
            description: "Validation error",
            ...jsonContent({ $ref: "#/components/schemas/Error" }),
          },
        },
      },
    },
  };
}

function allEntityPaths(): Record<string, unknown> {
  return entities.reduce<Record<string, unknown>>(
    (paths, entity) => ({
      ...paths,
      ...entityPaths(entity[0], entity[1], entity[2], entity[3]),
    }),
    {},
  );
}

function topicLinkPath(
  operationId: "attachTopic" | "detachTopic",
): Record<string, unknown> {
  return {
    post: {
      operationId,
      summary: operationId === "attachTopic"
        ? "Attach a topic to a note, paper, or idea"
        : "Detach a topic from a note, paper, or idea",
      security: [{ BearerAuth: [] }],
      parameters: [idParam()],
      requestBody: {
        required: true,
        content: {
          [JSON_MEDIA]: {
            schema: { $ref: "#/components/schemas/TopicLinkRequest" },
          },
        },
      },
      responses: {
        "200": { description: "OK", ...jsonContent({ type: "object" }) },
        "400": {
          description: "Validation error",
          ...jsonContent({ $ref: "#/components/schemas/Error" }),
        },
        "404": {
          description: "Not found",
          ...jsonContent({ $ref: "#/components/schemas/Error" }),
        },
      },
    },
  };
}

function feedPaths(): Record<string, unknown> {
  const error = { $ref: "#/components/schemas/Error" };
  return {
    "/feed-sources": {
      get: {
        operationId: "listFeedSources",
        summary: "List feed sources",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "OK",
            ...jsonContent(envelope("FeedSource", true)),
          },
          "401": { description: "Unauthorized", ...jsonContent(error) },
          "403": { description: "Forbidden", ...jsonContent(error) },
        },
      },
      post: {
        operationId: "createFeedSource",
        summary: "Create a feed source",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            [JSON_MEDIA]: {
              schema: { $ref: "#/components/schemas/FeedSourceInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            ...jsonContent(envelope("FeedSource")),
          },
          "400": { description: "Validation error", ...jsonContent(error) },
          "401": { description: "Unauthorized", ...jsonContent(error) },
          "403": { description: "Forbidden", ...jsonContent(error) },
        },
      },
    },
    "/feed-sources/{id}": {
      get: {
        operationId: "getFeedSource",
        summary: "Get a feed source",
        security: [{ BearerAuth: [] }],
        parameters: [idParam()],
        responses: {
          "200": { description: "OK", ...jsonContent(envelope("FeedSource")) },
          "400": { description: "Validation error", ...jsonContent(error) },
          "404": { description: "Not found", ...jsonContent(error) },
        },
      },
      patch: {
        operationId: "updateFeedSource",
        summary: "Update a feed source",
        security: [{ BearerAuth: [] }],
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: {
            [JSON_MEDIA]: {
              schema: { $ref: "#/components/schemas/FeedSourceInput" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated",
            ...jsonContent(envelope("FeedSource")),
          },
          "400": { description: "Validation error", ...jsonContent(error) },
          "404": { description: "Not found", ...jsonContent(error) },
        },
      },
      delete: {
        operationId: "deleteFeedSource",
        summary: "Delete a feed source",
        security: [{ BearerAuth: [] }],
        parameters: [idParam()],
        responses: {
          "204": { description: "Deleted" },
          "400": { description: "Validation error", ...jsonContent(error) },
          "404": { description: "Not found", ...jsonContent(error) },
        },
      },
    },
    "/feed-items": {
      get: {
        operationId: "listFeedItems",
        summary: "List feed items",
        security: [{ BearerAuth: [] }],
        parameters: [{
          name: "type",
          in: "query",
          schema: {
            type: "string",
            enum: ["paper", "job", "news", "custom"],
          },
        }, {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: ["new", "triaged", "archived", "promoted"],
          },
        }],
        responses: {
          "200": {
            description: "OK",
            ...jsonContent(envelope("FeedItem", true)),
          },
          "400": { description: "Validation error", ...jsonContent(error) },
          "401": { description: "Unauthorized", ...jsonContent(error) },
          "403": { description: "Forbidden", ...jsonContent(error) },
        },
      },
      post: {
        operationId: "createFeedItem",
        summary: "Create a feed item",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            [JSON_MEDIA]: {
              schema: { $ref: "#/components/schemas/FeedItemInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            ...jsonContent(envelope("FeedItem")),
          },
          "400": { description: "Validation error", ...jsonContent(error) },
          "401": { description: "Unauthorized", ...jsonContent(error) },
          "403": { description: "Forbidden", ...jsonContent(error) },
          "409": { description: "Duplicate", ...jsonContent(error) },
        },
      },
    },
    "/feed-items:batchCreate": {
      post: {
        operationId: "batchCreateFeedItems",
        summary: "Batch create feed items",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            [JSON_MEDIA]: {
              schema: {
                $ref: "#/components/schemas/FeedItemBatchCreateRequest",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            ...jsonContent({
              $ref: "#/components/schemas/FeedItemBatchCreateResponse",
            }),
          },
          "400": { description: "Validation error", ...jsonContent(error) },
          "401": { description: "Unauthorized", ...jsonContent(error) },
          "403": { description: "Forbidden", ...jsonContent(error) },
        },
      },
    },
    "/feed-items/{id}": {
      patch: {
        operationId: "patchFeedItem",
        summary: "Update feed item triage status",
        security: [{ BearerAuth: [] }],
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: {
            [JSON_MEDIA]: {
              schema: { $ref: "#/components/schemas/FeedItemPatchRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated",
            ...jsonContent(envelope("FeedItem")),
          },
          "400": { description: "Validation error", ...jsonContent(error) },
          "401": { description: "Unauthorized", ...jsonContent(error) },
          "403": { description: "Forbidden", ...jsonContent(error) },
          "404": { description: "Not found", ...jsonContent(error) },
        },
      },
    },
    "/feed-items/{id}/promote": {
      post: {
        operationId: "promoteFeedItem",
        summary: "Promote a feed item to a core entity",
        security: [{ BearerAuth: [] }],
        parameters: [idParam()],
        requestBody: {
          required: true,
          content: {
            [JSON_MEDIA]: {
              schema: { $ref: "#/components/schemas/PromoteFeedItemRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Promoted",
            ...jsonContent({ type: "object" }),
          },
          "400": { description: "Validation error", ...jsonContent(error) },
          "401": { description: "Unauthorized", ...jsonContent(error) },
          "403": { description: "Forbidden", ...jsonContent(error) },
          "404": { description: "Not found", ...jsonContent(error) },
          "409": { description: "Conflict", ...jsonContent(error) },
        },
      },
    },
  };
}

/** OpenAPI 3.1 document for the ResearchQuest agent REST gateway. */
export function getOpenApiDocument(baseUrl: string): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "ResearchQuest Agent API",
      version: "1.0.0",
      description:
        "Scoped REST gateway for AI agents and automation. Exposes API key management, core entity CRUD, and feeds ingest/triage/promote APIs.",
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "User JWT (for key minting) or API key starting with rq_ (for agent calls).",
        },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: {},
              },
            },
          },
        },
        ApiKeyPublic: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            key_prefix: { type: "string" },
            scopes: {
              type: "array",
              items: { type: "string", enum: [...ALL_SCOPES] },
            },
            expires_at: { type: ["string", "null"], format: "date-time" },
            revoked_at: { type: ["string", "null"], format: "date-time" },
            last_used_at: { type: ["string", "null"], format: "date-time" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        CreateApiKeyRequest: {
          type: "object",
          required: ["name", "scopes"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            scopes: {
              type: "array",
              minItems: 1,
              items: { type: "string", enum: [...ALL_SCOPES] },
            },
            expires_at: { type: ["string", "null"], format: "date-time" },
          },
        },
        CreateApiKeyResponse: {
          type: "object",
          required: ["key", "api_key"],
          properties: {
            key: {
              type: "string",
              description: "Raw API key shown once. Store securely.",
            },
            api_key: { $ref: "#/components/schemas/ApiKeyPublic" },
          },
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok"] },
            version: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        ...entitySchemas,
        ...feedSchemas,
      },
    },
    paths: {
      "/health": {
        get: {
          operationId: "getHealth",
          summary: "Health check",
          security: [],
          responses: {
            "200": {
              description: "Service healthy",
              ...jsonContent({ $ref: "#/components/schemas/HealthResponse" }),
            },
          },
        },
      },
      "/openapi.json": {
        get: {
          operationId: "getOpenApi",
          summary: "OpenAPI 3.1 document",
          security: [],
          responses: {
            "200": {
              description: "OpenAPI document",
              ...jsonContent({ type: "object" }),
            },
          },
        },
      },
      "/keys": {
        get: {
          operationId: "listApiKeys",
          summary: "List API keys for the authenticated user",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": {
              description: "Key list (secrets never returned)",
              ...jsonContent(envelope("ApiKeyPublic", true)),
            },
            "401": {
              description: "Unauthorized",
              ...jsonContent({ $ref: "#/components/schemas/Error" }),
            },
          },
        },
        post: {
          operationId: "createApiKey",
          summary: "Mint a new API key (JWT session required)",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              [JSON_MEDIA]: {
                schema: { $ref: "#/components/schemas/CreateApiKeyRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Key created; raw secret returned once",
              ...jsonContent({
                $ref: "#/components/schemas/CreateApiKeyResponse",
              }),
            },
            "400": {
              description: "Validation error",
              ...jsonContent({ $ref: "#/components/schemas/Error" }),
            },
            "401": {
              description: "Unauthorized",
              ...jsonContent({ $ref: "#/components/schemas/Error" }),
            },
            "403": {
              description: "Forbidden",
              ...jsonContent({ $ref: "#/components/schemas/Error" }),
            },
          },
        },
      },
      "/keys/{id}": {
        delete: {
          operationId: "revokeApiKey",
          summary: "Revoke an API key",
          security: [{ BearerAuth: [] }],
          parameters: [idParam()],
          responses: {
            "204": { description: "Revoked" },
            "401": {
              description: "Unauthorized",
              ...jsonContent({ $ref: "#/components/schemas/Error" }),
            },
            "404": {
              description: "Not found",
              ...jsonContent({ $ref: "#/components/schemas/Error" }),
            },
          },
        },
      },
      ...feedPaths(),
      ...allEntityPaths(),
      "/topics/{id}/attach": topicLinkPath("attachTopic"),
      "/topics/{id}/detach": topicLinkPath("detachTopic"),
    },
  };
}
