import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemePreference, UserProfile } from "../types/database";
import { parseRoute, type AppView } from "../lib/router";

export type { AppView };

export type DataSyncResource = "notes" | "papers" | "ideas" | "tasks" | "topics";

export interface DataSyncError {
  resource: DataSyncResource;
  message: string;
}

type DataSyncErrorState = Record<DataSyncResource, DataSyncError | null>;

/**
 * Shell slice: session-global chrome (theme / view / user / transient UI)
 * plus session-global sync status.
 *
 * Sync status (loading errors, retry counters, today's aggregates) lives here
 * — not in the domain stores — because it is written by the central sync
 * owner (useDataSync) and read by shell-level chrome (sidebars, dashboard
 * error banners), independently of any single entity collection.
 */
export interface ShellSlice {
  // Theme
  theme: ThemePreference;
  effectiveTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;

  // User
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;

  // Current view
  currentView: AppView;
  setCurrentView: (view: AppView) => void;

  // Sync status (written by useDataSync / owner hooks)
  dataSyncErrors: DataSyncErrorState;
  setDataSyncError: (resource: DataSyncResource, message: string) => void;
  clearDataSyncError: (resource: DataSyncResource) => void;
  clearDataSyncErrors: () => void;
  /** Monotonic per-resource retry counters; incremented by retryDataSync so owner hooks refetch. */
  dataSyncRetryCounters: Record<DataSyncResource, number>;
  retryDataSync: (resource: DataSyncResource) => void;

  /** Sum of `duration_seconds` for the signed-in user's focus sessions completed today (local midnight). */
  focusSessionSecondsToday: number;
  setFocusSessionSecondsToday: (seconds: number) => void;
  /** XP earned today from daily_logs (updated by useDataSync). */
  todayXP: number;
  setTodayXP: (xp: number) => void;

  // UI state
  isMobileSidebarOpen: boolean;
  isRightSidebarOpen: boolean;
  isZenMode: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  setIsRightSidebarOpen: (open: boolean) => void;
  setZenMode: (zen: boolean) => void;
  toggleZenMode: () => void;
}

const createEmptyDataSyncErrors = (): DataSyncErrorState => ({
  notes: null,
  papers: null,
  ideas: null,
  tasks: null,
  topics: null,
});

const createEmptyDataSyncRetryCounters = (): Record<DataSyncResource, number> => ({
  notes: 0,
  papers: 0,
  ideas: 0,
  tasks: 0,
  topics: 0,
});

export const useShellStore = create<ShellSlice>()(
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
      currentView:
        typeof window !== "undefined"
          ? (parseRoute(window.location.pathname).view ?? "dashboard")
          : "dashboard",
      setCurrentView: (currentView) => {
        if (get().currentView === currentView) return;
        set({ currentView });
      },

      // Sync status
      dataSyncErrors: createEmptyDataSyncErrors(),
      dataSyncRetryCounters: createEmptyDataSyncRetryCounters(),
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
          dataSyncErrors: createEmptyDataSyncErrors(),
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

      focusSessionSecondsToday: 0,
      setFocusSessionSecondsToday: (focusSessionSecondsToday) =>
        set({ focusSessionSecondsToday }),
      todayXP: 0,
      setTodayXP: (todayXP) => set({ todayXP }),

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
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setTheme(state.theme);
        }
      },
    },
  ),
);

// Initialize theme on load
if (typeof window !== "undefined") {
  const store = useShellStore.getState();
  store.setTheme(store.theme);

  // Listen for system theme changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      const currentTheme = useShellStore.getState().theme;
      if (currentTheme === "auto") {
        useShellStore.getState().setTheme("auto");
      }
    });
}
