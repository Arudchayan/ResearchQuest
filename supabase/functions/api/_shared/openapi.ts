import { ALL_SCOPES } from "./http.ts";

/** OpenAPI 3.1 stub for the ResearchQuest agent REST gateway (Wave 0). */
export function getOpenApiDocument(baseUrl: string): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "ResearchQuest Agent API",
      version: "1.0.0",
      description:
        "Scoped REST gateway for AI agents and automation. Wave 0 exposes health, OpenAPI, and API key management. Entity CRUD and feeds land in later waves.",
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
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthResponse" },
                },
              },
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
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
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
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ApiKeyPublic" },
                      },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
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
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateApiKeyRequest" },
              },
            },
          },
          responses: {
            "201": {
              description: "Key created; raw secret returned once",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CreateApiKeyResponse" },
                },
              },
            },
            "400": {
              description: "Validation error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "403": {
              description: "Forbidden — API keys cannot mint new keys",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/keys/{id}": {
        delete: {
          operationId: "revokeApiKey",
          summary: "Revoke an API key",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "204": { description: "Revoked" },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "404": {
              description: "Not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
    },
  };
}
