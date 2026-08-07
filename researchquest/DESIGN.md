# ResearchQuest — Luxe Scholar Design System

> **Contract status:** prescriptive for the seven primary views. This document is the implementation contract for the redesign; later view work must use these tokens, patterns, states, and responsive rules rather than inventing local styling.

## 1. Atmosphere & Identity

ResearchQuest is a warm editorial research workspace: ivory and charcoal surfaces, crisp hairline divisions, and deliberately sharp 2–8px geometry make dense scholarly work feel composed rather than decorative. Playfair Display gives headings the authority of a printed title page; Inter keeps controls quiet and legible; JetBrains Mono makes timers and measured progress feel precise. The signature is **paper hierarchy without paper clutter**: `bg-base` is the canvas, `bg-surface` is the working sheet, `bg-elevated` is the supporting layer, and borders are used as restrained editorial rules.

The redesign covers exactly the seven existing navigation views: **Dashboard, Notes, Papers, Ideas, Tasks, Topics, and Focus Studio**. Preserve current routes, selection behavior, data loading, dialogs, editor flows, and shell/sidebar behavior. This is a visual and interaction-polish contract, not an information-architecture or data-flow change.

**Primary sources:** [`src/index.css`](src/index.css) theme blocks; [`tailwind.config.js`](tailwind.config.js) `theme.extend`; [`src/components/layout/v2/AppShell.tsx`](src/components/layout/v2/AppShell.tsx); [`src/components/layout/v2/Sidebar.tsx`](src/components/layout/v2/Sidebar.tsx).

## 2. Color & Semantic Aliases

### Palette

All visual color values belong in the CSS variables below. View JSX must consume the Tailwind aliases, never add a view-level hex, RGB value, or new hue family. Light values are declared in `:root`; dark values are declared in `.dark`. Dark mode remains class-driven through `darkMode: ['class']`.

| Role | CSS token / Tailwind mapping | Light | Dark | Rule |
| --- | --- | --- | --- | --- |
| Primary soft | `--primary-50` → `primary-50` | `#F4F4F0` | `#1F1F1E` | Quiet selected and inverted-adjacent surfaces |
| Primary wash | `--primary-100` → `primary-100` | `#E6E6DF` | `#2C2C2A` | Secondary ink wash |
| Primary ink | `--primary-500` → `primary-500` | `#1C1C1A` | `#EDEDE4` | Primary action, selected state, progress |
| Primary strong | `--primary-600` → `primary-600` | `#141413` | `#F4F4F0` | Primary hover/pressed state |
| Primary maximum | `--primary-900` → `primary-900` | `#000000` | `#FFFFFF` | Maximum contrast only |
| Canvas | `--bg-base` → `bg-bg-base` | `#FDFDFB` | `#080808` | App and view background |
| Working surface | `--bg-surface` → `bg-bg-surface` | `#FFFFFF` | `#121211` | Cards, list rows, dialogs |
| Elevated surface | `--bg-elevated` → `bg-bg-elevated` | `#F7F7F4` | `#1A1A19` | Hover, filters, subordinate panels |
| Layer three | `--bg-layer-3` → `bg-bg-layer-3` | `#FFFFFF` | `#222220` | Stacked or nested surface |
| Primary text | `--text-primary` → `text-text-primary` | `#111111` | `#F0F0E8` | Titles and body copy |
| Secondary text | `--text-secondary` → `text-text-secondary` | `#4A4A46` | `#A0A09A` | Supporting copy |
| Tertiary text | `--text-tertiary` → `text-text-tertiary` | `#6B6B63` | `#A8A89F` | AA-safe warm metadata, placeholders, and disabled copy |
| Hairline | `--border-subtle` → `border-border-subtle` | `#8C8C84` | `rgba(255, 255, 255, 0.34)` | Quiet 1px separators with approximately 3:1 non-text contrast against the paper surfaces; never the sole component boundary |
| Boundary | `--border-moderate` → `border-border-moderate` | `#8C8C84` | `rgba(255, 255, 255, 0.34)` | At least 3:1 non-text contrast for controls, cards, and visible edges |
| Strong boundary | `--border-strong` → `border-border-strong` | `#6B6B63` | `rgba(255, 255, 255, 0.48)` | Active or high-emphasis edge with preserved warm-neutral hierarchy |
| Success | `--success` → `success` | `#2E5C3E` | `#679E7B` | Completed/healthy state |
| Success wash | `--success-bg` → `success-bg` | `#EEF4F0` | `rgba(103, 158, 123, 0.1)` | Success badge background |
| Success hover/foreground | `--success-hover`, `--success-foreground` | `#234A31` / `#FFFFFF` | `#78B78E` / `#080808` | Interactive success treatment |
| Warning | `--warning` → `warning` | `#945A17` | `#D19C4C` | Caution and high priority |
| Warning wash/hover | `--warning-bg`, `--warning-hover` | `#FDF8ED` / `#7D4C13` | `rgba(209, 156, 76, 0.1)` / `#E0B464` | Warning states |
| Purple | `--purple` → `purple` | `#623D70` | `#A276B3` | Mature/auxiliary state |
| Purple wash/hover | `--purple-bg`, `--purple-hover` | `#F8F5FA` / `#512F5D` | `rgba(162, 118, 179, 0.1)` / `#B589C3` | Purple states |
| Destructive | `--destructive` → `destructive` | `#A13F34` | `#D9877E` | Delete, overdue, failure |
| Destructive wash/hover | `--destructive-bg`, `--destructive-hover` | `#FDF1EF` / `#873329` | `rgba(217, 135, 126, 0.12)` / `#E6A19A` | Destructive states |
| Focus | `--focus` → `focus` | `#1C1C1A` | `#EDEDE4` | Visible keyboard ring |
| Informational | `--info`, `--info-bg`, `--info-hover`, `--info-foreground` → `info`, `info-bg`, `info-hover`, `info-foreground` | `#1C1C1A` / `#F4F4F0` / `#141413` / `#FDFDFB` | `#EDEDE4` / `#2C2C2A` / `#F4F4F0` / `#121211` | Limited informational indicators and dialog actions; not a general accent |
| Scrim | `--overlay` → `overlay` | `rgba(17, 17, 17, 0.5)` | `rgba(0, 0, 0, 0.6)` | Modal/drawer backdrop |

