import { ALL_SCOPES } from "./http.ts";

export const EXPLORE_RESOURCES = [
  "notes",
  "papers",
  "ideas",
  "topics",
  "tasks",
  "goals",
  "feeds",
  "keys",
  "meta",
] as const;

export const EXPLORE_ACTIONS = [
  "list",
  "get",
  "create",
  "update",
  "delete",
  "batchCreate",
  "attach",
  "detach",
  "promote",
  "ingest",
] as const;

export const EXPLORE_INCLUDES = [
  "schemas",
  "examples",
  "workflows",
  "scopes",
] as const;

export type ExploreResource = (typeof EXPLORE_RESOURCES)[number];
export type ExploreAction = (typeof EXPLORE_ACTIONS)[number];
export type ExploreInclude = (typeof EXPLORE_INCLUDES)[number];

export interface ExploreFilters {
  resource?: ExploreResource;
  action?: ExploreAction;
  include: Set<ExploreInclude>;
}

export interface ExploreRequestDoc {
  content_type: string;
  required_fields?: string[];
  optional_fields?: string[];
  query_params?: Record<string, string>;
  path_params?: Record<string, string>;
  schema?: Record<string, string>;
  example?: unknown;
  body_shapes?: string[];
}

export interface ExploreEndpointDoc {
  operation_id: string;
  method: string;
  path: string;
  summary: string;
  resource: ExploreResource;
  action: ExploreAction;
  required_scope: string | null;
  auth_required: boolean;
  request?: ExploreRequestDoc;
  response?: { status: number | string; envelope: string };
  errors?: string[];
}

export interface ExploreWorkflowDoc {
  name: string;
  resources: ExploreResource[];
  steps: string[];
}

export interface AgentExploreDocument {
  api: {
    name: string;
    version: string;
    base_url: string;
    purpose: string;
    related_discovery: {
      openapi: string;
      health: string;
      explore: string;
    };
  };
  auth?: {
    header: string;
    modes: Array<{ type: string; prefix?: string; usage: string }>;
    scopes: string[];
  };
  domain?: Record<string, { description: string; table?: string }>;
  endpoints: ExploreEndpointDoc[];
  workflows?: ExploreWorkflowDoc[];
}

const API_VERSION = "1.0.0";

const DOMAIN: Record<
  Exclude<ExploreResource, "meta">,
  { description: string; table?: string }
> = {
  notes: {
    description:
      "Markdown research notes with tags and cross-links to other entities.",
    table: "notes",
  },
  papers: {
    description:
      "Bibliographic library with reading status workflow (To Read, Reading, Read).",
    table: "papers",
  },
  ideas: {
    description:
      "Research hypotheses tracked through maturity stages with links to notes and papers.",
    table: "ideas",
  },
  topics: {
    description:
      "Thematic organization buckets; attach notes, papers, or ideas via junction links.",
    table: "topics",
  },
  tasks: {
    description:
      "Prioritized to-do items; reading tasks may be auto-created when papers are added.",
    table: "tasks",
  },
  goals: {
    description:
      "Long-horizon research goals with progress tracking and target dates.",
    table: "research_goals",
  },
  feeds: {
    description:
      "External content inbox (papers, jobs, news) with triage and promote-to-entity flow.",
    table: "feed_items",
  },
  keys: {
    description:
      "Scoped API keys for agent automation; mint via user JWT, use rq_ prefix.",
    table: "api_keys",
  },
};

const ENTITY_RESOURCES = [
  "notes",
  "papers",
  "ideas",
  "topics",
  "tasks",
  "goals",
] as const;

type EntityResourceName = (typeof ENTITY_RESOURCES)[number];

interface EntityMeta {
  resource: EntityResourceName;
  path: string;
  aliasPath?: string;
  createRequired: string[];
  createOptional: string[];
  schema: Record<string, string>;
  createExample: Record<string, unknown>;
  batchExample: unknown;
}

