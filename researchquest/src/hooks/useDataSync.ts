/**
 * OWNERSHIP: notes, papers, ideas, focus_sessions, daily_logs
 * (+ topics realtime merge only — loading/CRUD stay in useTopics)
 *
 * This hook is the sole realtime owner for the notes, papers, ideas,
 * focus_sessions, and daily_logs tables. It loads the initial data,
 * subscribes to Postgres changes, and pushes updates into the Zustand
 * store (useAppStore). Channel lifecycle is owned by the shared
 * `subscribeTable` helper (lib/realtime.ts, item 35) — one channel per
 * table per user, ref-counted across mounts.
 *
 * It also hosts the topics realtime subscription (item 35): row-level merge
 * via targeted single-row refetch (no loading flash, no full refetch).
 * Topic list loading, CRUD, and caches stay in useTopics, the topics owner.
 *
 * It reconciles the local sprint/dailyMissions persists with the server
 * streak signals (item 43 — server wins when signed in, local wins in
 * demo/offline; see the authority rule in those stores).
 *
 * Do NOT add tasks here — useTasks is the sole task owner.
 * daily_logs is consolidated here to eliminate duplicate subscriptions
 * from RightSidebar and useSidebarData.
 */
import { useEffect } from "react";
import { supabase, isDemoMode } from "../lib/supabase";
import { subscribeTable } from "../lib/realtime";
import { useAppStore, type DataSyncResource } from "../store/appStore";
import { useSprintStore } from "../store/sprintStore";
import { useDailyMissionsStore } from "../store/dailyMissionsStore";
import { useShallow } from "zustand/react/shallow";
import { sortByUpdatedAt } from "../utils/sort";
import { extractFunctionErrorMessage } from "../utils/errors";
import type { Note, Paper, Idea, TopicWithCounts } from "../types/database";
import { dedupeById } from "../utils/collections";

// --- Topics realtime merge (item 35) ---
// Mirrors the row shape + mapping owned by useTopics (TOPIC_SELECT /
// mapTopicRow there): a single topic with joined link counts. Duplicated
// here so this hook never depends on useTopics internals; the canonical
// copy stays in useTopics.
interface TopicCountRow {
  count: number | null;
}

interface TopicRow extends TopicWithCounts {
  topic_notes?: TopicCountRow[];
  topic_papers?: TopicCountRow[];
  topic_ideas?: TopicCountRow[];
}

const TOPIC_ROW_SELECT =
  "*, topic_notes(count), topic_papers(count), topic_ideas(count)";

function coerceTopicCount(value?: TopicCountRow[]): number {
  if (!value || value.length === 0) return 0;
  const first = value[0];
  if (!first || first.count == null) return 0;
  return first.count;
}

function mapTopicRow(row: TopicRow): TopicWithCounts {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    ...(row.description !== undefined ? { description: row.description } : {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
    note_count: coerceTopicCount(row.topic_notes),
    paper_count: coerceTopicCount(row.topic_papers),
    idea_count: coerceTopicCount(row.topic_ideas),
  };
}

function isTopicRow(value: unknown): value is TopicRow {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["id"] === "string" &&
    typeof record["user_id"] === "string" &&
    typeof record["name"] === "string" &&
    typeof record["created_at"] === "string" &&
    typeof record["updated_at"] === "string"
  );
}

