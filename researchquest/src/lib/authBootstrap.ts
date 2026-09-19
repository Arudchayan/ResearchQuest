/**
 * Decide whether an auth state change should block the UI with the full-app
 * loading skeleton.
 *
 * Supabase emits `TOKEN_REFRESHED` when the access token rotates — including
 * when the user switches back to this browser tab (visibility recovery).
 * Treating that like a fresh sign-in unmounts AppShell and remounts
 * `AppLoadingSkeleton`, which looks exactly like a full page refresh even
 * though `beforeunload` never fires.
 */
export function shouldBlockShellForAuthEvent(event: string): boolean {
  return event !== "TOKEN_REFRESHED";
}

type AuthIdentity = {
  id: string;
  email?: string;
} | null;

/** Same signed-in person — skip setState so TOKEN_REFRESHED does not re-run profile load. */
export function isSameAuthIdentity(
  current: AuthIdentity,
  next: AuthIdentity,
): boolean {
  if (current === next) return true;
  if (!current || !next) return false;
  return current.id === next.id && (current.email ?? "") === (next.email ?? "");
}
