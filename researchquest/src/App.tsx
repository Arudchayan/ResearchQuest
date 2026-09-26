import { Suspense, useEffect, useRef, useState } from "react";
import {
  hasSupabaseConfig,
  isDemoMode,
  supabase,
} from "./lib/supabase";
import { DEMO_FIRST_RUN_PATH } from "./lib/demoData";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./store/appStore";
import { useLibraryStore } from "./store/libraryStore";
import { useTopicsStore } from "./store/topicsStore";
import { useTasksStore } from "./store/tasksStore";
import { useGamificationStore } from "./store/gamificationStore";
import { AppShell } from "./components/layout/v2/AppShell";
import { AppLoadingSkeleton } from "./components/ui/Skeleton";
import { StaleBanner } from "./components/layout/StaleBanner";
import { AlertCircle, Home } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { usePapers } from "./hooks/usePapers";
import { useIdeas } from "./hooks/useIdeas";
import { useTopics } from "./hooks/useTopics";
import { useNotes } from "./hooks/useNotes";
import { useTasks } from "./hooks/useTasks";
import { useFeedItems } from "./hooks/useFeedItems";
import { useDataSync } from "./hooks/useDataSync";
import { AuthScreen } from "./components/auth/AuthScreen";
import { SupabaseConfigErrorScreen } from "./components/auth/SupabaseConfigErrorScreen";
import { TooltipProvider } from "./components/ui/tooltip";
import {
  parseRoute,
  selectEntityForRoute,
} from "./lib/router";
import {
  isSameAuthIdentity,
  shouldBlockShellForAuthEvent,
} from "./lib/authBootstrap";
import {
  navigateToView,
  subscribeSoftNavigation,
} from "./lib/softNavigation";
import { useFocusHydrateEpoch } from "./components/focus/focusSessionGuard";
import { prefetchPlanChunks } from "./lib/prefetchChunks";
import { KeepAlivePanes } from "./components/layout/KeepAlivePanes";
import { lazyWithReload } from "./lib/lazyWithReload";

function ensureDemoFirstRunPath(): boolean {
  if (!isDemoMode || typeof window === "undefined") return false;
  const path = window.location.pathname;
  if (path !== "/" && path !== "") return false;
  window.history.replaceState(null, "", DEMO_FIRST_RUN_PATH);
  return true;
}

const DashboardLazy = lazyWithReload(() =>
  import("./components/dashboard/Dashboard").then((module) => ({
    default: module.Dashboard,
  })),
);

const NotesView = lazyWithReload(() =>
  import("./components/notes/NotesView").then((module) => ({
    default: module.NotesView,
  })),
);

const PapersView = lazyWithReload(() =>
  import("./components/papers/PapersView").then((module) => ({
    default: module.PapersView,
  })),
);

const IdeasBoard = lazyWithReload(() =>
  import("./components/ideas/IdeasBoard").then((module) => ({
    default: module.IdeasBoard,
  })),
);

const TopicsView = lazyWithReload(() =>
  import("./components/topics/TopicsView").then((module) => ({
    default: module.TopicsView,
  })),
);

const TaskManager = lazyWithReload(() =>
  import("./components/tasks/TaskManager").then((module) => ({
    default: module.TaskManager,
  })),
);

const FocusWorkspace = lazyWithReload(() =>
  import("./components/focus/FocusWorkspace").then((module) => ({
    default: module.FocusWorkspace,
  })),
);

const FeedsView = lazyWithReload(() =>
  import("./components/feeds/FeedsView").then((module) => ({
    default: module.FeedsView,
  })),
);

const CommandPalette = lazyWithReload(() =>
  import("./components/layout/CommandPalette").then((module) => ({
    default: module.CommandPalette,
  })),
);

const ShortcutsDialog = lazyWithReload(() =>
  import("./components/layout/ShortcutsDialog").then((module) => ({
    default: module.ShortcutsDialog,
  })),
);

const ToasterLazy = lazyWithReload(() =>
  import("sonner").then((module) => ({ default: module.Toaster })),
);

