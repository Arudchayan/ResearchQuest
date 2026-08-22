# Task 20 — Dev/Test UI Showcase

## Files Created

### `src/components/showcase/Showcase.tsx`
- Lazy-loaded default export, only imported when `import.meta.env.DEV` is `true`
- Renders every shared UI primitive across 12 sections:

| Section | Primitives | data-testid pattern |
|---|---|---|
| 1. Typography Scale | hero, title, subtitle, body-lg, body, small, caption, code | `showcase-text-{level}` |
| 2. Surface Variants | bg-base, bg-surface, bg-elevated, bg-layer-3 | `showcase-surface-{name}` |
| 3. Feedback Variants | success, warning, purple (info/accent) | `showcase-feedback-{name}` |
| 4. Buttons | 6 variants × 2 states + 4 sizes + icons/loading | `showcase-button-{variant}`, `-size-{size}`, `-disabled-{variant}` |
| 5. Card | full Card composition + minimal variant | `showcase-card-{part}` |
| 6. Input | default, with-value, disabled, focused | `showcase-input-{state}` |
| 7. Form Controls | Label+Input, disabled, search, with-button | `showcase-form-control-{name}` |
| 8. Tooltip | side=top, side=right, icon-only trigger | `showcase-tooltip-{side}` |
| 9. Dialogs | ConfirmDialog (danger/warning/info), FormDialog | `showcase-dialog-open-{variant}` |
| 10. Skeleton | 11 skeleton variants (base, note, paper, idea, task, list, sidebar, search, empty-state, app-loading, editor) | `showcase-skeleton-{name}` |
| 11. ErrorFallback | InlineError, NetworkError, ErrorFallback | `showcase-error-{name}` |
| 12. Not Found | empty-state card with icon + message | `showcase-notfound-{part}` |

- Every interactive/visual element has a stable `data-testid` attribute
- Dialogs use local `useState` for open/close toggling
- Wrapped in `Section`/`SubSection` layout components for scannable test IDs

### `src/App.tsx` (modified)
- Added lazy import for Showcase gated by `import.meta.env.DEV`:
  - In production builds, `ShowcaseLazy` is `null` and the import is tree-shaken
- Added route handler for `/showcase` URL path, also gated by `import.meta.env.DEV`
- Added rendering branch in `routeContent` for the showcase view

## Files NOT Modified
- `src/lib/router.ts` — no changes to production routing types or logic
- `src/components/ui/*` — no changes to existing primitives
- `tailwind.config.js`, `vite.config.ts`, `tsconfig*.json` — no config changes
- No HTML files, no build configuration

## Verification
- `pnpm exec tsc -b --noEmit` — passes clean (0 errors)
- `lsp_diagnostics` on both changed files — 0 diagnostics
