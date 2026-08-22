import {
  type AuthContext,
  requireScopes,
  writeAudit,
} from "../_shared/auth.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH_ITEMS = 50;

export type EntityResource =
  | "notes"
  | "papers"
  | "ideas"
  | "topics"
  | "tasks"
  | "goals";
type EntityAction =
  | "list"
  | "get"
  | "create"
  | "update"
  | "delete"
  | "batchCreate"
  | "attach"
  | "detach";
type TopicEntityType = "note" | "paper" | "idea";

export interface EntityRouteMatch {
  action: EntityAction;
  resource: EntityResource;
  id?: string;
}

interface EntityConfig {
  resource: EntityResource;
  table: string;
  scopeResource: string;
  select: string;
  orderColumn: string;
}

interface ValidationOk {
  ok: true;
  payload: Record<string, unknown>;
}

interface ValidationErr {
  ok: false;
  error: string;
}

type ValidationResult = ValidationOk | ValidationErr;

const ENTITY_CONFIGS: Record<EntityResource, EntityConfig> = {
  notes: {
    resource: "notes",
    table: "notes",
    scopeResource: "notes",
    select:
      "id, user_id, title, markdown_body, tags, linked_entity_ids, created_at, updated_at",
    orderColumn: "updated_at",
  },
  papers: {
    resource: "papers",
    table: "papers",
    scopeResource: "papers",
    select:
      "id, user_id, title, authors, doi, source_url, status, topic_ids, abstract, publication_date, created_at, updated_at",
    orderColumn: "updated_at",
  },
  ideas: {
    resource: "ideas",
    table: "ideas",
    scopeResource: "ideas",
    select:
      "id, user_id, title, description, stage, linked_note_ids, linked_paper_ids, created_at, updated_at",
    orderColumn: "updated_at",
  },
  topics: {
    resource: "topics",
    table: "topics",
    scopeResource: "topics",
    select: "id, user_id, name, description, created_at, updated_at",
    orderColumn: "updated_at",
  },
  tasks: {
    resource: "tasks",
    table: "tasks",
    scopeResource: "tasks",
    select:
      "id, user_id, title, description, completed, priority, category, project_id, due_date, created_at, updated_at",
    orderColumn: "due_date",
  },
  goals: {
    resource: "goals",
    table: "research_goals",
    scopeResource: "goals",
    select:
      "id, user_id, title, description, target_date, progress, target_value, status, created_at, updated_at",
    orderColumn: "updated_at",
  },
};

const TOPIC_LINKS: Record<
  TopicEntityType,
  { table: string; column: string; entityTable: string }
