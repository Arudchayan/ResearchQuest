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
import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  cacheKeyForList,
  clearStaleKeys,
  markStaleKeys,
  readListCache,
  writeListCache,
} from "../lib/idbCache";
import {
  listWithGatewayFallback,
  type GatewayListResource,
} from "../lib/apiGateway";
import { useAppStore, type DataSyncResource } from "../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { sortByUpdatedAt } from "../utils/sort";
import { dedupeById, preferNewerByUpdatedAt } from "../utils/collections";
import { todayKey } from "../utils/time";
import { extractFunctionErrorMessage } from "../utils/errors";
import type { Note, Paper, Idea } from "../types/database";

export function useDataSync(userId: string | undefined) {

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
    setXpToday,
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
      setXpToday: state.setXpToday,
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
      return;
    }

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
      opts.setLoading(true);
      try {
        const cacheKey = cacheKeyForList(table, userId);

        // Read-through cache: render the cached snapshot immediately while
        // the gateway/direct read below revalidates. Stale entries flag the
        // banner until fresh rows land.
        try {
          const cached = await readListCache<T>(cacheKey);
          if (cached) {
            const cachedItems = opts.transform
              ? opts.transform(cached.data)
              : cached.data;
            opts.setItems(cachedItems);
            if (cached.stale) {
              markStaleKeys(cacheKey);
            } else {
              clearStaleKeys(cacheKey);
            }
          }
        } catch {
          // Cache must never break list reads.
        }

        const direct = async (): Promise<T[]> => {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false });
          if (error) throw error;
          return (data ?? []) as T[];
        };

        let rows: T[];
        try {
          const result = await listWithGatewayFallback<T>(
            table as GatewayListResource,
            { limit: 100 },
            direct,
          );
          rows = result.data;
        } catch (error) {
          setDataSyncError(
            table,
            extractFunctionErrorMessage(error, opts.fallbackError),
          );
          return;
        }

        clearDataSyncError(table);
        const items = opts.transform ? opts.transform(rows) : rows;
        opts.setItems(items);
        try {
          await writeListCache(cacheKey, rows);
        } catch {
          // Best-effort.
        }
        clearStaleKeys(cacheKey);

        {
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
        transform: (rows) =>
          sortByUpdatedAt(
            preferNewerByUpdatedAt(rows, useAppStore.getState().notes),
          ),
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
      // Always fetch — no shouldFetch guard since the sidebar always needs it.
      // "Today" is the shared date authority (todayKey: local calendar day,
      // matching the daily_logs.date DATE semantics) — not the UTC day.
      const today = todayKey();
      const { data, error } = await supabase
        .from("daily_logs")
        .select("xp_earned")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (!error) {
        setXpToday(data?.xp_earned ?? 0);
      }
    };

    // Trailing debounce for fire-and-forget realtime refetches: burst
    // INSERT/* events collapse into one fetch per 500ms window.
    // Pending timers are tracked so unmount clears them.
    const pendingDebounceTimers = new Set<ReturnType<typeof setTimeout>>();
    const debounceRealtimeRefetch = (fn: () => void) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      return () => {
        if (timer !== null) {
          clearTimeout(timer);
          pendingDebounceTimers.delete(timer);
        }
        timer = setTimeout(() => {
          if (timer !== null) pendingDebounceTimers.delete(timer);
          timer = null;
          fn();
        }, 500);
        pendingDebounceTimers.add(timer);
      };
    };
    const debouncedFetchFocusToday = debounceRealtimeRefetch(() => {
      void fetchFocusSessionsToday();
    });
    const debouncedFetchTodayXP = debounceRealtimeRefetch(() => {
      void fetchTodayXP();
    });

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
        // Selected-sync policy (deliberate asymmetry — documenting only, no
        // behavior change): notes NEVER auto-sync selectedNote here (fetch,
        // realtime update, or delete) because the note editor holds unsaved
        // local state that a remote/echoed update would clobber mid-edit.
        // Papers/ideas DO sync their selection because their detail views
        // are read-mostly. Keep this asymmetry unless the editor gains a
        // dirty-guard that can safely merge remote updates.
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
          sortByUpdatedAt(
            dedupeById([newPaper, ...useAppStore.getState().papers]),
          ),
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
          debouncedFetchFocusToday();
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
          debouncedFetchTodayXP();
        },
      )
      .subscribe();
    channels.push(dailyLogsSub);

    // Retry signal: when retryDataSync bumps a per-resource counter, refetch
    // so the Dashboard retry buttons actually re-run the failed query.
    const retryUnsub = useAppStore.subscribe((state, prevState) => {
      if (!userId) return;
      if (
        state.dataSyncRetryCounters.notes !==
        prevState.dataSyncRetryCounters.notes
      ) {
        void fetchNotes();
      }
      if (
        state.dataSyncRetryCounters.papers !==
        prevState.dataSyncRetryCounters.papers
      ) {
        void fetchPapers();
      }
      if (
        state.dataSyncRetryCounters.ideas !==
        prevState.dataSyncRetryCounters.ideas
      ) {
        void fetchIdeas();
      }
    });

    return () => {
      retryUnsub();
      pendingDebounceTimers.forEach((timer) => clearTimeout(timer));
      pendingDebounceTimers.clear();
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
    setXpToday,
  ]);
}
