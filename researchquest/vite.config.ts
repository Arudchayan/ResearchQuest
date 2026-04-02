import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'prod'
  return {
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
            'editor': ['@uiw/react-codemirror', '@codemirror/lang-markdown', 'react-markdown'],
            'ui': ['lucide-react', 'framer-motion'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  }
})

