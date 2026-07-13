import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { sortByUpdatedAt } from "../utils/sort";
import type { Note, Paper, Idea } from "../types/database";
import { dedupeById } from "../utils/collections";

/** Number of rows to fetch per paginated request. */
const PAGE_LIMIT = 50;

export function useDataSync(userId: string | undefined, currentView: string) {
  // Use a ref to track what we've already fetched in this session to prevent redundant calls
  const fetchedRef = useRef<Set<string>>(new Set());

  const {
    setNotes,
    setPapers,
    setIdeas,
    setNotesLoading,
    setPapersLoading,
    setIdeasLoading,
    setDataSyncError,
    clearDataSyncError,
    clearDataSyncErrors,
    setSelectedNote,
    setSelectedPaper,
    setSelectedIdea,
    setFocusSessionSecondsToday,
  } = useAppStore(
    useShallow((state) => ({
      setNotes: state.setNotes,
      setPapers: state.setPapers,
      setIdeas: state.setIdeas,
      setNotesLoading: state.setNotesLoading,
      setPapersLoading: state.setPapersLoading,
      setIdeasLoading: state.setIdeasLoading,
      setDataSyncError: state.setDataSyncError,
      clearDataSyncError: state.clearDataSyncError,
      clearDataSyncErrors: state.clearDataSyncErrors,
      setSelectedNote: state.setSelectedNote,
      setSelectedPaper: state.setSelectedPaper,
      setSelectedIdea: state.setSelectedIdea,
      setFocusSessionSecondsToday: state.setFocusSessionSecondsToday,
    })),
  );

  useEffect(() => {
    if (!userId) {
      setNotes([]);
      setPapers([]);
      setIdeas([]);
      setNotesLoading(false);
      setPapersLoading(false);
      setIdeasLoading(false);
      setFocusSessionSecondsToday(0);
      clearDataSyncErrors();
      fetchedRef.current.clear();
      return;
    }

    // Reset cache if user changes
    if (userId && !fetchedRef.current.has(`user_${userId}`)) {
       fetchedRef.current.clear();
       fetchedRef.current.add(`user_${userId}`);
    }

    const shouldFetch = (domain: string) => {
      if (fetchedRef.current.has(domain)) return false;
      
      // Always fetch for dashboard
      if (currentView === 'dashboard') return true;
      
      // Otherwise only fetch for the active view
      if (domain === 'notes' && currentView === 'notes') return true;
      if (domain === 'papers' && currentView === 'papers') return true;
      if (domain === 'ideas' && currentView === 'ideas') return true;
      if (domain === 'focus' && currentView === 'focus') return true;
      
      return false;
    };

    // --- NOTES ---
    const fetchNotes = async () => {
      if (!shouldFetch('notes')) return;
      fetchedRef.current.add('notes');
      
      setNotesLoading(true);
      try {
        const allNotes: Note[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("notes")
            .select("id, title, markdown_body, tags, linked_entity_ids, created_at, updated_at")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .range(offset, offset + PAGE_LIMIT - 1);

          if (error) {
            console.error("Failed to load notes:", error);
            setDataSyncError(
              "notes",
              "Failed to load notes.",
            );
            return;
          }

          if (data && data.length > 0) {
            allNotes.push(...(data as Note[]));
            if (data.length < PAGE_LIMIT) {
              hasMore = false;
            } else {
              offset += PAGE_LIMIT;
            }
          } else {
            hasMore = false;
          }
        }

        clearDataSyncError("notes");
        setNotes(sortByUpdatedAt(allNotes));
      } catch (error) {
        console.error("Failed to load notes:", error);
        setDataSyncError(
          "notes",
          "Failed to load notes.",
        );
      } finally {
        setNotesLoading(false);
      }
    };

    // --- PAPERS ---
    const fetchPapers = async () => {
      if (!shouldFetch('papers')) return;
      fetchedRef.current.add('papers');

      setPapersLoading(true);
      try {
        const allPapers: Paper[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("papers")
            .select("id, title, authors, doi, source_url, status, topic_ids, abstract, publication_date, created_at, updated_at")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .range(offset, offset + PAGE_LIMIT - 1);

          if (error) {
            console.error("Failed to load papers:", error);
            setDataSyncError(
              "papers",
              "Failed to load papers.",
            );
            return;
          }

          if (data && data.length > 0) {
            allPapers.push(...(data as Paper[]));
            if (data.length < PAGE_LIMIT) {
              hasMore = false;
            } else {
              offset += PAGE_LIMIT;
            }
          } else {
            hasMore = false;
          }
        }

        clearDataSyncError("papers");
        const sorted = sortByUpdatedAt(allPapers);
        setPapers(sorted);

        // Sync selected paper if it exists in the fresh data
        const current = useAppStore.getState().selectedPaper;
        if (current) {
          const fresh = sorted.find((paper) => paper.id === current.id);
          if (fresh) {
            setSelectedPaper(fresh);
          }
        }
      } catch (error) {
        console.error("Failed to load papers:", error);
        setDataSyncError(
          "papers",
          "Failed to load papers.",
        );
      } finally {
        setPapersLoading(false);
      }
    };

    // --- IDEAS ---
    const fetchIdeas = async () => {
      if (!shouldFetch('ideas')) return;
      fetchedRef.current.add('ideas');

      setIdeasLoading(true);
      try {
        const allIdeas: Idea[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("ideas")
            .select("id, title, description, stage, linked_note_ids, linked_paper_ids, created_at, updated_at")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .range(offset, offset + PAGE_LIMIT - 1);

          if (error) {
            console.error("Failed to load ideas:", error);
            setDataSyncError(
              "ideas",
              "Failed to load ideas.",
            );
            return;
          }

          if (data && data.length > 0) {
            allIdeas.push(...(data as Idea[]));
            if (data.length < PAGE_LIMIT) {
              hasMore = false;
            } else {
              offset += PAGE_LIMIT;
            }
          } else {
            hasMore = false;
          }
        }

        clearDataSyncError("ideas");
        if (allIdeas.length > 0) {
          setIdeas(sortByUpdatedAt(allIdeas));
        }

        const current = useAppStore.getState().selectedIdea;
        if (current) {
          const fresh = allIdeas.find((idea) => idea.id === current.id);
          if (fresh) {
            setSelectedIdea(fresh);
          }
        }
      } catch (error) {
        console.error("Failed to load ideas:", error);
        setDataSyncError(
          "ideas",
          "Failed to load ideas.",
        );
      } finally {
        setIdeasLoading(false);
      }
    };

    const fetchFocusSessionsToday = async () => {
      if (!shouldFetch('focus')) return;
      fetchedRef.current.add('focus');

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("focus_sessions")
        .select("duration_seconds")
        .eq("user_id", userId)
        .gte("completed_at", startOfDay.toISOString());

      if (error) {
        return;
      }

      const total = (data ?? []).reduce(
        (sum, row) => sum + (Number(row.duration_seconds) || 0),
        0,
      );
      setFocusSessionSecondsToday(total);
    };

    // Initial fetch (only what is needed for current view)
    void fetchNotes();
    void fetchPapers();
    void fetchIdeas();
    void fetchFocusSessionsToday();

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

    const focusSessionsSub = supabase
      .channel(`focus_sessions_sync_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "focus_sessions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchFocusSessionsToday();
        },
      )
      .subscribe();
    channels.push(focusSessionsSub);

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
    setDataSyncError,
    clearDataSyncError,
    clearDataSyncErrors,
    setSelectedPaper,
    setSelectedIdea,
    setFocusSessionSecondsToday,
    currentView,
  ]);
}
