import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_FIRST_RUN_PATH } from "./demoData";
import { demoSupabase } from "./demoSupabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Runtime flag so contributors can enter demo without rebuilding. */
export const DEMO_MODE_STORAGE_KEY = "rq_demo_mode";

function hasRuntimeDemoFlag(): boolean {
  try {
    return (
      typeof localStorage !== "undefined" &&
      localStorage.getItem(DEMO_MODE_STORAGE_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export const isDemoMode =
  import.meta.env.VITE_DEMO_MODE === "1" ||
  import.meta.env.VITE_USE_DEMO === "1" ||
  hasRuntimeDemoFlag();

/** Enter demo and land on the seeded first-run topic — never the dashboard.
 *
 * Callers with unsaved drafts pass `hasUnsavedChanges: true` so the reload
 * does not discard work without confirmation. Returns `true` when navigation
 * was triggered, `false` when the user aborted.
 */
export function enableDemoModeAndReload(options?: {
  hasUnsavedChanges?: boolean;
  confirmMessage?: string;
}): boolean {
  if (
    options?.hasUnsavedChanges === true &&
    typeof window !== "undefined" &&
    typeof window.confirm === "function"
  ) {
    const confirmed = window.confirm(
      options.confirmMessage ??
        "Entering the demo workspace reloads the app and discards unsaved changes. Continue?",
    );
    if (!confirmed) return false;
  }
  try {
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
  } catch {
    // Ignore quota / private-mode errors; navigation still attempts demo.
  }
  window.location.assign(DEMO_FIRST_RUN_PATH);
  return true;
}

/** Exit demo and land on the live workspace (no dead-end loop). */
export function disableDemoModeAndReload(nextPath = "/"): void {
  try {
    localStorage.removeItem(DEMO_MODE_STORAGE_KEY);
  } catch {
    // Ignore private-mode errors; navigation still leaves demo when the
    // build-time flag is off.
  }
  window.location.assign(nextPath);
}

export const hasSupabaseConfig =
  isDemoMode || Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseConfigErrorMessage = isDemoMode
  ? "Running in demo mode with a local seeded workspace"
  : "Missing Supabase environment variables";

const liveClient = createClient(
  hasSupabaseConfig && !isDemoMode
    ? supabaseUrl
    : "https://missing-supabase-config.invalid",
  hasSupabaseConfig && !isDemoMode
    ? supabaseAnonKey
    : "missing-supabase-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

export const supabase = (
  isDemoMode ? demoSupabase : liveClient
) as unknown as SupabaseClient;