> = {
  note: { table: "topic_notes", column: "note_id", entityTable: "notes" },
  paper: { table: "topic_papers", column: "paper_id", entityTable: "papers" },
  idea: { table: "topic_ideas", column: "idea_id", entityTable: "ideas" },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowOrNull(value: unknown): Record<string, unknown> | null {
  return value ? (value as Record<string, unknown>) : null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string");
}

function trimString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function optionalTrimmedString(
  payload: Record<string, unknown>,
  source: Record<string, unknown>,
  field: string,
  maxLength?: number,
): string | null {
  const raw = source[field];
  if (raw === null) {
    payload[field] = null;
    return null;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (maxLength && trimmed.length > maxLength) {
    throw new Error(`${field} exceeds ${maxLength} characters`);
  }
  payload[field] = trimmed || null;
  return trimmed || null;
}

function copyStringArray(
  payload: Record<string, unknown>,
  source: Record<string, unknown>,
  field: string,
): void {
  if (source[field] === undefined) return;
  if (!isStringArray(source[field])) {
    throw new Error(`${field} must be an array of strings`);
  }
  payload[field] = source[field];
}

function copyBoolean(
  payload: Record<string, unknown>,
  source: Record<string, unknown>,
  field: string,
): void {
  if (source[field] === undefined) return;
  if (typeof source[field] !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }
  payload[field] = source[field];
}

function copyInteger(
  payload: Record<string, unknown>,
  source: Record<string, unknown>,
  field: string,
  min?: number,
): void {
  if (source[field] === undefined) return;
  if (!Number.isInteger(source[field])) {
    throw new Error(`${field} must be an integer`);
  }
  if (min !== undefined && (source[field] as number) < min) {
    throw new Error(`${field} must be at least ${min}`);
  }
  payload[field] = source[field];
}

function copyUuid(
  payload: Record<string, unknown>,
  source: Record<string, unknown>,
  field: string,
): void {
  if (
    source[field] === undefined || source[field] === null ||
    source[field] === ""
  ) return;
  if (
    typeof source[field] !== "string" || !UUID_RE.test(source[field] as string)
  ) {
    throw new Error(`${field} must be a UUID`);
  }
  payload[field] = source[field];
}

function copyDateLike(
  payload: Record<string, unknown>,
  source: Record<string, unknown>,
  field: string,
): void {
  if (source[field] === undefined) return;
  if (source[field] === null || source[field] === "") {
    payload[field] = null;
    return;
  }
  if (typeof source[field] !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = source[field].trim();
  if (Number.isNaN(Date.parse(trimmed))) {
    throw new Error(`${field} must be a valid date`);
  }
  payload[field] = trimmed;
}

function copyEnum(
  payload: Record<string, unknown>,
  source: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
  fallback?: string,
): void {
  const value = source[field] === undefined || source[field] === null ||
      source[field] === ""
    ? fallback
    : source[field];
  if (value === undefined) return;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
  }
  payload[field] = value;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseResource(value: string): EntityResource | null {
  if (value === "research_goals" || value === "goals") return "goals";
  if (
    value === "notes" ||
    value === "papers" ||
    value === "ideas" ||
    value === "topics" ||
    value === "tasks"
  ) {
    return value;
  }
  return null;
}

export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function matchEntityRoute(
  method: string,
  path: string,
): EntityRouteMatch | null {
  const batchMatch = /^\/([^/]+):batchCreate$/.exec(path);
  if (method === "POST" && batchMatch) {
    const resource = parseResource(batchMatch[1]);
    return resource ? { action: "batchCreate", resource } : null;
  }

  const topicLinkMatch = /^\/topics\/([^/]+)\/(attach|detach)$/.exec(path);
  if (method === "POST" && topicLinkMatch) {
    return {
      action: topicLinkMatch[2] as "attach" | "detach",
      resource: "topics",
      id: topicLinkMatch[1],
    };
  }

  const collectionMatch = /^\/([^/]+)$/.exec(path);
  if (collectionMatch) {
    const resource = parseResource(collectionMatch[1]);
    if (!resource) return null;
    if (method === "GET") return { action: "list", resource };
    if (method === "POST") return { action: "create", resource };
  }

  const itemMatch = /^\/([^/]+)\/([^/]+)$/.exec(path);
  if (itemMatch) {
    const resource = parseResource(itemMatch[1]);
    if (!resource) return null;
    if (method === "GET") return { action: "get", resource, id: itemMatch[2] };
    if (method === "PATCH") {
      return { action: "update", resource, id: itemMatch[2] };
    }
    if (method === "DELETE") {
      return { action: "delete", resource, id: itemMatch[2] };
    }
  }

  return null;
}

export function requiredScopeForRoute(route: EntityRouteMatch): string {
  const scopeResource = ENTITY_CONFIGS[route.resource].scopeResource;
  const mode = route.action === "list" || route.action === "get"
    ? "read"
    : "write";
  return `${scopeResource}:${mode}`;
}

export function validateBatchItems(
  value: unknown,
): { ok: true; items: unknown[] } | ValidationErr {
  const items = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
    ? value.items
    : isRecord(value) && Array.isArray(value.data)
    ? value.data
    : null;
  if (!items) {
    return {
      ok: false,
      error: "Batch body must be an array or contain items/data array",
    };
  }
  if (items.length > MAX_BATCH_ITEMS) {
    return {
      ok: false,
      error: `Batch create accepts at most ${MAX_BATCH_ITEMS} items`,
    };
  }
  return { ok: true, items };
}

export function validateEntityPayload(
  resource: EntityResource,
  value: unknown,
  operation: "create" | "update",
  userId = "00000000-0000-4000-8000-000000000000",
): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const payload: Record<string, unknown> = {};
  if (operation === "create") payload.user_id = userId;

  try {
    switch (resource) {
      case "notes": {
        if (operation === "create") {
          const body = trimString(value.markdown_body);
          if (!body) return { ok: false, error: "markdown_body is required" };
          if (body.length > 100000) {
            return {
              ok: false,
              error: "markdown_body exceeds 100000 characters",
            };
          }
          payload.markdown_body = body;
          payload.tags = isStringArray(value.tags) ? value.tags : [];
        } else if (value.markdown_body !== undefined) {
          const body = trimString(value.markdown_body);
          if (!body) {
            return { ok: false, error: "markdown_body cannot be empty" };
          }
          if (body.length > 100000) {
            return {
              ok: false,
              error: "markdown_body exceeds 100000 characters",
            };
          }
          payload.markdown_body = body;
        }
        optionalTrimmedString(payload, value, "title", 255);
        copyStringArray(payload, value, "tags");
        copyStringArray(payload, value, "linked_entity_ids");
        break;
      }

      case "papers": {
        if (operation === "create") {
          const title = trimString(value.title);
          if (!title) return { ok: false, error: "title is required" };
          if (title.length > 255) {
            return { ok: false, error: "title exceeds 255 characters" };
          }
          payload.title = title;
          payload.authors = isStringArray(value.authors) ? value.authors : [];
        } else if (value.title !== undefined) {
          const title = trimString(value.title);
          if (!title) return { ok: false, error: "title cannot be empty" };
          if (title.length > 255) {
            return { ok: false, error: "title exceeds 255 characters" };
          }
          payload.title = title;
        }
        copyStringArray(payload, value, "authors");
        optionalTrimmedString(payload, value, "doi", 255);
        if (value.source_url !== undefined) {
          const url = optionalTrimmedString(payload, value, "source_url", 2048);
          if (url && !isValidUrl(url)) {
            return { ok: false, error: "source_url must be an http(s) URL" };
          }
        }
        copyEnum(
          payload,
          value,
          "status",
          ["To Read", "Reading", "Read"],
          operation === "create" ? "To Read" : undefined,
        );
        copyStringArray(payload, value, "topic_ids");
        optionalTrimmedString(payload, value, "abstract", 5000);
        if (value.publication_date !== undefined) {
          const raw = trimString(value.publication_date);
          payload.publication_date = raw && /^\d{4}$/.test(raw)
            ? `${raw}-01-01`
            : raw || null;
        }
        break;
      }

      case "ideas": {
        if (operation === "create") {
          const title = trimString(value.title);
          if (!title) return { ok: false, error: "title is required" };
          if (title.length > 255) {
            return { ok: false, error: "title exceeds 255 characters" };
          }
          payload.title = title;
        } else if (value.title !== undefined) {
          const title = trimString(value.title);
          if (!title) return { ok: false, error: "title cannot be empty" };
          if (title.length > 255) {
            return { ok: false, error: "title exceeds 255 characters" };
          }
          payload.title = title;
        }
        optionalTrimmedString(payload, value, "description", 5000);
        copyEnum(
          payload,
          value,
          "stage",
          ["Seed", "Developing", "Supported", "Mature"],
          operation === "create" ? "Seed" : undefined,
        );
        copyStringArray(payload, value, "linked_note_ids");
        copyStringArray(payload, value, "linked_paper_ids");
        break;
      }

      case "topics": {
        if (operation === "create") {
          const name = trimString(value.name);
          if (!name) return { ok: false, error: "name is required" };
          if (name.length > 50) {
            return { ok: false, error: "name exceeds 50 characters" };
          }
          payload.name = name;
        } else if (value.name !== undefined) {
          const name = trimString(value.name);
          if (!name) return { ok: false, error: "name cannot be empty" };
          if (name.length > 50) {
            return { ok: false, error: "name exceeds 50 characters" };
          }
          payload.name = name;
        }
        optionalTrimmedString(payload, value, "description", 500);
        break;
      }

      case "tasks": {
        if (operation === "create") {
          const title = trimString(value.title);
          if (!title) return { ok: false, error: "title is required" };
          if (title.length > 255) {
            return { ok: false, error: "title exceeds 255 characters" };
          }
          payload.title = title;
          payload.completed = typeof value.completed === "boolean"
            ? value.completed
            : false;
        } else if (value.title !== undefined) {
          const title = trimString(value.title);
          if (!title) return { ok: false, error: "title cannot be empty" };
          if (title.length > 255) {
            return { ok: false, error: "title exceeds 255 characters" };
          }
          payload.title = title;
        }
        optionalTrimmedString(payload, value, "description", 1000);
        copyBoolean(payload, value, "completed");
        copyEnum(
          payload,
          value,
          "priority",
          ["high", "medium", "low"],
          operation === "create" ? "medium" : undefined,
        );
        optionalTrimmedString(payload, value, "category", 255);
        copyUuid(payload, value, "project_id");
        copyDateLike(payload, value, "due_date");
        break;
      }

      case "goals": {
        if (operation === "create") {
          const title = trimString(value.title);
          if (!title) return { ok: false, error: "title is required" };
          if (title.length > 255) {
            return { ok: false, error: "title exceeds 255 characters" };
          }
          payload.title = title;
        } else if (value.title !== undefined) {
          const title = trimString(value.title);
          if (!title) return { ok: false, error: "title cannot be empty" };
          if (title.length > 255) {
            return { ok: false, error: "title exceeds 255 characters" };
          }
          payload.title = title;
        }
        optionalTrimmedString(payload, value, "description", 5000);
        copyDateLike(payload, value, "target_date");
        copyInteger(payload, value, "progress", 0);
        copyInteger(payload, value, "target_value", 1);
        copyEnum(
          payload,
          value,
          "status",
          ["active", "completed", "archived"],
          operation === "create" ? "active" : undefined,
        );
        break;
      }
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Invalid request body",
    };
  }

  if (operation === "update" && Object.keys(payload).length === 0) {
    return { ok: false, error: "At least one updatable field is required" };
  }

  return { ok: true, payload };
}

async function parseJsonBody(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<unknown | Response> {
  try {
    return await req.json();
  } catch {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid JSON body",
      400,
      corsHeaders,
    );
  }
}

function invalidIdResponse(corsHeaders: Record<string, string>): Response {
  return errorResponse("VALIDATION_ERROR", "Invalid id", 400, corsHeaders);
}

function postgrestMessage(error: unknown): string {
  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }
  return "Database operation failed";
}

function configFor(resource: EntityResource): EntityConfig {
  return ENTITY_CONFIGS[resource];
}

async function handleList(
  ctx: AuthContext,
  req: Request,
  route: EntityRouteMatch,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const config = configFor(route.resource);
  const url = new URL(req.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 200)
    : 100;
  const requestedOffset = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(requestedOffset)
    ? Math.max(Math.trunc(requestedOffset), 0)
    : 0;

  const { data, error } = await ctx.supabaseAdmin
    .from(config.table)
    .select(config.select)
    .eq("user_id", ctx.userId)
    .order(config.orderColumn, { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error(`list ${config.table}`, error);
    return errorResponse(
      "INTERNAL_ERROR",
      `Failed to list ${route.resource}`,
      500,
      corsHeaders,
    );
  }

  return jsonResponse({ data: data ?? [] }, 200, corsHeaders);
}

async function handleGet(
  ctx: AuthContext,
  route: EntityRouteMatch,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (!route.id || !isValidUuid(route.id)) {
    return invalidIdResponse(corsHeaders);
  }
  const config = configFor(route.resource);

  const { data, error } = await ctx.supabaseAdmin
    .from(config.table)
    .select(config.select)
    .eq("id", route.id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (error) {
    console.error(`get ${config.table}`, error);
    return errorResponse(
      "INTERNAL_ERROR",
      `Failed to get ${route.resource}`,
      500,
      corsHeaders,
    );
  }
  if (!data) {
    return errorResponse(
      "NOT_FOUND",
      `${route.resource} not found`,
      404,
      corsHeaders,
    );
  }

  return jsonResponse({ data }, 200, corsHeaders);
}

async function selectOwnedRow(
  ctx: AuthContext,
  table: string,
  id: string,
  select = "id",
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  const { data, error } = await ctx.supabaseAdmin
    .from(table)
    .select(select)
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  return { data: rowOrNull(data), error };
}

async function saveIdeaWithLinks(
  ctx: AuthContext,
  payload: Record<string, unknown>,
  ideaId: string | null,
): Promise<{ data: unknown | null; error: unknown | null }> {
  if (ctx.authMode !== "jwt") {
    return { data: null, error: new Error("RPC requires JWT auth") };
  }

  const { data, error } = await ctx.supabaseUser.rpc("save_idea_with_links", {
    p_user_id: ctx.userId,
    p_idea_id: ideaId,
    p_title: payload.title,
    p_description: payload.description ?? null,
    p_stage: payload.stage ?? "Seed",
    p_linked_note_ids: payload.linked_note_ids ?? [],
    p_linked_paper_ids: payload.linked_paper_ids ?? [],
  });

  return { data: data ?? null, error: error ?? null };
}

async function createReadingTaskForPaper(
  ctx: AuthContext,
  paper: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: profile } = await ctx.supabaseAdmin
      .from("user_profiles")
      .select("auto_create_reading_tasks")
      .eq("id", ctx.userId)
      .maybeSingle();

    if (profile?.auto_create_reading_tasks === false) return;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dueDateString = dueDate.toISOString().split("T")[0];
    const rawTitle = typeof paper.title === "string"
      ? paper.title
      : "Untitled paper";
    const paperTitle = rawTitle.length > 50
      ? `${rawTitle.substring(0, 47)}...`
      : rawTitle;
    const authors = isStringArray(paper.authors) ? paper.authors : [];
    const authorText = authors.length > 0
      ? ` Authors: ${authors.slice(0, 3).join(", ")}${
        authors.length > 3 ? ", et al." : ""
      }`
      : "";

    const { error } = await ctx.supabaseAdmin.from("tasks").insert({
      user_id: ctx.userId,
      title: `Read: ${paperTitle}`,
      description: `Review and take notes on this paper.${authorText}`,
      priority: "medium",
      category: "Reading",
      due_date: dueDateString,
      completed: false,
    });

    if (error) console.error("create reading task", error);
  } catch (err) {
    console.error("create reading task", err);
  }
}

async function createEntity(
  ctx: AuthContext,
  resource: EntityResource,
  payload: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> | null; error: unknown | null }> {
  const config = configFor(resource);

  if (resource === "ideas") {
    const rpcResult = await saveIdeaWithLinks(ctx, payload, null);
    if (!rpcResult.error && rpcResult.data) {
      return { data: rpcResult.data as Record<string, unknown>, error: null };
    }
  }

  const { data, error } = await ctx.supabaseAdmin
    .from(config.table)
    .insert(payload)
    .select(config.select)
    .single();

  const row = rowOrNull(data);
  if (!error && row && resource === "papers") {
    await createReadingTaskForPaper(ctx, row);
  }

  return { data: row, error: error ?? null };
}

async function handleCreate(
  ctx: AuthContext,
  req: Request,
  route: EntityRouteMatch,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const body = await parseJsonBody(req, corsHeaders);
  if (body instanceof Response) return body;

  const validation = validateEntityPayload(
    route.resource,
    body,
    "create",
    ctx.userId,
  );
  if (!validation.ok) {
    return errorResponse(
      "VALIDATION_ERROR",
      validation.error,
      400,
      corsHeaders,
    );
  }

  const { data, error } = await createEntity(
    ctx,
    route.resource,
    validation.payload,
  );
  if (error || !data) {
    console.error(`create ${route.resource}`, error);
    return errorResponse(
      "INTERNAL_ERROR",
      `Failed to create ${route.resource}`,
      500,
      corsHeaders,
      postgrestMessage(error),
    );
  }

  await writeAudit(
    ctx,
    `${route.resource}.create`,
    `${configFor(route.resource).table}/${data.id}`,
    201,
    req,
  );
  return jsonResponse({ data }, 201, corsHeaders);
}

async function updateIdea(
  ctx: AuthContext,
  id: string,
  patch: Record<string, unknown>,
): Promise<
  {
    data: Record<string, unknown> | null;
    error: unknown | null;
    notFound?: boolean;
  }
> {
  const current = await selectOwnedRow(
    ctx,
    "ideas",
    id,
    ENTITY_CONFIGS.ideas.select,
  );
  if (current.error) return { data: null, error: current.error };
  if (!current.data) return { data: null, error: null, notFound: true };

  const merged = { ...current.data, ...patch, user_id: ctx.userId };
  const rpcResult = await saveIdeaWithLinks(ctx, merged, id);
  if (!rpcResult.error && rpcResult.data) {
    return { data: rpcResult.data as Record<string, unknown>, error: null };
  }

  const { data, error } = await ctx.supabaseAdmin
    .from("ideas")
    .update(patch)
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select(ENTITY_CONFIGS.ideas.select)
    .maybeSingle();

  const row = rowOrNull(data);
  return { data: row, error: error ?? null, notFound: !row };
}

async function handleUpdate(
  ctx: AuthContext,
  req: Request,
  route: EntityRouteMatch,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (!route.id || !isValidUuid(route.id)) {
    return invalidIdResponse(corsHeaders);
  }
  const body = await parseJsonBody(req, corsHeaders);
  if (body instanceof Response) return body;

  const validation = validateEntityPayload(
    route.resource,
    body,
    "update",
    ctx.userId,
  );
  if (!validation.ok) {
    return errorResponse(
      "VALIDATION_ERROR",
      validation.error,
      400,
      corsHeaders,
    );
  }

  let data: Record<string, unknown> | null;
  let error: unknown | null;
  let notFound = false;

  if (route.resource === "ideas") {
    const result = await updateIdea(ctx, route.id, validation.payload);
    data = result.data;
    error = result.error;
    notFound = Boolean(result.notFound);
  } else {
    const config = configFor(route.resource);
    const result = await ctx.supabaseAdmin
      .from(config.table)
      .update(validation.payload)
      .eq("id", route.id)
      .eq("user_id", ctx.userId)
      .select(config.select)
      .maybeSingle();
    data = rowOrNull(result.data);
    error = result.error ?? null;
    notFound = !result.data;
  }

  if (error) {
    console.error(`update ${route.resource}`, error);
    return errorResponse(
      "INTERNAL_ERROR",
      `Failed to update ${route.resource}`,
      500,
      corsHeaders,
      postgrestMessage(error),
    );
  }
  if (notFound || !data) {
    return errorResponse(
      "NOT_FOUND",
      `${route.resource} not found`,
      404,
      corsHeaders,
    );
  }

  await writeAudit(
    ctx,
    `${route.resource}.update`,
    `${configFor(route.resource).table}/${route.id}`,
    200,
    req,
  );
  return jsonResponse({ data }, 200, corsHeaders);
}

async function handleDelete(
  ctx: AuthContext,
  req: Request,
  route: EntityRouteMatch,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (!route.id || !isValidUuid(route.id)) {
    return invalidIdResponse(corsHeaders);
  }
  const config = configFor(route.resource);
  const { data, error } = await ctx.supabaseAdmin
    .from(config.table)
    .delete()
    .eq("id", route.id)
    .eq("user_id", ctx.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`delete ${route.resource}`, error);
    return errorResponse(
      "INTERNAL_ERROR",
      `Failed to delete ${route.resource}`,
      500,
      corsHeaders,
      postgrestMessage(error),
    );
  }
  if (!data) {
    return errorResponse(
      "NOT_FOUND",
      `${route.resource} not found`,
      404,
      corsHeaders,
    );
  }

  await writeAudit(
    ctx,
    `${route.resource}.delete`,
    `${config.table}/${route.id}`,
    204,
    req,
  );
  return new Response(null, { status: 204, headers: corsHeaders });
}

