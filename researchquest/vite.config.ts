import { realpathSync } from "node:fs"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const repoRoot = path.resolve(__dirname, "..")
const fontsourceAllowlist = ["inter", "playfair-display", "jetbrains-mono"].map(
  (family) =>
    realpathSync(path.resolve(__dirname, "node_modules", "@fontsource", family)),
)

export default defineConfig(({ mode, command }) => {
  // ENV PLUMBING — intentionally non-standard; keep all three pieces together.
  // Native Vite semantics (default envDir + VITE_* only + no define override)
  // would change behavior, so this stays until every consumer below migrates:
  // 1. Root + local merge (local wins): contributors keep backend credentials
  //    in the repo-root `.env` (see `/.env.example`), while `researchquest/`
  //    holds the documented template. Native `envDir` loads exactly one dir.
  // 2. NEXT_PUBLIC_* alias: CI's env-guard passes Supabase credentials via
  //    `NEXT_PUBLIC_SUPABASE_URL` secrets
  //    (`.github/workflows/ci.yml` + `scripts/check-supabase-env.mjs`).
  //    Dropping the alias breaks that gate.
  // 3. `define:` override + PLAYWRIGHT_TEST_NO_SUPABASE: Playwright smoke
  //    runs Vite with empty VITE_* vars, but loadEnv would still read `.env`
  //    from disk; the define hack is what forces the empty no-backend build.
  // Vercel is unaffected (native VITE_* project vars flow through the same
  // merge). Safe future simplification requires: single-.env convention,
  // CI guard on VITE_* only, and a non-define Playwright override.
  const merged = { ...loadEnv(mode, repoRoot, ""), ...loadEnv(mode, __dirname, "") }
  const forceNoSupabase = process.env.PLAYWRIGHT_TEST_NO_SUPABASE === "1"
  const supabaseUrl = forceNoSupabase
    ? ""
    : merged.VITE_SUPABASE_URL || merged.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseAnonKey = forceNoSupabase
    ? ""
    : merged.VITE_SUPABASE_ANON_KEY || merged.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

  return {
    envDir: repoRoot,
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
    },
    plugins: [
      react(), 
      sourceIdentifierPlugin({
        enabled: command === 'serve',
        attributePrefix: 'data-matrix',
        includeProps: true,
      })
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/lang-markdown',
        '@uiw/react-codemirror',
      ],
    },
    optimizeDeps: {
      include: [
        '@codemirror/state',
        '@codemirror/view',
        '@codemirror/lang-markdown',
        '@uiw/react-codemirror',
      ],
    },
    preview: {
      port: 4173,
      strictPort: false,
    },
    server: {
      port: 5173,
      strictPort: false,
      host: true,
      fs: {
        allow: [__dirname, ...fontsourceAllowlist],
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'supabase': ['@supabase/supabase-js'],
            'ui': ['lucide-react'],
            'cm-core': ['@codemirror/view', '@codemirror/state', '@uiw/react-codemirror', '@uiw/codemirror-theme-github'],
          },
        },
      },
      chunkSizeWarningLimit: 300,
    },
  }
})

