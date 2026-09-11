/**
 * Server search wiring (plan item 45).
 *
 * PostgreSQL full-text search RPCs from migration `1762624300`:
 * `search_notes`, `search_papers`, `search_ideas`, `global_search`.
 * All take `{ search_user_id, search_query, limit_count }`.
 *
 * Demo mode (`VITE_DEMO_MODE=1`, `demoSupabase`) has no FTS, so every server
 * path falls back to the client-side substring filter below. Live RPC
 * failures also fall back rather than surfacing an error for search-as-you-type.
 */
import { supabase, isDemoMode } from "./supabase";

/** Debounce for search-as-you-type RPC calls. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Row cap for every search RPC call. */
export const SEARCH_LIMIT = 20;

export type SearchRpcName =
  | "search_notes"
  | "search_papers"
  | "search_ideas"
  | "global_search";

export interface GlobalSearchHit {
  entity_type: "note" | "paper" | "idea" | string;
  entity_id: string;
  title: string;
  snippet: string | null;
  rank: number;
  updated_at: string;
}

/**
 * Pure predicate: should we attempt a server RPC, or go straight to the
 * client filter? Exported for tests (the `isDemoMode` module const cannot be
 * re-mocked per test because the global setup mock fixes it).
 */
export function shouldUseServerSearch(demoMode: boolean, query: string): boolean {
  return !demoMode && query.trim().length > 0;
}

/**
 * Client-side fallback filter: case-insensitive substring match over the
 * given text selectors. Used in demo mode and when the RPC fails.
 */
export function clientSearch<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => Array<string | null | undefined>,
  limit: number = SEARCH_LIMIT,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: T[] = [];
  for (const item of items) {
    const haystack = getText(item);
    for (const field of haystack) {
      if (field && field.toLowerCase().includes(q)) {
        out.push(item);
        break;
      }
    }
    if (out.length >= limit) break;
  }
  return out;
}

/** Text selectors for the client fallback, mirroring the FTS documents. */
export const noteSearchText = (n: {
  title?: string | null;
  markdown_body?: string | null;
}) => [n.title, n.markdown_body];

export const paperSearchText = (p: {
  title?: string | null;
  abstract?: string | null;
  authors?: string[] | null;
}) => [p.title, p.abstract, (p.authors ?? []).join(" ")];

export const ideaSearchText = (i: {
  title?: string | null;
  description?: string | null;
}) => [i.title, i.description];

interface RpcArgs {
  search_user_id: string;
  search_query: string;
  limit_count: number;
}

function rpcArgs(userId: string, query: string, limit: number): RpcArgs {
  return { search_user_id: userId, search_query: query, limit_count: limit };
}

/**
 * Call a search RPC. Resolves to the rows, or `null` when the caller should
 * use the client filter instead (demo mode, empty query, RPC error, or
 * unexpected payload shape).
 */
export async function searchViaRpc<T>(
  rpcName: SearchRpcName,
  userId: string,
  query: string,
  limit: number = SEARCH_LIMIT,
): Promise<T[] | null> {
  if (!shouldUseServerSearch(isDemoMode, query)) return null;
  try {
    const { data, error } = await supabase.rpc(
      rpcName,
      rpcArgs(userId, query.trim(), limit),
    );
    if (error || !Array.isArray(data)) return null;
    return data as T[];
  } catch {
    return null;
  }
}

/** Typed wrappers over the three entity search RPCs. */
export function searchNotesViaRpc<T>(
  userId: string,
  query: string,
  limit: number = SEARCH_LIMIT,
): Promise<T[] | null> {
  return searchViaRpc<T>("search_notes", userId, query, limit);
}

export function searchPapersViaRpc<T>(
  userId: string,
  query: string,
  limit: number = SEARCH_LIMIT,
): Promise<T[] | null> {
  return searchViaRpc<T>("search_papers", userId, query, limit);
}

export function searchIdeasViaRpc<T>(
  userId: string,
  query: string,
  limit: number = SEARCH_LIMIT,
): Promise<T[] | null> {
  return searchViaRpc<T>("search_ideas", userId, query, limit);
}

export function globalSearchViaRpc(
  userId: string,
  query: string,
  limit: number = SEARCH_LIMIT,
): Promise<GlobalSearchHit[] | null> {
  return searchViaRpc<GlobalSearchHit>("global_search", userId, query, limit);
}
