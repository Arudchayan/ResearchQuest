/**
 * Debounced server search overlay (plan item 45).
 *
 * Views keep their existing synchronous client pipeline (instant feedback,
 * sorting, tag filters) and pass its output as `clientResults`. This hook
 * returns `clientResults` unchanged except in live mode, where — 300ms after
 * the query settles — it fires the FTS RPC (`search_notes` / `search_papers` /
 * `search_ideas` / `global_search`, capped at 20 rows) and swaps in the server
 * rows when they resolve. Demo mode, empty queries, and RPC failures all keep
 * the client list, since `demoSupabase` has no FTS.
 *
 * Stale responses are discarded via a generation guard (fetch dedupe, item 46).
 */
import { useEffect, useRef, useState } from "react";
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_LIMIT,
  globalSearchViaRpc,
  searchIdeasViaRpc,
  searchNotesViaRpc,
  searchPapersViaRpc,
  shouldUseServerSearch,
} from "../lib/search";
import { isDemoMode } from "../lib/supabase";
import { useAppStore } from "../store/appStore";
import { useDebouncedValue } from "./usePaginatedList";

export type ServerSearchEntity = "notes" | "papers" | "ideas" | "global";

export interface ServerSearchOptions<T> {
  /** Raw (undebounced) query string. */
  query: string;
  entity: ServerSearchEntity;
  /**
   * The view's already-computed client results (filtered/sorted). Returned
   * verbatim unless live server rows arrive for the settled query.
   */
  clientResults: T[];
  /** Row cap for the RPC. Defaults to SEARCH_LIMIT (20). */
  limit?: number;
}

export interface ServerSearchResult<T> {
  results: T[];
  /** True while a debounced RPC is in flight. */
  loading: boolean;
  /** "server" when rows came from the RPC, "client" otherwise. */
  source: "server" | "client";
}

export function useServerSearch<T>({
  query,
  entity,
  clientResults,
  limit = SEARCH_LIMIT,
}: ServerSearchOptions<T>): ServerSearchResult<T> {
  const userId = useAppStore((s) => s.user?.id);
  const trimmed = query.trim();
  const debouncedQuery = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  const [serverRows, setServerRows] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const genRef = useRef(0);

  useEffect(() => {
    const gen = (genRef.current += 1);
    if (!shouldUseServerSearch(isDemoMode, debouncedQuery) || !userId) {
      setServerRows(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let rows: unknown[] | null = null;
      if (entity === "notes") {
        rows = await searchNotesViaRpc<T>(userId, debouncedQuery, limit);
      } else if (entity === "papers") {
        rows = await searchPapersViaRpc<T>(userId, debouncedQuery, limit);
      } else if (entity === "ideas") {
        rows = await searchIdeasViaRpc<T>(userId, debouncedQuery, limit);
      } else {
        rows = await globalSearchViaRpc(userId, debouncedQuery, limit);
      }
      if (cancelled || genRef.current !== gen) return; // stale: discard
      setServerRows(rows ? (rows as T[]) : null);
      setLoading(false);
    })().catch(() => {
      if (cancelled || genRef.current !== gen) return;
      setServerRows(null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, debouncedQuery, entity, limit]);

  // While the user is still typing (debounced value lags), always show the
  // instant client list; swap in server rows only once they belong to the
  // current query.
  const settled = debouncedQuery === trimmed && serverRows !== null;
  return {
    results: settled ? (serverRows as T[]) : clientResults,
    loading,
    source: settled ? "server" : "client",
  };
}
