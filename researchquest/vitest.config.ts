import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    pool: 'forks',
    maxWorkers: 2,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      '**/*.bench.test.ts',
      '**/*.bench.test.tsx',
      '**/viteProductionBuild.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // P1 Batch 3: include untested files so coverage reflects the whole
      // tree, not just imported modules. If this tanks the run below the
      // floors, report it — do NOT lower the thresholds to compensate.
      all: true,
      thresholds: {
        // PR9 item 98: global floors measured from real local runs
        // (statements ~64.1 / branches ~54.8 / functions ~61.9 / lines ~66.0).
        // NOTE: vitest prints columns as Stmts | Branch | Funcs | Lines.
        lines: 60,
        functions: 55,
        branches: 50,
        statements: 60,
        'src/utils/security.ts': {
          lines: 95,
          functions: 100,
          branches: 100,
          statements: 95,
        },
      },
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
