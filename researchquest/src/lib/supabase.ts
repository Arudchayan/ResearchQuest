import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoSupabase } from "./demoSupabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "1";

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
