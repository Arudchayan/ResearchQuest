import type { AuthContext } from "./auth.ts";
import { requireScopes, writeAudit } from "./auth.ts";
import { errorResponse, jsonResponse } from "./http.ts";
import {
  FEED_ITEM_STATUSES,
  FEED_ITEM_TYPES,
  type FeedItemInput,
  isRecord,
  isUuid,
  type JsonRecord,
  planFeedItemBatch,
  type PromoteTarget,
  validateFeedItemBatchCreate,
  validateFeedItemCreate,
  validateFeedItemPatch,
  validateFeedSourceCreate,
  validateFeedSourceUpdate,
  validatePromoteRequest,
} from "./feeds.ts";

const FEED_SOURCE_SELECT =
  "id, user_id, name, kind, config, enabled, created_at, updated_at";
const FEED_ITEM_SELECT =
  "id, user_id, source_id, type, title, summary, url, payload, status, external_id, published_at, created_at, updated_at";

async function readJsonBody(
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

function sourceIdsFromFeedItems(items: FeedItemInput[]): string[] {
  return items
    .map((item) => item.source_id)
    .filter((sourceId): sourceId is string =>
      typeof sourceId === "string" && sourceId.length > 0
    );
}

async function validateFeedSourceReferences(
  ctx: AuthContext,
  sourceIds: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const uniqueIds = [...new Set(sourceIds.filter(Boolean))];
  if (uniqueIds.length === 0) return null;

  const { data, error } = await ctx.supabaseAdmin
    .from("feed_sources")
    .select("id")
    .eq("user_id", ctx.userId)
    .in("id", uniqueIds);

  if (error) {
    console.error("validate feed source references", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to validate feed sources",
      500,
      corsHeaders,
    );
  }

  const found = new Set((data ?? []).map((row) => row.id));
  const missing = uniqueIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    return errorResponse(
      "VALIDATION_ERROR",
      "source_id must reference one of the user's feed sources",
      400,
      corsHeaders,
      { missing_source_ids: missing },
    );
  }
  return null;
}

async function existingExternalIds(
  ctx: AuthContext,
  externalIds: string[],
): Promise<{ ids?: Set<string>; error?: unknown }> {
  const uniqueIds = [...new Set(externalIds)];
  if (uniqueIds.length === 0) return { ids: new Set() };

  const { data, error } = await ctx.supabaseAdmin
    .from("feed_items")
    .select("external_id")
    .eq("user_id", ctx.userId)
    .in("external_id", uniqueIds);

  if (error) return { error };
  return {
    ids: new Set(
      (data ?? [])
        .map((row) => row.external_id)
        .filter((externalId): externalId is string =>
          typeof externalId === "string"
        ),
    ),
  };
}

function stringField(fields: JsonRecord, field: string): string | undefined {
  const raw = fields[field];
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value || undefined;
}

function booleanField(fields: JsonRecord, field: string): boolean | undefined {
  return typeof fields[field] === "boolean" ? fields[field] : undefined;
}

