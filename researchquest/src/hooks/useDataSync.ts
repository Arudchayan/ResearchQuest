/**
 * OWNERSHIP: notes, papers, ideas, focus_sessions, daily_logs
 *
 * This hook is the sole realtime owner for the notes, papers, ideas,
 * focus_sessions, and daily_logs tables. It loads the initial data,
 * subscribes to Postgres changes, and pushes updates into the Zustand
 * store (useAppStore).
 *
 * Do NOT add tasks here — useTasks is the sole task owner.
 * daily_logs is consolidated here to eliminate duplicate subscriptions
 * from RightSidebar and useSidebarData.
 */
import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { sortByUpdatedAt } from "../utils/sort";
import type { Note, Paper, Idea } from "../types/database";
import { dedupeById } from "../utils/collections";

function getFetchErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
}

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
    setSelectedPaper,
    setSelectedIdea,
    setFocusSessionSecondsToday,
    setTodayXP,
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
      setSelectedPaper: state.setSelectedPaper,
      setSelectedIdea: state.setSelectedIdea,
      setFocusSessionSecondsToday: state.setFocusSessionSecondsToday,
      setTodayXP: state.setTodayXP,
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
        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (error) {
          setDataSyncError(
            "notes",
            getFetchErrorMessage(error, "Failed to load notes."),
          );
          return;
        }

        clearDataSyncError("notes");
        if (data) {
          setNotes(sortByUpdatedAt(data));
        }
      } catch (error) {
        setDataSyncError(
          "notes",
          getFetchErrorMessage(error, "Failed to load notes."),
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
        const { data, error } = await supabase
          .from("papers")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (error) {
          setDataSyncError(
            "papers",
            getFetchErrorMessage(error, "Failed to load papers."),
          );
          return;
        }

        clearDataSyncError("papers");
        if (data) {
          const sorted = sortByUpdatedAt(data);
          setPapers(sorted);

          // Sync selected paper if it exists in the fresh data
          const current = useAppStore.getState().selectedPaper;
          if (current) {
            const fresh = sorted.find((paper) => paper.id === current.id);
            if (fresh) {
              setSelectedPaper(fresh);
            }
          }
        }
      } catch (error) {
        setDataSyncError(
          "papers",
          getFetchErrorMessage(error, "Failed to load papers."),
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
        const { data, error } = await supabase
          .from("ideas")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (error) {
          setDataSyncError(
            "ideas",
            getFetchErrorMessage(error, "Failed to load ideas."),
          );
          return;
        }

        clearDataSyncError("ideas");
        if (data) {
          const sorted = data; 
          setIdeas(sorted);

          const current = useAppStore.getState().selectedIdea;
          if (current) {
            const fresh = sorted.find((idea) => idea.id === current.id);
            if (fresh) {
              setSelectedIdea(fresh);
            }
          }
        }
      } catch (error) {
        setDataSyncError(
          "ideas",
          getFetchErrorMessage(error, "Failed to load ideas."),
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

    const fetchTodayXP = async () => {
      // Always fetch — no shouldFetch guard since the sidebar always needs it
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("daily_logs")
        .select("xp_earned")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (!error) {
        setTodayXP(data?.xp_earned ?? 0);
      }
    };

    // Initial fetch (only what is needed for current view)
    void fetchNotes();
    void fetchPapers();
    void fetchIdeas();
    void fetchFocusSessionsToday();
    void fetchTodayXP();

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
            const oldId = payload.old["id"];
            if (typeof oldId === "string") {
              setNotes(currentNotes.filter((n) => n.id !== oldId));
            }
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
            const oldId = payload.old["id"];
            if (typeof oldId === "string") {
              setPapers(currentPapers.filter((p) => p.id !== oldId));

              const current = useAppStore.getState().selectedPaper;
              if (current?.id === oldId) {
                setSelectedPaper(null);
              }
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
            const oldId = payload.old["id"];
            if (typeof oldId === "string") {
              setIdeas(currentIdeas.filter((i) => i.id !== oldId));

              const current = useAppStore.getState().selectedIdea;
              if (current?.id === oldId) {
                setSelectedIdea(null);
              }
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

    // daily_logs Subscription (consolidated — replaces RightSidebar + useSidebarData copies)
    const dailyLogsSub = supabase
      .channel(`daily_logs_sync_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_logs",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void fetchTodayXP();
        },
      )
      .subscribe();
    channels.push(dailyLogsSub);

    // Retry signal: when retryDataSync bumps a per-resource counter, drop the
    // fetched guard for that resource and refetch so the Dashboard retry
    // buttons actually re-run the failed query.
    const retryUnsub = useAppStore.subscribe((state, prevState) => {
      if (!userId) return;
      if (
        state.dataSyncRetryCounters.notes !==
        prevState.dataSyncRetryCounters.notes
      ) {
        fetchedRef.current.delete("notes");
        void fetchNotes();
      }
      if (
        state.dataSyncRetryCounters.papers !==
        prevState.dataSyncRetryCounters.papers
      ) {
        fetchedRef.current.delete("papers");
        void fetchPapers();
      }
      if (
        state.dataSyncRetryCounters.ideas !==
        prevState.dataSyncRetryCounters.ideas
      ) {
        fetchedRef.current.delete("ideas");
        void fetchIdeas();
      }
    });

    return () => {
      retryUnsub();
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
    setTodayXP,
    currentView,
  ]);
}