const ENTITY_META: EntityMeta[] = [
  {
    resource: "notes",
    path: "/notes",
    createRequired: ["markdown_body"],
    createOptional: ["title", "tags", "linked_entity_ids"],
    schema: {
      title: "string|null (max 255)",
      markdown_body: "string (1-100000, required on create)",
      tags: "string[]",
      linked_entity_ids: "string[] (entity cross-links)",
    },
    createExample: {
      title: "Transformer scaling notes",
      markdown_body: "Key takeaways from today's reading...",
      tags: ["agent", "literature"],
    },
    batchExample: [
      {
        title: "Transformer scaling notes",
        markdown_body: "Key takeaways from today...",
        tags: ["agent", "literature"],
      },
      {
        title: "Open questions",
        markdown_body: "- Compare retrieval baselines\n- Check ablations",
        tags: ["agent"],
      },
    ],
  },
  {
    resource: "papers",
    path: "/papers",
    createRequired: ["title"],
    createOptional: [
      "authors",
      "doi",
      "source_url",
      "status",
      "topic_ids",
      "abstract",
      "publication_date",
    ],
    schema: {
      title: "string (1-255, required on create)",
      authors: "string[]",
      doi: "string|null",
      source_url: "string|null (uri)",
      status: "To Read | Reading | Read",
      topic_ids: "string[]",
      abstract: "string|null (max 5000)",
      publication_date: "string|null",
    },
    createExample: {
      title: "Attention Is All You Need",
      authors: ["Vaswani et al."],
      doi: "10.48550/arXiv.1706.03762",
      status: "To Read",
      topic_ids: [],
    },
    batchExample: [
      {
        title: "Scaling Laws for Neural Language Models",
        authors: ["Kaplan et al."],
        status: "To Read",
      },
    ],
  },
  {
    resource: "ideas",
    path: "/ideas",
    createRequired: ["title"],
    createOptional: [
      "description",
      "stage",
      "linked_note_ids",
      "linked_paper_ids",
    ],
    schema: {
      title: "string (1-255, required on create)",
      description: "string|null (max 5000)",
      stage: "Seed | Developing | Supported | Mature",
      linked_note_ids: "uuid[]",
      linked_paper_ids: "uuid[]",
    },
    createExample: {
      title: "Retrieval-augmented scaling hypothesis",
      description: "Compare dense vs sparse retrieval at 7B and 70B.",
      stage: "Seed",
    },
    batchExample: [
      {
        title: "Mixture-of-experts efficiency",
        stage: "Developing",
      },
    ],
  },
  {
    resource: "topics",
    path: "/topics",
    createRequired: ["name"],
    createOptional: ["description"],
    schema: {
      name: "string (1-50, required on create)",
      description: "string|null (max 500)",
    },
    createExample: {
      name: "LLM scaling",
      description: "Papers and notes on model scaling laws.",
    },
    batchExample: [{ name: "Retrieval" }, { name: "Efficiency" }],
  },
  {
    resource: "tasks",
    path: "/tasks",
    createRequired: ["title"],
    createOptional: [
      "description",
      "completed",
      "priority",
      "category",
      "project_id",
      "due_date",
    ],
    schema: {
      title: "string (1-255, required on create)",
      description: "string|null (max 1000)",
      completed: "boolean",
      priority: "high | medium | low",
      category: "string|null",
      project_id: "uuid|null",
      due_date: "string|null (date-time)",
    },
    createExample: {
      title: "Summarize new retrieval papers",
      description: "Create notes for the top five relevant papers.",
      priority: "high",
    },
    batchExample: [
      {
        title: "Summarize new retrieval papers",
        description: "Create notes for the top five relevant papers.",
        priority: "high",
      },
      {
        title: "Prepare experiment checklist",
        description: "Turn agent findings into implementation tasks.",
        priority: "medium",
      },
    ],
  },
  {
    resource: "goals",
    path: "/goals",
    aliasPath: "/research_goals",
    createRequired: ["title"],
    createOptional: [
      "description",
      "target_date",
      "progress",
      "target_value",
      "status",
    ],
    schema: {
      title: "string (1-255, required on create)",
      description: "string|null (max 5000)",
      target_date: "string|null (date)",
      progress: "integer (>= 0)",
      target_value: "integer (>= 1)",
      status: "active | completed | archived",
    },
    createExample: {
      title: "Publish scaling study draft",
      target_date: "2026-12-01",
      progress: 0,
      target_value: 100,
      status: "active",
    },
    batchExample: [{ title: "Complete literature review", status: "active" }],
  },
];

