import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import unicorn from 'eslint-plugin-unicorn'
import vitest from '@vitest/eslint-plugin'
import tseslint from 'typescript-eslint'

/** @type {import('eslint').Linter.Config[]} */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '**/*.config.{js,ts,mjs,cjs}',
    ],
  },

  // --- Baseline: every TS/TSX file ---
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      unicorn,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // Curated unicorn rules (avoid full recommended — too noisy for UI codebases)
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/new-for-builtins': 'error',
      'unicorn/prefer-string-starts-ends-with': 'warn',
      'unicorn/no-useless-spread': 'warn',
      'unicorn/no-array-reverse': 'off',
      'unicorn/prefer-array-find': 'warn',

      // Defaults; tightened for production code in the next block
      complexity: ['warn', 15],
      'max-depth': ['warn', 5],
      'max-lines-per-function': ['warn', 120],
    },
  },

  // --- Application / library code (strict signal, tests excluded) ---
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      '**/*.test.ts',
      '**/*.test.tsx',
      'src/test/**',
    ],
    rules: {
      complexity: ['warn', 18],
      'max-depth': ['warn', 5],
      'max-lines-per-function': ['warn', 200],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },

  // Sentinel logger intentionally wraps console.* — do not duplicate no-console noise here
  {
    files: ['src/utils/logger.ts'],
    rules: { 'no-console': 'off' },
  },

  // --- Vitest / RTL harnesses: strict test hygiene + relaxed structural rules ---
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      'src/test/**/*.{ts,tsx}',
    ],
    plugins: {
      vitest,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...vitest.environments.env.globals,
      },
    },
    rules: {
      ...vitest.configs.recommended.rules,
      complexity: 'off',
      'max-depth': 'off',
      'max-lines-per-function': 'off',
      'no-console': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-import-type-side-effects': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'unicorn/prefer-node-protocol': 'off',
      'unicorn/new-for-builtins': 'off',
      'unicorn/prefer-string-starts-ends-with': 'off',
      'unicorn/no-useless-spread': 'off',
      'unicorn/prefer-array-find': 'off',
    },
  },

  // --- Supabase Edge (Deno-style): higher tolerance for orchestration handlers ---
  {
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.es2021,
        ...globals.worker,
        Deno: 'readonly',
      },
    },
    rules: {
      complexity: ['warn', 28],
      'max-lines-per-function': ['warn', 180],
      'max-depth': ['warn', 6],
      'no-console': 'off',
    },
  },
)
