import { lazy, Suspense, useEffect, useState } from "react";
import { EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";
import { supabase } from "./lib/supabase";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./store/appStore";
import { useGamificationStore } from "./store/gamificationStore";
import { AppShell } from "./components/layout/v2/AppShell";
import { AppLoadingSkeleton } from "./components/ui/Skeleton";
import { Toaster } from "sonner";
import type { User } from "@supabase/supabase-js";
import { usePapers } from "./hooks/usePapers";
import { useIdeas } from "./hooks/useIdeas";
import { useDataSync } from "./hooks/useDataSync";
import { isStrongPassword } from "./utils/security";

const Dashboard = lazy(() =>
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
    <div className="flex h-full min-h-[320px] items-center justify-center px-6 py-10 text-sm text-text-secondary">
      Loading view…
    </div>
  );
}

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isSignUp) {
        const passwordStrength = isStrongPassword(password);
        if (!passwordStrength.valid) {
          throw new Error(passwordStrength.message);
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Check your email for the confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setMessage(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setMessage("Enter your email address to receive a reset link.");
      return;
    }

    setResetting(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) throw error;

      setMessage("Password reset link sent! Check your email to continue.");
    } catch (error: any) {
      setMessage(
        error.message ||
          "Unable to send password reset email. Please try again.",
      );
    } finally {
      setResetting(false);
    }
  };

  const handleOAuthLogin = async () => {
    setOauthLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Unable to start Google sign-in. Please try again or use email/password.",
      );
    } finally {
      setOauthLoading(false);
    }
  };

  const handleTestLogin = async () => {
    setLoading(true);
    setMessage("");

    const testEmail = import.meta.env.VITE_TEST_EMAIL;
    const testPassword = import.meta.env.VITE_TEST_PASSWORD;

    if (!testEmail || !testPassword) {
      setMessage("Test credentials not configured");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

      if (error) throw error;
    } catch (error: any) {
      setMessage(error.message || "An error occurred during test login");
    } finally {
      setLoading(false);
    }
  };

  const showTestLogin = !!(
    import.meta.env.VITE_TEST_EMAIL && import.meta.env.VITE_TEST_PASSWORD
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base transition-colors">
      <div className="w-full max-w-md p-8 bg-bg-surface border border-border-subtle rounded-md shadow-lg relative overflow-hidden">
        {/* Subtle decorative top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500"></div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-bg-elevated border border-border-subtle rounded-md mx-auto mb-4 flex items-center justify-center text-text-primary font-serif font-bold text-2xl shadow-sm">
            RQ
          </div>
          <h1 className="font-serif text-title font-bold text-text-primary">
            ResearchQuest
          </h1>
          <p className="text-small text-text-secondary mt-2 tracking-widest uppercase">
            Scholar Access
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleOAuthLogin}
              disabled={oauthLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border-strong rounded-sm text-text-primary font-medium hover:bg-bg-elevated transition-colors disabled:opacity-60 bg-transparent"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 533.5 544.3"
                aria-hidden="true"
              >
                <path
                  fill="#4285f4"
                  d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.3H272v95.2h147.5c-6.4 34.7-25.7 64-54.7 83.6v69.4h88.5c51.8-47.8 80.2-118.2 80.2-197.9z"
                />
                <path
                  fill="#34a853"
                  d="M272 544.3c73.8 0 135.8-24.5 181.1-66.6l-88.5-69.4c-24.6 16.5-56.1 26-92.6 26-71.2 0-131.5-48-153.1-112.5H27.6v70.7c45 89.1 137.5 151.8 244.4 151.8z"
                />
                <path
                  fill="#fbbc05"
                  d="M118.9 322.8c-10.9-32.6-10.9-67.6 0-100.2V151.9H27.6c-46.5 92-46.5 201.1 0 293.1l91.3-70.2z"
                />
                <path
                  fill="#ea4335"
                  d="M272 107.7c39.9-.6 78.2 14.9 107.3 42.9l80-80C405.8 24.2 344.1-1.3 272 0 165.1 0 72.6 62.7 27.6 151.9l91.3 70.7C140.5 155.7 200.8 107.7 272 107.7z"
                />
              </svg>
              {oauthLoading ? "Contacting Google…" : "Continue with Google"}
            </button>

            {showTestLogin && (
              <button
                type="button"
                onClick={handleTestLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-border-moderate rounded-sm text-text-secondary font-medium hover:text-text-primary transition-colors disabled:opacity-60"
              >
                🛠️ Use Test Login
              </button>
            )}

            <div className="flex items-center gap-3 text-small text-text-tertiary font-serif italic py-2">
              <span
                className="h-px flex-1 bg-border-subtle"
                aria-hidden="true"
              />
              <span>or use email</span>
              <span
                className="h-px flex-1 bg-border-subtle"
                aria-hidden="true"
              />
            </div>
          </div>

          <div>
            <label className="block text-small font-medium text-text-primary mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              className="w-full px-4 py-2 bg-bg-base border border-border-moderate rounded-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
              placeholder="scholar@university.edu"
            />
          </div>

          <div>
            <label className="block text-small font-medium text-text-primary mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={100}
                className="w-full px-4 py-2 bg-bg-base border border-border-moderate rounded-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-shadow pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeClosedIcon className="w-5 h-5" />
                ) : (
                  <EyeOpenIcon className="w-5 h-5" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetting}
              className="mt-2 text-caption text-text-secondary hover:text-text-primary underline decoration-border-strong underline-offset-2 disabled:opacity-60 font-medium"
            >
              {resetting ? "Sending reset link…" : "Recover access"}
            </button>
          </div>

          {message && (
            <div
              className={`p-3 rounded-sm text-small font-medium border ${
                message.includes("error") || message.includes("Error")
                  ? "bg-warning-bg text-warning border-warning"
                  : "bg-success-bg text-success border-success"
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-primary-500 text-bg-base rounded-sm hover:opacity-90 transition-opacity font-medium disabled:opacity-50"
          >
            {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-border-subtle pt-6">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage("");
            }}
            className="text-small font-serif italic text-text-secondary hover:text-text-primary transition-colors"
          >
            {isSignUp
              ? "Existing scholar? Sign in."
              : "New scholar? Submit application."}
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  // ⚡ Optimization: Use useShallow with an object selector to prevent the App component
  // from unnecessarily re-rendering on unrelated state changes in the global appStore.
  const {
    setUser: setUserProfile,
    currentView,
    setCurrentView,
    selectedPaper,
    selectedIdea,
    setSelectedIdea,
    setSelectedPaper,
  } = useAppStore(
    useShallow((state) => ({
      setUser: state.setUser,
      currentView: state.currentView,
      setCurrentView: state.setCurrentView,
      selectedPaper: state.selectedPaper,
      selectedIdea: state.selectedIdea,
      setSelectedIdea: state.setSelectedIdea,
      setSelectedPaper: state.setSelectedPaper,
    })),
  );
  const hydrateGamification = useGamificationStore(
    (state) => state.hydrateFromProfile,
  );

  // Sync data centrally
  useDataSync(userId);

  // Get hooks for CRUD operations (data comes from store now)
  const { papers, loading: papersLoading } = usePapers(userId);
  const { ideas, loading: ideasLoading } = useIdeas(userId);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__TEST_USER__) {
      setUser((window as any).__TEST_USER__)
      setUserId((window as any).__TEST_USER__.id)
      setLoading(false)
      ;(window as any).__APP_STORE__ = useAppStore
      return
    }
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setUserId(session?.user?.id);
      setLoading(false);
    });

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
    }
  }, [currentView, ideas, ideasLoading, papers, papersLoading, userId]);

  if (loading) {
    return <AppLoadingSkeleton />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  const routeContent =
    currentView === "dashboard" ? (
      <div className="h-full overflow-auto">
        <Dashboard />
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
    </div>
  );
}

export default App;