function entityEndpoints(meta: EntityMeta): ExploreEndpointDoc[] {
  const scopeRead = `${meta.resource}:read`;
  const scopeWrite = `${meta.resource}:write`;
  const op = meta.resource.charAt(0).toUpperCase() +
    meta.resource.slice(1).replace(/s$/, "") +
    (meta.resource.endsWith("s") ? "s" : "");

  const paths = meta.aliasPath ? [meta.path, meta.aliasPath] : [meta.path];
  const endpoints: ExploreEndpointDoc[] = [];

  for (const path of paths) {
    const suffix = path === meta.aliasPath ? "ResearchGoals" : op;

    endpoints.push(
      {
        operation_id: `list${suffix}`,
        method: "GET",
        path,
        summary: `List ${meta.resource}`,
        resource: meta.resource,
        action: "list",
        required_scope: scopeRead,
        auth_required: true,
        request: {
          content_type: "none",
          query_params: {
            limit: "integer 1-200 (default 50)",
            offset: "integer >= 0 (default 0)",
          },
        },
        response: { status: 200, envelope: `{ data: ${meta.resource}[] }` },
        errors: ["403 FORBIDDEN"],
      },
      {
        operation_id: `create${suffix}`,
        method: "POST",
        path,
        summary: `Create ${meta.resource.replace(/s$/, "")}`,
        resource: meta.resource,
        action: "create",
        required_scope: scopeWrite,
        auth_required: true,
        request: {
          content_type: "application/json",
          required_fields: meta.createRequired,
          optional_fields: meta.createOptional,
          schema: meta.schema,
          example: meta.createExample,
        },
        response: { status: 201, envelope: `{ data: ${meta.resource.slice(0, -1) || meta.resource} }` },
        errors: ["400 VALIDATION_ERROR", "403 FORBIDDEN"],
      },
      {
        operation_id: `get${suffix}`,
        method: "GET",
        path: `${path}/{id}`,
        summary: `Get ${meta.resource.replace(/s$/, "")} by id`,
        resource: meta.resource,
        action: "get",
        required_scope: scopeRead,
        auth_required: true,
        request: {
          content_type: "none",
          path_params: { id: "uuid" },
        },
        response: { status: 200, envelope: `{ data: entity }` },
        errors: ["404 NOT_FOUND", "403 FORBIDDEN"],
      },
      {
        operation_id: `update${suffix}`,
        method: "PATCH",
        path: `${path}/{id}`,
        summary: `Update ${meta.resource.replace(/s$/, "")}`,
        resource: meta.resource,
        action: "update",
        required_scope: scopeWrite,
        auth_required: true,
        request: {
          content_type: "application/json",
          optional_fields: meta.createOptional,
          schema: meta.schema,
          path_params: { id: "uuid" },
        },
        response: { status: 200, envelope: `{ data: entity }` },
        errors: ["400 VALIDATION_ERROR", "404 NOT_FOUND", "403 FORBIDDEN"],
      },
      {
        operation_id: `delete${suffix}`,
        method: "DELETE",
        path: `${path}/{id}`,
        summary: `Delete ${meta.resource.replace(/s$/, "")}`,
        resource: meta.resource,
        action: "delete",
        required_scope: scopeWrite,
        auth_required: true,
        request: {
          content_type: "none",
          path_params: { id: "uuid" },
        },
        response: { status: 204, envelope: "empty body" },
        errors: ["404 NOT_FOUND", "403 FORBIDDEN"],
      },
      {
        operation_id: `batchCreate${suffix}`,
        method: "POST",
        path: `${path}:batchCreate`,
        summary: `Batch create ${meta.resource} (max 50)`,
        resource: meta.resource,
        action: "batchCreate",
        required_scope: scopeWrite,
        auth_required: true,
        request: {
          content_type: "application/json",
          body_shapes: [
            "array of input objects",
            `{ items: input[] }`,
            `{ data: input[] }`,
            `{ ${meta.resource}: input[] }`,
          ],
          schema: meta.schema,
          example: meta.batchExample,
        },
        response: {
          status: "201 or 207",
          envelope: "{ data: created[], errors: { index, error }[] }",
        },
        errors: ["400 VALIDATION_ERROR", "403 FORBIDDEN"],
      },
    );
  }

  return endpoints;
}

