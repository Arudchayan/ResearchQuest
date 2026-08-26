# ResearchQuest

[![CI](https://github.com/Arudchayan/ResearchQuest/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/Arudchayan/ResearchQuest/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Security Policy](https://img.shields.io/badge/Security-Policy-blue.svg)](SECURITY.md)

A research management dashboard for tracking papers, notes, ideas, topics, and reading tasks — all synced to Supabase.

**Status:** Alpha — functional but evolving. Live demo: [research-quest-wine.vercel.app](https://research-quest-wine.vercel.app)

## Features

- **Papers** — Add papers via DOI lookup, Crossref search, or manual entry. Track reading status (To Read → Reading → Read). Import from BibTeX.
- **Notes** — Write rich markdown notes with tags, links to papers/ideas, and CodeMirror editor with syntax highlighting.
- **Ideas** — Track research ideas through stages (Seed → Developing → Supported → Mature). Link to supporting papers and notes.
- **Topics** — Organize entities into topics with automatic count tracking.
- **Tasks** — Reading tasks created automatically when you add papers. Manual task creation with priorities and due dates.
- **Focus Studio** — Timer-based focus sessions with XP tracking.
- **Feeds (alpha)** — Triage ingested `feed_items` and promote leads into papers, tasks, or notes. Feed source/RSS management UI and scheduled ingest are still incomplete.
- **Gamification** — XP, levels, streaks, and achievements for research activity.
- **Zen Mode** — Distraction-free workspace (Ctrl+Shift+F).
- **Command Palette** — Quick search and navigation (Ctrl+K).
- **Dark/Light/Auto themes** — Clean, editorial-style design system.
- **Real-time sync** — Multi-tab via Supabase Realtime subscriptions.

## Quick Start

### Prerequisites

- **Node.js 22+** (see `.nvmrc`)
- **pnpm 10** (`corepack enable` or `npm install -g pnpm@10`)
- **Supabase project** (free tier works) — or use **demo mode** with no backend

### Setup

```bash
# Clone
git clone https://github.com/Arudchayan/ResearchQuest.git
cd ResearchQuest

# Install dependencies
cd researchquest && pnpm install

# Configure (optional for demo)
cp .env.example .env
# Edit .env with your Supabase project credentials:
#   VITE_SUPABASE_URL=https://your-project.supabase.co
#   VITE_SUPABASE_ANON_KEY=your-anon-key

# Start dev server
pnpm run dev
# Opens at http://localhost:5173
```

### Demo mode (no backend required)

ResearchQuest ships with a fully local demo workspace. It seeds papers, notes,
ideas, topics, tasks, feeds, focus sessions, XP, streaks, quests, and
achievements into an in-memory Supabase-compatible client.

**Easiest path:** run `pnpm run dev`, then click **Use demo workspace** on the
auth screen (or the config-error screen if Supabase env vars are missing).

Or set the flag explicitly:

```bash
cd researchquest
cp .env.example .env
# Set VITE_DEMO_MODE=1 in .env
pnpm run dev
```

Sign in with any email and password once demo mode is active.

### Without Supabase

Without credentials and without demo mode, the app shows a config screen with a
demo CTA and setup instructions. Set `PLAYWRIGHT_TEST_NO_SUPABASE=1` to force
this mode in tests.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start dev server with hot reload |
| `pnpm run build` | TypeScript check + production build |
| `pnpm run build:prod` | Production build with prod flags |
| `pnpm run lint` | ESLint check |
| `pnpm run lint:fix` | ESLint auto-fix |
| `pnpm run test` | Vitest watch mode |
| `pnpm run test:run` | Run all tests once |
| `pnpm run test:coverage` | Run tests with coverage |
| `pnpm run test:e2e` | Playwright E2E tests |
| `pnpm run preview` | Preview production build |
| `pnpm run clean` | Full clean of node_modules |

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| UI | Radix UI primitives + Tailwind CSS 3 |
| State | Zustand (client) + Supabase (server) |
| Auth | Supabase Auth (email/password) |
| Database | PostgreSQL via Supabase |
| Editor | CodeMirror 6 |
| Tests | Vitest + Testing Library + Playwright |

## Project Structure

```
ResearchQuest/
├── researchquest/           # Frontend app
│   ├── src/
│   │   ├── components/      # React components by domain
│   │   │   ├── auth/        # Authentication screens
│   │   │   ├── dashboard/   # Dashboard view
│   │   │   ├── editor/      # Markdown editor
│   │   │   ├── entities/    # Entity CRUD (papers, ideas, notes)
│   │   │   ├── focus/       # Focus workspace
│   │   │   ├── ideas/       # Ideas board
│   │   │   ├── layout/      # App shell, sidebar, command palette
│   │   │   ├── notes/       # Notes view
│   │   │   ├── papers/      # Papers view
│   │   │   ├── settings/    # Data management
│   │   │   ├── tasks/       # Task manager
│   │   │   ├── topics/      # Topics view
│   │   │   └── ui/          # Reusable primitives
│   │   ├── hooks/           # Custom React hooks
│   │   ├── store/           # Zustand stores
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utilities (security, gamification, etc.)
│   │   └── test/            # Test files
│   └── e2e/                 # Playwright E2E tests
└── supabase/                # Database
    ├── functions/           # Edge functions (Deno)
    ├── migrations/          # Schema migrations
    └── tables/              # Table definitions
```

## Configuration

All config is through environment variables. Copy `.env.example` to `.env`.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes (for DB) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (for DB) | Supabase anon/public key |
| `VITE_DEMO_MODE` | No | Set to `1` for local seeded demo (no Supabase) |
| `VITE_TEST_EMAIL` / `VITE_TEST_PASSWORD` | No | Dev-only test login button |
| `PLAYWRIGHT_TEST_NO_SUPABASE` | No | Force config-error screen for E2E |

## Security

See [SECURITY.md](SECURITY.md) for private vulnerability reporting. Do not commit
`.env` files or service-role keys. The privileged `create-admin-user` edge
function must not be deployed casually — see its README.

## Performance Notes

- **Code splitting**: Views are lazy-loaded. React, Supabase, UI icons, and CodeMirror are split into separate chunks.
- **CSS containment**: Sidebars use `contain: layout style paint` for layout isolation.
- **Zustand shallow selectors**: Components use `useShallow` to prevent unnecessary re-renders.
- **Content visibility**: Off-screen content uses `content-visibility: auto`.
- **Bundle**: ~80KB gzipped for main app (excluding CodeMirror which loads on demand).

## Browser Support

Modern browsers (Chrome, Firefox, Safari, Edge). No IE11 support.

## Database

21 PostgreSQL tables with Row-Level Security (RLS). See `supabase/tables/` for schema and `supabase/migrations/` for migrations.

Edge functions in `supabase/functions/` (Deno runtime):
- `api` — Agent API gateway for scoped entity, feed, and key management
- `fetch-paper` — Crossref DOI/query search
- `deep-research` — Deep research orchestration
- `create-admin-user` — **Privileged** admin bootstrap (keep undeployed by default)

## Tests

```bash
# Unit + integration
pnpm run test:run

# With coverage
pnpm run test:coverage

# E2E (requires build first)
pnpm run test:e2e
```

~90 test files covering unit, integration, security, accessibility, performance, and E2E.

## Contributing

1. Fork and clone
2. Prefer **demo mode** for UI work (`Use demo workspace` or `VITE_DEMO_MODE=1`)
3. Create a feature branch
4. Make changes with tests
5. Run `pnpm run test:run` and `pnpm run build`
6. Open a PR

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Roadmap

- [ ] Offline support / PWA
- [ ] Collaborative research sessions
- [ ] Feed source/RSS management UI and scheduled ingest
- [ ] Analysis / adversarial review workspace (experimental code exists, not productized)
- [ ] Zotero/ Mendeley import
- [ ] Bibliography export (BibTeX, CSL)
- [ ] Mobile-optimized view

## License

MIT — see [LICENSE](LICENSE).

---

Built with React, Supabase, and lots of coffee.