async function handleBatchCreate(
  ctx: AuthContext,
  req: Request,
  route: EntityRouteMatch,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const body = await parseJsonBody(req, corsHeaders);
  if (body instanceof Response) return body;

  const batch = validateBatchItems(body);
  if (!batch.ok) {
    return errorResponse("VALIDATION_ERROR", batch.error, 400, corsHeaders);
  }

  const data: unknown[] = [];
  const errors: { index: number; error: string }[] = [];

  for (const [index, item] of batch.items.entries()) {
    const validation = validateEntityPayload(
      route.resource,
      item,
      "create",
      ctx.userId,
    );
    if (!validation.ok) {
      errors.push({ index, error: validation.error });
      continue;
    }

    const created = await createEntity(ctx, route.resource, validation.payload);
    if (created.error || !created.data) {
      errors.push({ index, error: postgrestMessage(created.error) });
      continue;
    }
    data.push(created.data);
  }

  await writeAudit(
    ctx,
    `${route.resource}.batch_create`,
    configFor(route.resource).table,
    207,
    req,
    {
      requested: batch.items.length,
      created: data.length,
      errors: errors.length,
    },
  );

  return jsonResponse(
    { data, errors },
    errors.length > 0 ? 207 : 201,
    corsHeaders,
  );
}

function parseTopicLinkBody(value: unknown):
  | { ok: true; entityType: TopicEntityType; entityId: string }
  | ValidationErr {
  if (!isRecord(value)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const entityType = value.entity_type;
  if (
    entityType !== "note" && entityType !== "paper" && entityType !== "idea"
  ) {
    return {
      ok: false,
      error: "entity_type must be one of: note, paper, idea",
    };
  }
  if (typeof value.entity_id !== "string" || !isValidUuid(value.entity_id)) {
    return { ok: false, error: "entity_id must be a UUID" };
  }
  return { ok: true, entityType, entityId: value.entity_id };
}

async function handleTopicAttachDetach(
  ctx: AuthContext,
  req: Request,
  route: EntityRouteMatch,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (!route.id || !isValidUuid(route.id)) {
    return invalidIdResponse(corsHeaders);
  }
  const body = await parseJsonBody(req, corsHeaders);
  if (body instanceof Response) return body;

  const parsed = parseTopicLinkBody(body);
  if (!parsed.ok) {
    return errorResponse("VALIDATION_ERROR", parsed.error, 400, corsHeaders);
  }

  const topic = await selectOwnedRow(ctx, "topics", route.id);
  if (topic.error) {
    console.error("topic link topic lookup", topic.error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to lookup topic",
      500,
      corsHeaders,
    );
  }
  if (!topic.data) {
    return errorResponse("NOT_FOUND", "Topic not found", 404, corsHeaders);
  }

  const link = TOPIC_LINKS[parsed.entityType];
  const entity = await selectOwnedRow(ctx, link.entityTable, parsed.entityId);
  if (entity.error) {
    console.error("topic link entity lookup", entity.error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to lookup entity",
      500,
      corsHeaders,
    );
  }
  if (!entity.data) {
    return errorResponse("NOT_FOUND", "Entity not found", 404, corsHeaders);
  }

  if (route.action === "attach") {
    const payload = {
      user_id: ctx.userId,
      topic_id: route.id,
      [link.column]: parsed.entityId,
    };
    const { data, error } = await ctx.supabaseAdmin
      .from(link.table)
      .upsert(payload, { onConflict: `topic_id,${link.column}` })
      .select("*")
      .single();

    if (error || !data) {
      console.error("topic attach", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to attach topic",
        500,
        corsHeaders,
      );
    }

    await writeAudit(
      ctx,
      "topics.attach",
      `${link.table}/${route.id}/${parsed.entityId}`,
      200,
      req,
      {
        entity_type: parsed.entityType,
        entity_id: parsed.entityId,
      },
    );
    return jsonResponse({ data }, 200, corsHeaders);
  }

  const { data, error } = await ctx.supabaseAdmin
    .from(link.table)
    .delete()
    .eq("topic_id", route.id)
    .eq(link.column, parsed.entityId)
    .eq("user_id", ctx.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("topic detach", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to detach topic",
      500,
      corsHeaders,
    );
  }
  if (!data) {
    return errorResponse("NOT_FOUND", "Topic link not found", 404, corsHeaders);
  }

  await writeAudit(
    ctx,
    "topics.detach",
    `${link.table}/${route.id}/${parsed.entityId}`,
    200,
    req,
    {
      entity_type: parsed.entityType,
      entity_id: parsed.entityId,
    },
  );
  return jsonResponse({ data: { detached: true } }, 200, corsHeaders);
}

export async function handleEntityRoute(
  ctx: AuthContext,
  req: Request,
  path: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const route = matchEntityRoute(req.method, path);
  if (!route) return null;

  const denied = requireScopes(
    ctx,
    [requiredScopeForRoute(route)],
    corsHeaders,
  );
  if (denied) return denied;

  switch (route.action) {
    case "list":
      return await handleList(ctx, req, route, corsHeaders);
    case "get":
      return await handleGet(ctx, route, corsHeaders);
    case "create":
      return await handleCreate(ctx, req, route, corsHeaders);
    case "update":
      return await handleUpdate(ctx, req, route, corsHeaders);
    case "delete":
      return await handleDelete(ctx, req, route, corsHeaders);
    case "batchCreate":
      return await handleBatchCreate(ctx, req, route, corsHeaders);
    case "attach":
    case "detach":
      return await handleTopicAttachDetach(ctx, req, route, corsHeaders);
  }
}
