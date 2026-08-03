import { useState } from "react";
import { EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";
import { supabase } from "../../lib/supabase";
import { isStrongPassword } from "../../utils/security";

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
    } catch (error: unknown) {
      console.error("AuthScreen auth error:", error);
      if (
        error instanceof Error &&
        isSignUp &&
        error.message &&
        error.message.toLowerCase().startsWith("password must")
      ) {
        setMessage(error.message);
      } else {
        setMessage("Authentication failed. Please check your credentials and try again.");
      }
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
      console.error("AuthScreen password reset error:", error);
      setMessage("Unable to send password reset email. Please try again.");
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
      console.error("AuthScreen test login error:", error);
      setMessage("An error occurred during test login. Please try again.");
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

        <form onSubmit={handleAuth} className="space-y-4" noValidate>
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
            <label htmlFor="auth-email" className="block text-small font-medium text-text-primary mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <input
              id="auth-email"
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
            <label htmlFor="auth-password" className="block text-small font-medium text-text-primary mb-1.5 uppercase tracking-wide">
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
              role="alert"
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
