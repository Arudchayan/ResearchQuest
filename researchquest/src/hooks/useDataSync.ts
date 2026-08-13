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
import { useAppStore, type DataSyncResource } from "../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { sortByUpdatedAt } from "../utils/sort";
import { extractFunctionErrorMessage } from "../utils/errors";
import type { Note, Paper, Idea } from "../types/database";
import { dedupeById } from "../utils/collections";

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

    // Generic fetch for the per-view tables (notes/papers/ideas): same
    // select-all-where-user_id query, loading flag, and error handling.
    const fetchTable = async <T extends { id: string }>(
      table: DataSyncResource,
      opts: {
        fallbackError: string;
        setItems: (items: T[]) => void;
        setLoading: (loading: boolean) => void;
        transform?: (items: T[]) => T[];
        syncSelected?: {
          getSelected: () => { id: string } | null;
          setSelected: (item: T | null) => void;
        };
      },
    ) => {
      if (!shouldFetch(table)) return;
      fetchedRef.current.add(table);

      opts.setLoading(true);
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (error) {
          setDataSyncError(
            table,
            extractFunctionErrorMessage(error, opts.fallbackError),
          );
          return;
        }

        clearDataSyncError(table);
        if (data) {
          const items = opts.transform ? opts.transform(data) : data;
          opts.setItems(items);

          // Sync selected entity if it still exists in the fresh data
          if (opts.syncSelected) {
            const current = opts.syncSelected.getSelected();
            if (current) {
              const fresh = items.find((item) => item.id === current.id);
              if (fresh) {
                opts.syncSelected.setSelected(fresh);
              }
            }
          }
        }
      } catch (error) {
        setDataSyncError(
          table,
          extractFunctionErrorMessage(error, opts.fallbackError),
        );
      } finally {
        opts.setLoading(false);
      }
    };

    const fetchNotes = () =>
      fetchTable<Note>("notes", {
        fallbackError: "Failed to load notes.",
        setItems: setNotes,
        setLoading: setNotesLoading,
        transform: sortByUpdatedAt,
      });

    const fetchPapers = () =>
      fetchTable<Paper>("papers", {
        fallbackError: "Failed to load papers.",
        setItems: setPapers,
        setLoading: setPapersLoading,
        transform: sortByUpdatedAt,
        syncSelected: {
          getSelected: () => useAppStore.getState().selectedPaper,
          setSelected: setSelectedPaper,
        },
      });

    const fetchIdeas = () =>
      fetchTable<Idea>("ideas", {
        fallbackError: "Failed to load ideas.",
        setItems: setIdeas,
        setLoading: setIdeasLoading,
        syncSelected: {
          getSelected: () => useAppStore.getState().selectedIdea,
          setSelected: setSelectedIdea,
        },
      });

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

    // Generic realtime subscription for the per-view tables (notes/papers/ideas):
    // same postgres_changes listener; per-table merge logic via callbacks.
    const makeSubscription = <T extends { id: string }>(opts: {
      table: string;
      channelName: string;
      onInsert: (newItem: T) => void;
      onUpdate: (updated: T) => void;
      onDelete: (oldId: string) => void;
    }) =>
      supabase
        .channel(opts.channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: opts.table,
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              opts.onInsert(payload.new as T);
            } else if (payload.eventType === "UPDATE") {
              opts.onUpdate(payload.new as T);
            } else if (payload.eventType === "DELETE") {
              const oldId = payload.old["id"];
              if (typeof oldId === "string") {
                opts.onDelete(oldId);
              }
            }
          },
        )
        .subscribe();

    // Notes Subscription
    const notesSub = makeSubscription<Note>({
      table: "notes",
      channelName: `notes_realtime_sync_${userId}`,
      onInsert: (newNote) =>
        setNotes(dedupeById([newNote, ...useAppStore.getState().notes])),
      onUpdate: (updated) => {
        const remaining = useAppStore
          .getState()
          .notes.filter((n) => n.id !== updated.id);
        setNotes(sortByUpdatedAt([updated, ...remaining]));
        // We don't auto-update selectedNote here because it might disrupt editing
      },
      onDelete: (oldId) =>
        setNotes(useAppStore.getState().notes.filter((n) => n.id !== oldId)),
    });
    channels.push(notesSub);

    // Papers Subscription
    const syncSelectedPaper = (paper: Paper) => {
      const current = useAppStore.getState().selectedPaper;
      if (current?.id === paper.id) {
        setSelectedPaper(paper);
      }
    };

    const papersSub = makeSubscription<Paper>({
      table: "papers",
      channelName: `papers_realtime_sync_${userId}`,
      onInsert: (newPaper) => {
        setPapers(
          sortByUpdatedAt([newPaper, ...useAppStore.getState().papers]),
        );
        syncSelectedPaper(newPaper);
      },
      onUpdate: (updated) => {
        const remaining = useAppStore
          .getState()
          .papers.filter((p) => p.id !== updated.id);
        setPapers(sortByUpdatedAt([updated, ...remaining]));
        syncSelectedPaper(updated);
      },
      onDelete: (oldId) => {
        setPapers(useAppStore.getState().papers.filter((p) => p.id !== oldId));

        const current = useAppStore.getState().selectedPaper;
        if (current?.id === oldId) {
          setSelectedPaper(null);
        }
      },
    });
    channels.push(papersSub);

    // Ideas Subscription
    const syncSelectedIdea = (idea: Idea) => {
      const current = useAppStore.getState().selectedIdea;
      if (current?.id === idea.id) {
        setSelectedIdea(idea);
      }
    };

    const ideasSub = makeSubscription<Idea>({
      table: "ideas",
      channelName: `ideas_realtime_sync_${userId}`,
      onInsert: (newIdea) => {
        const currentIdeas = useAppStore.getState().ideas;
        // Check if exists
        if (!currentIdeas.some((i) => i.id === newIdea.id)) {
          setIdeas([newIdea, ...currentIdeas]);
          syncSelectedIdea(newIdea);
        }
      },
      onUpdate: (updated) => {
        setIdeas(
          useAppStore
            .getState()
            .ideas.map((i) => (i.id === updated.id ? updated : i)),
        );
        syncSelectedIdea(updated);
      },
      onDelete: (oldId) => {
        setIdeas(useAppStore.getState().ideas.filter((i) => i.id !== oldId));

        const current = useAppStore.getState().selectedIdea;
        if (current?.id === oldId) {
          setSelectedIdea(null);
        }
      },
    });
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
