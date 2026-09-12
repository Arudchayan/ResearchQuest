import { useSyncExternalStore } from "react";
import {
  subscribeStaleKeys,
  getStaleKeysSnapshot,
} from "../../lib/idbCache";

/**
 * Shell-level banner shown ONLY while a list is rendering stale cached data
 * pending revalidation. Mounted once in `App.tsx`; hidden otherwise so the
 * healthy path renders exactly as before.
 */
export function StaleBanner() {
  const staleKeys = useSyncExternalStore(
    subscribeStaleKeys,
    getStaleKeysSnapshot,
  );

  if (staleKeys.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-700 dark:text-amber-300"
    >
      Showing cached data while fresh results load…
    </div>
  );
}
