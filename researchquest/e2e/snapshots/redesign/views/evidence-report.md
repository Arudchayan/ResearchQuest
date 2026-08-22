# Luxe Scholar redesign — W3 visual evidence

Generated 2026-08-05 against `http://127.0.0.1:4199` with Chrome, `RQ_VISUAL_QA=1`, at 375/768/1280px in light and dark themes.

## Coverage

- 48 fresh rest-state PNGs: 7 views + `/showcase` × 3 viewports × 2 themes.
- `qa-matrix.json` contains the full automated diagnostics; `dashboard-qa.json` is the later dashboard re-capture after the test-store profile was hydrated.
- All captures render the requested route content; no auth/config screen remains.

## Findings

| View | 375 light | 375 dark | 768 light | 768 dark | 1280 light | 1280 dark |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Pass | Pass | Pass | Pass | Pass | Pass |
| Notes | Polish: 1×1 unfocused skip link; Create Note CTA fully visible/reachable; list/editor are intentionally exclusive on mobile | Same | Polish: collapsed tablet editor placeholder is intentionally hidden | Same | Pass | Pass |
| Papers | Polish: `sr-only` skip link measured 1×1 while unfocused | Same | Pass | Pass | Pass | Pass |
| Ideas | Polish: `sr-only` skip link measured 1×1 while unfocused | Same | Pass | Pass | Pass | Pass |
| Tasks | Polish: `sr-only` skip link measured 1×1 while unfocused | Same | Pass | Pass | Pass | Pass |
| Focus Studio | Polish: `sr-only` skip link measured 1×1 while unfocused | Same | Pass | Pass | Pass | Pass |
| Topics | Polish: 1×1 unfocused skip link; mobile detail pane hidden until a topic is selected; list empty state visible | Same | Pass | Pass | Pass | Pass |
| Showcase | Polish: `sr-only` skip link measured 1×1 while unfocused | Same | Pass | Pass | Pass | Pass |

### Blocking checks

- **No confirmed blocking visual issues were found in the current captures.** `scrollWidth === innerWidth` for all 48 states; no offscreen controls or text/background collisions were reported.
- The first matrix run recorded Dashboard as blank because the test-only user was not yet hydrated into the Zustand profile store. The six Dashboard PNGs were recaptured with the exposed `__APP_STORE__` test hook and now contain the full Dashboard (`dashboard-qa.json`, heading `Good afternoon, Scholar`). No production fix was needed.
- Notes' hidden editor at `<lg` is deliberate master/detail behavior in `NotesView.tsx:98`; the Notes list and editor are intentionally exclusive on mobile, so the placeholder remains in the DOM but is not painted until a note is selected. The final 375px light/dark captures show the Create Note CTA fully visible and reachable. This is an intentional state, not a blocking regression.
- Topics' mobile detail pane is hidden until a topic is selected; the final 375px light/dark captures show the topic list empty state. Both corrected mobile findings are resolved in the rendered PNGs.

### Global observations

- The 1×1 `Skip to content` result is the expected unfocused `sr-only focus:not-sr-only` pattern, not a touch-target defect.
- Some unused font weights report `unloaded` at narrow widths; the active rendered text remains visible and no contrast/layout failure was observed. No safe view-owned fix was justified.

## Fixes

No source fixes applied. No blocking visual regression was confirmed, and no prohibited/shared files were touched.

## Verification

- Fresh capture runner: **48/48 PNGs captured**.
- Dedicated `redesign-visual.spec.ts`: reaches the font gate but fails its existing `document.fonts` assertion for unused weights (`Inter 500/600`, `JetBrains Mono 400`, `Playfair Display 400`); the spec was not modified.
- Independent read-only visual QA passes A and B: no confirmed blocking layout, overflow, contrast, or content-rendering defect in the current PNGs.
- LSP/tests/build: no source files changed, so source diagnostics and affected-view test reruns were not applicable.