### Required semantic aliases

These aliases are deliberately mappings of the existing muted warning, primary, success, purple, and destructive palette. They are implemented in both theme blocks in [`src/index.css`](src/index.css) and exposed as nested Tailwind v3 colors in [`tailwind.config.js`](tailwind.config.js). The generated static class names are `bg-stage-seed`, `text-stage-seed`, `hover:bg-stage-seed-hover`, `text-stage-seed-foreground`, and the equivalent names for every alias.

| Semantic alias | Palette source | Light default / wash / hover / foreground | Dark default / wash / hover / foreground |
| --- | --- | --- | --- |
| `stage.seed` | warning | `#945A17` / `#FDF8ED` / `#7D4C13` / `#FFFFFF` | `#D19C4C` / `rgba(209, 156, 76, 0.1)` / `#E0B464` / `#121211` |
| `stage.developing` | primary | `#1C1C1A` / `#F4F4F0` / `#141413` / `#FDFDFB` | `#EDEDE4` / `#1F1F1E` / `#F4F4F0` / `#080808` |
| `stage.supported` | success | `#2E5C3E` / `#EEF4F0` / `#234A31` / `#FFFFFF` | `#679E7B` / `rgba(103, 158, 123, 0.1)` / `#78B78E` / `#080808` |
| `stage.mature` | purple | `#623D70` / `#F8F5FA` / `#512F5D` / `#FFFFFF` | `#A276B3` / `rgba(162, 118, 179, 0.1)` / `#B589C3` / `#080808` |
| `priority.high` | warning | `#945A17` / `#FDF8ED` / `#7D4C13` / `#FFFFFF` | `#D19C4C` / `rgba(209, 156, 76, 0.1)` / `#E0B464` / `#121211` |
| `priority.medium` | primary | `#1C1C1A` / `#F4F4F0` / `#141413` / `#FDFDFB` | `#EDEDE4` / `#1F1F1E` / `#F4F4F0` / `#080808` |
| `priority.low` | success | `#2E5C3E` / `#EEF4F0` / `#234A31` / `#FFFFFF` | `#679E7B` / `rgba(103, 158, 123, 0.1)` / `#78B78E` / `#080808` |
| `priority.overdue` | destructive | `#A13F34` / `#FDF1EF` / `#873329` / `#FFFFFF` | `#D9877E` / `rgba(217, 135, 126, 0.12)` / `#E6A19A` / `#121211` |

