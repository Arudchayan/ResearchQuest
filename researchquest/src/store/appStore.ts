import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ThemePreference,
  UserProfile,
  Note,
  Paper,
  Idea,
  TopicWithCounts,
  Task,
} from "../types/database";

export type DataSyncResource = "notes" | "papers" | "ideas" | "tasks" | "topics";

export interface DataSyncError {
  resource: DataSyncResource;
  message: string;
}

type DataSyncErrorState = Record<DataSyncResource, DataSyncError | null>;

interface AppState {
  // Theme
  theme: ThemePreference;
  effectiveTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;

  // User
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;

  // Current view
  currentView: "dashboard" | "notes" | "papers" | "ideas" | "tasks" | "focus" | "topics";
  setCurrentView: (
    view: "dashboard" | "notes" | "papers" | "ideas" | "tasks" | "focus" | "topics",
  ) => void;

  // Selected entity
  selectedNote: Note | null;
  selectedPaper: Paper | null;
  selectedIdea: Idea | null;
  selectedTopic: TopicWithCounts | null;
  selectedTask: Task | null;
  setSelectedNote: (note: Note | null) => void;
  setSelectedPaper: (paper: Paper | null) => void;
  setSelectedIdea: (idea: Idea | null) => void;
  setSelectedTopic: (topic: TopicWithCounts | null) => void;
  setSelectedTask: (task: Task | null) => void;

  // Entity collections (Global Cache)
  notes: Note[];
  papers: Paper[];
  ideas: Idea[];
  tasks: Task[];
  notesLoading: boolean;
  papersLoading: boolean;
  ideasLoading: boolean;
  tasksLoading: boolean;
  topicsLoading: boolean;
  dataSyncErrors: DataSyncErrorState;
  setNotes: (notes: Note[]) => void;
  setPapers: (papers: Paper[]) => void;
  setIdeas: (ideas: Idea[]) => void;
  setTasks: (tasks: Task[]) => void;
  /** Sum of `duration_seconds` for the signed-in user's focus sessions completed today (local midnight). */
  focusSessionSecondsToday: number;
  setFocusSessionSecondsToday: (seconds: number) => void;
  /** XP earned today from daily_logs (updated by useDataSync). */
  todayXP: number;
  setTodayXP: (xp: number) => void;
  setNotesLoading: (loading: boolean) => void;
  setPapersLoading: (loading: boolean) => void;
  setIdeasLoading: (loading: boolean) => void;
  setTasksLoading: (loading: boolean) => void;
  setTopicsLoading: (loading: boolean) => void;
  setDataSyncError: (resource: DataSyncResource, message: string) => void;
  clearDataSyncError: (resource: DataSyncResource) => void;
  clearDataSyncErrors: () => void;
  /** Monotonic per-resource retry counters; incremented by retryDataSync so owner hooks refetch. */
  dataSyncRetryCounters: Record<DataSyncResource, number>;
  retryDataSync: (resource: DataSyncResource) => void;

  // Topics collection
  topics: Record<string, TopicWithCounts>;
  setTopics: (topics: TopicWithCounts[]) => void;
  upsertTopic: (topic: TopicWithCounts) => void;
  removeTopic: (topicId: string) => void;

  // UI state
  isMobileSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
  isZenMode: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  setIsRightSidebarOpen: (open: boolean) => void;
  setZenMode: (zen: boolean) => void;
  toggleZenMode: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: "auto",
      effectiveTheme: "light",
      setTheme: (theme) => {
        const effectiveTheme =
          theme === "auto"
            ? window.matchMedia("(prefers-color-scheme: dark)").matches
              ? "dark"
              : "light"
            : theme;

        // Apply theme to document
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(effectiveTheme);

        set({ theme, effectiveTheme });
      },

      // User
      user: null,
      setUser: (user) => set({ user }),

      // Current view
      currentView: "dashboard",
      setCurrentView: (currentView) => set({ currentView }),

