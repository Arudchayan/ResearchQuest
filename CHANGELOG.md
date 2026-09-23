# Changelog

All notable changes to ResearchQuest will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Topics sidebar opens `/topics` (index). First-run still deep-links to
  `/topics/topic-ai-agents`; other topic URLs stay intentional.
- DOI lookup for `10.48550/arXiv.1706.03762` returns Attention Is All You
  Need (demo fetch-paper matched by DOI; Crossref/client reject mismatches).
- Creating a task no longer duplicates the row (submit guard + id-deduped
  optimistic/realtime apply).
- Note sidebar titles follow the saved/derived title instead of staying
  "Untitled Note" after edit.
- Dark mode tokens apply to AppShell and sidebar together (`html` class +
  shell `effectiveTheme`).
- Feeds chrome is hidden; `/feeds` is an alpha empty state when there are
  0 sources (filters/promote/refresh stay hidden; orphan items are not shown
  and are not mass-deleted).
- Demo first-run uses the full workspace shell with a demo banner, exit CTAs,
  and a single OnboardingGuide. Papers/tasks/ideas no longer each mount a
  copy of the guide.

### Added

- Systematic axe-core sweep (WCAG 2.1 AA) over all main views plus
  focus-trap, tab-order, contrast, and reduced-motion interaction proofs
  (`researchquest/e2e/a11y.ts`, `axe-views.spec.ts`,
  `axe-interactions.spec.ts`; run with `pnpm run test:e2e:axe`).
- Authenticated CRUD, realtime live-update/scoping, and multi-session
  isolation e2e against the demo workspace (`authenticated-crud.spec.ts`,
  `realtime-updates.spec.ts`, `multi-user-isolation.spec.ts`).
- Nightly-only Firefox/WebKit/mobile-chrome Playwright projects gated
  behind `RQ_E2E_MATRIX=1` (`pnpm run test:e2e:matrix`); CI chromium stays
  fast by default.
- README roadmap sequencing (Trust → Loop → Palette → Scale →
  Moat → Polish) with per-phase quality gates.

### Security

- Mirrored production `harden_rpc_security_definer`: search/save RPCs require
  `auth.uid()`, reject spoofed user ids, and pin `search_path=public`.
  EXECUTE revoked on `ensure_user_id`, `handle_new_user`, and
  `evaluate_user_streaks` from PUBLIC/anon/authenticated.
- `create-admin-user` stays a 410 Gone stub with `verify_jwt = true`.
- Edge CORS fallback includes `https://research-quest-wine.vercel.app` and
  `https://rq.arudchayan.com`.
- Removed the client-bundled test-login credential path.
- Added full-history secret scanning and dependency auditing to pull requests.
- Pinned GitHub Actions dependencies to immutable commit SHAs.

### Changed

- Demo vs live auth copy: demo is sample data on this device; sign-in is
  for an existing live account.
- Focus Studio Start stays disabled until a target is selected, with hint
  copy. Onboarding on Focus is opt-in via Tips.
- Canonical live demo is `https://research-quest-wine.vercel.app`; table
  docs now include all 21 tables (`topic_*` junctions). Unused
  `@types/react-router-dom` removed.
- Standardized CI on Node.js 22 and pnpm 10.12.1.
- Added reproducible frozen-lockfile installs, workflow concurrency, and timeouts.

## [0.1.0-alpha] - TBD

Initial public alpha release.

### Exit criteria

- [ ] Scholar Access gate + `Use demo workspace` first-run loop green
      (`pnpm run test:first-run`).
- [ ] Unit/integration suite green (`pnpm run test:run`) with coverage
      thresholds held.
- [ ] Production build green (`pnpm run build`, `build:prod`).
- [ ] Chromium e2e green: smoke, responsive, authenticated CRUD, realtime,
      multi-session isolation.
- [ ] Systematic axe sweep green (WCAG 2.1 AA, all main views +
      focus-trap/tab-order/contrast/reduced-motion).
- [ ] Nightly matrix configured (Firefox/WebKit/mobile via
      `RQ_E2E_MATRIX=1`); no open critical axe or security findings.
- [ ] Roadmap sequencing published (Trust → Loop → Palette → Scale →
      Moat(PDF/Zotero/offline) → Polish).