function RouteLoadingFallback() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center px-6 py-10 text-sm text-text-secondary">
      Loading view…
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  // Shell-only subscription: entity arrays live in AppDataOwners so list
  // mutations do not re-render AppShell + the lazy view tree.
  const { setUser: setUserProfile, currentView, setCurrentView, effectiveTheme } = useAppStore(
    useShallow((state) => ({
      setUser: state.setUser,
      currentView: state.currentView,
      setCurrentView: state.setCurrentView,
      effectiveTheme: state.effectiveTheme,
    })),
  );
  const hydrateGamification = useGamificationStore(
    (state) => state.hydrateFromProfile,
  );
  const focusHydrateEpoch = useFocusHydrateEpoch();

  useEffect(() => {
    prefetchPlanChunks();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__TEST_USER__) {
      setUser((window as any).__TEST_USER__)
      setUserId((window as any).__TEST_USER__.id)
      setLoading(false)
      ;(window as any).__APP_STORE__ = useAppStore
      return
    }

    if (!hasSupabaseConfig) {
      setLoading(false);
      return;
    }

    // Check active sessions
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setUserId(session?.user?.id);
        if (session?.user) {
          setProfileLoading(true);
        }
      })
      .finally(() => setLoading(false));

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      if (event === "TOKEN_REFRESHED") {
        setUser((prev) => (isSameAuthIdentity(prev, nextUser) ? prev : nextUser));
        setUserId(nextUser?.id);
        return;
      }
      setUser(nextUser);
      setUserId(nextUser?.id);
      // TOKEN_REFRESHED (browser tab focus / token rotation) must not tear
      // down AppShell — that remount looks like a full page refresh.
      if (!shouldBlockShellForAuthEvent(event)) {
        return;
      }
      if (session?.user) {
        setProfileLoading(true);
      } else {
        setProfileLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (user) {
        // Fetch user profile — profileLoading was already set to true
        // in the auth effect, so the try/finally clears it.
        try {
          const { data } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          if (data) {
            setUserProfile(data);
            hydrateGamification(data);
          }
        } finally {
          setProfileLoading(false);
        }
      } else {
        setUserProfile(null);
        hydrateGamification({
          streak_freeze_tokens: 0,
          rest_days: 0,
          active_boost: null,
        });
        setProfileLoading(false);
      }
    }
    void loadProfile();
  }, [user, setUserProfile, hydrateGamification]);

  // -- Route error recovery state --

  const [routeError, setRouteError] = useState<string | null>(null);

  // Save deep-link target path before redirecting unauthenticated user to auth screen
  useEffect(() => {
    if (!loading && !user) {
      const route = parseRoute(window.location.pathname);
      if (route.isValid && route.view !== "dashboard") {
        setPendingPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      }
    }
  }, [loading, user]);

  // After sign-in, navigate to the saved deep-link path
  useEffect(() => {
    if (user && pendingPath) {
      const route = parseRoute(new URL(pendingPath, window.location.origin).pathname);
      navigateToView(route.isValid && route.view ? route.view : "dashboard", pendingPath);
      setPendingPath(null);
    }
  }, [user, pendingPath]);

  // URL-based routing — initial load, back/forward, soft link clicks, recovery
  useEffect(() => {
    // Demo first-run: never leave a stranger on `/` / dashboard.
    ensureDemoFirstRunPath();

    const applyPath = (pathname: string, { enforceDemoHome = false } = {}) => {
      if (enforceDemoHome) {
        ensureDemoFirstRunPath();
      }
      const route = parseRoute(
        enforceDemoHome ? window.location.pathname : pathname,
      );

      if (route.isValid && route.view) {
        setCurrentView(route.view);
        setRouteError(null);
      } else {
        // Deliberate recovery contract: show the URL the user typed (don't
        // silently replace) and present a recovery UI instead.
        setRouteError("not-found");
      }
      useAppStore.getState().setIsMobileSidebarOpen(false);
    };

    const handlePopState = () => {
      // Back/forward to bare `/` in demo should recover to the first-run topic.
      applyPath(window.location.pathname, { enforceDemoHome: true });
    };

    const handleSoftNav = (path: string) => {
      // Soft clicks intentionally allow `/` (dashboard) even in demo mode.
      let pathname = path;
      try {
        pathname = new URL(path, window.location.origin).pathname;
      } catch {
        pathname = path.split("?")[0]?.split("#")[0] || path;
      }
      applyPath(pathname);
    };

    applyPath(window.location.pathname, { enforceDemoHome: true });
    window.addEventListener("popstate", handlePopState);
    const unsubscribeSoft = subscribeSoftNavigation(handleSoftNav);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      unsubscribeSoft();
    };
  }, [setCurrentView]);

  // Focus main content on navigation change, but only for keyboard users:
  // an unconditional focus() on every view change yanks focus away from
  // pointer/touch users mid-task.
  const lastInputWasKeyboardRef = useRef(false);
  useEffect(() => {
    const markKeyboard = () => {
      lastInputWasKeyboardRef.current = true;
    };
    const markPointer = () => {
      lastInputWasKeyboardRef.current = false;
    };
    window.addEventListener("keydown", markKeyboard, true);
    window.addEventListener("mousedown", markPointer, true);
    window.addEventListener("touchstart", markPointer, true);
    return () => {
      window.removeEventListener("keydown", markKeyboard, true);
      window.removeEventListener("mousedown", markPointer, true);
      window.removeEventListener("touchstart", markPointer, true);
    };
  }, []);

  useEffect(() => {
    if (!lastInputWasKeyboardRef.current) return;
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [currentView]);

  if (!hasSupabaseConfig) {
    return <SupabaseConfigErrorScreen />;
  }

  // First-run door must not wait on auth hydrate — the demo CTA has to be
  // clickable on first paint, not after getSession() resolves.
  if (!isDemoMode && !user) {
    return <AuthScreen />;
  }

  if (loading || profileLoading) {
    return <AppLoadingSkeleton />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  // Invalid-route recovery: show a deliberate error UI instead of silently
  // redirecting to the dashboard. The URL is preserved so the user can see
  // what they typed; recovery buttons allow them to navigate back.
  if (routeError) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive-bg mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Page Not Found</h2>
          <p className="text-text-secondary mb-6">
            The page "<span className="font-mono text-text-primary">{window.location.pathname}</span>" doesn't exist.
          </p>
          <button
            onClick={() => {
              navigateToView("dashboard");
              setRouteError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-bg-base rounded-md hover:bg-primary-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Route content is rendered bare: AppShell's <main> is the single page-scroll
  // owner, and each view owns its own wrapper (split-pane views keep h-full
  // with internal scroll regions; page-scroll views normalize to
  // `p-4 sm:p-6 lg:p-8` with a per-view max-w). Do not add padding or
  // overflow wrappers here — they create double gutters and nested scrollers.
  // TopicsView already owns the full-height handoff for its list/detail
  // split panes; an extra wrapper would break that handoff.
  const routeContent =
    currentView === "dashboard" ? (
      <DashboardLazy />
    ) : currentView === "notes" || currentView === "focus" ? null : currentView === "papers" ? (
      <PapersView />
    ) : currentView === "ideas" ? (
      <IdeasBoard />
    ) : currentView === "topics" ? (
      <TopicsView />
    ) : currentView === "tasks" ? (
      <TaskManager />
    ) : currentView === "feeds" ? (
      <FeedsView />
    ) : null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary selection:bg-primary-500 selection:text-bg-base">
      <TooltipProvider delayDuration={300}>
        <Suspense fallback={null}>
          <CommandPalette />
          <ShortcutsDialog />
        </Suspense>

        <Suspense fallback={null}>
          <ToasterLazy
            // "KeyNone" is not a valid key; disables sonner's hotkey (empty array would match every keydown)
            hotkey={["KeyNone"]}
            position="top-right"
            richColors
            expand={false}
            duration={2500}
            offset={16}
            visibleToasts={3}
            theme={effectiveTheme}
            closeButton
            toastOptions={{ duration: 2500 }}
          />
        </Suspense>

        <AppDataOwners userId={userId} currentView={currentView} />
        <AppShell>
          <StaleBanner />
          <KeepAlivePanes
            currentView={currentView}
            notes={<NotesView />}
            focus={<FocusWorkspace key={focusHydrateEpoch} userId={userId} />}
          />
          <Suspense fallback={<RouteLoadingFallback />}>
            {routeContent}
          </Suspense>
        </AppShell>
      </TooltipProvider>
    </div>
  );
}

/** Owns sync/CRUD hooks and deep-link hydration without subscribing App to entity arrays. */
function AppDataOwners({
  userId,
  currentView,
}: {
  userId: string | undefined;
  currentView: string;
}) {
  useDataSync(userId);
  usePapers(userId);
  useIdeas(userId);
  useTopics(userId, { owner: true });
  useNotes(userId);
  useTasks(userId, { owner: true });
  useFeedItems(userId, { owner: true });

  const notesLoading = useLibraryStore((state) => state.notesLoading);
  const papersLoading = useLibraryStore((state) => state.papersLoading);
  const ideasLoading = useLibraryStore((state) => state.ideasLoading);
  const topicsLoading = useTopicsStore((state) => state.topicsLoading);
  const tasksLoading = useTasksStore((state) => state.tasksLoading);

  useEffect(() => {
    if (!userId) return;

        const route = parseRoute(window.location.pathname);
        if (route.isValid && route.view === "topics" && !route.itemId) {
          useAppStore.getState().setSelectedTopic(null);
          return;
        }
        if (!route.isValid || !route.itemId) return;

    const state = useAppStore.getState();
    selectEntityForRoute(
      route,
      {
        papers: state.papers,
        papersLoading: state.papersLoading,
        ideas: state.ideas,
        ideasLoading: state.ideasLoading,
        notes: state.notes,
        notesLoading: state.notesLoading,
        topics: state.topics,
        topicsLoading: state.topicsLoading,
        tasks: state.tasks,
        tasksLoading: state.tasksLoading,
      },
      {
        setSelectedPaper: state.setSelectedPaper,
        setSelectedIdea: state.setSelectedIdea,
        setSelectedNote: state.setSelectedNote,
        setSelectedTopic: state.setSelectedTopic,
        setSelectedTask: state.setSelectedTask,
      },
    );
  }, [
    currentView,
    ideasLoading,
    notesLoading,
    papersLoading,
    tasksLoading,
    topicsLoading,
    userId,
  ]);

  return null;
}

export default App;
