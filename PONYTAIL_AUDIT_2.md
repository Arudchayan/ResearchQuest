# ponytail-audit — ResearchQuest (round 2)

Fresh scan post-iteration-1 (commit `f87f304` + pending tree). Ranked, biggest cut first.
Verified by import-graph scan (`grep -rln` across `src`); iteration-1 findings excluded.

- `delete:` 27 tracked `.wt/*` gitlink entries (mode 160000, no `.gitmodules`) — worktree-scratch submodule pointers that clone as empty dirs. Nothing. [/.wt/]
- `delete:` `useGamificationDashboard` — zero callers anywhere (Dashboard/App read the gamification store directly); no test imports it. Nothing. [-80 lines] [researchquest/src/hooks/useGamificationDashboard.ts]
- `yagni:` `usePaperSearchInternal.ts` — 70-line stateful wrapper with exactly one caller (AddPaperView); fold its five useState blocks into that caller or into `usePapers`. Inline it. [~-40 lines] [researchquest/src/hooks/usePaperSearchInternal.ts]
- `delete:` Second Playwright config `playwright.redesign.config.ts` — no script, workflow, or doc invokes it; `e2e/redesign-visual.spec.ts` already runs (and self-skips) under the default config. Use `playwright.config.ts`. [-32 lines] [researchquest/playwright.redesign.config.ts]
- `yagni:` Strict-gate canary fixtures + `typecheck:strict` script enforced by nothing — `fail.fixture.ts`/`pass.ts` prove a gate CI never runs. Wire `pnpm run typecheck:strict` into `ci.yml`, or delete the fixtures and the script. [-30 lines if dropped] [researchquest/src/strict-gate/, researchquest/package.json]
- `yagni:` Triple SPA-rewrite configs shipped for three different hosts (`_redirects` Netlify, `vercel.json`, `.htaccess` Apache) — only one can be the real deploy target. Keep the matching one. [~-20 lines] [researchquest/public/]
- `yagni:` `pnpm-workspace.yaml` `onlyBuiltDependencies` still lists `deno` and `supabase` after both packages left `package.json` (keep `esbuild`). Drop the two stale entries. [-2 lines] [researchquest/pnpm-workspace.yaml]
- `delete:` Stray screenshot `auth-gate-mobile.png` at repo root — referenced by no doc, code, or workflow. Nothing. [/auth-gate-mobile.png]

Kept deliberately: `demoSupabase`/`demoData` (README-documented demo mode), cmdk/radix/virtual/dompurify/rehype-sanitize (all imported), `@fontsource/playfair-display` (backs `font-serif` classes), zen-mode store slice (editor + shell use it), `components.json` (shadcn CLI).

net: -200 lines, -0 deps possible.
