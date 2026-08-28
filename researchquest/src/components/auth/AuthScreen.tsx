import { useCallback, useEffect, useRef, useState } from "react";
import { EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";
import { FlaskConical } from "lucide-react";
import {
  enableDemoModeAndReload,
  isDemoMode,
  supabase,
} from "../../lib/supabase";
import { isStrongPassword } from "../../utils/security";

type AuthMessage = {
  readonly type: "success" | "error";
  readonly text: string;
} | null;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<AuthMessage>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const messageId = "auth-message";
  const emailErrorId = "auth-email-error";
  const passwordErrorId = "auth-password-error";

  // Focus the email input on mount
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Reset validation and messages when toggling between sign-in and sign-up
  useEffect(() => {
    setEmailError(null);
    setPasswordError(null);
    setMessage(null);
    // Re-focus the email input after mode toggle
    emailRef.current?.focus();
  }, [isSignUp]);

  const validateEmail = useCallback((value: string): boolean => {
    if (value.length > 0 && !EMAIL_REGEX.test(value)) {
      setEmailError("Enter a valid email address.");
      return false;
    }
    setEmailError(null);
    return true;
  }, []);

  const handleEmailBlur = useCallback(() => {
    validateEmail(email);
  }, [email, validateEmail]);

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmail(value);
      // Re-validate only if already showing an error
      if (emailError !== null) {
        validateEmail(value);
      }
    },
    [emailError, validateEmail],
  );

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setPassword(value);
      if (isSignUp && value.length > 0) {
        const result = isStrongPassword(value);
        setPasswordError(result.valid ? null : (result.message ?? null));
      } else {
        setPasswordError(null);
      }
    },
    [isSignUp],
  );

  const handleAuth = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setMessage(null);

      // Client-side validation before submission
      if (!validateEmail(email)) {
        return;
      }

      if (isSignUp) {
        const pwResult = isStrongPassword(password);
        if (!pwResult.valid) {
          setPasswordError(pwResult.message ?? null);
          return;
        }
      }

      setLoading(true);

      try {
        if (isSignUp) {
          const { error } = await supabase.auth.signUp({
            email,
            password,
          });
          if (error) throw error;
          setMessage({
            type: "success",
            text: "Check your email for the confirmation link!",
          });
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          // No success message on sign-in — auth state change redirects
        }
      } catch (error: unknown) {
        const errMsg =
          error instanceof Error ? error.message : "An error occurred";
        // Normalize common Supabase error messages
        let displayMsg = errMsg;
        if (errMsg.includes("Invalid login credentials")) {
          displayMsg = "Invalid email or password. Please try again.";
        } else if (errMsg.includes("Email not confirmed")) {
          displayMsg =
            "Please confirm your email address before signing in.";
        }
        setMessage({ type: "error", text: displayMsg });
      } finally {
        setLoading(false);
      }
    },
    [email, password, isSignUp, validateEmail],
  );

  const handlePasswordReset = useCallback(async () => {
    if (!email) {
      setMessage({
        type: "error",
        text: "Enter your email address to receive a reset link.",
      });
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setMessage({
        type: "error",
        text: "Enter a valid email address to receive a reset link.",
      });
      return;
    }

    setResetting(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setMessage({
        type: "success",
        text: "Password reset link sent! Check your email to continue.",
      });
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error
          ? error.message
          : "Unable to send password reset email.";
      setMessage({ type: "error", text: errMsg });
    } finally {
      setResetting(false);
    }
  }, [email]);

  const showDemoWorkspace = !isDemoMode;

  const isBusy = loading || resetting;

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-base transition-colors">
      <div className="w-full max-w-md p-8 bg-bg-surface border border-border-subtle rounded-md shadow-lg relative overflow-hidden">
        {/* Subtle decorative top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500" />

        <header className="text-center mb-8">
          <div className="w-16 h-16 bg-bg-elevated border border-border-subtle rounded-md mx-auto mb-4 flex items-center justify-center text-text-primary font-serif font-bold text-2xl shadow-sm">
            RQ
          </div>
          <h1 className="font-serif text-title font-bold text-text-primary">
            ResearchQuest
          </h1>
          <p className="text-small text-text-secondary mt-2 tracking-widest uppercase">
            Scholar Access
          </p>
        </header>

        <form onSubmit={handleAuth} className="space-y-4" noValidate>
          {showDemoWorkspace && (
            <div className="space-y-3">
              {showDemoWorkspace && (
                <button
                  type="button"
                  onClick={enableDemoModeAndReload}
                  disabled={isBusy}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-border-moderate rounded-sm text-text-secondary font-medium hover:text-text-primary transition-colors disabled:opacity-60"
                >
                  <FlaskConical className="w-4 h-4" aria-hidden="true" />
                  Use demo workspace
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
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-small font-medium text-text-primary mb-1.5 uppercase tracking-wide"
            >
              Email
            </label>
            <input
              ref={emailRef}
              id="auth-email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              required
              maxLength={254}
              disabled={isBusy}
              aria-describedby={emailError ? emailErrorId : undefined}
              aria-invalid={emailError ? true : undefined}
              className="w-full px-4 py-2 bg-bg-base border border-border-moderate rounded-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-shadow disabled:opacity-50"
              placeholder="scholar@university.edu"
            />
            {emailError && (
              <p
                id={emailErrorId}
                role="alert"
                className="mt-1 text-caption text-warning"
              >
                {emailError}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-small font-medium text-text-primary mb-1.5 uppercase tracking-wide"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={handlePasswordChange}
                required
                maxLength={100}
                disabled={isBusy}
                aria-describedby={
                  passwordError ? passwordErrorId : undefined
                }
                aria-invalid={passwordError ? true : undefined}
                className="w-full px-4 py-2 bg-bg-base border border-border-moderate rounded-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-shadow pr-10 disabled:opacity-50"
                placeholder={"\u2022".repeat(8)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isBusy}
                className="absolute right-3 top-1/2 -translate-y-1/2 min-h-6 min-w-6 flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeClosedIcon className="w-5 h-5" />
                ) : (
                  <EyeOpenIcon className="w-5 h-5" />
                )}
              </button>
            </div>
            {passwordError && (
              <p
                id={passwordErrorId}
                role="alert"
                className="mt-1 text-caption text-warning"
              >
                {passwordError}
              </p>
            )}
            {isSignUp && (
              <p className="mt-1.5 text-caption text-text-tertiary leading-relaxed">
                Password must be at least 8 characters and include uppercase,
                lowercase, number, and special character.
              </p>
            )}
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetting || loading}
              className="mt-2 text-caption text-text-secondary hover:text-text-primary underline decoration-border-strong underline-offset-2 disabled:opacity-60 font-medium"
            >
              {resetting
                ? "Sending reset link\u2026"
                : "Recover access"}
            </button>
          </div>

          {message && (
            <div
              role="alert"
              aria-live="polite"
              id={messageId}
              className={`p-3 rounded-sm text-small font-medium border ${
                message.type === "error"
                  ? "bg-warning-bg text-warning border-warning"
                  : "bg-success-bg text-success border-success"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className="w-full px-4 py-2 bg-primary-500 text-bg-base rounded-sm hover:opacity-90 transition-opacity font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span
                  className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                {isSignUp ? "Creating account\u2026" : "Signing in\u2026"}
              </>
            ) : isSignUp ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-border-subtle pt-6">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage(null);
            }}
            disabled={loading}
            className="text-small font-serif italic text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            {isSignUp
              ? "Existing scholar? Sign in."
              : "New scholar? Submit application."}
          </button>
        </div>
      </div>
    </main>
  );
}
