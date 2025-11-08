import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const isProd = process.env.BUILD_MODE === 'prod'
export default defineConfig({
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
    host: true,
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    // Enable HTML5 history mode for client-side routing
    // This ensures that refreshing on routes like /papers or /tasks works
    fs: {
      strict: false,
    },
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
})

