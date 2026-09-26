# ResearchQuest

[![CI](https://github.com/Arudchayan/ResearchQuest/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/Arudchayan/ResearchQuest/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Security Policy](https://img.shields.io/badge/Security-Policy-blue.svg)](SECURITY.md)

A research workspace for a scholar's day: a **Today** plan you work through with Focus Studio, plus a library of papers, notes, ideas, and topics — synced to Supabase.

**Status:** Alpha — functional but evolving. Canonical live demo: [research-quest-wine.vercel.app](https://research-quest-wine.vercel.app). Custom domain [rq.arudchayan.com](https://rq.arudchayan.com) is an alias on the same Vercel project (`research-quest`). A second historical Vercel project exists; do not delete it without checking aliases.

## Features

- **Today** — Ordered checklist for the day (due-today tasks plus items you add). Start Focus, mark done, or drag to reorder.
- **Topics** — Organize entities into topics (Research, Area, or Subject). Automatic count tracking.
- **Papers** — Add papers via DOI lookup, Crossref search, or manual entry. Track reading status (To Read → Reading → Read). Import from BibTeX.
- **Notes** — Write rich markdown notes with tags, links to papers/ideas, and CodeMirror editor with syntax highlighting.
- **Ideas** — Track research ideas through stages (Seed → Developing → Supported → Mature). Link to supporting papers and notes.
- **Topics** — Organize entities into topics (Research, Area, or Subject) with automatic count tracking.
- **Tasks** — Free-form actions with due dates, priorities, and kinds (research, study, exercise, offline, …). Reading tasks can still be created when you add papers.
- **Focus Studio** — Timer-based sessions. Defaults to your Today queue; you can also type a freeform intention. After a task session you can mark it done. Notes and Focus stay mounted after the first visit so switching away does not reset the editor or timer.
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
ideas, topics, tasks, focus sessions, XP, streaks, quests, and
achievements into an in-memory Supabase-compatible client. Feeds are
intentionally empty in demo (no orphan inbox).

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
| `pnpm run build:prod` | Production build (type-check + `vite build`) |
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
| `PLAYWRIGHT_TEST_NO_SUPABASE` | No | Force config-error screen for E2E |

## Deploy (Vercel)

The app is a Vite SPA. **Canonical production** is Vercel project
`research-quest`, which serves both `https://research-quest-wine.vercel.app`
and `https://rq.arudchayan.com`. Prefer the wine URL as the public live demo
in docs and GitHub homepage. A second Vercel project (`research-quest-wine`)
exists historically — do not delete it without confirming aliases and DNS.

| Setting | Value |
|---------|-------|
| Root Directory | `researchquest` |
| Framework preset | Vite |
| Build command | `pnpm run build` |
| Output directory | `dist` |

Client-side routes (e.g. `/topics/topic-ai-agents`) survive a full-page
refresh via the SPA fallback rewrite in `researchquest/vercel.json`
(`/(.*)` → `/index.html`).

### Required environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL (`https://your-project-id.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

### Edge-function CORS origins (Supabase Dashboard → Edge Functions → Secrets)

The `api`, `fetch-paper`, and `deep-research` functions only accept browser
origins listed in `ALLOWED_ORIGINS` (comma-separated). After each deploy, set
it to the deployed app origin, e.g.:

```
ALLOWED_ORIGINS=https://research-quest-wine.vercel.app
```

Without this, the functions fall back to the production app origins
(`https://research-quest-wine.vercel.app`, `https://rq.arudchayan.com`) plus
localhost. This is a server-side secret — it is not a `VITE_*` variable and
must not be added to Vercel.

Exact format: `ALLOWED_ORIGINS="https://app.example.com,https://preview.example.com"`

- Comma-separated; surrounding whitespace is trimmed and trailing slashes are
  stripped.
- Every entry must be `scheme://host` with no path and no wildcard (deployed
  apps use `https://`). In the `api` gateway shared helper, anything else is
  malformed: it is ignored and logged loudly in the function logs, and fails
  `check:cors` (a fully-malformed value is treated the same as unset).
  `fetch-paper` and `deep-research` still use their legacy per-function parsing
  with the same unset fallback plus a loud unset warning.
- When the secret is unset, the functions keep serving the fallback origins
  above and log a warning on cold start. To block that fallback entirely, call
  the fail-closed `requireAllowedOrigins()` from
  `supabase/functions/api/_shared/cors.ts` instead of `getAllowedOrigins()`.
- Validate before deploying (from `researchquest/`, with the secret exported):
  `ALLOWED_ORIGINS="..." pnpm run check:cors -- --strict`.

## Security

See [SECURITY.md](SECURITY.md) for private vulnerability reporting. Do not commit
`.env` files, credentials, or service-role keys. Vite embeds every `VITE_*`
value in the browser bundle, so client configuration must never contain account
passwords or privileged secrets. The `create-admin-user` edge function is a
**410 Gone stub** (`verify_jwt = true`); keep it deployed so a catch-all
deploy cannot revive the old Admin API. Create users from the Supabase
Dashboard or CLI.

## Performance Notes

- **Code splitting**: Views are lazy-loaded. React, Supabase, UI icons, and CodeMirror are split into separate chunks.
- **CSS containment**: Sidebars use `contain: layout style paint` for layout isolation.
- **Zustand shallow selectors**: Components use `useShallow` to prevent unnecessary re-renders.
- **Content visibility**: Off-screen content uses `content-visibility: auto`.
- **Bundle**: ~80KB gzipped for main app (excluding CodeMirror which loads on demand).

## Browser Support

Modern browsers (Chrome, Firefox, Safari, Edge). No IE11 support.

## Database

21 PostgreSQL tables with Row-Level Security (RLS). Schema snapshots live in
`supabase/tables/` (one file per table, including the four `topic_*` junction
tables). Apply `supabase/migrations/` in filename order for the live schema.

Edge functions in `supabase/functions/` (Deno runtime):
- `api` — Agent API gateway for scoped entity, feed, and key management
- `fetch-paper` — Crossref DOI/query search
- `deep-research` — Deep research orchestration
- `create-admin-user` — **410 Gone stub** (keep deployed; `verify_jwt = true`)

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

Sequenced **Trust → Loop → Palette → Scale → Moat → Polish**. Each phase
lands only when the previous phase's exit checks stay green
(`test:run` + `build` + chromium e2e + axe sweep).

- **Trust (current)** — Auth + data authority + quality gates: demo-mode
  honesty, RLS-backed stores, secret scanning, frozen lockfile installs,
  systematic axe (WCAG 2.1 AA) + authenticated CRUD/realtime/isolation e2e.
- **Loop** — Daily research loop: topics → papers → notes → focus sessions
  with gamification feedback and the first-run seeded topic.
- **Palette** — Command palette, themes, and personalization (zen mode,
  focus studio) over the trusted loop.
- **Scale** — Feeds + collaboration: feed source/RSS management UI and
  scheduled ingest, collaborative research sessions, mobile-optimized view.
- **Moat (PDF/Zotero/offline)** — PDF workspace, Zotero/Mendeley import,
  bibliography export (BibTeX, CSL), offline support / PWA.
- **Polish** — Analysis / adversarial review workspace (experimental code
  exists, not productized), performance budgets, final a11y pass.

Quality gates that ship with every phase:

- `pnpm run test:e2e:axe` — systematic axe sweep (all main views +
  focus-trap/tab-order/contrast/reduced-motion).
- `pnpm run test:e2e` — chromium e2e (CI-fast default).
- `pnpm run test:e2e:matrix` — nightly Firefox/WebKit/mobile matrix
  (`RQ_E2E_MATRIX=1`; on Windows PowerShell use
  `$env:RQ_E2E_MATRIX=1; pnpm exec playwright test`).

## License

MIT — see [LICENSE](LICENSE).

---

Built with React, Supabase, and lots of coffee.
