import { lazy, Suspense, useEffect, useState } from "react";
import {
  hasSupabaseConfig,
  supabase,
} from "./lib/supabase";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./store/appStore";
import { useGamificationStore } from "./store/gamificationStore";
import { AppShell } from "./components/layout/v2/AppShell";
import { AppLoadingSkeleton } from "./components/ui/Skeleton";
import { Toaster } from "sonner";
import { AlertCircle, Home } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { usePapers } from "./hooks/usePapers";
import { useIdeas } from "./hooks/useIdeas";
import { useTopics } from "./hooks/useTopics";
import { useNotes } from "./hooks/useNotes";
import { useTasks } from "./hooks/useTasks";
import { useDataSync } from "./hooks/useDataSync";
import { AuthScreen } from "./components/auth/AuthScreen";
import { SupabaseConfigErrorScreen } from "./components/auth/SupabaseConfigErrorScreen";
import { TooltipProvider } from "./components/ui/tooltip";
import {
  parseRoute,
  selectEntityForRoute,
} from "./lib/router";

const DashboardLazy = lazy(() =>
  import("./components/dashboard/Dashboard").then((module) => ({
    default: module.Dashboard,
  })),
);

const NotesView = lazy(() =>
  import("./components/notes/NotesView").then((module) => ({
    default: module.NotesView,
  })),
);

const PapersView = lazy(() =>
  import("./components/papers/PapersView").then((module) => ({
    default: module.PapersView,
  })),
);

const IdeasBoard = lazy(() =>
  import("./components/ideas/IdeasBoard").then((module) => ({
    default: module.IdeasBoard,
  })),
);

const TopicsView = lazy(() =>
  import("./components/topics/TopicsView").then((module) => ({
    default: module.TopicsView,
  })),
);

const TaskManager = lazy(() =>
  import("./components/tasks/TaskManager").then((module) => ({
    default: module.TaskManager,
  })),
);

const FocusWorkspace = lazy(() =>
  import("./components/focus/FocusWorkspace").then((module) => ({
    default: module.FocusWorkspace,
  })),
);

const OnboardingGuide = lazy(() =>
  import("./components/layout/OnboardingGuide").then((module) => ({
    default: module.OnboardingGuide,
  })),
);

const CommandPalette = lazy(() =>
  import("./components/layout/CommandPalette").then((module) => ({
    default: module.CommandPalette,
  })),
);

const ShortcutsDialog = lazy(() =>
  import("./components/layout/ShortcutsDialog").then((module) => ({
    default: module.ShortcutsDialog,
  })),
);