function topicLinkEndpoints(): ExploreEndpointDoc[] {
  const request = {
    content_type: "application/json",
    required_fields: ["entity_type", "entity_id"],
    optional_fields: [],
    schema: {
      entity_type: "note | paper | idea",
      entity_id: "uuid",
    },
    example: { entity_type: "note", entity_id: "00000000-0000-4000-8000-000000000001" },
  };

  return [
    {
      operation_id: "attachTopic",
      method: "POST",
      path: "/topics/{id}/attach",
      summary: "Attach a note, paper, or idea to a topic",
      resource: "topics",
      action: "attach",
      required_scope: "topics:write",
      auth_required: true,
      request: { ...request, path_params: { id: "uuid (topic id)" } },
      response: { status: 200, envelope: "{ data: object }" },
      errors: ["400 VALIDATION_ERROR", "404 NOT_FOUND", "403 FORBIDDEN"],
    },
    {
      operation_id: "detachTopic",
      method: "POST",
      path: "/topics/{id}/detach",
      summary: "Detach a note, paper, or idea from a topic",
      resource: "topics",
      action: "detach",
      required_scope: "topics:write",
      auth_required: true,
      request: { ...request, path_params: { id: "uuid (topic id)" } },
      response: { status: 200, envelope: "{ data: object }" },
      errors: ["400 VALIDATION_ERROR", "404 NOT_FOUND", "403 FORBIDDEN"],
    },
  ];
}

