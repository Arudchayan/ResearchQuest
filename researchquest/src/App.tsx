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
import type { User } from "@supabase/supabase-js";
import { usePapers } from "./hooks/usePapers";
import { useIdeas } from "./hooks/useIdeas";
import { useTopics } from "./hooks/useTopics";
import { useNotes } from "./hooks/useNotes";
import { useDataSync } from "./hooks/useDataSync";
import { AuthScreen } from "./components/auth/AuthScreen";
import { SupabaseConfigErrorScreen } from "./components/auth/SupabaseConfigErrorScreen";
import { TooltipProvider } from "./components/ui/tooltip";

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

function RouteLoadingFallback() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center px-6 py-10">
      <div className="h-8 w-8 animate-pulse rounded-full bg-border-moderate" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  // Use useShallow to prevent unnecessary re-renders
  const {
    setUser: setUserProfile,
    currentView,
    setCurrentView,
    selectedPaper,
    selectedIdea,
    setSelectedIdea,
    setSelectedPaper,
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
      selectedPaper: state.selectedPaper,
      selectedIdea: state.selectedIdea,
      setSelectedIdea: state.setSelectedIdea,
      setSelectedPaper: state.setSelectedPaper,
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
  // Fetch topics early at App level for deep-link hydration (has fetch-deduplication guard)
  useTopics(userId);
  useNotes(userId);

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
      })
      .finally(() => setLoading(false));

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setUserId(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      // Fetch user profile
      supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setUserProfile(data);
            hydrateGamification(data);
          }
        });
    } else {
      setUserProfile(null);
      hydrateGamification({
        streak_freeze_tokens: 0,
        rest_days: 0,
        active_boost: null,
      });
    }
  }, [user, setUserProfile, hydrateGamification]);

  // Save deep-link target path before redirecting unauthenticated user to auth screen
  useEffect(() => {
    if (!loading && !user) {
      const path = window.location.pathname;
      if (path !== "/" && path !== "") {
        setPendingPath(path);
      }
    }
  }, [loading, user]);

  // After sign-in, navigate to the saved deep-link path
  useEffect(() => {
    if (user && pendingPath) {
      window.history.pushState(null, "", pendingPath);
      const pathParts = pendingPath.slice(1).split("/");
      const view = pathParts[0] as typeof currentView;
      if (
        ["dashboard", "notes", "papers", "ideas", "tasks", "topics", "focus"].includes(view)
      ) {
        setCurrentView(view);
      } else {
        setCurrentView("dashboard");
      }
      setPendingPath(null);
    }
  }, [user, pendingPath, setCurrentView]);

  // URL-based routing - handle initial load and navigation
  useEffect(() => {
    // Handle route changes
    const handleRouteChange = () => {
      const path = window.location.pathname;

      // Handle root path
      if (path === "/" || path === "") {
        setCurrentView("dashboard");
        return;
      }

      // Parse URL: /view or /view/itemId
      const pathParts = path.slice(1).split("/");
      const view = pathParts[0] as typeof currentView;
      const itemId = pathParts[1];

      // Validate view
      if (
        ["dashboard", "notes", "papers", "ideas", "tasks", "topics", "focus"].includes(
          view,
        )
      ) {
        setCurrentView(view);
      } else {
        // Invalid route, redirect to dashboard
        window.history.replaceState(null, "", "/");
        setCurrentView("dashboard");
      }
    };

    // Handle initial load
    handleRouteChange();

    // Listen for back/forward navigation
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

    const path = window.location.pathname;
    const pathParts = path.slice(1).split("/");
    const view = pathParts[0];
    const itemId = pathParts[1];

    if (!itemId) {
      return;
    }

    // Wait for data to load
    if (view === "papers" && papersLoading) return;
    if (view === "ideas" && ideasLoading) return;
    if (view === "notes" && notesLoading) return;
    if (view === "topics" && topicsLoading) return;
    if (view === "tasks" && tasksLoading) return;

    // Try to find and select the item based on URL
    if (view === "papers" && papers.length >= 0) {
      const paper = papers.find((p) => p.id === itemId);
      if (paper) {
        useAppStore.getState().setSelectedPaper(paper);
      } else if (!papersLoading) {
        useAppStore.getState().setSelectedPaper(null);
      }
    } else if (view === "ideas" && ideas.length >= 0) {
      const idea = ideas.find((i) => i.id === itemId);
      if (idea) {
        useAppStore.getState().setSelectedIdea(idea);
      } else if (!ideasLoading) {
        useAppStore.getState().setSelectedIdea(null);
      }
    } else if (view === "notes") {
      const note = notes.find((n) => n.id === itemId);
      if (note) {
        useAppStore.getState().setSelectedNote(note);
      } else if (!notesLoading) {
        useAppStore.getState().setSelectedNote(null);
      }
    } else if (view === "topics") {
      const topic = topics[itemId];
      if (topic) {
        useAppStore.getState().setSelectedTopic(topic);
      } else if (!topicsLoading) {
        useAppStore.getState().setSelectedTopic(null);
      }
    } else if (view === "tasks") {
      const task = tasks.find((t) => t.id === itemId);
      if (task) {
        useAppStore.getState().setSelectedTask(task);
      } else if (!tasksLoading) {
        useAppStore.getState().setSelectedTask(null);
      }
    }
  }, [currentView, ideas, ideasLoading, notes, notesLoading, papers, papersLoading, tasks, tasksLoading, topics, topicsLoading, userId]);

  if (loading) {
    return <AppLoadingSkeleton />;
  }

  if (!hasSupabaseConfig) {
    return <SupabaseConfigErrorScreen />;
  }

  if (!user) {
    return <AuthScreen />;
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
    ) : null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary selection:bg-primary-500 selection:text-bg-base">
      <TooltipProvider delayDuration={300}>
        <Suspense fallback={null}>
          <CommandPalette />
          <ShortcutsDialog />
        </Suspense>

        <Toaster
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
