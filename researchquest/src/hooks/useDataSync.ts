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
 *
 * Fetch/realtime discipline (plan items 41, 46, 47):
 * - Initial table fetches are bounded with `.limit(DATA_SYNC_ROW_LIMIT)`.
 * - One initial load per table per user (module `loadedTables` set); mounts
 *   for an already-loaded user skip the fetch, retries always refetch.
 * - Concurrent duplicate fetches (StrictMode double-effect, two mounted
 *   instances) share a single in-flight request; stale responses are
 *   discarded via a per-table sequence guard.
 * - Exactly one realtime channel per table per userId across all mounted
 *   instances (module registry with ref-counting); channels unsubscribe
 *   when the last instance unmounts.
 */
import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { DATA_SYNC_ROW_LIMIT } from "../lib/pagination";
import { useAppStore, type DataSyncResource } from "../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { sortByUpdatedAt } from "../utils/sort";
import { extractFunctionErrorMessage } from "../utils/errors";
import type { Note, Paper, Idea } from "../types/database";
import { dedupeById } from "../utils/collections";

type Unsubscribable = { unsubscribe: () => unknown };

interface ChannelEntry {
  sub: Unsubscribable;
  refCount: number;
}

// --- Module-level fetch dedupe (item 46) ----------------------------------
/** Latest fetch sequence number per `${userId}:${table}`; older ones are stale. */
const fetchSeqByKey = new Map<string, number>();
/** Shared in-flight table requests so duplicate mounts issue one query. */
const inflightByKey = new Map<
  string,
  Promise<{ data: unknown[] | null; error: unknown }>
>();
/** Tables with a completed initial load per `${userId}:${table}`. */
const loadedTables = new Set<string>();

// --- Module-level realtime registry (item 47) -------------------------------
/** One entry per channel name (`<table>_realtime_sync_<userId>`). */
const channelRegistry = new Map<string, ChannelEntry>();

function acquireChannel(
  name: string,
  create: () => Unsubscribable,
): ChannelEntry {
  const existing = channelRegistry.get(name);
  if (existing) {
    existing.refCount += 1;
    return existing;
  }
  const entry: ChannelEntry = { sub: create(), refCount: 1 };
  channelRegistry.set(name, entry);
  return entry;
}

function releaseChannel(name: string): void {
  const entry = channelRegistry.get(name);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    channelRegistry.delete(name);
    try {
      entry.sub.unsubscribe();
    } catch {
      // Releasing must never throw during unmount cleanup.
    }
  }
}

/** Test-only reset for the module registries (fetch dedupe + channels). */
export function resetDataSyncModuleState(): void {
  fetchSeqByKey.clear();
  inflightByKey.clear();
  loadedTables.clear();
  for (const name of [...channelRegistry.keys()]) {
    const entry = channelRegistry.get(name);
    channelRegistry.delete(name);
    try {
      entry?.sub.unsubscribe();
    } catch {
      // ignore
    }
  }
}

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
      // Fresh login must refetch even if a previous user loaded the same tables.
      loadedTables.clear();
      return;
    }

    let cancelled = false;

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
      const key = `${userId}:${table}`;
      const seq = (fetchSeqByKey.get(key) ?? 0) + 1;
      fetchSeqByKey.set(key, seq);
      opts.setLoading(true);

      let req = inflightByKey.get(key);
      if (!req) {
        req = (async () => {
          try {
            const { data, error } = await supabase
              .from(table)
              .select("*")
              .eq("user_id", userId)
              .order("updated_at", { ascending: false })
              .limit(DATA_SYNC_ROW_LIMIT);
            return { data: data as unknown[] | null, error };
          } catch (err) {
            return { data: null as unknown[] | null, error: err };
          }
        })();
        inflightByKey.set(key, req);
        void req.then(() => {
          if (inflightByKey.get(key) === req) inflightByKey.delete(key);
        });
      }

      let isCurrent = true;
      try {
        const { data, error } = await req;

        // Abort stale: a newer fetch for this table already started, or the
        // effect unmounted. Never commit stale rows over fresh state.
        if (cancelled || fetchSeqByKey.get(key) !== seq) {
          isCurrent = false;
          return;
        }

        if (error) {
          setDataSyncError(
            table,
            extractFunctionErrorMessage(error, opts.fallbackError),
          );
          return;
        }

        clearDataSyncError(table);
        loadedTables.add(key);
        if (data) {
          const items = opts.transform
            ? opts.transform(data as T[])
            : (data as T[]);
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
        if (!isCurrent || cancelled || fetchSeqByKey.get(key) !== seq) {
          isCurrent = false;
          return;
        }
        setDataSyncError(
          table,
          extractFunctionErrorMessage(error, opts.fallbackError),
        );
      } finally {
        if (isCurrent) opts.setLoading(false);
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
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("focus_sessions")
        .select("duration_seconds")
        .eq("user_id", userId)
        .gte("completed_at", startOfDay.toISOString());

      if (cancelled || error) {
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

      if (cancelled || error) {
        return;
      }
      setTodayXP(data?.xp_earned ?? 0);
    };

    // Initial fetch — one load per table per user (item 46). Remounts for an
    // already-loaded user reuse the store + realtime instead of refetching;
    // Dashboard retry buttons bump counters and always refetch via `fetchTable`.
    if (!loadedTables.has(`${userId}:notes`)) void fetchNotes();
    if (!loadedTables.has(`${userId}:papers`)) void fetchPapers();
    if (!loadedTables.has(`${userId}:ideas`)) void fetchIdeas();
    void fetchFocusSessionsToday();
    void fetchTodayXP();

    // --- SUBSCRIPTIONS (item 47: single owner per table per userId) ---
    const channelNames: string[] = [];

    // Generic realtime subscription for the per-view tables (notes/papers/ideas):
    // same postgres_changes listener; per-table merge logic via callbacks.
    const makeSubscription = <T extends { id: string }>(opts: {
      table: string;
      channelName: string;
      onInsert: (newItem: T) => void;
      onUpdate: (updated: T) => void;
      onDelete: (oldId: string) => void;
    }) => {
      channelNames.push(opts.channelName);
      acquireChannel(opts.channelName, () =>
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
          .subscribe(),
      );
    };

    const subscribeRawChannel = (
      channelName: string,
      create: () => Unsubscribable,
    ) => {
      channelNames.push(channelName);
      acquireChannel(channelName, create);
    };

    // Notes Subscription
    makeSubscription<Note>({
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

    // Papers Subscription
    const syncSelectedPaper = (paper: Paper) => {
      const current = useAppStore.getState().selectedPaper;
      if (current?.id === paper.id) {
        setSelectedPaper(paper);
      }
    };

    makeSubscription<Paper>({
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

    // Ideas Subscription
    const syncSelectedIdea = (idea: Idea) => {
      const current = useAppStore.getState().selectedIdea;
      if (current?.id === idea.id) {
        setSelectedIdea(idea);
      }
    };

    makeSubscription<Idea>({
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

    subscribeRawChannel(`focus_sessions_sync_${userId}`, () =>
      supabase
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
        .subscribe(),
    );

    // daily_logs Subscription (consolidated — replaces RightSidebar + useSidebarData copies)
    subscribeRawChannel(`daily_logs_sync_${userId}`, () =>
      supabase
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
        .subscribe(),
    );

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
      cancelled = true;
      retryUnsub();
      // Release (not force-unsubscribe): the channel closes only when the
      // last mounted instance for this userId unmounts.
      channelNames.forEach(releaseChannel);
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
  ]);
}