function feedEndpoints(): ExploreEndpointDoc[] {
  return [
    {
      operation_id: "listFeedSources",
      method: "GET",
      path: "/feed-sources",
      summary: "List feed sources",
      resource: "feeds",
      action: "list",
      required_scope: "feeds:read",
      auth_required: true,
      response: { status: 200, envelope: "{ data: FeedSource[] }" },
      errors: ["401 UNAUTHORIZED", "403 FORBIDDEN"],
    },
    {
      operation_id: "createFeedSource",
      method: "POST",
      path: "/feed-sources",
      summary: "Create a feed source",
      resource: "feeds",
      action: "create",
      required_scope: "feeds:write",
      auth_required: true,
      request: {
        content_type: "application/json",
        required_fields: ["name", "kind"],
        optional_fields: ["config", "enabled"],
        schema: {
          name: "string (1-200)",
          kind: "string (1-64)",
          config: "object (default {})",
          enabled: "boolean (default true)",
        },
        example: {
          name: "arXiv cs.CL",
          kind: "rss",
          config: { url: "https://export.arxiv.org/rss/cs.CL" },
          enabled: true,
        },
      },
      response: { status: 201, envelope: "{ data: FeedSource }" },
      errors: ["400 VALIDATION_ERROR", "403 FORBIDDEN"],
    },
    {
      operation_id: "getFeedSource",
      method: "GET",
      path: "/feed-sources/{id}",
      summary: "Get a feed source",
      resource: "feeds",
      action: "get",
      required_scope: "feeds:read",
      auth_required: true,
      request: { content_type: "none", path_params: { id: "uuid" } },
      response: { status: 200, envelope: "{ data: FeedSource }" },
      errors: ["404 NOT_FOUND"],
    },
    {
      operation_id: "updateFeedSource",
      method: "PATCH",
      path: "/feed-sources/{id}",
      summary: "Update a feed source",
      resource: "feeds",
      action: "update",
      required_scope: "feeds:write",
      auth_required: true,
      request: {
        content_type: "application/json",
        optional_fields: ["name", "kind", "config", "enabled"],
        path_params: { id: "uuid" },
      },
      response: { status: 200, envelope: "{ data: FeedSource }" },
      errors: ["400 VALIDATION_ERROR", "404 NOT_FOUND"],
    },
    {
      operation_id: "deleteFeedSource",
      method: "DELETE",
      path: "/feed-sources/{id}",
      summary: "Delete a feed source",
      resource: "feeds",
      action: "delete",
      required_scope: "feeds:write",
      auth_required: true,
      request: { content_type: "none", path_params: { id: "uuid" } },
      response: { status: 204, envelope: "empty body" },
      errors: ["404 NOT_FOUND"],
    },
    {
      operation_id: "listFeedItems",
      method: "GET",
      path: "/feed-items",
      summary: "List feed items",
      resource: "feeds",
      action: "list",
      required_scope: "feeds:read",
      auth_required: true,
      request: {
        content_type: "none",
        query_params: {
          type: "paper | job | news | custom",
          status: "new | triaged | archived | promoted",
        },
      },
      response: { status: 200, envelope: "{ data: FeedItem[] }" },
      errors: ["400 VALIDATION_ERROR", "403 FORBIDDEN"],
    },
    {
      operation_id: "createFeedItem",
      method: "POST",
      path: "/feed-items",
      summary: "Create a single feed item",
      resource: "feeds",
      action: "ingest",
      required_scope: "feeds:ingest",
      auth_required: true,
      request: {
        content_type: "application/json",
        required_fields: ["type", "title"],
        optional_fields: [
          "source_id",
          "summary",
          "url",
          "payload",
          "external_id",
          "published_at",
        ],
        schema: {
          type: "paper | job | news | custom",
          title: "string (1-500)",
          source_id: "uuid|null",
          summary: "string|null",
          url: "string|null",
          payload: "object",
          external_id: "string|null",
          published_at: "string|null (date-time)",
        },
        example: {
          type: "paper",
          title: "New scaling law preprint",
          summary: "Authors propose updated compute-optimal frontier.",
          url: "https://arxiv.org/abs/0000.00000",
          external_id: "arxiv:0000.00000",
        },
      },
      response: { status: 201, envelope: "{ data: FeedItem }" },
      errors: ["400 VALIDATION_ERROR", "409 CONFLICT", "403 FORBIDDEN"],
    },
    {
      operation_id: "batchCreateFeedItems",
      method: "POST",
      path: "/feed-items:batchCreate",
      summary: "Batch ingest feed items (max 100)",
      resource: "feeds",
      action: "batchCreate",
      required_scope: "feeds:ingest",
      auth_required: true,
      request: {
        content_type: "application/json",
        required_fields: ["items"],
        schema: {
          items: "FeedItemInput[] (1-100)",
        },
        example: {
          items: [
            {
              type: "paper",
              title: "Efficient fine-tuning survey",
              external_id: "feed-001",
            },
            {
              type: "news",
              title: "New benchmark released",
              external_id: "feed-002",
            },
          ],
        },
      },
      response: {
        status: 201,
        envelope:
          "{ data: FeedItem[], skipped: [], created_count, skipped_count }",
      },
      errors: ["400 VALIDATION_ERROR", "403 FORBIDDEN"],
    },
    {
      operation_id: "patchFeedItem",
      method: "PATCH",
      path: "/feed-items/{id}",
      summary: "Update feed item triage status",
      resource: "feeds",
      action: "update",
      required_scope: "feeds:write",
      auth_required: true,
      request: {
        content_type: "application/json",
        required_fields: ["status"],
        schema: { status: "new | triaged | archived" },
        example: { status: "triaged" },
        path_params: { id: "uuid" },
      },
      response: { status: 200, envelope: "{ data: FeedItem }" },
      errors: ["400 VALIDATION_ERROR", "404 NOT_FOUND", "403 FORBIDDEN"],
    },
    {
      operation_id: "promoteFeedItem",
      method: "POST",
      path: "/feed-items/{id}/promote",
      summary: "Promote a feed item to a paper, task, or note",
      resource: "feeds",
      action: "promote",
      required_scope: "feeds:write (+ target entity write scope)",
      auth_required: true,
      request: {
        content_type: "application/json",
        required_fields: ["target"],
        optional_fields: ["fields"],
        schema: {
          target: "paper | task | note",
          fields: "object (optional overrides for created entity)",
        },
        example: { target: "paper", fields: { status: "To Read" } },
        path_params: { id: "uuid" },
      },
      response: { status: 201, envelope: "{ data: promoted entity }" },
      errors: [
        "400 VALIDATION_ERROR",
        "404 NOT_FOUND",
        "409 CONFLICT",
        "403 FORBIDDEN",
      ],
    },
  ];
}

