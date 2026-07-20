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

/** OpenAPI 3.1 document for the ResearchQuest agent REST gateway. */
export function getOpenApiDocument(baseUrl: string): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "ResearchQuest Agent API",
      version: "1.0.0",
      description:
        "Scoped REST gateway for AI agents and automation. Exposes API key management and core entity CRUD.",
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
      ...allEntityPaths(),
      "/topics/{id}/attach": topicLinkPath("attachTopic"),
      "/topics/{id}/detach": topicLinkPath("detachTopic"),
    },
  };
}
