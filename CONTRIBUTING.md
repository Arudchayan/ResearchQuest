# Contributing

Thanks for considering contributing to ResearchQuest.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues belong in
[SECURITY.md](SECURITY.md), not public issues.

## Getting Started

1. Fork the repo and clone locally.
2. Use **Node 22** (`.nvmrc`) and **pnpm 10**.
3. Run `pnpm install` in `researchquest/`.
4. Prefer **demo mode** for UI work:
   - `pnpm run dev`, then click **Use demo workspace**, or
   - set `VITE_DEMO_MODE=1` in `.env` (copy from `.env.example`).
5. For a real backend, add Supabase URL + anon key to `.env`.

Do **not** commit `.env`, API keys, or local agent folders (`.omo/`, `.jules/`, `.wt/`).

## Code Style

- TypeScript strict mode. Avoid `any` unless absolutely necessary.
- React functional components with hooks. No class components.
- Zustand for global state; local state for component-only concerns.
- Tailwind CSS for styling. No CSS modules or styled-components.
- Prefer `useShallow` from Zustand for store selectors to prevent re-renders.
- Custom hooks should return plain objects, not JSX.
- Top-level views live in `src/lib/router.ts` (`AppView` / `VALID_VIEWS`). Keep
  the store, sidebar, and `App.tsx` route switch in sync when adding a view.

## Testing

- Write tests alongside code: `src/test/` mirrors `src/` structure.
- Use Vitest + React Testing Library for unit/integration tests.
- Use Playwright for E2E tests.
- Run `pnpm run test:run` before pushing.
- Run `pnpm run build` to verify TypeScript and build.
- Run `pnpm run lint` for ESLint.

## Pull Requests

1. Create a feature branch from `master`.
2. Make focused, atomic commits.
3. Add tests for new functionality.
4. Update docs if behavior changes.
5. Open a PR with a clear title and description.

## Project Structure

```
src/
├── components/     # React components, grouped by domain
│   ├── ui/         # Reusable primitives (button, card, input, etc.)
│   ├── layout/     # App shell, sidebar, navigation (v2 is current)
│   ├── auth/       # Authentication screens
│   ├── dashboard/  # Dashboard
│   ├── papers/     # Paper management
│   ├── notes/      # Note management
│   ├── ideas/      # Idea board
│   ├── topics/     # Topic management
│   ├── tasks/      # Task manager
│   ├── feeds/      # Feed triage (alpha)
│   ├── focus/      # Focus workspace
│   ├── editor/     # Markdown editor
│   ├── entities/   # Entity CRUD operations
│   ├── analysis/   # Experimental analysis UI (not wired)
│   └── settings/   # Data management
├── hooks/          # Custom React hooks (usePapers, useNotes, etc.)
├── store/          # Zustand stores
├── types/          # TypeScript type definitions
├── utils/          # Utilities (security, gamification, sort, etc.)
└── lib/            # Library config (Supabase client, router, demo)
```

## Development Tips

- Install once with `pnpm install` (or `pnpm run install-deps`); scripts do not
  reinstall on every `dev`/`lint`/`build`.
- Dev mode has hot module reload via Vite.
- Set `PLAYWRIGHT_TEST_NO_SUPABASE=1` to skip Supabase config in tests.
- Tests use `happy-dom` by default, `jsdom` for some specific tests.
- Do not commit `.env` files or API keys.

## Performance Considerations

- Lazy-load route-level components.
- Use `useShallow` for Zustand selectors.
- Avoid unnecessary Supabase subscriptions.
- CSS containment on sidebars and panels.
- Profile with React DevTools before optimizing.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