// --- Streak reconcile (item 43) ---
// Server wins when signed in; local persists rule in demo/offline (where
// this is never called) and when signed out (early return above).
function reconcileStreakSnapshot(
  focusSecondsToday: number,
  todayXP: number,
): void {
  if (isDemoMode) return;
  const minutes = Math.max(0, Math.floor(focusSecondsToday / 60));
  const xp = Math.max(0, todayXP);
  useSprintStore.getState().applyServerSnapshot(minutes, xp);
  useDailyMissionsStore.getState().applyServerSnapshot(minutes);
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

    const fetchFocusSessionsToday = async (): Promise<number> => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("focus_sessions")
        .select("duration_seconds")
        .eq("user_id", userId)
        .gte("completed_at", startOfDay.toISOString());

      if (error) {
        return useAppStore.getState().focusSessionSecondsToday;
      }

      const total = (data ?? []).reduce(
        (sum, row) => sum + (Number(row.duration_seconds) || 0),
        0,
      );
      setFocusSessionSecondsToday(total);
      return total;
    };

    const fetchTodayXP = async (): Promise<number> => {
      // Always fetch — no shouldFetch guard since the sidebar always needs it
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("daily_logs")
        .select("xp_earned")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (!error) {
        const xp = data?.xp_earned ?? 0;
        setTodayXP(xp);
        return xp;
      }
      return useAppStore.getState().todayXP;
    };

    // Targeted single-topic refetch for the topics realtime merge below:
    // one row with joined counts, no loading flags (avoids list flicker).
    const refreshTopicRow = async (topicId: string): Promise<void> => {
      const { data, error } = await supabase
        .from("topics")
        .select(TOPIC_ROW_SELECT)
        .eq("user_id", userId)
        .eq("id", topicId)
        .maybeSingle();

      if (error || !isTopicRow(data)) {
        return;
      }
      const topic = mapTopicRow(data);
      useAppStore.getState().upsertTopic(topic);
      const selected = useAppStore.getState().selectedTopic;
      if (selected?.id === topic.id) {
        useAppStore.getState().setSelectedTopic(topic);
      }
    };

    // Initial fetch (only what is needed for current view)
    void fetchNotes();
    void fetchPapers();
    void fetchIdeas();
    // Streak snapshot (item 43): once today's server signals land,
    // reconcile the local sprint/dailyMissions persists (server wins).
    void Promise.all([fetchFocusSessionsToday(), fetchTodayXP()]).then(
      ([focusSeconds, xpEarned]) => {
        reconcileStreakSnapshot(focusSeconds, xpEarned);
      },
    );

    // --- SUBSCRIPTIONS (item 35: shared ref-counted lifecycle) ---
    // Merge callbacks are unchanged; only channel creation/teardown moved
    // into subscribeTable (one channel per table+user across mounts).

    // Notes Subscription
    const releaseNotes = subscribeTable<Note>("notes", userId, {
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

    const releasePapers = subscribeTable<Paper>("papers", userId, {
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

    const releaseIdeas = subscribeTable<Idea>("ideas", userId, {
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

    const releaseFocusSessions = subscribeTable<{ id: string }>(
      "focus_sessions",
      userId,
      {
        event: "INSERT",
        onInsert: () => {
          void fetchFocusSessionsToday().then((seconds) => {
            reconcileStreakSnapshot(
              seconds,
              useAppStore.getState().todayXP,
            );
          });
        },
      },
    );

    // daily_logs Subscription (consolidated — replaces RightSidebar + useSidebarData copies)
    const releaseDailyLogs = subscribeTable<{ id: string }>(
      "daily_logs",
      userId,
      {
        onInsert: () => {
          void fetchTodayXP().then((xp) => {
            reconcileStreakSnapshot(
              useAppStore.getState().focusSessionSecondsToday,
              xp,
            );
          });
        },
        onUpdate: () => {
          void fetchTodayXP().then((xp) => {
            reconcileStreakSnapshot(
              useAppStore.getState().focusSessionSecondsToday,
              xp,
            );
          });
        },
      },
    );

    // Topics Subscription (item 35): realtime row-merge only. List loading,
    // CRUD, and caches stay in useTopics; remote row changes converge here
    // via a targeted single-row refetch (no full-refetch flicker).
    const releaseTopics = subscribeTable<TopicRow>("topics", userId, {
      onInsert: (row) => {
        void refreshTopicRow(row.id);
      },
      onUpdate: (row) => {
        void refreshTopicRow(row.id);
      },
      onDelete: (oldId) => {
        useAppStore.getState().removeTopic(oldId);
        const selected = useAppStore.getState().selectedTopic;
        if (selected?.id === oldId) {
          useAppStore.getState().setSelectedTopic(null);
        }
      },
    });

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
      releaseNotes();
      releasePapers();
      releaseIdeas();
      releaseFocusSessions();
      releaseDailyLogs();
      releaseTopics();
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
