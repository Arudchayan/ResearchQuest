# Public alpha release checklist

Do not change repository visibility or publish `v0.1.0-alpha` until every
blocking item is complete.

## Security

- [ ] Rotate or revoke every Supabase credential that existed before the history scrub.
- [ ] Confirm the full-history TruffleHog job passes.
- [ ] Confirm `pnpm audit --audit-level=high` passes or document accepted risk.
- [ ] Verify the deployed project contains no account passwords or privileged secrets in `VITE_*` variables.

## Quality gates

- [ ] CI `build` job passes on the release commit.
- [ ] CI `edge-api` job passes on the release commit.
- [ ] Vercel production deployment succeeds.
- [ ] Demo workspace completes the documented first-run flow.

## Repository settings

- [ ] Set description: “An open-source research workspace for papers, notes, ideas, tasks, and focus sessions.”
- [ ] Set homepage to `https://research-quest-wine.vercel.app` (canonical live demo). Keep `https://rq.arudchayan.com` as an additional alias on Vercel project `research-quest`. Do not delete the historical Vercel twin without checking aliases.
- [ ] Add topics: `research`, `knowledge-management`, `react`, `typescript`, `supabase`, `open-source`.
- [ ] Make the repository public.
- [ ] Protect `master`: require pull requests and passing CI, and block force pushes and deletion.
- [ ] Enable private vulnerability reporting.
- [ ] Enable GitHub Secret Scanning and push protection (currently off; CI TruffleHog does not replace this).
- [ ] Enable Dependabot security updates (distinct from version-update PRs in `.github/dependabot.yml`).

## Release

- [ ] Replace the `TBD` date in `CHANGELOG.md`.
- [ ] Create signed tag `v0.1.0-alpha`.
- [ ] Publish a GitHub prerelease from the changelog.
