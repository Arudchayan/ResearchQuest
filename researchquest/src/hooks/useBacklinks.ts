import { useMemo } from "react";
import { useAppStore } from "../store/appStore";
import { deriveTitleFromMarkdown } from "../utils/text";

export interface BacklinkItem {
  id: string;
  title: string;
  type: "note" | "idea";
  updated_at: string;
}

export function useBacklinks(
  entityId: string | null,
  entityType: "note" | "paper" | "idea" | null,
  userId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;

  // ⚡ PERFORMANCE OPTIMIZATION: Use global store cache instead of redundant Supabase queries
  // The app already loads all notes and ideas via useDataSync/useAppStore.
  // We can filter them in memory which is instant and reactive to realtime updates.
  const notes = useAppStore((state) => state.notes);
  const ideas = useAppStore((state) => state.ideas);
  const notesLoading = useAppStore((state) => state.notesLoading);
  const ideasLoading = useAppStore((state) => state.ideasLoading);

  const backlinks = useMemo(() => {
    if (!enabled || !entityId || !entityType || !userId) return [];

    const results: BacklinkItem[] = [];

    // 1. Find notes that link to this entity
    // notes have linked_entity_ids array
    const linkingNotes = notes.filter(
      (note) =>
        note.linked_entity_ids && note.linked_entity_ids.includes(entityId),
    );

    results.push(
      ...linkingNotes.map((note) => ({
        id: note.id,
        title:
          note.title?.trim() || deriveTitleFromMarkdown(note.markdown_body),
        type: "note" as const,
        updated_at: note.updated_at,
      })),
    );

    // 2. Find ideas that link to this entity
    // ideas have linked_note_ids and linked_paper_ids
    let linkingIdeas: typeof ideas = [];

    if (entityType === "note") {
      linkingIdeas = ideas.filter(
        (idea) =>
          idea.linked_note_ids && idea.linked_note_ids.includes(entityId),
      );
    } else if (entityType === "paper") {
      linkingIdeas = ideas.filter(
        (idea) =>
          idea.linked_paper_ids && idea.linked_paper_ids.includes(entityId),
      );
    }
    // ideas don't link to ideas in the current schema

    results.push(
      ...linkingIdeas.map((idea) => ({
        id: idea.id,
        title: idea.title,
        type: "idea" as const,
        updated_at: idea.updated_at,
      })),
    );

    // Sort by updated_at desc
    return results.sort((a, b) => {
      // Optimized string comparison for ISO dates
      if (b.updated_at > a.updated_at) return 1;
      if (b.updated_at < a.updated_at) return -1;
      return 0;
    });
  }, [entityId, entityType, userId, enabled, notes, ideas]);

  return {
    backlinks,
    // Show loading only if the store is still initializing the collections
    loading: notesLoading || ideasLoading,
  };
}
