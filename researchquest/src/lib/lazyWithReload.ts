import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Session flag that bounds the auto-reload to once per tab lifetime.
 * A second stale-chunk failure in the same tab falls through to the error
 * page (with a manual reload action) instead of reload-looping.
 */
const RELOAD_FLAG = "rq_chunk_reload_attempted";

const CHUNK_FAILURE_PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "failed to load module script",
  "loading chunk",
  "loading css chunk",
];

/** True when the error looks like a stale/missing split chunk, not app logic. */
export function isChunkLoadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return CHUNK_FAILURE_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

// Indirection so tests can observe reloads without touching window.location.
let reloadPage = () => window.location.reload();

/** @internal test seam — replaces the reload implementation. */
export function __setReloadPageForTests(
  fn: () => void,
): () => void {
  const previous = reloadPage;
  reloadPage = fn;
  return () => {
    reloadPage = previous;
  };
}

function claimReloadAttempt(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    return true;
  } catch {
    // Storage unavailable (private mode): never auto-reload, avoid loops.
    return false;
  }
}

/**
 * Guards a single dynamic import against stale-chunk failures.
 * Exported so the contract is unit-testable; `lazyWithReload` composes it.
 *
 * @returns the module on success; a never-settling promise when an
 * auto-reload was triggered (the reload tears the page down); rejects
 * otherwise so the nearest error boundary renders.
 */
export function guardImport<T>(
  importer: () => Promise<{ default: T }>,
): Promise<{ default: T }> {
  return importer().catch((error: unknown) => {
    if (!isChunkLoadFailure(error)) throw error;
    // Genuinely offline: a reload cannot help, show the error page instead.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw error;
    }
    if (!claimReloadAttempt()) throw error;
    reloadPage();
    // The reload tears the page down; never resolve so Suspense stays put.
    return new Promise<{ default: T }>(() => {});
  });
}

/**
 * Drop-in replacement for `React.lazy` for route-level split points.
 *
 * When a new version is deployed, an already-open tab holds HTML that
 * references chunk hashes the server no longer serves (the SPA rewrite
 * answers those with index.html, which `import()` rejects). Retrying the
 * same import can never succeed, so on the first chunk-load failure per tab
 * we hard-reload once to fetch the fresh manifest. Anything else rethrows
 * to the nearest error boundary.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- `any` props keep components with required props assignable (unknown's contravariance rejects them); mirrors React's own lazy() typings.
export function lazyWithReload<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => guardImport(importer));
}