      // Selected entities
      selectedNote: null,
      selectedPaper: null,
      selectedIdea: null,
      selectedTopic: null,
      selectedTask: null,
      setSelectedNote: (selectedNote) => set({ selectedNote }),
      setSelectedPaper: (selectedPaper) => set({ selectedPaper }),
      setSelectedIdea: (selectedIdea) => set({ selectedIdea }),
      setSelectedTopic: (selectedTopic) => set({ selectedTopic }),
      setSelectedTask: (selectedTask) => set({ selectedTask }),

      // Entity collections (Global Cache)
      notes: [],
      papers: [],
      ideas: [],
      tasks: [],
      focusSessionSecondsToday: 0,
      setFocusSessionSecondsToday: (focusSessionSecondsToday) =>
        set({ focusSessionSecondsToday }),
      todayXP: 0,
      setTodayXP: (todayXP) => set({ todayXP }),
      notesLoading: false,
      papersLoading: false,
      ideasLoading: false,
      tasksLoading: false,
      topicsLoading: false,
      dataSyncErrors: {
        notes: null,
        papers: null,
        ideas: null,
        tasks: null,
        topics: null,
      },
      dataSyncRetryCounters: {
        notes: 0,
        papers: 0,
        ideas: 0,
        tasks: 0,
        topics: 0,
      },
      setNotes: (notes) => set({ notes }),
      setPapers: (papers) => set({ papers }),
      setIdeas: (ideas) => set({ ideas }),
      setTasks: (tasks) => set({ tasks }),
      setNotesLoading: (notesLoading) => set({ notesLoading }),
      setPapersLoading: (papersLoading) => set({ papersLoading }),
      setIdeasLoading: (ideasLoading) => set({ ideasLoading }),
      setTasksLoading: (tasksLoading) => set({ tasksLoading }),
      setTopicsLoading: (topicsLoading) => set({ topicsLoading }),
      setDataSyncError: (resource, message) =>
        set((state) => ({
          dataSyncErrors: {
            ...state.dataSyncErrors,
            [resource]: { resource, message },
          },
        })),
      clearDataSyncError: (resource) =>
        set((state) => ({
          dataSyncErrors: {
            ...state.dataSyncErrors,
            [resource]: null,
          },
        })),
      clearDataSyncErrors: () =>
        set({
          dataSyncErrors: {
            notes: null,
            papers: null,
            ideas: null,
            tasks: null,
            topics: null,
          },
        }),
      retryDataSync: (resource) =>
        set((state) => ({
          dataSyncErrors: {
            ...state.dataSyncErrors,
            [resource]: null,
          },
          dataSyncRetryCounters: {
            ...state.dataSyncRetryCounters,
            [resource]: state.dataSyncRetryCounters[resource] + 1,
          },
        })),

      // Topics collection state
      topics: {},
      setTopics: (topics) => {
        const topicsRecord = topics.reduce((acc, t) => {
          acc[t.id] = t;
          return acc;
        }, {} as Record<string, TopicWithCounts>);
        set({ topics: topicsRecord });
      },
      upsertTopic: (topic) =>
        set((state) => ({
          topics: { ...state.topics, [topic.id]: topic },
        })),
      removeTopic: (topicId) =>
        set((state) => {
          const { [topicId]: removed, ...rest } = state.topics;
          return { topics: rest };
        }),

      // UI state
      isMobileSidebarOpen: false,
      isRightSidebarOpen: false,
      isZenMode: false,
      setIsMobileSidebarOpen: (isMobileSidebarOpen) =>
        set({ isMobileSidebarOpen }),
      setIsRightSidebarOpen: (isRightSidebarOpen) =>
        set({ isRightSidebarOpen }),
      setZenMode: (isZenMode) => set({ isZenMode }),
      toggleZenMode: () => set((state) => ({ isZenMode: !state.isZenMode })),
    }),
    {
      name: "researchquest-storage",
      partialize: (state) => ({
        theme: state.theme,
      }),
    },
  ),
);

// Initialize theme on load
if (typeof window !== "undefined") {
  const store = useAppStore.getState();
  store.setTheme(store.theme);

  // Listen for system theme changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      const currentTheme = useAppStore.getState().theme;
      if (currentTheme === "auto") {
        useAppStore.getState().setTheme("auto");
      }
    });
}