function keyEndpoints(): ExploreEndpointDoc[] {
  return [
    {
      operation_id: "listApiKeys",
      method: "GET",
      path: "/keys",
      summary: "List API keys for the authenticated user",
      resource: "keys",
      action: "list",
      required_scope: "keys:read",
      auth_required: true,
      response: { status: 200, envelope: "{ data: ApiKeyPublic[] }" },
      errors: ["401 UNAUTHORIZED"],
    },
    {
      operation_id: "createApiKey",
      method: "POST",
      path: "/keys",
      summary: "Mint a new scoped API key (JWT session required)",
      resource: "keys",
      action: "create",
      required_scope: "JWT only (not API key)",
      auth_required: true,
      request: {
        content_type: "application/json",
        required_fields: ["name", "scopes"],
        optional_fields: ["expires_at"],
        schema: {
          name: "string (1-100)",
          scopes: `non-empty subset of: ${ALL_SCOPES.join(", ")}`,
          expires_at: "string|null (ISO-8601)",
        },
        example: {
          name: "Local research agent",
          scopes: ["notes:write", "tasks:write"],
        },
      },
      response: {
        status: 201,
        envelope: "{ key: raw_secret_once, api_key: ApiKeyPublic }",
      },
      errors: ["400 VALIDATION_ERROR", "403 FORBIDDEN"],
    },
    {
      operation_id: "revokeApiKey",
      method: "DELETE",
      path: "/keys/{id}",
      summary: "Revoke an API key",
      resource: "keys",
      action: "delete",
      required_scope: "keys:write",
      auth_required: true,
      request: { content_type: "none", path_params: { id: "uuid" } },
      response: { status: 204, envelope: "empty body" },
      errors: ["404 NOT_FOUND", "401 UNAUTHORIZED"],
    },
  ];
}

function metaEndpoints(): ExploreEndpointDoc[] {
  return [
    {
      operation_id: "getHealth",
      method: "GET",
      path: "/health",
      summary: "Health check",
      resource: "meta",
      action: "get",
      required_scope: null,
      auth_required: false,
      response: {
        status: 200,
        envelope: "{ status: ok, version, timestamp }",
      },
    },
    {
      operation_id: "getOpenApi",
      method: "GET",
      path: "/openapi.json",
      summary: "Full OpenAPI 3.1 machine contract",
      resource: "meta",
      action: "get",
      required_scope: null,
      auth_required: false,
      response: { status: 200, envelope: "OpenAPI 3.1 JSON document" },
    },
    {
      operation_id: "getExplore",
      method: "GET",
      path: "/explore",
      summary: "Agent-friendly API discovery with examples and workflows",
      resource: "meta",
      action: "get",
      required_scope: null,
      auth_required: false,
      request: {
        content_type: "none",
        query_params: {
          resource:
            "notes | papers | ideas | topics | tasks | goals | feeds | keys | meta",
          action:
            "list | get | create | update | delete | batchCreate | attach | detach | promote | ingest",
          include: "schemas,examples,workflows,scopes (comma-separated)",
        },
      },
      response: { status: 200, envelope: "{ data: AgentExploreDocument }" },
    },
  ];
}

