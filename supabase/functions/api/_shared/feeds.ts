export const FEED_ITEM_TYPES = ["paper", "job", "news", "custom"] as const;
export const FEED_ITEM_STATUSES = [
  "new",
  "triaged",
  "archived",
  "promoted",
] as const;
export const TRIAGE_STATUSES = ["new", "triaged", "archived"] as const;
export const PROMOTE_TARGETS = ["paper", "task", "note"] as const;

export type FeedItemType = (typeof FEED_ITEM_TYPES)[number];
export type FeedItemStatus = (typeof FEED_ITEM_STATUSES)[number];
export type TriageStatus = (typeof TRIAGE_STATUSES)[number];
export type PromoteTarget = (typeof PROMOTE_TARGETS)[number];
export type JsonRecord = Record<string, unknown>;

export interface ValidationResult<T> {
  value?: T;
  error?: string;
  details?: unknown;
}

export interface FeedSourceInput {
  name: string;
  kind: string;
  config: JsonRecord;
  enabled: boolean;
}

export interface FeedSourceUpdateInput {
  name?: string;
  kind?: string;
  config?: JsonRecord;
  enabled?: boolean;
}

export interface FeedItemInput {
  source_id?: string | null;
  type: FeedItemType;
  title: string;
  summary?: string | null;
  url?: string | null;
  payload: JsonRecord;
  external_id?: string | null;
  published_at?: string | null;
}

export interface FeedItemPatchInput {
  status: TriageStatus;
}

export interface FeedItemBatchPlan<T extends { external_id?: string | null }> {
  insertable: T[];
  skipped: Array<{
    index: number;
    external_id: string;
    reason: "duplicate_in_request" | "already_exists";
  }>;
  externalIds: string[];
}

