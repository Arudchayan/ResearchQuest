import { ALL_SCOPES } from "./http.ts";

/** OpenAPI 3.1 document for the ResearchQuest agent REST gateway. */
export function getOpenApiDocument(baseUrl: string): Record<string, unknown> {
  const error = { $ref: "#/components/schemas/Error" };
  const bearer = [{ BearerAuth: [] }];

  return {
    openapi: "3.1.0",
    info: {
      title: "ResearchQuest Agent API",
      version: "1.0.0",
      description:
        "Scoped REST gateway for AI agents and automation. Exposes health, OpenAPI, API key management, and feeds ingest/triage/promote APIs.",
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer" },
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
            key: { type: "string" },
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
          },
          additionalProperties: true,
        },
      },
    },
    paths: {
      "/health": {
        get: {
          operationId: "getHealth",
          security: [],
          responses: { "200": { description: "Service healthy" } },
        },
      },
      "/openapi.json": {
        get: {
          operationId: "getOpenApi",
          security: [],
          responses: { "200": { description: "OpenAPI document" } },
        },
      },
      "/keys": {
        get: {
          operationId: "listApiKeys",
          security: bearer,
          responses: {
            "200": { description: "OK" },
            "401": {
              description: "Unauthorized",
              content: { "application/json": { schema: error } },
            },
          },
        },
        post: {
          operationId: "createApiKey",
          security: bearer,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateApiKeyRequest" },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "400": { description: "Validation error" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/keys/{id}": {
        delete: {
          operationId: "revokeApiKey",
          security: bearer,
          parameters: [{
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          }],
          responses: {
            "204": { description: "Revoked" },
            "401": { description: "Unauthorized" },
            "404": { description: "Not found" },
          },
        },
      },
      "/feed-sources": {
        get: {
          operationId: "listFeedSources",
          security: bearer,
          responses: {
            "200": { description: "OK" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
          },
        },
        post: {
          operationId: "createFeedSource",
          security: bearer,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FeedSourceInput" },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "400": { description: "Validation error" },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/feed-sources/{id}": {
        get: {
          operationId: "getFeedSource",
          security: bearer,
          parameters: [{
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          }],
          responses: {
            "200": { description: "OK" },
            "404": { description: "Not found" },
          },
        },
        patch: {
          operationId: "updateFeedSource",
          security: bearer,
          parameters: [{
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          }],
          responses: {
            "200": { description: "Updated" },
            "400": { description: "Validation error" },
            "404": { description: "Not found" },
          },
        },
        delete: {
          operationId: "deleteFeedSource",
          security: bearer,
          parameters: [{
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          }],
          responses: {
            "204": { description: "Deleted" },
            "404": { description: "Not found" },
          },
        },
      },
      "/feed-items": {
        get: {
          operationId: "listFeedItems",
          security: bearer,
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
            "200": { description: "OK" },
            "400": { description: "Validation error" },
          },
        },
        post: {
          operationId: "createFeedItem",
          security: bearer,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FeedItemInput" },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "400": { description: "Validation error" },
            "409": { description: "Duplicate" },
          },
        },
      },
      "/feed-items:batchCreate": {
        post: {
          operationId: "batchCreateFeedItems",
          security: bearer,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/FeedItemBatchCreateRequest",
                },
              },
            },
          },
          responses: {
            "201": { description: "Created" },
            "400": { description: "Validation error" },
          },
        },
      },
      "/feed-items/{id}": {
        patch: {
          operationId: "patchFeedItem",
          security: bearer,
          parameters: [{
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FeedItemPatchRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Updated" },
            "400": { description: "Validation error" },
            "404": { description: "Not found" },
          },
        },
      },
      "/feed-items/{id}/promote": {
        post: {
          operationId: "promoteFeedItem",
          security: bearer,
          parameters: [{
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PromoteFeedItemRequest" },
              },
            },
          },
          responses: {
            "201": { description: "Promoted" },
            "400": { description: "Validation error" },
            "404": { description: "Not found" },
            "409": { description: "Conflict" },
          },
        },
      },
    },
  };
}
