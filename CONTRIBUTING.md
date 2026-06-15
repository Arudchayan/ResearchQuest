# Contributing

Thanks for considering contributing to ResearchQuest.

## Getting Started

1. Fork the repo and clone locally.
2. Run `pnpm install` in `researchquest/`.
3. Copy `.env.example` to `.env` and add Supabase credentials (optional for UI development).
4. Run `pnpm run dev` to start the dev server.

## Code Style

- TypeScript strict mode. Avoid `any` unless absolutely necessary.
- React functional components with hooks. No class components.
- Zustand for global state; local state for component-only concerns.
- Tailwind CSS for styling. No CSS modules or styled-components.
- Prefer `useShallow` from Zustand for store selectors to prevent re-renders.
- Custom hooks should return plain objects, not JSX.

## Testing

- Write tests alongside code: `src/test/` mirrors `src/` structure.
- Use Vitest + React Testing Library for unit/integration tests.
- Use Playwright for E2E tests.
- Run `pnpm run test:run` before pushing.
- Run `pnpm run build` to verify TypeScript and build.

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
│   ├── layout/     # App shell, sidebar, navigation
│   ├── auth/       # Authentication screens
│   ├── dashboard/  # Dashboard
│   ├── papers/     # Paper management
│   ├── notes/      # Note management
│   ├── ideas/      # Idea board
│   ├── topics/     # Topic management
│   ├── tasks/      # Task manager
│   ├── focus/      # Focus workspace
│   ├── editor/     # Markdown editor
│   ├── entities/   # Entity CRUD operations
│   └── settings/   # Data management
├── hooks/          # Custom React hooks (usePapers, useNotes, etc.)
├── store/          # Zustand stores
├── types/          # TypeScript type definitions
├── utils/          # Utilities (security, gamification, sort, etc.)
└── lib/            # Library config (Supabase client, etc.)
```

## Development Tips

- The build uses `pnpm install --prefer-offline` so first build may be slow.
- Dev mode has hot module reload via Vite.
- Set `PLAYWRIGHT_TEST_NO_SUPABASE=1` to skip Supabase config in dev/test.
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
