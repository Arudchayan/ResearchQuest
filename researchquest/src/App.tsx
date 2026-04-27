import { useEffect, useState } from "react";
import { EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";
import {
  hasSupabaseConfig,
  supabase,
  supabaseConfigErrorMessage,
} from "./lib/supabase";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./store/appStore";
import { useGamificationStore } from "./store/gamificationStore";
import { AppShell } from "./components/layout/v2/AppShell";
import { NotesView } from "./components/notes/NotesView";
import { PapersView } from "./components/papers/PapersView";
import { IdeasBoard } from "./components/ideas/IdeasBoard";
import { TopicsView } from "./components/topics/TopicsView";
import { TaskManager } from "./components/tasks/TaskManager";
import { FocusWorkspace } from "./components/focus/FocusWorkspace";
import { AppLoadingSkeleton } from "./components/ui/Skeleton";
import { Toaster } from "sonner";
import type { User } from "@supabase/supabase-js";
import { usePapers } from "./hooks/usePapers";
import { useIdeas } from "./hooks/useIdeas";
import { useDataSync } from "./hooks/useDataSync";
import { OnboardingGuide } from "./components/layout/OnboardingGuide";
import { CommandPalette } from "./components/layout/CommandPalette";
import { ShortcutsDialog } from "./components/layout/ShortcutsDialog";
import { isStrongPassword } from "./utils/security";
import { Dashboard } from "./components/dashboard/Dashboard";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
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
          {showTestLogin && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleTestLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-border-moderate rounded-sm text-text-secondary font-medium hover:text-text-primary transition-colors disabled:opacity-60"
              >
                🛠️ Use Test Login
              </button>

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
          )}

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

export function SupabaseConfigErrorScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base p-6">
      <div className="w-full max-w-lg bg-bg-surface border border-border-subtle rounded-md shadow-lg p-8">
        <div className="w-14 h-14 bg-bg-elevated border border-border-subtle rounded-md mb-5 flex items-center justify-center text-text-primary font-serif font-bold text-xl">
          RQ
        </div>
        <h1 className="font-serif text-title font-bold text-text-primary">
          Supabase configuration required
        </h1>
        <p className="text-body text-text-secondary mt-3">
          ResearchQuest needs Supabase credentials before it can start.
        </p>
        <div className="mt-5 rounded-sm border border-border-moderate bg-bg-elevated p-4">
          <p className="text-small font-medium text-text-primary">
            Required environment variables
          </p>
          <ul className="mt-2 space-y-1 text-small text-text-secondary font-mono">
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_ANON_KEY</li>
          </ul>
        </div>
        <p className="text-caption text-text-tertiary mt-4">
          {supabaseConfigErrorMessage}. Add them to your local environment or
          deployment settings, then reload the app.
        </p>
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

  if (!hasSupabaseConfig) {
    return <SupabaseConfigErrorScreen />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary selection:bg-primary-500 selection:text-bg-base">
      <CommandPalette />
      <ShortcutsDialog />

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
        {currentView === "dashboard" ? (
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
        ) : null}
      </AppShell>
    </div>
  );
}

export default App;
