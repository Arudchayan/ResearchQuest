import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store/appStore";
import { deriveTitleFromMarkdown } from "../utils/text";
import { logger } from "../utils/logger";

export interface RelatedItem {
  id: string;
  title: string;
  type: "note" | "paper" | "idea";
  sharedTopics: number;
  updated_at: string;
}

interface RelatedLink {
  id: string;
  type: "note" | "paper" | "idea";
  topicCount: number;
}

const LINK_CONFIG = [
  { type: "note", table: "topic_notes", idColumn: "note_id" },
  { type: "paper", table: "topic_papers", idColumn: "paper_id" },
  { type: "idea", table: "topic_ideas", idColumn: "idea_id" },
] as const;

const PLACEHOLDER_UUID = "00000000-0000-0000-0000-000000000000";

export function useRelatedItems(
  entityId: string | null,
  entityType: "note" | "paper" | "idea" | null,
  userId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;
  // Store only the structural relationship data (IDs and counts), not the full objects
  const [relatedLinks, setRelatedLinks] = useState<RelatedLink[]>([]);
  const [loading, setLoading] = useState(false);

  // Subscribe to store updates for hydration
  const notes = useAppStore((state) => state.notes);
  const papers = useAppStore((state) => state.papers);
  const ideas = useAppStore((state) => state.ideas);

  const fetchRelatedLinks = useCallback(async () => {
    if (!enabled) return;

    if (!entityId || !entityType || !userId) {
      setRelatedLinks([]);
      return;
    }

    setLoading(true);

    try {
      // First, get the topics for the current entity
      const topicTable =
        entityType === "note"
          ? "topic_notes"
          : entityType === "paper"
            ? "topic_papers"
            : "topic_ideas";
      const entityColumn =
        entityType === "note"
          ? "note_id"
          : entityType === "paper"
            ? "paper_id"
            : "idea_id";

      const { data: currentTopics, error: topicsError } = await supabase
        .from(topicTable)
        .select("topic_id")
        .eq(entityColumn, entityId)
        .eq("user_id", userId);

      if (topicsError || !currentTopics || currentTopics.length === 0) {
        setRelatedLinks([]);
        setLoading(false);
        return;
      }

      const topicIds = currentTopics.map((t) => t.topic_id);

      // Now find other entities that share these topics
      const linkMap = new Map<string, RelatedLink>();

      // ⚡ PERFORMANCE OPTIMIZATION:
      // We fetch only the IDs. We do NOT hydrate with store data here.
      // This allows us to keep this effect independent of store updates.
      // Additionally, we use Promise.all to fetch related items concurrently.

      const results = await Promise.all(
        LINK_CONFIG.map(({ type, table, idColumn }) =>
          supabase
            .from(table)
            .select(`${idColumn}, topic_id`)
            .in("topic_id", topicIds)
            .eq("user_id", userId)
            .neq(idColumn, entityType === type ? entityId : PLACEHOLDER_UUID),
        ),
      );

      for (let i = 0; i < LINK_CONFIG.length; i++) {
        const { type, idColumn } = LINK_CONFIG[i]!;
        const { data, error } = results[i]!;

        if (!error && data) {
          // ponytail: rows are typed per-table by the dynamic select string; index by column name
          for (const link of data as { [key: string]: string }[]) {
            const key = `${type}-${link[idColumn]}`;
            if (linkMap.has(key)) {
              linkMap.get(key)!.topicCount++;
            } else {
              linkMap.set(key, { id: link[idColumn], type, topicCount: 1 });
            }
          }
        }
      }

      setRelatedLinks(Array.from(linkMap.values()));
    } catch (error) {
      logger.error("Error fetching related items", error);
      setRelatedLinks([]);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, userId, enabled]); // No dependencies on store data!

  // Effect to fetch links. Only runs when entity changes (or userId).
  useEffect(() => {
    void fetchRelatedLinks();
  }, [fetchRelatedLinks]);

  // Hydrate links with full object data from store
  const relatedItems = useMemo(() => {
    if (relatedLinks.length === 0) return [];

    const results: RelatedItem[] = [];

    // ⚡ PERFORMANCE OPTIMIZATION:
    // Pre-compute Map lookups (O(1)) instead of repeated array scans (O(N*M)) when hydrating links from the store.
    // Avoid intermediate array allocations by directly building the Map.
    const notesMap = new Map();
    for (let i = 0; i < notes.length; i++) notesMap.set(notes[i].id, notes[i]);

    const papersMap = new Map();
    for (let i = 0; i < papers.length; i++) papersMap.set(papers[i].id, papers[i]);

    const ideasMap = new Map();
    for (let i = 0; i < ideas.length; i++) ideasMap.set(ideas[i].id, ideas[i]);

    for (const link of relatedLinks) {
      let title = "";
      let updated_at = "";

      if (link.type === "note") {
        const fullItem = notesMap.get(link.id);
        if (fullItem) {
          title =
            fullItem.title || deriveTitleFromMarkdown(fullItem.markdown_body);
          updated_at = fullItem.updated_at;
        }
      } else if (link.type === "paper") {
        const fullItem = papersMap.get(link.id);
        if (fullItem) {
          title = fullItem.title;
          updated_at = fullItem.updated_at;
        }
      } else if (link.type === "idea") {
        const fullItem = ideasMap.get(link.id);
        if (fullItem) {
          title = fullItem.title;
          updated_at = fullItem.updated_at;
        }
      }

      // Only include if found in store
      if (title) {
        results.push({
          id: link.id,
          title,
          type: link.type,
          sharedTopics: link.topicCount,
          updated_at,
        });
      }
    }

    // Sort by number of shared topics (desc), then by update time (desc)
    return results.sort((a, b) => {
      if (b.sharedTopics !== a.sharedTopics) {
        return b.sharedTopics - a.sharedTopics;
      }
      // ⚡ PERFORMANCE OPTIMIZATION: String comparison for ISO dates
      if (b.updated_at > a.updated_at) return 1;
      if (b.updated_at < a.updated_at) return -1;
      return 0;
    });
  }, [relatedLinks, notes, papers, ideas]);

  return {
    relatedItems,
    loading,
    refresh: fetchRelatedLinks,
  };
}
