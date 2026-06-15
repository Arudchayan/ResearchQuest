import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const repoRoot = path.resolve(__dirname, "..")

export default defineConfig(({ mode }) => {
  const isProd = mode === 'prod'
  // Root `.env` (monorepo) + local `researchquest/.env*` — local wins.
  const merged = { ...loadEnv(mode, repoRoot, ""), ...loadEnv(mode, __dirname, "") }
  // Playwright smoke runs Vite with empty VITE_* vars but loadEnv would still read `.env` from disk.
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
        enabled: !isProd,
        attributePrefix: 'data-matrix',
        includeProps: true,
      })
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    preview: {
      port: 4173,
      strictPort: false,
    },
    server: {
      port: 5173,
      strictPort: false,
      host: true,
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

