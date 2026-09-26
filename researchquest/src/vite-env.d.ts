/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_USE_DEMO?: string;
  // Already declared by vite/client; restated so demo/backend flags (read in
  // src/lib/supabase.ts) and the build-mode flags are visible in one place.
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
