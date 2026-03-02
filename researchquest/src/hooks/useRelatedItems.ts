import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store/appStore";
import { deriveTitleFromMarkdown } from "../utils/text";

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
        .eq(entityColumn, entityId);

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

      const [notesResult, papersResult, ideasResult] = await Promise.all([
        supabase
          .from("topic_notes")
          .select("note_id, topic_id")
          .in("topic_id", topicIds)
          .neq(
            "note_id",
            entityType === "note"
              ? entityId
              : "00000000-0000-0000-0000-000000000000",
          ),

        supabase
          .from("topic_papers")
          .select("paper_id, topic_id")
          .in("topic_id", topicIds)
          .neq(
            "paper_id",
            entityType === "paper"
              ? entityId
              : "00000000-0000-0000-0000-000000000000",
          ),

        supabase
          .from("topic_ideas")
          .select("idea_id, topic_id")
          .in("topic_id", topicIds)
          .neq(
            "idea_id",
            entityType === "idea"
              ? entityId
              : "00000000-0000-0000-0000-000000000000",
          ),
      ]);

      // Find related notes
      const { data: relatedNotes, error: notesError } = notesResult;

      if (!notesError && relatedNotes) {
        for (const link of relatedNotes) {
          const key = `note-${link.note_id}`;
          if (linkMap.has(key)) {
            linkMap.get(key)!.topicCount++;
          } else {
            linkMap.set(key, { id: link.note_id, type: "note", topicCount: 1 });
          }
        }
      }

      // Find related papers
      const { data: relatedPapers, error: papersError } = papersResult;

      if (!papersError && relatedPapers) {
        for (const link of relatedPapers) {
          const key = `paper-${link.paper_id}`;
          if (linkMap.has(key)) {
            linkMap.get(key)!.topicCount++;
          } else {
            linkMap.set(key, {
              id: link.paper_id,
              type: "paper",
              topicCount: 1,
            });
          }
        }
      }

      // Find related ideas
      const { data: relatedIdeas, error: ideasError } = ideasResult;

      if (!ideasError && relatedIdeas) {
        for (const link of relatedIdeas) {
          const key = `idea-${link.idea_id}`;
          if (linkMap.has(key)) {
            linkMap.get(key)!.topicCount++;
          } else {
            linkMap.set(key, { id: link.idea_id, type: "idea", topicCount: 1 });
          }
        }
      }

      setRelatedLinks(Array.from(linkMap.values()));
    } catch (error) {
      console.error("Error fetching related items:", error);
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

    for (const link of relatedLinks) {
      let fullItem: any = null;
      let title = "";
      let updated_at = "";

      if (link.type === "note") {
        fullItem = notes.find((n) => n.id === link.id);
        if (fullItem) {
          title =
            fullItem.title || deriveTitleFromMarkdown(fullItem.markdown_body);
          updated_at = fullItem.updated_at;
        }
      } else if (link.type === "paper") {
        fullItem = papers.find((p) => p.id === link.id);
        if (fullItem) {
          title = fullItem.title;
          updated_at = fullItem.updated_at;
        }
      } else if (link.type === "idea") {
        fullItem = ideas.find((i) => i.id === link.id);
        if (fullItem) {
          title = fullItem.title;
          updated_at = fullItem.updated_at;
        }
      }

      // Only include if found in store
      if (fullItem) {
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
