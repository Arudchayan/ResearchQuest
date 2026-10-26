import { useCallback, useEffect, useRef, useState } from "react";
import { EyeOpenIcon, EyeClosedIcon } from "@radix-ui/react-icons";
import { FlaskConical } from "lucide-react";
import { DEMO_DATA_BADGE_LABEL, demoEntryPath } from "../../lib/demoEntry";
import { enableDemoModeAndReload, supabase } from "../../lib/supabase";
import { toFriendlyAuthError } from "../../utils/errors";

type AuthMessage = {
  readonly type: "success" | "error";
  readonly text: string;
} | null;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_REQUIRED_MESSAGE = "Enter your email address.";
const EMAIL_INVALID_MESSAGE = "Enter a valid email address.";
const PASSWORD_REQUIRED_MESSAGE = "Enter your password.";
const SIGN_IN_ERROR_FALLBACK = "Unable to sign in. Please try again.";

type AuthFieldErrors = {
  emailError: string | null;
  passwordError: string | null;
};

function emailErrorFromValue(email: string, requireValue: boolean): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return requireValue ? EMAIL_REQUIRED_MESSAGE : null;
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return EMAIL_INVALID_MESSAGE;
  }
  return null;
}

function getAuthFieldErrors(email: string, password: string): AuthFieldErrors {
  return {
    emailError: emailErrorFromValue(email, true),
    passwordError: password.length === 0 ? PASSWORD_REQUIRED_MESSAGE : null,
  };
}

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<AuthMessage>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const messageId = "auth-message";
  const emailErrorId = "auth-email-error";
  const passwordErrorId = "auth-password-error";

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const validateEmail = useCallback((value: string): boolean => {
    const requireValue = emailError === EMAIL_REQUIRED_MESSAGE;
    const next = emailErrorFromValue(value, requireValue);
    setEmailError(next);
    return next === null;
  }, [emailError]);

  const handleEmailBlur = useCallback(() => {
    validateEmail(email);
  }, [email, validateEmail]);

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEmail(value);
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
      if (passwordError !== null) {
        setPasswordError(
          value.length === 0 ? PASSWORD_REQUIRED_MESSAGE : null,
        );
      }
    },
    [passwordError],
  );

  const handleAuth = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setMessage(null);

      const nextErrors = getAuthFieldErrors(email, password);
      setEmailError(nextErrors.emailError);
      setPasswordError(nextErrors.passwordError);

      if (nextErrors.emailError || nextErrors.passwordError) {
        if (nextErrors.emailError) {
          emailRef.current?.focus();
        } else {
          passwordRef.current?.focus();
        }
        return;
      }

      setLoading(true);

      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } catch (error: unknown) {
        setMessage({
          type: "error",
          text: toFriendlyAuthError(error, SIGN_IN_ERROR_FALLBACK),
        });
      } finally {
        setLoading(false);
      }
    },
    [email, password],
  );

  const isBusy = loading;
  const demoPath = demoEntryPath(new URL(window.location.href));

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-base transition-colors">
      <div className="w-full max-w-md p-8 bg-bg-elevated border border-border-subtle rounded-md shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500" />

        <header className="text-center mb-8">
          <div className="w-16 h-16 bg-bg-surface border border-border-subtle rounded-md mx-auto mb-4 flex items-center justify-center text-text-primary font-serif font-bold text-2xl shadow-sm">
            RQ
          </div>
          <h1 className="font-serif text-title font-bold text-text-primary">
            ResearchQuest
          </h1>
          <p className="text-small text-text-secondary mt-2 tracking-widest uppercase">
            Scholar Access
          </p>
          <p className="text-small text-text-secondary mt-3">
            Four sample topics. Papers, notes, and Focus Studio to explore.
          </p>
          <p className="text-caption text-text-tertiary mt-2">
            Demo workspace is sample data on this device. Sign in only if you
            already have a live ResearchQuest account.
          </p>
        </header>

        <form onSubmit={handleAuth} className="space-y-4" noValidate>
          <div className="space-y-3">
            {/*
              Real link + data-rq-demo-entry: first click works even if React
              handlers are late — index.html capture script arms demo mode,
              then the browser navigates to the seeded topic.
            */}
            <a
              href={demoPath}
              data-rq-demo-entry
              onClick={(event) => {
                event.preventDefault();
                enableDemoModeAndReload(demoPath);
              }}
              aria-disabled={isBusy || undefined}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-sm hover:opacity-90 transition-opacity font-medium"
            >
              <FlaskConical className="w-4 h-4" aria-hidden="true" />
              Use demo workspace
            </a>
            <p className="mt-2 text-center text-caption text-text-tertiary">
              {/* Intent: badges label the demo entry option and render pre-auth by design. */}
              <span className="mr-1.5 rounded-full border border-border-moderate bg-bg-elevated px-2 py-0.5 font-medium text-text-secondary">
                {DEMO_DATA_BADGE_LABEL}
              </span>
              Seeded samples on this device — no account needed.
            </p>

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
                ref={passwordRef}
                id="auth-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={handlePasswordChange}
                required
                maxLength={128}
                disabled={isBusy}
                aria-describedby={passwordError ? passwordErrorId : undefined}
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
            <a
              href="https://lp.arudchayan.com/login/?mode=recover"
              aria-describedby="shared-account-recovery"
              className="mt-2 inline-block text-caption text-text-secondary hover:text-text-primary underline decoration-border-strong underline-offset-2 font-medium"
            >
              Recover access
            </a>
            <p id="shared-account-recovery" className="mt-1 text-caption text-text-tertiary">
              Reset your password on Learning Atlas, then return here. Your email
              and password work on both sites.
            </p>
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
            className="w-full px-4 py-2 border border-border-moderate bg-transparent text-text-secondary rounded-sm hover:bg-bg-elevated hover:text-text-primary transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span
                  className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                {"Signing in\u2026"}
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
