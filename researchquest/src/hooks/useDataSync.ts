import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { sortByUpdatedAt } from "../utils/sort";
import type { Note, Paper, Idea } from "../types/database";
import { dedupeById } from "../utils/collections";

export function useDataSync(userId: string | undefined) {
  // ⚡ Optimization: Always use useShallow with an object selector when extracting multiple 
  // properties from a Zustand store inside custom hooks to maintain referential equality 
  // and prevent unnecessary re-evaluations.
  const {
    setNotes,
    setPapers,
    setIdeas,
    setNotesLoading,
    setPapersLoading,
    setIdeasLoading,
    setSelectedNote,
    setSelectedPaper,
    setSelectedIdea,
  } = useAppStore(
    useShallow((state) => ({
      setNotes: state.setNotes,
      setPapers: state.setPapers,
      setIdeas: state.setIdeas,
      setNotesLoading: state.setNotesLoading,
      setPapersLoading: state.setPapersLoading,
      setIdeasLoading: state.setIdeasLoading,
      setSelectedNote: state.setSelectedNote,
      setSelectedPaper: state.setSelectedPaper,
      setSelectedIdea: state.setSelectedIdea,
    })),
  );

  // Use refs to avoid dependency cycles in useEffect, but we want to update the store
  // We don't need refs for setters as they are stable from zustand

  useEffect(() => {
    if (!userId) {
      setNotes([]);
      setPapers([]);
      setIdeas([]);
      setNotesLoading(false);
      setPapersLoading(false);
      setIdeasLoading(false);
      return;
    }

    // --- NOTES ---
    const fetchNotes = async () => {
      setNotesLoading(true);
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (!error && data) {
        setNotes(sortByUpdatedAt(data));
      }
      setNotesLoading(false);
    };

    // --- PAPERS ---
    const fetchPapers = async () => {
      setPapersLoading(true);
      const { data, error } = await supabase
        .from("papers")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (!error && data) {
        const sorted = sortByUpdatedAt(data);
        setPapers(sorted);

        // Sync selected paper if it exists in the fresh data
        const current = useAppStore.getState().selectedPaper;
        if (current) {
          const papersMap = new Map(sorted.map(paper => [paper.id, paper]));
          const fresh = papersMap.get(current.id);
          if (fresh) {
            setSelectedPaper(fresh);
          }
        }
      }
      setPapersLoading(false);
    };

    // --- IDEAS ---
    const fetchIdeas = async () => {
      setIdeasLoading(true);
      const { data, error } = await supabase
        .from("ideas")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (!error && data) {
        const sorted = data; // ideas sort might be handled differently in UI? No, usually updated_at
        setIdeas(sorted);

        const current = useAppStore.getState().selectedIdea;
        if (current) {
          const ideasMap = new Map(sorted.map(idea => [idea.id, idea]));
          const fresh = ideasMap.get(current.id);
          if (fresh) {
            setSelectedIdea(fresh);
          }
        }
      }
      setIdeasLoading(false);
    };

    // Initial fetch
    void fetchNotes();
    void fetchPapers();
    void fetchIdeas();

    // --- SUBSCRIPTIONS ---
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Notes Subscription
    const notesSub = supabase
      .channel(`notes_realtime_sync_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setNotes(
              dedupeById([
                payload.new as Note,
                ...useAppStore.getState().notes,
              ]),
            );
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Note;
            const currentNotes = useAppStore.getState().notes;
            const remaining = currentNotes.filter((n) => n.id !== updated.id);
            setNotes(sortByUpdatedAt([updated, ...remaining]));

            const selected = useAppStore.getState().selectedNote;
            if (selected?.id === updated.id) {
              // We don't auto-update selectedNote here because it might disrupt editing
              // But typically we should if it's a remote update?
              // For now, let's leave it as is, similar to useNotes logic
            }
          } else if (payload.eventType === "DELETE") {
            const currentNotes = useAppStore.getState().notes;
            setNotes(currentNotes.filter((n) => n.id !== payload.old.id));
          }
        },
      )
      .subscribe();
    channels.push(notesSub);

    // Papers Subscription
    const papersSub = supabase
      .channel(`papers_realtime_sync_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "papers",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newPaper = payload.new as Paper;
            setPapers(
              sortByUpdatedAt([newPaper, ...useAppStore.getState().papers]),
            );

            const current = useAppStore.getState().selectedPaper;
            if (current?.id === newPaper.id) {
              setSelectedPaper(newPaper);
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Paper;
            const currentPapers = useAppStore.getState().papers;
            const remaining = currentPapers.filter((p) => p.id !== updated.id);
            setPapers(sortByUpdatedAt([updated, ...remaining]));

            const current = useAppStore.getState().selectedPaper;
            if (current?.id === updated.id) {
              setSelectedPaper(updated);
            }
          } else if (payload.eventType === "DELETE") {
            const currentPapers = useAppStore.getState().papers;
            setPapers(currentPapers.filter((p) => p.id !== payload.old.id));

            const current = useAppStore.getState().selectedPaper;
            if (current?.id === payload.old.id) {
              setSelectedPaper(null);
            }
          }
        },
      )
      .subscribe();
    channels.push(papersSub);

    // Ideas Subscription
    const ideasSub = supabase
      .channel(`ideas_realtime_sync_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ideas",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newIdea = payload.new as Idea;
            // Check if exists
            const currentIdeas = useAppStore.getState().ideas;
            if (!currentIdeas.some((i) => i.id === newIdea.id)) {
              setIdeas([newIdea, ...currentIdeas]);

              const current = useAppStore.getState().selectedIdea;
              if (current?.id === newIdea.id) {
                setSelectedIdea(newIdea);
              }
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as Idea;
            const currentIdeas = useAppStore.getState().ideas;
            setIdeas(
              currentIdeas.map((i) => (i.id === updated.id ? updated : i)),
            );

            const current = useAppStore.getState().selectedIdea;
            if (current?.id === updated.id) {
              setSelectedIdea(updated);
            }
          } else if (payload.eventType === "DELETE") {
            const currentIdeas = useAppStore.getState().ideas;
            setIdeas(currentIdeas.filter((i) => i.id !== payload.old.id));

            const current = useAppStore.getState().selectedIdea;
            if (current?.id === payload.old.id) {
              setSelectedIdea(null);
            }
          }
        },
      )
      .subscribe();
    channels.push(ideasSub);

    return () => {
      channels.forEach((sub) => sub.unsubscribe());
    };
  }, [
    userId,
    setNotes,
    setPapers,
    setIdeas,
    setNotesLoading,
    setPapersLoading,
    setIdeasLoading,
    setSelectedPaper,
    setSelectedIdea,
  ]);
}