const WORKFLOWS: ExploreWorkflowDoc[] = [
  {
    name: "Bulk ingest literature as notes",
    resources: ["notes", "topics"],
    steps: [
      "Ensure API key has notes:write scope",
      "POST /notes:batchCreate with array of NoteInput objects (max 50 per request)",
      "Optionally POST /topics/{id}/attach to organize notes under a topic",
    ],
  },
  {
    name: "Create reading tasks from new papers",
    resources: ["papers", "tasks"],
    steps: [
      "Ensure API key has papers:write and tasks:write scopes",
      "POST /papers:batchCreate with bibliographic metadata",
      "POST /tasks:batchCreate with titles referencing each paper",
    ],
  },
  {
    name: "Ingest external feed and promote to paper",
    resources: ["feeds", "papers"],
    steps: [
      "POST /feed-items:batchCreate with scope feeds:ingest",
      "PATCH /feed-items/{id} with { status: triaged } (scope: feeds:write)",
      "POST /feed-items/{id}/promote with { target: paper } (scope: feeds:write + papers:write)",
    ],
  },
  {
    name: "Organize research under topics",
    resources: ["topics", "notes", "papers", "ideas"],
    steps: [
      "POST /topics to create a theme (scope: topics:write)",
      "Create or list entities (notes, papers, ideas)",
      "POST /topics/{id}/attach with { entity_type, entity_id }",
    ],
  },
  {
    name: "Mint and use an agent API key",
    resources: ["keys", "meta"],
    steps: [
      "Sign in via Supabase Auth to obtain a user JWT",
      "POST /keys with desired scopes (JWT required, not another API key)",
      "Store the returned rq_... secret; use Authorization: Bearer rq_... for agent calls",
      "GET /explore?resource=notes to inspect required fields before writing",
    ],
  },
];

function allEndpoints(): ExploreEndpointDoc[] {
  return [
    ...metaEndpoints(),
    ...keyEndpoints(),
    ...ENTITY_META.flatMap(entityEndpoints),
    ...topicLinkEndpoints(),
    ...feedEndpoints(),
  ];
}

function endpointMatchesFilters(
  endpoint: ExploreEndpointDoc,
  filters: ExploreFilters,
): boolean {
  if (filters.resource && endpoint.resource !== filters.resource) {
    return false;
  }
  if (filters.action && endpoint.action !== filters.action) {
    return false;
  }
  return true;
}

function workflowMatchesFilters(
  workflow: ExploreWorkflowDoc,
  filters: ExploreFilters,
): boolean {
  if (filters.resource && !workflow.resources.includes(filters.resource)) {
    return false;
  }
  if (filters.action) {
    const actionHint = filters.action.toLowerCase();
    const matches = workflow.steps.some((step) =>
      step.toLowerCase().includes(actionHint)
    );
    if (!matches) return false;
  }
  return true;
}

function stripExamples(endpoint: ExploreEndpointDoc): ExploreEndpointDoc {
  if (!endpoint.request?.example) return endpoint;
  const { example: _example, ...requestRest } = endpoint.request;
  return { ...endpoint, request: requestRest };
}

function stripSchemas(endpoint: ExploreEndpointDoc): ExploreEndpointDoc {
  if (!endpoint.request?.schema) return endpoint;
  const { schema: _schema, ...requestRest } = endpoint.request;
  return { ...endpoint, request: requestRest };
}

