import { useState } from "react";
import { EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";
import { BookOpen, Lightbulb, Flame, Sparkles, ArrowRight } from "lucide-react";
import { supabase, isDemoMode } from "../../lib/supabase";
import { isStrongPassword } from "../../utils/security";
import { DEMO_USER_EMAIL, DEMO_USER_PASSWORD } from "../../lib/demoData";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail && !password) {
      setMessage({ text: "Please fill in both fields", type: "error" });
      setLoading(false);
      return;
    }
    if (!trimmedEmail) {
      setMessage({ text: "Email is required", type: "error" });
      setLoading(false);
      return;
    }
    if (!password) {
      setMessage({ text: "Password is required", type: "error" });
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const passwordStrength = isStrongPassword(password);
        if (!passwordStrength.valid) {
          throw new Error(passwordStrength.message);
        }

        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        setMessage({
          text: "Check your email for the confirmation link!",
          type: "success",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
      }
    } catch (error: unknown) {
      console.error("AuthScreen auth error:", error);
      if (
        error instanceof Error &&
        isSignUp &&
        error.message &&
        error.message.toLowerCase().startsWith("password must")
      ) {
        setMessage({ text: error.message, type: "error" });
      } else {
        setMessage({
          text: "Authentication failed. Please check your credentials and try again.",
          type: "error",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setMessage({
        text: "Enter your email address to receive a reset link.",
        type: "error",
      });
      return;
    }

    setResetting(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) throw error;

      setMessage({
        text: "Password reset link sent! Check your email to continue.",
        type: "success",
      });
    } catch (error: any) {
      console.error("AuthScreen password reset error:", error);
      setMessage({
        text: "Unable to send password reset email. Please try again.",
        type: "error",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleTestLogin = async () => {
    setLoading(true);
    setMessage(null);

    const testEmail = import.meta.env.VITE_TEST_EMAIL;
    const testPassword = import.meta.env.VITE_TEST_PASSWORD;

    if (!testEmail || !testPassword) {
      setMessage({ text: "Test credentials not configured", type: "error" });
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
      console.error("AuthScreen test login error:", error);
      setMessage({
        text: "An error occurred during test login. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_USER_EMAIL,
        password: DEMO_USER_PASSWORD,
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("AuthScreen demo login error:", error);
      setMessage({
        text: "Unable to enter the demo workspace.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const showTestLogin = !!(
    import.meta.env.VITE_TEST_EMAIL && import.meta.env.VITE_TEST_PASSWORD
  );

  const inputClasses =
    "w-full rounded-lg border border-border-moderate bg-bg-base px-4 py-2.5 text-body text-text-primary shadow-sm transition-all placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

  return (
    <div className="min-h-screen bg-bg-base text-text-primary transition-colors">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* Brand panel */}
        <div className="hero-ambient relative hidden items-center overflow-hidden border-r border-border-subtle px-10 py-14 lg:flex lg:flex-col lg:justify-center">
          <div className="relative z-10 w-full max-w-md">
            <div className="brand-gradient mb-8 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-lift">
              RQ
            </div>
            <p className="section-kicker mb-4">ResearchQuest</p>
            <h1 className="font-serif text-hero font-bold leading-tight text-text-primary">
              Research,
              <br />
              quested.
            </h1>
            <p className="mt-5 max-w-sm text-body-lg text-text-secondary">
              Papers, notes, ideas, and focus in one deliberate workspace.
            </p>
            <div className="mt-10 flex flex-wrap gap-2.5">
              <span className="status-chip bg-violet-soft text-violet-strong">
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                Library
              </span>
              <span className="status-chip bg-gold-soft text-gold-strong">
                <Lightbulb className="h-3 w-3" aria-hidden="true" />
                Ideas
              </span>
              <span className="status-chip bg-accent-soft text-accent-strong">
                <Flame className="h-3 w-3" aria-hidden="true" />
                Streaks
              </span>
              <span className="status-chip bg-blue-soft text-blue-strong">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Quests
              </span>
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="brand-gradient flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white shadow-lift">
                RQ
              </div>
              <div>
                <div className="font-serif text-xl font-bold">ResearchQuest</div>
                <div className="text-caption text-text-tertiary">Research cockpit</div>
              </div>
            </div>

            <div className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <span className="section-kicker">Scholar access</span>
                {isDemoMode && (
                  <span className="status-chip bg-accent-soft text-accent-strong">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Demo workspace
                  </span>
                )}
              </div>
              <h2 className="font-serif text-title font-bold text-text-primary">
                {isSignUp ? "Submit your application" : "Welcome back"}
              </h2>
              <p className="mt-2 text-small text-text-secondary">
                {isSignUp
                  ? "Create an account to begin your research run."
                  : "Sign in to continue your research run."}
              </p>
            </div>

            {(isDemoMode || showTestLogin) && (
              <div className="mb-6 space-y-3">
                {isDemoMode && (
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={loading}
                    className="group flex w-full items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2.5 text-small font-semibold text-accent-strong transition-all hover:bg-accent-soft/80 disabled:opacity-60"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Use demo workspace
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                )}
                {showTestLogin && (
                  <button
                    type="button"
                    onClick={handleTestLogin}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-moderate bg-bg-surface px-4 py-2.5 text-small font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-60"
                  >
                    Use test login
                  </button>
                )}
                {(isDemoMode || showTestLogin) && (
                  <div className="flex items-center gap-3 py-1 text-caption text-text-tertiary">
                    <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
                    <span>or use email</span>
                    <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-5" noValidate>
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-1.5 block text-small font-semibold text-text-primary"
                >
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={254}
                  className={inputClasses}
                  placeholder="scholar@university.edu"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="mb-1.5 block text-small font-semibold text-text-primary"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    maxLength={100}
                    className={`${inputClasses} pr-11`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="icon-btn absolute right-2 top-1/2 -translate-y-1/2"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeClosedIcon className="h-4 w-4" />
                    ) : (
                      <EyeOpenIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={resetting}
                  className="mt-2 text-caption font-medium text-text-secondary underline decoration-border-strong underline-offset-2 transition-colors hover:text-text-primary disabled:opacity-60"
                >
                  {resetting ? "Sending reset link…" : "Recover access"}
                </button>
              </div>

              {message && (
                <div
                  role="alert"
                  className={`rounded-lg border p-3 text-small font-medium ${
                    message.type === "success"
                      ? "border-success/30 bg-success-bg text-success"
                      : "border-coral/30 bg-coral-soft text-coral-strong"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-text-primary px-4 text-sm font-semibold text-bg-base shadow-lift transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-50"
              >
                {loading
                  ? "Loading..."
                  : isSignUp
                    ? "Create Account"
                    : "Sign In"}
                {!loading && (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </form>

            <div className="mt-7 border-t border-border-subtle pt-6 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setMessage(null);
                }}
                className="text-small font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                {isSignUp
                  ? "Existing scholar? Sign in."
                  : "New scholar? Submit application."}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
