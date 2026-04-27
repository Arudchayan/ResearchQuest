import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigErrorMessage =
  "Missing Supabase environment variables";

export const supabase = createClient(
  hasSupabaseConfig ? supabaseUrl : "https://missing-supabase-config.invalid",
  hasSupabaseConfig ? supabaseAnonKey : "missing-supabase-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