// Dev-only showcase — tree-shaken from production builds
const ShowcaseLazy = import.meta.env.DEV
  ? lazy(() => import("./components/showcase/Showcase"))
  : null;

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
  // ⚡ Optimization: Use useShallow with an object selector to prevent the App component
  // from unnecessarily re-rendering on unrelated state changes in the global appStore.
  const {
    setUser: setUserProfile,
    currentView,
    setCurrentView,
    notes,
    notesLoading,
    topics,
    topicsLoading,
    tasks,
    tasksLoading,
  } = useAppStore(
    useShallow((state) => ({
      setUser: state.setUser,
      currentView: state.currentView,
      setCurrentView: state.setCurrentView,
      notes: state.notes,
      notesLoading: state.notesLoading,
      topics: state.topics,
      topicsLoading: state.topicsLoading,
      tasks: state.tasks,
      tasksLoading: state.tasksLoading,
    })),
  );
  const hydrateGamification = useGamificationStore(
    (state) => state.hydrateFromProfile,
  );

  // Sync data centrally (lazy-loads based on currentView)
  useDataSync(userId, currentView);

  // Get hooks for CRUD operations (data comes from store now)
  const { papers, loading: papersLoading } = usePapers(userId);
  const { ideas, loading: ideasLoading } = useIdeas(userId);
  // Fetch topics early at App level for deep-link hydration (sole owner; has fetch-deduplication guard)
  useTopics(userId, { owner: true });
  useNotes(userId);
  useTasks(userId, { owner: true });

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setUserId(session?.user?.id);
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
        setPendingPath(window.location.pathname);
      }
    }
  }, [loading, user]);

  // After sign-in, navigate to the saved deep-link path
  useEffect(() => {
    if (user && pendingPath) {
      window.history.pushState(null, "", pendingPath);
      const route = parseRoute(pendingPath);
      if (route.isValid && route.view) {
        setCurrentView(route.view);
      } else {
        setCurrentView("dashboard");
      }
      setPendingPath(null);
    }
  }, [user, pendingPath, setCurrentView]);

  // URL-based routing — handle initial load, popstate, and invalid-route recovery
  useEffect(() => {
    const handleRouteChange = () => {
      // Dev-only showcase route — tree-shaken from production
      if (import.meta.env.DEV && window.location.pathname === "/showcase") {
        setCurrentView("showcase" as any);
        setRouteError(null);
        return;
      }

      const route = parseRoute(window.location.pathname);

      if (route.isValid && route.view) {
        setCurrentView(route.view);
        setRouteError(null);
      } else {
        // Deliberate recovery contract: show the URL the user typed (don't
        // silently replace) and present a recovery UI instead.
        setRouteError("not-found");
      }
    };

    handleRouteChange();
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, [setCurrentView]);

  // Focus main content on navigation change for keyboard users
  useEffect(() => {
    const el = document.getElementById("main-content");
    if (el) {
      el.focus();
    }
  }, [currentView]);

  // Handle selecting items from URL (when data is loaded)
  useEffect(() => {
    if (!userId) return;

    const route = parseRoute(window.location.pathname);
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
  }, [currentView, ideas, ideasLoading, notes, notesLoading, papers, papersLoading, tasks, tasksLoading, topics, topicsLoading, userId]);

  if (loading || profileLoading) {
    return <AppLoadingSkeleton />;
  }

  if (!hasSupabaseConfig) {
    return <SupabaseConfigErrorScreen />;
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
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Page Not Found</h2>
          <p className="text-text-secondary mb-6">
            The page "<span className="font-mono text-text-primary">{window.location.pathname}</span>" doesn't exist.
          </p>
          <button
            onClick={() => {
              window.history.pushState(null, "", "/");
              setCurrentView("dashboard");
              setRouteError(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const routeContent =
    currentView === "dashboard" ? (
      <div className="h-full overflow-auto">
        <DashboardLazy />
      </div>
    ) : currentView === "notes" ? (
      <NotesView />
    ) : currentView === "papers" ? (
      <PapersView />
    ) : currentView === "ideas" ? (
      <IdeasBoard />
    ) : currentView === "topics" ? (
      <div className="h-full overflow-hidden">
        <TopicsView />
      </div>
    ) : currentView === "tasks" ? (
      <div className="p-6 h-full overflow-auto">
        <OnboardingGuide />
        <TaskManager />
      </div>
    ) : currentView === "focus" ? (
      <div className="p-6 h-full overflow-auto">
        <OnboardingGuide storageKey="rq_focus_onboarding_bridge" />
        <FocusWorkspace userId={userId} />
      </div>
    ) : import.meta.env.DEV && currentView === "showcase" && ShowcaseLazy ? (
      <Suspense fallback={<RouteLoadingFallback />}>
        <ShowcaseLazy />
      </Suspense>
    ) : null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary selection:bg-primary-500 selection:text-bg-base">
      <TooltipProvider delayDuration={300}>
        <Suspense fallback={null}>
          <CommandPalette />
          <ShortcutsDialog />
        </Suspense>

        <Toaster
          hotkey={[]}
          position="top-right"
          richColors
          expand={false}
          duration={2500}
          offset={16}
          visibleToasts={3}
          theme={useAppStore.getState().effectiveTheme}
          closeButton
          toastOptions={{ duration: 2500 }}
        />

        <AppShell>
          <Suspense fallback={<RouteLoadingFallback />}>{routeContent}</Suspense>
        </AppShell>
      </TooltipProvider>
    </div>
  );
}

export default App;
