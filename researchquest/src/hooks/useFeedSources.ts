import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import type { FeedSource } from "../types/database";
import { logger } from "../utils/logger";
import { isValidUrl } from "../utils/security";

export const FEED_SOURCE_KINDS = ["rss", "arxiv", "jobs", "custom"] as const;
export type FeedSourceKind = (typeof FEED_SOURCE_KINDS)[number];

export interface FeedSourceDraft {
  name: string;
  kind: FeedSourceKind;
  url?: string;
}

function validateDraft(draft: FeedSourceDraft): string | null {
  if (!draft.name.trim()) return "Source name is required.";
  if (!(FEED_SOURCE_KINDS as readonly string[]).includes(draft.kind)) {
    return "Pick a valid source kind.";
  }
  if (draft.url?.trim() && !isValidUrl(draft.url.trim())) {
    return "Source URL must start with http:// or https://.";
  }
  return null;
}

/**
 * Feed source list/add/remove/disable. Sources are metadata only (alpha):
 * no automatic ingest runs — triage stays manual and promotion is the only
 * write path into papers/tasks/notes.
 */
export function useFeedSources(userId: string | undefined) {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    if (!userId) {
      setSources([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("feed_sources")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (fetchError) {
        logger.error("Failed to fetch feed sources", fetchError);
        setError("Couldn't load feed sources. Retry?");
        return;
      }
      setSources((data ?? []) as FeedSource[]);
    } catch (fetchError) {
      logger.error("Failed to fetch feed sources", fetchError);
      setError("Couldn't load feed sources. Retry?");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchSources();
  }, [fetchSources]);

  const addSource = useCallback(
    async (draft: FeedSourceDraft) => {
      if (!userId) {
        toast.error("You must be logged in to add feed sources");
        return null;
      }
      const validationError = validateDraft(draft);
      if (validationError) {
        toast.error(validationError);
        return null;
      }
      const duplicate = sources.some(
        (source) =>
          source.name.trim().toLowerCase() === draft.name.trim().toLowerCase(),
      );
      if (duplicate) {
        toast.error("A source with this name already exists.");
        return null;
      }
      const { data, error: insertError } = await supabase
        .from("feed_sources")
        .insert({
          user_id: userId,
          name: draft.name.trim(),
          kind: draft.kind,
          config: draft.url?.trim() ? { url: draft.url.trim() } : {},
          enabled: true,
        })
        .select("*")
        .single();
      if (insertError || !data) {
        logger.error("Failed to add feed source", insertError);
        toast.error("Couldn't add feed source. Retry?");
        return null;
      }
      setSources((prev) => [data as FeedSource, ...prev]);
      toast.success(`Source "${draft.name.trim()}" added`);
      return data as FeedSource;
    },
    [sources, userId],
  );

  const removeSource = useCallback(
    async (sourceId: string) => {
      if (!userId) {
        toast.error("You must be logged in to remove feed sources");
        return false;
      }
      const source = sources.find((item) => item.id === sourceId);
      const confirmed =
        typeof window === "undefined" ||
        window.confirm(
          `Remove source "${source?.name ?? sourceId}"? Items already added are kept.`,
        );
      if (!confirmed) return false;
      const previous = sources;
      setBusyId(sourceId);
      setSources((prev) => prev.filter((item) => item.id !== sourceId));
      const { error: deleteError } = await supabase
        .from("feed_sources")
        .delete()
        .eq("id", sourceId)
        .eq("user_id", userId);
      setBusyId(null);
      if (deleteError) {
        logger.error("Failed to remove feed source", deleteError);
        setSources(previous);
        toast.error("Couldn't remove feed source. Retry?");
        return false;
      }
      toast.success("Feed source removed");
      return true;
    },
    [sources, userId],
  );

  const setSourceEnabled = useCallback(
    async (sourceId: string, enabled: boolean) => {
      if (!userId) {
        toast.error("You must be logged in to update feed sources");
        return false;
      }
      const previous = sources;
      setBusyId(sourceId);
      setSources((prev) =>
        prev.map((item) =>
          item.id === sourceId
            ? { ...item, enabled, updated_at: new Date().toISOString() }
            : item,
        ),
      );
      const { data, error: updateError } = await supabase
        .from("feed_sources")
        .update({ enabled })
        .eq("id", sourceId)
        .eq("user_id", userId)
        .select("*")
        .single();
      setBusyId(null);
      if (updateError || !data) {
        logger.error("Failed to update feed source", updateError);
        setSources(previous);
        toast.error("Couldn't update feed source. Retry?");
        return false;
      }
      setSources((prev) =>
        prev.map((item) =>
          item.id === sourceId ? (data as FeedSource) : item,
        ),
      );
      return true;
    },
    [sources, userId],
  );

  return {
    sources,
    loading,
    error,
    busyId,
    refreshSources: fetchSources,
    addSource,
    removeSource,
    setSourceEnabled,
  };
}