function stringArrayField(
  fields: JsonRecord,
  field: string,
): string[] | undefined {
  const raw = fields[field];
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isoField(fields: JsonRecord, field: string): string | undefined {
  const value = stringField(fields, field);
  if (!value) return undefined;
  return Number.isNaN(Date.parse(value))
    ? undefined
    : new Date(value).toISOString();
}

function publicationDateFromFeedItem(item: JsonRecord): string | undefined {
  return typeof item.published_at === "string"
    ? item.published_at.slice(0, 10)
    : undefined;
}

function buildPromotedEntityInsert(
  target: PromoteTarget,
  item: JsonRecord,
  fields: JsonRecord,
  userId: string,
): { table: "papers" | "tasks" | "notes"; row: Record<string, unknown> } | {
  error: string;
} {
  const title = stringField(fields, "title") ??
    (typeof item.title === "string" ? item.title : "");
  const summary = typeof item.summary === "string" ? item.summary : undefined;
  const url = typeof item.url === "string" ? item.url : undefined;
  const payload = isRecord(item.payload) ? item.payload : {};

  if (!title) return { error: "title is required for promotion" };

  if (target === "paper") {
    return {
      table: "papers",
      row: {
        user_id: userId,
        title,
        authors: stringArrayField(fields, "authors") ??
          stringArrayField(payload, "authors") ?? [],
        doi: stringField(fields, "doi") ?? stringField(payload, "doi") ?? null,
        source_url: stringField(fields, "source_url") ??
          stringField(fields, "url") ?? url ?? null,
        status: stringField(fields, "status") ?? "To Read",
        topic_ids: stringArrayField(fields, "topic_ids") ?? [],
        abstract: stringField(fields, "abstract") ?? summary ?? null,
        publication_date: stringField(fields, "publication_date") ??
          publicationDateFromFeedItem(item) ??
          null,
      },
    };
  }

  if (target === "task") {
    const priority = stringField(fields, "priority") ?? "medium";
    if (!["high", "medium", "low"].includes(priority)) {
      return { error: "priority must be one of: high, medium, low" };
    }
    return {
      table: "tasks",
      row: {
        user_id: userId,
        title,
        description: stringField(fields, "description") ?? summary ?? url ??
          null,
        completed: booleanField(fields, "completed") ?? false,
        priority,
        category: stringField(fields, "category") ?? "Feeds",
        due_date: isoField(fields, "due_date") ?? null,
      },
    };
  }

  const defaultBody = [
    `# ${title}`,
    "",
    summary ?? "",
    url ? `Source: ${url}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
  return {
    table: "notes",
    row: {
      user_id: userId,
      title,
      markdown_body: stringField(fields, "markdown_body") ?? defaultBody,
      tags: stringArrayField(fields, "tags") ?? [],
      linked_entity_ids: stringArrayField(fields, "linked_entity_ids") ?? [],
    },
  };
}

async function listFeedSources(
  ctx: AuthContext,
  req: Request,
  corsHeaders: Record<string, string>,
) {
  const denied = requireScopes(ctx, ["feeds:read"], corsHeaders);
  if (denied) return denied;
  const { data, error } = await ctx.supabaseAdmin
    .from("feed_sources")
    .select(FEED_SOURCE_SELECT)
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("list feed sources", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to list feed sources",
      500,
      corsHeaders,
    );
  }
  await writeAudit(ctx, "feed_sources.list", "feed_sources", 200, req);
  return jsonResponse({ data: data ?? [] }, 200, corsHeaders);
}

async function createFeedSource(
  ctx: AuthContext,
  req: Request,
  corsHeaders: Record<string, string>,
) {
  const denied = requireScopes(ctx, ["feeds:write"], corsHeaders);
  if (denied) return denied;
  const body = await readJsonBody(req, corsHeaders);
  if (body instanceof Response) return body;
  const parsed = validateFeedSourceCreate(body);
  if (parsed.error || !parsed.value) {
    return errorResponse(
      "VALIDATION_ERROR",
      parsed.error ?? "Invalid feed source",
      400,
      corsHeaders,
    );
  }
  const { data, error } = await ctx.supabaseAdmin
    .from("feed_sources")
    .insert({ ...parsed.value, user_id: ctx.userId })
    .select(FEED_SOURCE_SELECT)
    .single();
  if (error || !data) {
    console.error("create feed source", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to create feed source",
      500,
      corsHeaders,
    );
  }
  await writeAudit(
    ctx,
    "feed_sources.create",
    `feed_sources/${data.id}`,
    201,
    req,
  );
  return jsonResponse({ data }, 201, corsHeaders);
}

async function getFeedSource(
  ctx: AuthContext,
  req: Request,
  id: string,
  corsHeaders: Record<string, string>,
) {
  const denied = requireScopes(ctx, ["feeds:read"], corsHeaders);
  if (denied) return denied;
  if (!isUuid(id)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid feed source id",
      400,
      corsHeaders,
    );
  }
  const { data, error } = await ctx.supabaseAdmin
    .from("feed_sources")
    .select(FEED_SOURCE_SELECT)
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) {
    console.error("get feed source", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to get feed source",
      500,
      corsHeaders,
    );
  }
  if (!data) {
    return errorResponse(
      "NOT_FOUND",
      "Feed source not found",
      404,
      corsHeaders,
    );
  }
  await writeAudit(ctx, "feed_sources.get", `feed_sources/${id}`, 200, req);
  return jsonResponse({ data }, 200, corsHeaders);
}

async function updateFeedSource(
  ctx: AuthContext,
  req: Request,
  id: string,
  corsHeaders: Record<string, string>,
) {
  const denied = requireScopes(ctx, ["feeds:write"], corsHeaders);
  if (denied) return denied;
  if (!isUuid(id)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid feed source id",
      400,
      corsHeaders,
    );
  }
  const body = await readJsonBody(req, corsHeaders);
  if (body instanceof Response) return body;
  const parsed = validateFeedSourceUpdate(body);
  if (parsed.error || !parsed.value) {
    return errorResponse(
      "VALIDATION_ERROR",
      parsed.error ?? "Invalid feed source",
      400,
      corsHeaders,
    );
  }
  const { data, error } = await ctx.supabaseAdmin
    .from("feed_sources")
    .update(parsed.value)
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select(FEED_SOURCE_SELECT)
    .maybeSingle();
  if (error) {
    console.error("update feed source", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to update feed source",
      500,
      corsHeaders,
    );
  }
  if (!data) {
    return errorResponse(
      "NOT_FOUND",
      "Feed source not found",
      404,
      corsHeaders,
    );
  }
  await writeAudit(ctx, "feed_sources.update", `feed_sources/${id}`, 200, req);
  return jsonResponse({ data }, 200, corsHeaders);
}

async function deleteFeedSource(
  ctx: AuthContext,
  req: Request,
  id: string,
  corsHeaders: Record<string, string>,
) {
  const denied = requireScopes(ctx, ["feeds:write"], corsHeaders);
  if (denied) return denied;
  if (!isUuid(id)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid feed source id",
      400,
      corsHeaders,
    );
  }
  const { data, error } = await ctx.supabaseAdmin
    .from("feed_sources")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("delete feed source", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to delete feed source",
      500,
      corsHeaders,
    );
  }
  if (!data) {
    return errorResponse(
      "NOT_FOUND",
      "Feed source not found",
      404,
      corsHeaders,
    );
  }
  await writeAudit(ctx, "feed_sources.delete", `feed_sources/${id}`, 204, req);
  return new Response(null, { status: 204, headers: corsHeaders });
}

async function listFeedItems(
  ctx: AuthContext,
  req: Request,
  corsHeaders: Record<string, string>,
) {
  const denied = requireScopes(ctx, ["feeds:read"], corsHeaders);
  if (denied) return denied;
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  if (type && !(FEED_ITEM_TYPES as readonly string[]).includes(type)) {
    return errorResponse(
      "VALIDATION_ERROR",
      `type must be one of: ${FEED_ITEM_TYPES.join(", ")}`,
      400,
      corsHeaders,
    );
  }
  if (status && !(FEED_ITEM_STATUSES as readonly string[]).includes(status)) {
    return errorResponse(
      "VALIDATION_ERROR",
      `status must be one of: ${FEED_ITEM_STATUSES.join(", ")}`,
      400,
      corsHeaders,
    );
  }
  let query = ctx.supabaseAdmin.from("feed_items").select(FEED_ITEM_SELECT).eq(
    "user_id",
    ctx.userId,
  );
  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);
  const { data, error } = await query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("list feed items", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to list feed items",
      500,
      corsHeaders,
    );
  }
  await writeAudit(ctx, "feed_items.list", "feed_items", 200, req, {
    type,
    status,
  });
  return jsonResponse({ data: data ?? [] }, 200, corsHeaders);
}

async function createFeedItem(
  ctx: AuthContext,
  req: Request,
  corsHeaders: Record<string, string>,
) {
  const denied = requireScopes(ctx, ["feeds:ingest"], corsHeaders);
  if (denied) return denied;
  const body = await readJsonBody(req, corsHeaders);
  if (body instanceof Response) return body;
  const parsed = validateFeedItemCreate(body);
  if (parsed.error || !parsed.value) {
    return errorResponse(
      "VALIDATION_ERROR",
      parsed.error ?? "Invalid feed item",
      400,
      corsHeaders,
    );
  }
  const sourceValidation = await validateFeedSourceReferences(
    ctx,
    sourceIdsFromFeedItems([parsed.value]),
    corsHeaders,
  );
  if (sourceValidation) return sourceValidation;
  const { data, error } = await ctx.supabaseAdmin
    .from("feed_items")
    .insert({ ...parsed.value, user_id: ctx.userId })
    .select(FEED_ITEM_SELECT)
    .single();
  if (error || !data) {
    if (error?.code === "23505") {
      return errorResponse(
        "CONFLICT",
        "Feed item with this external_id already exists",
        409,
        corsHeaders,
      );
    }
    console.error("create feed item", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to create feed item",
      500,
      corsHeaders,
    );
  }
  await writeAudit(ctx, "feed_items.create", `feed_items/${data.id}`, 201, req);
  return jsonResponse({ data }, 201, corsHeaders);
}

async function batchCreateFeedItems(
  ctx: AuthContext,
  req: Request,
  corsHeaders: Record<string, string>,
) {
  const denied = requireScopes(ctx, ["feeds:ingest"], corsHeaders);
  if (denied) return denied;
  const body = await readJsonBody(req, corsHeaders);
  if (body instanceof Response) return body;
  const parsed = validateFeedItemBatchCreate(body);
  if (parsed.error || !parsed.value) {
    return errorResponse(
      "VALIDATION_ERROR",
      parsed.error ?? "Invalid feed items",
      400,
      corsHeaders,
      parsed.details,
    );
  }
  const sourceValidation = await validateFeedSourceReferences(
    ctx,
    sourceIdsFromFeedItems(parsed.value),
    corsHeaders,
  );
  if (sourceValidation) return sourceValidation;
  const initialPlan = planFeedItemBatch(parsed.value);
  const existing = await existingExternalIds(ctx, initialPlan.externalIds);
  if (existing.error) {
    console.error("batch feed item external_id lookup", existing.error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to inspect existing feed items",
      500,
      corsHeaders,
    );
  }
  let plan = planFeedItemBatch(parsed.value, existing.ids);
  let data: unknown[] = [];
  if (plan.insertable.length > 0) {
    const rows = plan.insertable.map((item) => ({
      ...item,
      user_id: ctx.userId,
    }));
    let result = await ctx.supabaseAdmin.from("feed_items").insert(rows).select(
      FEED_ITEM_SELECT,
    );
    if (result.error?.code === "23505") {
      const raced = await existingExternalIds(ctx, initialPlan.externalIds);
      if (raced.error) {
        console.error("batch feed item retry lookup", raced.error);
        return errorResponse(
          "INTERNAL_ERROR",
          "Failed to inspect existing feed items",
          500,
          corsHeaders,
        );
      }
      plan = planFeedItemBatch(parsed.value, raced.ids);
      const retryRows = plan.insertable.map((item) => ({
        ...item,
        user_id: ctx.userId,
      }));
      result = retryRows.length === 0
        ? {
          data: [],
          error: null,
          count: null,
          status: 201,
          statusText: "Created",
        }
        : await ctx.supabaseAdmin.from("feed_items").insert(retryRows).select(
          FEED_ITEM_SELECT,
        );
    }
    if (result.error) {
      console.error("batch create feed items", result.error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to create feed items",
        500,
        corsHeaders,
      );
    }
    data = result.data ?? [];
  }
  await writeAudit(ctx, "feed_items.batch_create", "feed_items", 201, req, {
    created_count: data.length,
    skipped_count: plan.skipped.length,
  });
  return jsonResponse(
    {
      data,
      skipped: plan.skipped,
      created_count: data.length,
      skipped_count: plan.skipped.length,
    },
    201,
    corsHeaders,
  );
}

async function patchFeedItem(
  ctx: AuthContext,
  req: Request,
  id: string,
  corsHeaders: Record<string, string>,
) {
  const denied = requireScopes(ctx, ["feeds:write"], corsHeaders);
  if (denied) return denied;
  if (!isUuid(id)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid feed item id",
      400,
      corsHeaders,
    );
  }
  const body = await readJsonBody(req, corsHeaders);
  if (body instanceof Response) return body;
  const parsed = validateFeedItemPatch(body);
  if (parsed.error || !parsed.value) {
    return errorResponse(
      "VALIDATION_ERROR",
      parsed.error ?? "Invalid feed item",
      400,
      corsHeaders,
    );
  }
  const { data, error } = await ctx.supabaseAdmin
    .from("feed_items")
    .update({ status: parsed.value.status })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select(FEED_ITEM_SELECT)
    .maybeSingle();
  if (error) {
    console.error("patch feed item", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to update feed item",
      500,
      corsHeaders,
    );
  }
  if (!data) {
    return errorResponse("NOT_FOUND", "Feed item not found", 404, corsHeaders);
  }
  await writeAudit(ctx, "feed_items.patch", `feed_items/${id}`, 200, req, {
    status: parsed.value.status,
  });
  return jsonResponse({ data }, 200, corsHeaders);
}

async function promoteFeedItem(
  ctx: AuthContext,
  req: Request,
  id: string,
  corsHeaders: Record<string, string>,
) {
  const denied = requireScopes(ctx, ["feeds:write"], corsHeaders);
  if (denied) return denied;
  if (!isUuid(id)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid feed item id",
      400,
      corsHeaders,
    );
  }
  const body = await readJsonBody(req, corsHeaders);
  if (body instanceof Response) return body;
  const parsed = validatePromoteRequest(body);
  if (parsed.error || !parsed.value) {
    return errorResponse(
      "VALIDATION_ERROR",
      parsed.error ?? "Invalid promotion request",
      400,
      corsHeaders,
    );
  }
  const { data: item, error: itemError } = await ctx.supabaseAdmin
    .from("feed_items")
    .select(FEED_ITEM_SELECT)
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (itemError) {
    console.error("get feed item for promote", itemError);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to get feed item",
      500,
      corsHeaders,
    );
  }
  if (!item) {
    return errorResponse("NOT_FOUND", "Feed item not found", 404, corsHeaders);
  }
  if (item.status === "promoted") {
    return errorResponse(
      "CONFLICT",
      "Feed item is already promoted",
      409,
      corsHeaders,
    );
  }
  const promotion = buildPromotedEntityInsert(
    parsed.value.target,
    item,
    parsed.value.fields,
    ctx.userId,
  );
  if ("error" in promotion) {
    return errorResponse("VALIDATION_ERROR", promotion.error, 400, corsHeaders);
  }
  const { data: entity, error: entityError } = await ctx.supabaseAdmin
    .from(promotion.table)
    .insert(promotion.row)
    .select("*")
    .single();
  if (entityError || !entity) {
    console.error("promote feed item create target", entityError);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to create promoted entity",
      500,
      corsHeaders,
    );
  }
  const payload = {
    ...(isRecord(item.payload) ? item.payload : {}),
    promotion: {
      target: parsed.value.target,
      entity_id: entity.id,
      promoted_at: new Date().toISOString(),
    },
  };
  const { data: updatedItem, error: updateError } = await ctx.supabaseAdmin
    .from("feed_items")
    .update({ status: "promoted", payload })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .select(FEED_ITEM_SELECT)
    .single();
  if (updateError || !updatedItem) {
    console.error("promote feed item update status", updateError);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to mark feed item as promoted",
      500,
      corsHeaders,
    );
  }
  await writeAudit(ctx, "feed_items.promote", `feed_items/${id}`, 201, req, {
    target: parsed.value.target,
    entity_id: entity.id,
  });
  return jsonResponse(
    { target: parsed.value.target, entity, item: updatedItem },
    201,
    corsHeaders,
  );
}

export async function handleFeedRoute(
  ctx: AuthContext,
  req: Request,
  path: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (req.method === "GET" && path === "/feed-sources") {
    return await listFeedSources(ctx, req, corsHeaders);
  }
  if (req.method === "POST" && path === "/feed-sources") {
    return await createFeedSource(ctx, req, corsHeaders);
  }

  const sourceMatch = /^\/feed-sources\/([^/]+)$/.exec(path);
  if (sourceMatch) {
    if (req.method === "GET") {
      return await getFeedSource(ctx, req, sourceMatch[1], corsHeaders);
    }
    if (req.method === "PATCH") {
      return await updateFeedSource(ctx, req, sourceMatch[1], corsHeaders);
    }
    if (req.method === "DELETE") {
      return await deleteFeedSource(ctx, req, sourceMatch[1], corsHeaders);
    }
  }

  if (req.method === "POST" && path === "/feed-items:batchCreate") {
    return await batchCreateFeedItems(ctx, req, corsHeaders);
  }
  if (req.method === "GET" && path === "/feed-items") {
    return await listFeedItems(ctx, req, corsHeaders);
  }
  if (req.method === "POST" && path === "/feed-items") {
    return await createFeedItem(ctx, req, corsHeaders);
  }

  const promoteMatch = /^\/feed-items\/([^/]+)\/promote$/.exec(path);
  if (req.method === "POST" && promoteMatch) {
    return await promoteFeedItem(ctx, req, promoteMatch[1], corsHeaders);
  }

  const itemMatch = /^\/feed-items\/([^/]+)$/.exec(path);
  if (req.method === "PATCH" && itemMatch) {
    return await patchFeedItem(ctx, req, itemMatch[1], corsHeaders);
  }

  return null;
}