function applyIncludeFilters(
  doc: AgentExploreDocument,
  filters: ExploreFilters,
): AgentExploreDocument {
  const includeAll = filters.include.size === 0 ||
    filters.include.size === EXPLORE_INCLUDES.length;

  let endpoints = doc.endpoints;

  if (!includeAll && !filters.include.has("examples")) {
    endpoints = endpoints.map(stripExamples);
  }
  if (!includeAll && !filters.include.has("schemas")) {
    endpoints = endpoints.map(stripSchemas);
  }

  const result: AgentExploreDocument = {
    ...doc,
    endpoints,
  };

  if (!includeAll && !filters.include.has("scopes")) {
    delete result.auth;
  }
  if (!includeAll && !filters.include.has("workflows")) {
    delete result.workflows;
  }
  if (!includeAll && !filters.include.has("schemas")) {
    delete result.domain;
  }

  return result;
}

export function parseExploreFilters(
  params: URLSearchParams,
): ExploreFilters | Response {
  const resourceRaw = params.get("resource")?.trim().toLowerCase();
  const actionRaw = params.get("action")?.trim();
  const includeRaw = params.get("include")?.trim();

  let resource: ExploreResource | undefined;
  if (resourceRaw) {
    if (!(EXPLORE_RESOURCES as readonly string[]).includes(resourceRaw)) {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message:
              `Invalid resource. Must be one of: ${EXPLORE_RESOURCES.join(", ")}`,
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    resource = resourceRaw as ExploreResource;
  }

  let action: ExploreAction | undefined;
  if (actionRaw) {
    const normalized = actionRaw.trim();
    const match = EXPLORE_ACTIONS.find(
      (candidate) => candidate.toLowerCase() === normalized.toLowerCase(),
    );
    if (!match) {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message:
              `Invalid action. Must be one of: ${EXPLORE_ACTIONS.join(", ")}`,
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    action = match;
  }

  let include: Set<ExploreInclude>;
  if (includeRaw) {
    const parts = includeRaw.split(",").map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const invalid = parts.filter(
      (part) => !(EXPLORE_INCLUDES as readonly string[]).includes(part),
    );
    if (invalid.length > 0) {
      return new Response(
        JSON.stringify({
          error: {
            code: "VALIDATION_ERROR",
            message:
              `Invalid include values: ${invalid.join(", ")}. Must be subset of: ${EXPLORE_INCLUDES.join(", ")}`,
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    include = new Set(parts as ExploreInclude[]);
  } else {
    include = new Set(EXPLORE_INCLUDES);
  }

  return { resource, action, include };
}

/** Agent-oriented API discovery document for LLM and automation clients. */
export function getAgentExploreDocument(
  baseUrl: string,
  filters: ExploreFilters = {
    include: new Set(EXPLORE_INCLUDES),
  },
): { data: AgentExploreDocument } {
  const filteredEndpoints = allEndpoints().filter((endpoint) =>
    endpointMatchesFilters(endpoint, filters)
  );

  const domainEntries = Object.entries(DOMAIN).filter(([key]) => {
    if (!filters.resource) return true;
    return key === filters.resource;
  });

  const domain = Object.fromEntries(domainEntries);

  const workflows = WORKFLOWS.filter((workflow) =>
    workflowMatchesFilters(workflow, filters)
  );

  const doc: AgentExploreDocument = {
    api: {
      name: "ResearchQuest Agent API",
      version: API_VERSION,
      base_url: baseUrl,
      purpose:
        "Scoped REST gateway for AI agents and automation to manage research notes, papers, ideas, tasks, goals, and external feeds.",
      related_discovery: {
        openapi: "/openapi.json",
        health: "/health",
        explore: "/explore",
      },
    },
    auth: {
      header: "Authorization: Bearer <token>",
      modes: [
        {
          type: "api_key",
          prefix: "rq_",
          usage: "Agent automation with scoped permissions",
        },
        {
          type: "jwt",
          usage: "Full access; required to mint API keys",
        },
      ],
      scopes: [...ALL_SCOPES],
    },
    domain,
    endpoints: filteredEndpoints,
    workflows,
  };

  return { data: applyIncludeFilters(doc, filters) };
}
