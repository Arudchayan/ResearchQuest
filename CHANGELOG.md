# Changelog

All notable changes to ResearchQuest will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

- Removed the client-bundled test-login credential path.
- Added full-history secret scanning and dependency auditing to pull requests.
- Pinned GitHub Actions dependencies to immutable commit SHAs.

### Changed

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
