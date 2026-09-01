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

/** Enter demo and land on the seeded first-run topic — never the dashboard. */
export function enableDemoModeAndReload(): void {
  try {
    localStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
  } catch {
    // Ignore quota / private-mode errors; navigation still attempts demo.
  }
  window.location.assign(DEMO_FIRST_RUN_PATH);
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
