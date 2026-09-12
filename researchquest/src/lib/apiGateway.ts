/**
 * Typed client for the `api` edge gateway (`supabase/functions/api`).
 *
 * List reads for resources whose gateway `select` matches the client row
 * shape exactly (notes, papers, ideas, tasks — see `ENTITY_CONFIGS` in
 * `supabase/functions/api/routes/entities.ts`) are routed through the
 * gateway, which paginates (`limit` default 100, clamped to 1–200) and
 * validates payloads. Topics are deliberately excluded: the gateway topics
 * list omits the `topic_notes/papers/ideas(count)` aggregates the client
 * needs, so routing it would zero out topic counts.
 *
 * Resilience contract:
 * - Gateway transport/server failures (network error, 5xx, unconfigured
 *   gateway) fall back to the direct Supabase read silently (logged only).
 * - Client errors (4xx — validation/auth) are surfaced, never masked by
 *   fallback, so bad requests stay visible.
 * - Demo mode skips the gateway entirely and reads direct (demoSupabase).
 *
 * Zustand remains the single UI-state owner; this module only fetches rows.
 */

import { supabase } from "./supabase";
import * as supabaseModule from "./supabase";
import { logger } from "../utils/logger";

/**
 * Reads the demo-mode flag defensively: some test doubles mock
 * `lib/supabase` with only `{ supabase }`, and a missing export must never
 * crash list reads — it just means "not demo mode".
 */
function readIsDemoMode(): boolean {
  try {
    return (
      (supabaseModule as { isDemoMode?: unknown }).isDemoMode === true
    );
  } catch {
    return false;
  }
}

export const GATEWAY_DEFAULT_LIMIT = 100;
export const GATEWAY_MAX_LIMIT = 200;

/** Resources whose gateway list select matches the client row shape. */
export const GATEWAY_LIST_RESOURCES = [
  "notes",
  "papers",
  "ideas",
  "tasks",
] as const;

export type GatewayListResource = (typeof GATEWAY_LIST_RESOURCES)[number];

export class GatewayError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    opts: { status: number; code: string },
  ) {
    super(message);
    this.name = "GatewayError";
    this.status = opts.status;
    this.code = opts.code;
  }
}

export function getGatewayBaseUrl(): string | null {
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!raw) return null;
  return `${raw.replace(/\/$/, "")}/functions/v1/api/v1`;
}

/** Mirror of the server clamp (`entities.ts` handleList): 1–200, default 100. */
export function clampGatewayLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit as number)) return GATEWAY_DEFAULT_LIMIT;
  return Math.min(
    Math.max(Math.trunc(limit as number), 1),
    GATEWAY_MAX_LIMIT,
  );
}

export function clampGatewayOffset(offset: number | undefined): number {
  if (!Number.isFinite(offset as number)) return 0;
  return Math.max(Math.trunc(offset as number), 0);
}

interface GatewayErrorBody {
  error?: { code?: string; message?: string };
}

function extractGatewayError(body: unknown, status: number): {
  code: string;
  message: string;
} {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as GatewayErrorBody).error === "object" &&
    (body as GatewayErrorBody).error !== null
  ) {
    const nested = (body as GatewayErrorBody).error as {
      code?: unknown;
      message?: unknown;
    };
    return {
      code:
        typeof nested.code === "string" && nested.code
          ? nested.code
          : "GATEWAY_ERROR",
      message:
        typeof nested.message === "string" && nested.message
          ? nested.message
          : `Gateway request failed (${status})`,
    };
  }
  return { code: "GATEWAY_ERROR", message: `Gateway request failed (${status})` };
}

function extractDataArray<T>(body: unknown): T[] {
  if (
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    Array.isArray((body as { data: unknown }).data)
  ) {
    return (body as { data: T[] }).data;
  }
  throw new GatewayError("Gateway returned an unexpected response shape", {
    status: 502,
    code: "GATEWAY_BAD_RESPONSE",
  });
}

export interface GatewayListOptions {
  limit?: number;
  offset?: number;
  /** Injectable for tests; defaults to the configured edge function URL. */
  baseUrl?: string | null;
  fetchFn?: typeof fetch;
  /** Injectable auth token; resolved via getSession when omitted. */
  accessToken?: string | null;
}

/**
 * GET `/{resource}?limit=&offset=` through the edge gateway.
 * Throws GatewayError on any non-2xx (callers decide fallback vs surface).
 */
