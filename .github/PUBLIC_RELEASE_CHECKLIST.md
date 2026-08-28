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
- [ ] Add topics: `research`, `knowledge-management`, `react`, `typescript`, `supabase`, `open-source`.
- [ ] Make the repository public.
- [ ] Protect `master`: require pull requests and passing CI, and block force pushes and deletion.
- [ ] Enable private vulnerability reporting.

## Release

- [ ] Replace the `TBD` date in `CHANGELOG.md`.
- [ ] Create signed tag `v0.1.0-alpha`.
- [ ] Publish a GitHub prerelease from the changelog.