export interface PromoteInput {
  target: PromoteTarget;
  fields: JsonRecord;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isInReadonlyArray<T extends readonly string[]>(
  value: string,
  values: T,
): value is T[number] {
  return (values as readonly string[]).includes(value);
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function optionalString(
  body: JsonRecord,
  field: string,
  maxLength: number,
): ValidationResult<string | null | undefined> {
  const raw = body[field];
  if (raw === undefined) return { value: undefined };
  if (raw === null) return { value: null };
  if (typeof raw !== "string") return { error: `${field} must be a string` };
  const value = raw.trim();
  if (!value) return { value: null };
  if (value.length > maxLength) {
    return { error: `${field} must be at most ${maxLength} characters` };
  }
  return { value };
}

function requiredString(
  body: JsonRecord,
  field: string,
  maxLength: number,
): ValidationResult<string> {
  const raw = body[field];
  if (typeof raw !== "string") {
    return { error: `${field} is required` };
  }
  const value = raw.trim();
  if (!value) {
    return { error: `${field} is required` };
  }
  if (value.length > maxLength) {
    return { error: `${field} must be at most ${maxLength} characters` };
  }
  return { value };
}

function optionalObject(
  body: JsonRecord,
  field: string,
): ValidationResult<JsonRecord | undefined> {
  const raw = body[field];
  if (raw === undefined) return { value: undefined };
  if (!isRecord(raw)) return { error: `${field} must be an object` };
  return { value: raw };
}

export function validateFeedSourceCreate(
  body: unknown,
): ValidationResult<FeedSourceInput> {
  if (!isRecord(body)) {
    return { error: "Body must be a JSON object" };
  }

  const name = requiredString(body, "name", 200);
  if (name.error) return { error: name.error };

  const kind = requiredString(body, "kind", 64);
  if (kind.error) return { error: kind.error };

  const config = optionalObject(body, "config");
  if (config.error) return { error: config.error };

  const enabledRaw = body.enabled;
  if (enabledRaw !== undefined && typeof enabledRaw !== "boolean") {
    return { error: "enabled must be a boolean" };
  }

  return {
    value: {
      name: name.value!,
      kind: kind.value!,
      config: config.value ?? {},
      enabled: enabledRaw ?? true,
    },
  };
}

export function validateFeedSourceUpdate(
  body: unknown,
): ValidationResult<FeedSourceUpdateInput> {
  if (!isRecord(body)) {
    return { error: "Body must be a JSON object" };
  }

  const updates: FeedSourceUpdateInput = {};
  if (body.name !== undefined) {
    const name = requiredString(body, "name", 200);
    if (name.error) return { error: name.error };
    updates.name = name.value!;
  }
  if (body.kind !== undefined) {
    const kind = requiredString(body, "kind", 64);
    if (kind.error) return { error: kind.error };
    updates.kind = kind.value!;
  }
  if (body.config !== undefined) {
    const config = optionalObject(body, "config");
    if (config.error) return { error: config.error };
    updates.config = config.value;
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      return { error: "enabled must be a boolean" };
    }
    updates.enabled = body.enabled;
  }

  if (Object.keys(updates).length === 0) {
    return { error: "At least one field is required" };
  }
  return { value: updates };
}

export function validateFeedItemCreate(
  body: unknown,
): ValidationResult<FeedItemInput> {
  if (!isRecord(body)) {
    return { error: "Body must be a JSON object" };
  }

  const typeRaw = body.type;
  if (
    typeof typeRaw !== "string" || !isInReadonlyArray(typeRaw, FEED_ITEM_TYPES)
  ) {
    return { error: `type must be one of: ${FEED_ITEM_TYPES.join(", ")}` };
  }

  const title = requiredString(body, "title", 500);
  if (title.error) return { error: title.error };

  const sourceId = optionalString(body, "source_id", 36);
  if (sourceId.error) return { error: sourceId.error };
  if (sourceId.value && !isUuid(sourceId.value)) {
    return { error: "source_id must be a UUID" };
  }

  const summary = optionalString(body, "summary", 10_000);
  if (summary.error) return { error: summary.error };

  const url = optionalString(body, "url", 2_048);
  if (url.error) return { error: url.error };

  const externalId = optionalString(body, "external_id", 512);
  if (externalId.error) return { error: externalId.error };

  const payload = optionalObject(body, "payload");
  if (payload.error) return { error: payload.error };

  let publishedAt: string | null | undefined;
  if (body.published_at !== undefined && body.published_at !== null) {
    if (typeof body.published_at !== "string") {
      return { error: "published_at must be ISO-8601" };
    }
    const parsed = Date.parse(body.published_at);
    if (Number.isNaN(parsed)) {
      return { error: "published_at must be ISO-8601" };
    }
    publishedAt = new Date(parsed).toISOString();
  } else if (body.published_at === null) {
    publishedAt = null;
  }

  return {
    value: {
      source_id: sourceId.value,
      type: typeRaw,
      title: title.value!,
      summary: summary.value,
      url: url.value,
      payload: payload.value ?? {},
      external_id: externalId.value,
      published_at: publishedAt,
    },
  };
}

export function validateFeedItemBatchCreate(
  body: unknown,
): ValidationResult<FeedItemInput[]> {
  if (!isRecord(body) || !Array.isArray(body.items)) {
    return { error: "items must be an array" };
  }
  if (body.items.length === 0 || body.items.length > 100) {
    return { error: "items must contain 1-100 entries" };
  }

  const items: FeedItemInput[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  body.items.forEach((item, index) => {
    const result = validateFeedItemCreate(item);
    if (result.error || !result.value) {
      errors.push({ index, error: result.error ?? "Invalid item" });
      return;
    }
    items.push(result.value);
  });

  if (errors.length > 0) {
    return { error: "Invalid feed items", details: errors };
  }
  return { value: items };
}

export function validateFeedItemPatch(
  body: unknown,
): ValidationResult<FeedItemPatchInput> {
  if (!isRecord(body)) {
    return { error: "Body must be a JSON object" };
  }
  if (
    typeof body.status !== "string" ||
    !isInReadonlyArray(body.status, TRIAGE_STATUSES)
  ) {
    return { error: `status must be one of: ${TRIAGE_STATUSES.join(", ")}` };
  }
  return { value: { status: body.status } };
}

export function validatePromoteRequest(
  body: unknown,
): ValidationResult<PromoteInput> {
  if (!isRecord(body)) {
    return { error: "Body must be a JSON object" };
  }
  if (
    typeof body.target !== "string" ||
    !isInReadonlyArray(body.target, PROMOTE_TARGETS)
  ) {
    return { error: `target must be one of: ${PROMOTE_TARGETS.join(", ")}` };
  }
  const { target: _target, ...fields } = body;
  return { value: { target: body.target, fields } };
}

export function planFeedItemBatch<T extends { external_id?: string | null }>(
  items: T[],
  existingExternalIds: Set<string> = new Set(),
): FeedItemBatchPlan<T> {
  const seen = new Set<string>();
  const insertable: T[] = [];
  const skipped: FeedItemBatchPlan<T>["skipped"] = [];
  const externalIds: string[] = [];

  items.forEach((item, index) => {
    const externalId = item.external_id;
    if (!externalId) {
      insertable.push(item);
      return;
    }

    if (!seen.has(externalId)) {
      seen.add(externalId);
      externalIds.push(externalId);
    }

    if (existingExternalIds.has(externalId)) {
      skipped.push({
        index,
        external_id: externalId,
        reason: "already_exists",
      });
      return;
    }

    if (insertable.some((candidate) => candidate.external_id === externalId)) {
      skipped.push({
        index,
        external_id: externalId,
        reason: "duplicate_in_request",
      });
      return;
    }

    insertable.push(item);
  });

  return { insertable, skipped, externalIds };
}