Use the `bg` value for a quiet chip or row wash, the default value for semantic text and indicators, the hover value for an interactive semantic control, and the foreground value only on the solid semantic background. Do not make semantic color decorative; every colored mark must communicate state, priority, focus, or action.

Other color behavior remains locked: selection uses `primary-500` on `bg-base`; scrollbars use `border-moderate` and `border-strong`; overlays use `overlay`. **Source:** `src/index.css` `::selection`, scrollbar, and theme blocks.

## 3. Typography

### Font roles

| Role | Tailwind utility | Stack | Use |
| --- | --- | --- | --- |
| UI/body | `font-sans` | `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | Controls, labels, body, navigation |
| Display/editorial | `font-serif` | `Playfair Display, Merriweather, Georgia, 'Times New Roman', serif` | Page headers, view titles, editorial emphasis |
| Metrics/code | `font-mono` | `JetBrains Mono, Fira Code, 'Courier New', monospace` | Focus timer, durations, counts, code |

The app body uses Inter. Playfair Display is a deliberate display voice, not a default for every label. JetBrains Mono is reserved for measurable values and code-like content. Do not introduce another font family.

### Type scale

| Token | Size / line height | Tracking | Use |
| --- | --- | --- | --- |
| `text-hero` | `3.5rem / 1.05` | `-0.03em` | Rare large display only |
| `text-title` | `2.25rem / 1.15` | `-0.02em` | Dashboard/page title |
| `text-subtitle` | `1.5rem / 1.3` | `-0.01em` | View and section title |
| `text-body-lg` | `1.125rem / 1.65` | default | Lead copy and empty-state title |
| `text-body` | `1rem / 1.6` | default | Default body and editor copy |
| `text-small` | `0.875rem / 1.5` | `0.01em` | Supporting UI and metadata with room |
| `text-caption` | `0.75rem / 1.4` | `0.02em` | Compact labels and metadata only |
| `text-code` | `0.875rem / 1.4` | default | Code and technical values |

Keep normal body copy at or above 14px. Use `text-caption` only for short metadata, never for instructions or long prose. Headlines may use `clamp()` when a view title could wrap beyond three lines.

**Source:** font imports and body rule in [`src/index.css`](src/index.css); family and type scale in [`tailwind.config.js`](tailwind.config.js).

## 4. Spacing, Grid & Responsive Shell

### Spacing architecture

The existing 8-point rhythm is authoritative, with 2px and 4px optical adjustments:

| Tailwind key | Value | Use |
| --- | --- | --- |
| `0.5` | 2px | Optical correction only |
| `1` | 4px | Icon/label and fine alignment |
| `2` | 8px | Compact groups |
| `3` | 12px | Controls and metadata |
| `4` | 16px | Default section/card padding |
| `5` | 20px | Comfortable inner spacing |
| `6` | 24px | Card and view padding |
| `8` | 32px | Group separation |
| `10` | 40px | Major internal break |
| `12` | 48px | View section break |
| `16` | 64px | Page rhythm |
| `20` | 80px | Major separation |
| `24` | 96px | Rare page-level separation |
| `32` | 128px | Maximum configured general gap |

Do not add arbitrary spacing. Every margin, padding, and gap must use this scale or an existing layout token. Keep the current sharp geometry: `rounded-sm` 2px, `rounded-control`/`rounded-md` 4px, `rounded-lg` 6px, `rounded-surface`/`rounded-xl` 8px. `rounded-full` is reserved for avatars, progress tracks, and genuinely circular controls; semantic chips use `rounded-control` unless the view contract explicitly calls for a pill.

### Shell and breakpoints

- The `AppShell` owns `min-h-[100dvh]`, the desktop sidebar, mobile navigation drawer, optional right context panel, and the `main#main-content` landmark. View code must not re-create the shell.
- Tailwind breakpoints remain `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, and `2xl: 1440px`.
- Containers are centered with 16px default padding, 24px at `md`, and 32px at `lg`/`xl`; Dashboard is capped at `max-w-7xl`.
- Desktop left navigation is 256px (`w-64`); Notes and Topics list rails are 320px (`w-80`); Papers detail is 500px; Ideas detail is 450px; the right context panel is 320px (`w-80`).
- Use mobile-first single-column flow. At `md`, allow two-column collections where the content supports it. At `lg`/`xl`, restore split panes, drawers, and the Focus two-column workspace. Never rely on horizontal overflow for primary reading content.
- Every view must survive 375px width without horizontal page scroll. Collection boards may use an intentional inner horizontal scroller only when the board grammar requires it, as in Ideas.
- Interactive touch targets are at least 44×44px on mobile. Desktop compact icon buttons may use the existing 36px `Button` icon size only when the surrounding control still has a clear accessible label and the target is not touch-critical.

**Sources:** `tailwind.config.js` container, screens, spacing, radius, and viewport extensions; `src/components/layout/v2/AppShell.tsx` shell composition; `src/App.tsx` route wrappers.

## 5. Seven-view Contracts

### Shared view frame

Every view starts with a clear `PageHeader` or a view-specific list header, then separates working content from supporting controls with a hairline. Use `bg-base` for the view canvas, `bg-surface` for active work, and `bg-elevated` for filters, hover, or subordinate regions. Each asynchronous region has an explicit loading, empty, and error state. Keep the existing route and selection semantics intact.

### Dashboard — orient, then choose one next action

- Keep the editorial greeting header, compact library counts, recent/active collection sections, reading list, due-soon tasks, and progress cards. Do not add a new dashboard information architecture.
- Use a `PageHeader` with a serif title and two actions: secondary task review and primary focus session. Actions wrap cleanly below the title at narrow widths.
- Use a single-column flow below `lg`; use the existing two-column content split at `lg`; keep Progress as the final full-width section.
- Collection sections use a hairline section heading with a text action, then `Card`-like rows. Row titles use primary text; previews use secondary text; dates and counts use tertiary/caption or mono only when they are measured values.
- Empty collection sections use `EmptyState` with one direct create/open action. Loading uses the matching `ListSkeleton`; sync failures use `InlineError` with retry.
- Progress cards may use primary, warning, and purple semantic accents, but the accent is a state label or edge, never a decorative color wash.

**Source:** [`src/components/dashboard/Dashboard.tsx`](src/components/dashboard/Dashboard.tsx), route wrapper in [`src/App.tsx`](src/App.tsx).

### Notes — list-to-editor workspace

- Preserve the 320px list rail and full-height editor split on `lg+`. The rail contains title, create/export actions, search, sort, tag chips, and a virtualized list.
- On mobile, show either the list or the editor, never both compressed side by side. Selecting a note opens the editor; Back returns to the list and restores focus to the selecting control.
- The editor remains the quietest surface: `bg-base` canvas, `bg-surface` writing surface, hairline toolbars, and serif only where editorial content calls for it. Do not decorate the writing area with gradients or large cards.
- Selected note rows use primary-soft background and a visible focus/selection edge. Search and tag state must be discoverable and keyboard reachable.
- Use `NoteCardSkeleton`/`ListSkeleton` for list loading, `NotesEmptyState` for no notes or no matches, and `InlineError` for sync failures.

**Sources:** [`src/components/notes/NotesView.tsx`](src/components/notes/NotesView.tsx), [`src/components/notes/NotesSidebar.tsx`](src/components/notes/NotesSidebar.tsx), [`src/components/editor/MarkdownEditor.tsx`](src/components/editor/MarkdownEditor.tsx).

### Papers — scan, filter, and open a reference

- The header owns the serif `Research Library` title, supporting line, Export action, and primary Add Paper action. Search and sort remain a separate control row.
- Paper cards use `Card` anatomy: source/icon mark, title, authors, year, DOI, and reading-status `Badge`. Use status semantics as a quiet chip: `To Read` is neutral, `Reading` uses primary, and `Read` uses success.
- The collection grid is one column below `md`, two columns from `md`, and three columns at `xl`; preserve the current virtualized row behavior and avoid changing data loading.
- Paper details use a 500px right drawer at `lg+` and a full-screen mobile detail surface with an explicit Back action. The drawer header is a hairline, not a floating rounded card.
- Add Paper remains a modal flow. Its overlay uses `overlay`, its surface uses `bg-surface`, and its content scrolls inside the modal without moving the page.
- Loading uses `PaperCardSkeleton`; no papers or no matches use `EmptyState`; sync failures use `InlineError`.

**Sources:** [`src/components/papers/PapersView.tsx`](src/components/papers/PapersView.tsx), [`src/components/papers/PaperCard.tsx`](src/components/papers/PaperCard.tsx), route wrapper in [`src/App.tsx`](src/App.tsx).

### Ideas — four-stage evidence board

- Preserve the four stages and their order: Seed → Developing → Supported → Mature. The stage color is semantic and must use `stage.seed`, `stage.developing`, `stage.supported`, or `stage.mature`; never use a raw palette utility.
- Keep four horizontal columns with an intentional inner scroller. Each column is 320px wide, uses `bg-elevated` as the lane surface, and has a sticky `bg-surface` lane header with a stage `Badge` and count.
- Idea cards use `Card` geometry with a clear title, clamped description, delete affordance, stage select, and Advance action. Keyboard activation must match pointer activation.
- At narrow widths, the board scrolls horizontally inside the view while the page itself remains stable. When an idea is selected, the detail surface replaces the board on mobile and becomes a 450px drawer at `lg+`.
- Use `ListSkeleton` for loading, a quiet dashed `EmptyState` per empty lane, and `InlineError` for sync failures. Create Idea remains a modal.

**Sources:** [`src/components/ideas/IdeasBoard.tsx`](src/components/ideas/IdeasBoard.tsx), [`src/components/ideas/ideaStages.ts`](src/components/ideas/ideaStages.ts), route wrapper in [`src/App.tsx`](src/App.tsx).

### Tasks — prioritize, complete, and recover

- Keep the existing header, progress bar, filter chips, category/project filters, search, sort, compact toggle, task list, and New/Edit Task dialog. Do not change task persistence or filtering semantics.
- Priority and due-date state use `priority.high`, `priority.medium`, `priority.low`, and `priority.overdue`. High is warning, medium is primary, low is success, and overdue is destructive. The category chip remains neutral unless a later contract adds a semantic role.
- Use `Card` rows with a stable checkbox target, title, optional description, priority chip, category chip, due date, Edit action, and Delete action. Completed rows reduce emphasis without losing readable contrast.
- Filters wrap into multiple rows on mobile; the task list remains a single readable column. The progress metric may use `font-mono` when displayed as a measured percentage/count.
- Loading uses `ListSkeleton`; no matching tasks use `EmptyState`; sync failures use `InlineError`; create/edit uses the existing form dialog pattern.

**Sources:** [`src/components/tasks/TaskManager.tsx`](src/components/tasks/TaskManager.tsx), [`src/components/tasks/TaskCard.tsx`](src/components/tasks/TaskCard.tsx), [`src/components/tasks/taskTypes.ts`](src/components/tasks/taskTypes.ts), route wrapper in [`src/App.tsx`](src/App.tsx).

### Topics — directory with contextual detail

- Preserve the 320px list panel and flexible detail panel. The list header contains title, export, create, search, and sort. The detail surface stays `bg-surface` and fills the remaining height.
- Topic rows and linked-content counts use primary/secondary/tertiary text hierarchy. Use the `Hash` icon as a structural mark, not a decorative illustration.
- On mobile, list and detail are mutually exclusive; selecting a topic opens detail and Back returns to the directory. At `md+`, the split view is allowed.
- Empty detail uses `EmptyState` centered in the available panel. Empty lists, loading, deletion undo, and sync failure retain their existing behavior and use the shared patterns.

**Sources:** [`src/components/topics/TopicsView.tsx`](src/components/topics/TopicsView.tsx), [`src/components/topics/TopicList.tsx`](src/components/topics/TopicList.tsx), [`src/components/topics/TopicDetailView.tsx`](src/components/topics/TopicDetailView.tsx), route wrapper in [`src/App.tsx`](src/App.tsx).

### Focus Studio — one deliberate session

- Preserve the single focus journey: choose a target, set a duration, start/pause/reset the timer, review the target, and optionally open it in its workspace. No new IA or timer behavior.
- Use a `PageHeader` with the Target mark, serif title, and short supporting copy. The workspace becomes a two-column layout at `xl`: the timer/target surface is wider, and the target/insight aside is narrower.
- Timers, durations, percentages, and XP values use `font-mono`. The timer is the focal metric; surrounding controls remain quiet and use the existing Button variants.
- Session state uses success for completion, primary for active selection/action, and warning only for attention. Do not use gradients for progress; use a semantic solid fill over a neutral track.
- Target groups are collapsible panels, not nested card stacks. Their headers and list rows require visible focus, `aria-expanded`, and `aria-pressed` where applicable.
- On mobile, stack the timer, selected-target preview, and target list. Loading uses skeleton groups; no targets and suggestions use concise empty/information states. Respect sound/notification control states without relying on color alone.

**Sources:** [`src/components/focus/FocusWorkspace.tsx`](src/components/focus/FocusWorkspace.tsx), [`src/components/focus/FocusTargetAside.tsx`](src/components/focus/FocusTargetAside.tsx), route wrapper in [`src/App.tsx`](src/App.tsx).

## 6. Reusable Patterns & States

### PageHeader

- **Structure:** semantic `<header>` with a `font-serif` title, optional supporting line, and an action group.
- **Spacing:** `gap-4`, `p-4` on mobile, `p-6` at `sm+`; actions wrap rather than overflow.
- **States:** action buttons expose default, hover, active, focus-visible, disabled, and loading states.
- **Rule:** use once per view; section headings use the smaller section-heading grammar rather than repeating a full page header.

### Badge / chip

- **Structure:** inline label with optional icon and optional count.
- **Geometry:** `rounded-control`, `px-2`, `py-0.5`, `text-caption`, medium/semibold weight. Reserve `rounded-full` for avatars, tracks, and explicitly circular UI.
- **Semantic variants:** neutral (`bg-elevated` + secondary text), `stage.*`, `priority.*`, success, warning, purple, and destructive. Use `bg` for wash, default for text/indicator, hover for interactive chips, and foreground only on a solid fill.
- **States:** static, selected, hover/focus when interactive, disabled when unavailable. Never rely on color alone; preserve the text label or icon.

### Card

- **Structure:** existing `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter` composition.
- **Surface:** `rounded-surface border border-border-moderate bg-bg-surface shadow-sm`; use `border-subtle` for internal hairlines and `bg-elevated` only for subordinate/hover state.
- **Spacing:** default `p-6`, compact list/card content `p-4`, metadata separated by `gap-2`/`pt-2`.
- **States:** default, hover with border/shadow refinement, active/selected with primary-soft edge, focus-visible for interactive cards, disabled with reduced emphasis, loading via skeleton, empty via EmptyState, error via InlineError.
- **Rule:** cards are working surfaces, not decorative nested containers. Do not stack a card inside a card unless the inner region has a distinct interaction boundary.

### EmptyState

- **Structure:** `role="status"`/`aria-live="polite"` wrapper, restrained icon mark, short title, one supporting sentence, and at most one primary action.
- **Surface:** use the current view surface; icon mark uses `bg-elevated` and tertiary/semantic icon color. Avoid large illustrations and vague copy.
- **Variants:** no data, no search matches, no filtered results, no selected detail. Say which condition is active and give the recovery action.

### Loading skeleton

- Use the existing `Skeleton`, `ListSkeleton`, `NoteCardSkeleton`, `PaperCardSkeleton`, `IdeaCardSkeleton`, `TaskCardSkeleton`, and `EditorSkeleton` shapes from [`src/components/ui/Skeleton.tsx`](src/components/ui/Skeleton.tsx).
- Skeletons use `bg-elevated`, `animate-pulse`, and the same geometry as the content they replace. Keep the layout stable; do not swap a full view to a spinner when a list skeleton is available.
- Containers expose `role="status"` and a useful `aria-label`; decorative skeleton children are `aria-hidden`.

### InlineError / error state

- Use `InlineError` for recoverable view-level sync failures: `destructive-bg` wash, destructive border/icon/text, and an optional retry action with focus ring.
- Use `ErrorFallback` for a full recoverable failure with a plain-language message, technical details behind disclosure, and Try Again/Go Home actions.
- Error copy names the failed operation and the recovery path. Never expose stack traces in the view.

### Focus ring

- Every interactive element has a visible keyboard state: `focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2`. Inputs may use `focus-visible:ring-2 focus-visible:ring-focus` when an outline would conflict with the field border.
- Never remove a focus indicator without replacing it with an equally visible tokenized treatment. Focus must survive both themes and adjacent semantic backgrounds.
- Dialogs, mobile drawers, and selected cards must preserve logical focus movement and return focus to the trigger on close.

### Button variants

Use the existing [`src/components/ui/button.tsx`](src/components/ui/button.tsx) variants and sizes:

| Variant | Use |
| --- | --- |
| `default` | One primary action per local region |
| `destructive` | Delete or irreversible action |
| `outline` | Secondary action with a clear boundary |
| `secondary` | Supporting action on a neutral surface |
| `ghost` | Toolbar/navigation affordance |
| `link` | Inline navigation or low-emphasis continuation |

The shared focus, disabled opacity, icon sizing, and transition behavior are authoritative. Do not recreate button variants with one-off class strings. Use `icon` only with an accessible label; use `min-h-11 min-w-11` for touch-critical view controls.

## 7. Motion & Surface

### Motion rules

| Motion | Timing | Allowed properties | Use |
| --- | --- | --- | --- |
| Micro | `200ms ease-out` | color, opacity, transform | Button/row feedback |
| Standard | `300ms ease-in-out` | color, opacity, transform | Theme, panel, tab, drawer state |
| Emphasis | `300ms cubic-bezier(0.16, 1, 0.3, 1)` | opacity + translateY | Dialog/section entry |
| XP feedback | `600ms ease-in-out` | opacity + translateY | Existing XP gain only |

- Animate only `transform`, `opacity`, `filter`, and color properties already covered by the theme transition. Never animate layout properties such as width, height, top, left, margin, or padding.
- Motion must communicate an action, state change, or hierarchy. No decorative bounce, hover motion on static content, or gratuitous gradient animation.
- Preserve the existing `animate-fade-in`, `animate-slide-in`, and `animate-xp-gain` utilities where their current state semantics fit. Use `content-visibility: auto` only for truly off-screen regions.
- `prefers-reduced-motion: reduce` disables non-essential movement through the existing global media query. Loading must remain understandable without animation; do not rely on pulse alone to communicate status.

### Surface and depth strategy

Use the existing mixed strategy: tonal paper hierarchy, hairline borders, and restrained shadows.

- `bg-base` → `bg-surface` → `bg-elevated` → `bg-layer-3` establishes depth.
- `border-subtle` separates adjacent regions; `border-moderate` marks controls and visible card boundaries; `border-strong` is reserved for active/high-emphasis state.
- `shadow-sm` is the default card lift; `shadow-md` is for dropdowns and standard elevation; `shadow-lg` is for dialogs/drawers; `shadow-hover` is an intentional hover lift only.
- No glassmorphism, purple-blue gradients, or diffuse shadows that erase the editorial hairline character.

**Sources:** `src/index.css` shadow and motion rules; `tailwind.config.js` box shadows, animations, durations, easing, and viewport utilities.

## 8. Accessibility Constraints, Current Debt & Handoff

### Constraints

- Target WCAG 2.2 AA: 4.5:1 minimum for normal text, 3:1 for large text and non-text indicators, visible focus on every interactive element, full keyboard reachability, and no color-only state communication.
- Use `text-tertiary` only with its measured warm-neutral values above; use `border-moderate` for component boundaries that require the documented 3:1 non-text contrast, reserving `border-subtle` for non-semantic hairlines.
- Keep body/UI copy at or above 14px. `text-caption` is metadata-only and must remain short.
- Every modal/drawer has an accessible label, Escape handling, a bounded focus path, and focus return. The AppShell mobile drawer already establishes this behavior and is the reference.
- Every async region exposes loading, empty, and recoverable error feedback. Error messages provide a next action.
- Respect `prefers-reduced-motion`; timers and progress remain legible without animation. Sound and notification preferences are communicated with labels and state, not color alone.
- Use semantic landmarks and controls: `main`, `header`, `nav`, `aside`, `button`, `a`, `label`, and native form controls. Icons are decorative when adjacent text is present and carry an accessible label when they are the only affordance.

### Corrected current-source debt inventory

The previous extraction-only draft claimed that Notes, Papers, Ideas, and Topics universally bypassed Luxe Scholar tokens with slate/blue palettes. That claim is stale: current top-level implementations use the Luxe Scholar `bg-*`, `text-*`, `border-*`, `primary-*`, `success`, `warning`, `purple`, `destructive`, and `focus` utilities. The redesign must preserve that progress while correcting the remaining local drift below.

| Current debt | Exact source | Contract correction / exit condition |
| --- | --- | --- |
| Task priority and category colors still bypass semantic aliases | [`src/components/tasks/TaskCard.tsx`](src/components/tasks/TaskCard.tsx), `getPriorityColor` and category badge | Replace raw red/amber/emerald/blue utilities with `priority.high`, `priority.medium`, `priority.low`, and `priority.overdue` mappings. Category remains neutral until a semantic role is approved. |
| Task controls still mix local geometry and direct white/dark utilities | [`src/components/tasks/TaskManager.tsx`](src/components/tasks/TaskManager.tsx) | Normalize later to `rounded-control`, shared Button variants, `text-bg-base`/alias foregrounds, and `focus` utilities; keep filter and form behavior unchanged. |
| Focus Studio still uses rounded-2xl/full/xl surfaces, gradient progress, and direct dark/white fallbacks | [`src/components/focus/FocusWorkspace.tsx`](src/components/focus/FocusWorkspace.tsx), [`src/components/focus/FocusTargetAside.tsx`](src/components/focus/FocusTargetAside.tsx) | Normalize later to 2–8px geometry, solid tokenized progress, shared buttons/chips, and the documented mono metric treatment; preserve timer behavior and target selection. |
| Notes/Papers/Ideas/Topics are tokenized but retain a few local radius/width exceptions | [`NotesSidebar.tsx`](src/components/notes/NotesSidebar.tsx), [`PapersView.tsx`](src/components/papers/PapersView.tsx), [`IdeasBoard.tsx`](src/components/ideas/IdeasBoard.tsx), [`TopicsView.tsx`](src/components/topics/TopicsView.tsx) | Treat the current token usage as the baseline. Consolidate only documented exceptions (drawer widths, board scroller, circular clear buttons) during the view redesign. |
| Shared shadcn metadata does not describe the active CSS-variable palette | [`components.json`](components.json) | Retain as source context; do not broaden this scoped task into shadcn configuration or component migration. |
| Route fallback and Not Found surfaces have older red/yellow/white utilities | [`src/App.tsx`](src/App.tsx), [`src/components/ui/NotFound.tsx`](src/components/ui/NotFound.tsx) | Out of the seven-view scope. Do not change here; schedule with global error-surface normalization. |

No new debt is accepted silently. If a later view agent needs a new semantic role, add its variable, light/dark value, Tailwind mapping, and this document entry before using it.

### Source map

- Global color, semantic aliases, shadows, theme transition, reduced motion, scrollbar, selection, and performance utilities: [`src/index.css`](src/index.css).
- Tailwind colors, font stacks, type scale, spacing, container, breakpoints, radii, z-index, shadows, animation, transition, and viewport utility mappings: [`tailwind.config.js`](tailwind.config.js).
- Active primitives: [`button.tsx`](src/components/ui/button.tsx), [`card.tsx`](src/components/ui/card.tsx), [`input.tsx`](src/components/ui/input.tsx), [`Skeleton.tsx`](src/components/ui/Skeleton.tsx), [`ErrorFallback.tsx`](src/components/ui/ErrorFallback.tsx), [`tooltip.tsx`](src/components/ui/tooltip.tsx), [`ConfirmDialog.tsx`](src/components/ui/ConfirmDialog.tsx), [`FormDialog.tsx`](src/components/ui/FormDialog.tsx).
- Active shell: [`AppShell.tsx`](src/components/layout/v2/AppShell.tsx) and [`Sidebar.tsx`](src/components/layout/v2/Sidebar.tsx).
- Seven-view route composition: [`src/App.tsx`](src/App.tsx) and navigation definitions in [`Sidebar.tsx`](src/components/layout/v2/Sidebar.tsx).