export async function listViaGateway<T>(
  resource: GatewayListResource,
  opts: GatewayListOptions = {},
): Promise<{ data: T[] }> {
  const baseUrl = opts.baseUrl === undefined ? getGatewayBaseUrl() : opts.baseUrl;
  if (!baseUrl) {
    throw new GatewayError("API gateway is not configured", {
      status: 0,
      code: "GATEWAY_UNAVAILABLE",
    });
  }

  const limit = clampGatewayLimit(opts.limit);
  const offset = clampGatewayOffset(opts.offset);

  let accessToken = opts.accessToken;
  if (accessToken === undefined) {
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token ?? null;
    } catch {
      accessToken = null;
    }
  }

  const url = `${baseUrl}/${resource}?limit=${limit}&offset=${offset}`;
  let response: Response;
  try {
    response = await (opts.fetchFn ?? fetch)(url, {
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    throw new GatewayError(
      error instanceof Error ? error.message : "Gateway request failed",
      { status: 0, code: "GATEWAY_UNAVAILABLE" },
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const { code, message } = extractGatewayError(body, response.status);
    throw new GatewayError(message, { status: response.status, code });
  }

  return { data: extractDataArray<T>(body) };
}

export type ListSource = "gateway" | "direct";

/**
 * List through the gateway with automatic silent fallback to `direct` on
 * transport/server failure. 4xx GatewayErrors (validation/auth) are
 * re-thrown so validation errors surface instead of being masked.
 */
export async function listWithGatewayFallback<T>(
  resource: GatewayListResource,
  opts: GatewayListOptions,
  direct: () => Promise<T[]>,
): Promise<{ data: T[]; source: ListSource }> {
  if (readIsDemoMode()) {
    return { data: await direct(), source: "direct" };
  }
  try {
    const { data } = await listViaGateway<T>(resource, opts);
    return { data, source: "gateway" };
  } catch (error) {
    if (
      error instanceof GatewayError &&
      error.status >= 400 &&
      error.status < 500
    ) {
      throw error;
    }
    logger.warn(
      `API gateway list failed for ${resource}; falling back to direct read`,
      error,
    );
    return { data: await direct(), source: "direct" };
  }
}

// ---------------------------------------------------------------------------
// Server search — single path shared by live and demo.
// ---------------------------------------------------------------------------

export const GLOBAL_SEARCH_RPC = "global_search";

export interface GlobalSearchRow {
  entity_type: "note" | "paper" | "idea";
  entity_id: string;
  title: string;
  snippet: string;
  rank: number;
  updated_at: string;
}

export interface ServerSearchOptions {
  limit?: number;
}

/**
 * Full-text search via the `global_search` Postgres RPC
 * (`supabase/migrations/1762624300_add_search_functions.sql`).
 * Live resolves against Postgres; demo resolves against the demoSupabase
 * `rpc()` stub, which implements the same signature — so demo search works
 * through the exact path the server-search overlay uses.
 */
export async function serverSearch(
  userId: string,
  query: string,
  opts: ServerSearchOptions = {},
): Promise<{ data: GlobalSearchRow[]; error: { message: string } | null }> {
  const trimmed = query.trim();
  if (!userId || !trimmed) {
    return { data: [], error: null };
  }
  const limit = clampGatewayLimit(opts.limit ?? 20);
  if (typeof supabase.rpc !== "function") {
    return { data: [], error: { message: "Search is unavailable" } };
  }
  const { data, error } = await supabase.rpc(GLOBAL_SEARCH_RPC, {
    search_user_id: userId,
    search_query: trimmed,
    limit_count: limit,
  });
  if (error) {
    return {
      data: [],
      error: { message: error.message ?? "Search failed" },
    };
  }
  return { data: (data ?? []) as GlobalSearchRow[], error: null };
}

// ---------------------------------------------------------------------------
// Gateway surface contract — consumed by the parity harness
// (src/test/lib/parity-*.test.ts).
// ---------------------------------------------------------------------------

export const GATEWAY_SURFACE = {
  lists: [...GATEWAY_LIST_RESOURCES],
  rpc: [
    {
      name: "global_search",
      args: ["search_user_id", "search_query", "limit_count"],
    },
    {
      name: "save_idea_with_links",
      args: [
        "p_idea_id",
        "p_user_id",
        "p_title",
        "p_description",
        "p_stage",
        "p_linked_note_ids",
        "p_linked_paper_ids",
      ],
    },
  ],
  functions: ["fetch-paper", "deep-research"],
} as const;
