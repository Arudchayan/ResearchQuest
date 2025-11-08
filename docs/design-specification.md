# Design Specification - ResearchQuest

**Version**: 1.0 | **Dual-Theme System** | **Updated**: 2025-11-08

---

## 1. Direction & Rationale

### 1.1 Dual-Theme Philosophy

ResearchQuest employs a **theme-first design system** combining Modern Minimalism Premium (light mode) and Dark Mode First (dark mode), optimized for extended research sessions in varying lighting conditions.

**Light Mode (Default)**: Clean, professional restraint with generous whitespace. Optimized for daytime research, reading comprehension, and collaborative environments. Emphasizes content clarity through subtle backgrounds and muted depth.

**Dark Mode**: OLED-optimized dark surfaces with vibrant gamification accents. Designed for low-light environments, nighttime sessions, and reduced eye strain during extended use. Uses surface elevation instead of shadows.

**Core Balance**: Subtle gamification that reinforces productivity without overwhelming core research functionality. XP meters, streak counters, and progress indicators integrate seamlessly into the interface through color accents and micro-animations.

### 1.2 Real-World Inspiration

- **Notion** (note-taking interface, sidebar navigation, clean content focus)
- **Obsidian** (markdown editing, backlink visualization, graph relationships)
- **Linear** (task management, subtle progress indicators, modern aesthetics)
- **GitHub** (code editor panels, dark mode implementation)
- **Readwise** (reading tracker, progress visualization, streak mechanics)

### 1.3 Design Essence

**Light Mode**: 90% neutral grays, 8% primary accent (blue), 2% semantic colors. Generous 48-64px section spacing, 32-48px card padding, 12-16px border radius.

**Dark Mode**: 85% dark surfaces (#0a0a0a to #1e1e1e), 10% vibrant accents (saturated blue/purple/green), 5% high-contrast UI. Surface elevation through lightness gradients, glow effects instead of shadows.

---

## 2. Design Tokens

### 2.1 Color System

#### Primary Brand Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `primary-50` | #E6F0FF | #1e3a8a | Lightest accent bg |
| `primary-100` | #CCE0FF | #1e40af | Hover states |
| `primary-500` | #0066FF | #3b82f6 | Primary CTAs, links, active states |
| `primary-600` | #0052CC | #2563eb | Pressed states |
| `primary-900` | #003D99 | #1e40af | Darkest accent |

**WCAG Compliance**:
- Light: `primary-500` on white = 4.53:1 ✅ AA
- Dark: `primary-500` on #0a0a0a = 8.6:1 ✅ AAA

#### Neutral Grays

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `bg-base` | #FAFAFA | #0a0a0a | Page background |
| `bg-surface` | #FFFFFF | #141414 | Cards, panels, elevated surfaces |
| `bg-elevated` | #F5F5F5 | #1e1e1e | Hover states, active elements, modals |
| `border-subtle` | #E5E5E5 | rgba(255,255,255,0.1) | Dividers, card borders |
| `border-moderate` | #D4D4D8 | rgba(255,255,255,0.15) | Input borders, emphasis |
| `text-primary` | #171717 | #e4e4e7 | Headlines, body text |
| `text-secondary` | #404040 | #a1a1aa | Captions, metadata |
| `text-tertiary` | #A3A3A3 | #71717a | Disabled, timestamps |

**Background Contrast**: Light mode cards (white) on base (#FAFAFA) = 2% lightness contrast. Dark mode surfaces (#141414) on base (#0a0a0a) = 8% lightness contrast.

#### Semantic Colors (Gamification)

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `success-500` | #22c55e | #4ade80 | Streaks, completed tasks, "Read" status |
| `success-bg` | #f0fdf4 | #14532d | Success toast backgrounds |
| `warning-500` | #f59e0b | #fbbf24 | XP alerts, streak warnings, "To Read" |
| `warning-bg` | #fffbeb | #78350f | Warning toast backgrounds |
| `purple-500` | #a855f7 | #c084fc | Idea stages, achievements |
| `purple-bg` | #faf5ff | #581c87 | Idea highlights |

**Gamification Accent Saturation**:
- Light mode: 60-75% saturation (subtle integration)
- Dark mode: 80-100% saturation (vibrant pop against dark backgrounds)

#### Background Layers (Premium Depth)

| Layer | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `layer-0` | #FAFAFA | #0a0a0a | Base page |
| `layer-1` | #FFFFFF | #141414 | Cards, sidebars |
| `layer-2` | #F5F5F5 | #1e1e1e | Modals, tooltips, hover states |
| `layer-3` | - | #282828 | Highest elevation (rare) |

### 2.2 Typography

#### Font Families

**Primary**: Inter (clean sans-serif, optimized for screens)
- Stack: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Weights: Regular 400, Medium 500, Semibold 600, Bold 700

**Monospace** (code/markdown editor): JetBrains Mono
- Stack: `'JetBrains Mono', 'Fira Code', 'Courier New', monospace`
- Weight: Regular 400

#### Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| `text-hero` | 48px | 700 | 1.1 | -0.02em | Modal headlines |
| `text-title` | 32px | 600 | 1.2 | -0.01em | Panel headers |
| `text-subtitle` | 24px | 600 | 1.3 | 0 | Section headers |
| `text-body-lg` | 18px | 400 | 1.6 | 0 | Intro text, previews |
| `text-body` | 16px | 400 | 1.5 | 0 | Standard content |
| `text-small` | 14px | 400 | 1.5 | 0.01em | Metadata, labels |
| `text-caption` | 12px | 400 | 1.4 | 0.01em | Timestamps, badges |
| `text-code` | 14px | 400 | 1.4 | 0 | Markdown editor |

**Dark Mode Typography Adjustment**:
- Reduce font weights by 100 for large text (Bold 700 → Semibold 600) to prevent halation
- Use `text-primary` (#e4e4e7) instead of pure white (#fff) to reduce eye strain
- Apply `-webkit-font-smoothing: antialiased` for better rendering

#### Readability

- **Max line length**: 65-75 characters (~650px at 16px)
- **Editor width**: 700px (optimal for reading + editing)
- **Preview panel**: Match editor width for consistency

### 2.3 Spacing (8-Point Grid)

| Token | Value | Usage |
|-------|-------|-------|
| `spacing-xs` | 8px | Icon padding, inline gaps |
| `spacing-sm` | 16px | Element spacing, small gaps |
| `spacing-md` | 24px | Related group spacing, card gaps |
| `spacing-lg` | 32px | Card padding (minimum), section spacing |
| `spacing-xl` | 48px | Large section margins, panel padding |
| `spacing-2xl` | 64px | Hero sections, major separations |
| `spacing-3xl` | 96px | Dramatic spacing (rare) |

### 2.4 Border Radius

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `radius-sm` | 8px | 8px | Badges, small buttons |
| `radius-md` | 12px | 12px | Buttons, inputs, tags |
| `radius-lg` | 16px | 16px | Cards, panels, modals |
| `radius-full` | 9999px | 9999px | Avatars, pills, rounded badges |

### 2.5 Shadows & Elevation

#### Light Mode (Subtle Shadows)

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06) | Cards, dropdowns |
| `shadow-md` | 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06) | Elevated cards |
| `shadow-lg` | 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05) | Modals, overlays |
| `shadow-hover` | 0 10px 20px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08) | Hover states |

#### Dark Mode (Glow Effects)

| Token | Value | Usage |
|-------|-------|-------|
| `glow-accent` | 0 0 20px rgba(59,130,246,0.5), 0 0 40px rgba(59,130,246,0.3) | Primary button hover |
| `glow-subtle` | 0 0 0 1px rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.5) | Card elevation |
| `glow-success` | 0 0 16px rgba(74,222,128,0.4) | Streak counter, achievements |

### 2.6 Animation

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `motion-fast` | 150ms | ease-out | Button hover, icon changes |
| `motion-base` | 250ms | ease-out | Card transitions, panel slides |
| `motion-slow` | 300ms | ease-out | Modals, theme toggle |
| `motion-xp` | 600ms | ease-in-out | XP bar animations, achievement popups |

**Performance**: Animate ONLY `transform` and `opacity` (GPU-accelerated). Never animate width, height, margin, or padding.

---

## 3. Component Specifications

### 3.1 Buttons

#### Primary CTA

**Light Mode**:
- Background: `primary-500` (#0066FF)
- Text: White (#FFFFFF)
- Height: 48px
- Padding: 16-32px horizontal
- Radius: `radius-md` (12px)
- Font: Semibold 600, 16px
- Shadow: `shadow-sm`
- Hover: Background `primary-600`, shadow `shadow-md`, translateY(-1px)

**Dark Mode**:
- Background: `primary-500` (#3b82f6)
- Text: White (#FFFFFF)
- Height: 48px
- Padding: 16-32px
- Radius: `radius-md` (12px)
- Font: Medium 500, 16px (lighter weight)
- Glow: `glow-accent` on hover
- Hover: Brightness 110%, scale(1.02)

#### Secondary (Outline)

**Light Mode**:
- Background: Transparent
- Border: 2px solid `border-moderate` (#D4D4D8)
- Text: `text-primary` (#171717)
- Hover: Background `bg-elevated` (#F5F5F5)

**Dark Mode**:
- Background: Transparent
- Border: 2px solid `primary-500` (#3b82f6)
- Text: `primary-500`
- Hover: Background `primary-500`, text white, `glow-accent`

#### Icon Button (Toolbar)

- Size: 36×36px
- Icon: 20px
- Radius: `radius-md` (12px)
- Light: Background transparent, hover `bg-elevated`
- Dark: Background transparent, hover `bg-elevated` (#1e1e1e)

### 3.2 Input Fields

**Structure**:
- Height: 48px
- Padding: 12-16px horizontal
- Radius: `radius-md` (12px)
- Font: Regular 400, 16px

**Light Mode**:
- Background: White (#FFFFFF)
- Border: 1px solid `border-subtle` (#E5E5E5)
- Text: `text-primary` (#171717)
- Placeholder: `text-tertiary` (#A3A3A3)
- Focus: Border `primary-500`, 2px `primary-500` ring (no border jump)

**Dark Mode**:
- Background: `bg-surface` (#141414)
- Border: 1px solid rgba(255,255,255,0.1)
- Text: `text-primary` (#e4e4e7)
- Placeholder: `text-tertiary` (#71717a)
- Focus: Border `primary-500`, 2px `primary-500` glow

### 3.3 Cards

**Structure**:
- Padding: 32px (desktop), 24px (mobile)
- Radius: `radius-lg` (16px)
- Gap between cards: 24px

**Light Mode**:
- Background: `bg-surface` (#FFFFFF)
- Border: 1px solid `border-subtle` (#E5E5E5)
- Shadow: `shadow-sm`
- Hover: Shadow `shadow-hover`, translateY(-2px), scale(1.01)

**Dark Mode**:
- Background: `bg-surface` (#141414)
- Border: 1px solid rgba(255,255,255,0.1)
- Shadow: `glow-subtle`
- Hover: Background `bg-elevated` (#1e1e1e), border rgba(255,255,255,0.15)

**Entity Card Variants** (Left Sidebar List):
- **Compact**: Padding 16px, height auto
- **Note Card**: Title (16px Semibold) + Tags (12px) + Backlink count badge
- **Paper Card**: Title (14px Regular) + Authors (12px tertiary) + Reading status badge
- **Idea Card**: Title (16px Semibold) + Stage badge + Connection count

### 3.4 Navigation Components

#### Top Navigation Bar

**Structure**:
- Height: 64px
- Padding: 0 24px
- Position: Sticky top

**Light Mode**:
- Background: White (#FFFFFF) with 80% opacity + backdrop-blur(10px)
- Border-bottom: 1px solid `border-subtle` (#E5E5E5)
- Shadow: `shadow-sm` on scroll

**Dark Mode**:
- Background: `bg-base` (#0a0a0a) with 90% opacity + backdrop-blur(10px)
- Border-bottom: 1px solid rgba(255,255,255,0.1)
- Subtle top glow: `glow-subtle`

**Elements**:
- Logo/Title: 20px Semibold, `text-primary`
- XP Progress: Linear gradient bar, 120px width, 8px height, rounded-full
- Streak: Badge pill with fire icon, `success-500` text
- Theme Toggle: Icon button, 32×32px, sun/moon icon

#### Left Sidebar (Vertical Navigation)

**Structure**:
- Width: 280px (desktop), slide-out drawer (mobile)
- Padding: 24px 16px
- Position: Fixed left

**Light Mode**:
- Background: `bg-surface` (#FFFFFF)
- Border-right: 1px solid `border-subtle` (#E5E5E5)

**Dark Mode**:
- Background: `bg-base` (#0a0a0a)
- Border-right: 1px solid rgba(255,255,255,0.1)

**Tab Navigation** (Notes/Papers/Ideas/Topics):
- Active tab: Background `bg-elevated`, left border 3px `primary-500`
- Inactive tab: Background transparent, text `text-secondary`
- Hover: Background `bg-elevated`, text `text-primary`

#### Right Sidebar (Backlinks & Context)

**Structure**:
- Width: 320px (desktop), hidden on tablet/mobile
- Padding: 24px 16px
- Scrollable overflow

**Light Mode**:
- Background: `bg-surface` (#FFFFFF)
- Border-left: 1px solid `border-subtle` (#E5E5E5)

**Dark Mode**:
- Background: `bg-base` (#0a0a0a)
- Border-left: 1px solid rgba(255,255,255,0.1)

### 3.5 Gamification Components

#### XP Progress Bar (Top Nav)

**Structure**:
- Width: 120px (desktop), 80px (mobile)
- Height: 8px
- Radius: `radius-full`

**Light Mode**:
- Background: `bg-elevated` (#F5F5F5)
- Fill: Linear gradient from `primary-500` to `primary-600`
- Text overlay: "Lvl 5 • 420/500 XP" (12px, positioned below bar)

**Dark Mode**:
- Background: `bg-elevated` (#1e1e1e)
- Fill: Linear gradient from `primary-500` to `purple-500` (vibrant)
- Glow: Subtle `glow-accent` on fill

**Animation**: Progress fill animates left-to-right with 600ms ease-in-out on XP gain

#### Streak Counter Badge

**Structure**:
- Height: 32px
- Padding: 8-12px
- Radius: `radius-full`

**Light Mode**:
- Background: `success-bg` (#f0fdf4)
- Border: 1px solid `success-500` (#22c55e)
- Text: `success-500`, 14px Semibold
- Icon: Fire emoji or SVG flame, 16px

**Dark Mode**:
- Background: rgba(74,222,128,0.1)
- Border: 1px solid `success-500` (#4ade80)
- Text: `success-500`, 14px Semibold
- Glow: `glow-success` on hover

**Pulse Animation**: Scale(1.05) → Scale(1) every 3 seconds when active

#### Idea Stage Badge

**Structure**:
- Height: 24px
- Padding: 6-10px
- Radius: `radius-md` (12px)
- Font: 12px Semibold

**Stages (Light → Dark)**:
1. **Seed**: Background `warning-bg` → rgba(251,191,36,0.1), Text `warning-500`
2. **Developing**: Background `primary-bg` → rgba(59,130,246,0.1), Text `primary-500`
3. **Supported**: Background `purple-bg` → rgba(192,132,252,0.1), Text `purple-500`
4. **Mature**: Background `success-bg` → rgba(74,222,128,0.1), Text `success-500`

**Transition**: When stage advances, badge scales to 1.2 → 1 with 300ms, then glows briefly

#### Reading Status Badge (Papers)

**Structure**: Same as Idea Stage Badge

**Statuses**:
1. **To Read**: Gray neutral background, text `text-secondary`
2. **Reading**: Blue `primary-500` background (light mode: 10% opacity), text `primary-500`
3. **Read**: Green `success-500` background (light mode: 10% opacity), text `success-500`

#### Achievement Toast

**Structure**:
- Width: 360px
- Padding: 20px
- Radius: `radius-lg` (16px)
- Position: Top-right, slide-in from right

**Light Mode**:
- Background: White (#FFFFFF)
- Border: 2px solid `primary-500`
- Shadow: `shadow-lg`

**Dark Mode**:
- Background: `bg-elevated` (#1e1e1e)
- Border: 2px solid `primary-500`
- Glow: `glow-accent`

**Content**:
- Icon: 48×48px achievement badge SVG (left)
- Title: "Achievement Unlocked!" (16px Semibold)
- Description: Achievement name (14px Regular)
- XP Reward: "+50 XP" (14px Semibold, `primary-500`)

**Animation**: Slide-in translateX(400px → 0), stay 4s, slide-out, duration 300ms

### 3.6 Markdown Editor (Main Panel)

**Structure**:
- Split view: 50/50 editor/preview (resizable with drag handle)
- Editor background: `bg-surface`
- Preview background: `bg-base`
- Divider: 1px `border-subtle`, draggable handle 8px wide

**Light Mode Editor**:
- Background: White (#FFFFFF)
- Text: `text-primary` (#171717)
- Font: `text-code` (JetBrains Mono, 14px)
- Syntax highlighting: Muted colors (headings `primary-600`, links `primary-500`, code `text-secondary`)
- Selection: `primary-100` background

**Dark Mode Editor**:
- Background: `bg-surface` (#141414)
- Text: `text-primary` (#e4e4e7)
- Font: `text-code` (JetBrains Mono, 14px, weight 400)
- Syntax highlighting: Vibrant colors (headings `primary-500`, links `primary-400`, code `success-500`)
- Selection: rgba(59,130,246,0.2) background

**Preview Panel**:
- Rendered markdown using standard HTML tags
- Headings: Use `text-title`, `text-subtitle` scales
- Links: Underline on hover, `primary-500` color
- Code blocks: `bg-elevated` background, `text-code` font, syntax highlighting

**Toolbar (Above Editor)**:
- Height: 48px
- Background: `bg-elevated`
- Border-bottom: 1px `border-subtle`
- Icon buttons: 36×36px, 8px gap between buttons
- Groups: Format (bold, italic, code) | Structure (heading, list, quote) | Insert (link, image)

---

## 4. Layout & Responsive Strategy

### 4.1 Three-Panel Layout (Desktop: 1280px+)

**Grid Structure**:
```
┌─────────────────────────────────────────────┐
│           Top Nav (full-width, 64px)        │
├───────────┬──────────────────┬──────────────┤
│  Left     │  Main Panel      │  Right       │
│  Sidebar  │  (flexible)      │  Sidebar     │
│  280px    │                  │  320px       │
│  fixed    │                  │  fixed       │
└───────────┴──────────────────┴──────────────┘
```

**Main Panel Calculation**: `calc(100vw - 280px - 320px - 48px)` (48px for gaps/padding)

**Split View (Main Panel)**:
- Editor: 50% width (resizable 40-60%)
- Divider: 8px draggable handle
- Preview: 50% width (resizable 40-60%)
- Minimum width per pane: 400px

### 4.2 Responsive Breakpoints

**Desktop Large (1440px+)**:
- All panels visible
- Main panel max-width: 1200px (centered if >1920px viewport)

**Desktop Standard (1280px - 1439px)**:
- All panels visible
- Right sidebar collapsible via icon button

**Tablet (768px - 1279px)**:
- Left sidebar: Fixed 280px
- Main panel: Flexible width
- Right sidebar: Hidden by default, slide-in overlay (triggered by icon button)
- Split view: 50/50 or tab toggle (editor/preview tabs instead of split)

**Mobile (< 768px)**:
- Top nav: 64px height, simplified (hide XP bar on <480px)
- Left sidebar: Hidden, slide-in drawer from left
- Main panel: 100% width
- Right sidebar: Hidden, slide-in drawer from right
- Split view: Tab toggle only (no simultaneous split)
- Bottom nav: 64px fixed bar with 4 icons (Notes, Papers, Ideas, Topics)

### 4.3 Touch Targets (Mobile)

- Minimum: 44×44px (Apple HIG)
- Preferred: 48×48px for primary actions
- Spacing: 8px minimum between tappable elements
- Buttons: Increase height to 52px on mobile

### 4.4 Typography Scaling (Mobile)

- `text-hero`: 32px (reduced from 48px)
- `text-title`: 24px (reduced from 32px)
- `text-body`: 16px (maintained for readability)
- Line length: Maintain 65-75 characters by reducing container padding

---

## 5. Interaction & Animation

### 5.1 Theme Toggle

**Toggle Button** (Top Nav):
- Icon: Sun (light mode) / Moon (dark mode), 20px
- Size: 32×32px
- Position: Top-right nav area
- Click: Triggers theme transition

**Theme Transition Animation**:
1. User clicks toggle
2. Add `theme-transitioning` class to `<body>`
3. Apply CSS transition: `all 300ms ease-in-out` to background, color, border properties
4. Switch theme (light → dark or dark → light)
5. Remove class after 300ms
6. Save preference to `localStorage` ("theme": "light" | "dark" | "auto")

**Auto Theme Detection**:
- Default: Follow system preference `prefers-color-scheme`
- User override: Persist choice in localStorage
- Logic: `localStorage.theme || window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'`

### 5.2 Micro-Animations

**Button Hover**:
- Duration: `motion-fast` (150ms)
- Effect: translateY(-1px), scale(1.02), shadow increase
- Reset on mouse leave

**Card Hover** (Entity Lists):
- Duration: `motion-base` (250ms)
- Effect: translateY(-2px), scale(1.01), shadow/glow increase
- Stagger: If list animation, 50ms delay per item

**XP Gain Animation**:
- Trigger: On XP increment
- Effect: "+X XP" floating text appears above progress bar, translateY(0 → -20px), opacity(1 → 0), 600ms
- Progress bar: Fill animates from current to new value, 600ms ease-in-out
- Scale pulse: Progress bar scales(1 → 1.05 → 1) on completion

**Streak Update**:
- Trigger: On new day with activity
- Effect: Streak counter scales(1 → 1.2 → 1), 300ms, with `glow-success` pulse
- Confetti animation (optional): 5-8 small particles emit from badge, gravity fall

**Achievement Unlock**:
- Toast slides in from right: translateX(400px → 0), 300ms ease-out
- Icon pulses: scale(1 → 1.1 → 1), 400ms, repeat 2x
- Toast stays 4 seconds, slides out: translateX(0 → 400px), 250ms ease-in

**Idea Stage Progression**:
- Badge scales: 1 → 1.2 → 1, 300ms
- Color transition: Fade from old stage color to new, 250ms
- Glow effect: Brief 1-second glow matching new stage color

**Panel Transitions**:
- Sidebar slide-in (mobile): translateX(-280px → 0), 250ms ease-out
- Modal fade-in: opacity(0 → 1), scale(0.95 → 1), 300ms ease-out
- Tab switching: Cross-fade opacity(0 → 1), 200ms, content translateY(8px → 0)

### 5.3 Loading States

**Entity List Loading**:
- Skeleton cards: Gray pulsing rectangles (light: #E5E5E5, dark: #1e1e1e)
- Pulse animation: opacity(0.5 → 1 → 0.5), 1.5s infinite

**Editor Loading**:
- Spinner: Rotating circle, `primary-500`, 32px, positioned center

**Paper Fetch (DOI Lookup)**:
- Button: "Fetching..." text, spinner icon rotating
- Duration: Show timeout message after 5 seconds if no response

### 5.4 Accessibility

**Reduced Motion**:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Focus Indicators**:
- All interactive elements: 2px `primary-500` ring on focus
- Offset: 2px from element edge
- Visible on keyboard navigation, hidden on mouse click (`:focus-visible`)

**Screen Reader**:
- XP progress: `aria-label="Level 5, 420 out of 500 XP"`
- Streak counter: `aria-label="7 day streak"`
- Theme toggle: `aria-label="Switch to dark mode"` (dynamic based on current theme)
- Loading states: `aria-live="polite"` for status updates

**Keyboard Navigation**:
- Tab order: Top nav → Left sidebar → Main panel → Right sidebar
- Shortcuts: `Cmd/Ctrl + K` for search, `Cmd/Ctrl + N` for new note, `Cmd/Ctrl + \` for toggle theme

---

## 6. Implementation Notes

### 6.1 CSS Custom Properties (Dual-Theme)

```css
/* Light Mode (Root Default) */
:root {
  --color-primary-500: #0066FF;
  --color-bg-base: #FAFAFA;
  --color-bg-surface: #FFFFFF;
  --color-text-primary: #171717;
  /* ... all tokens */
}

/* Dark Mode Override */
[data-theme="dark"] {
  --color-primary-500: #3b82f6;
  --color-bg-base: #0a0a0a;
  --color-bg-surface: #141414;
  --color-text-primary: #e4e4e7;
  /* ... all tokens */
}

/* Transition Class (Applied During Theme Switch) */
.theme-transitioning,
.theme-transitioning * {
  transition: background-color 300ms ease-in-out,
              color 300ms ease-in-out,
              border-color 300ms ease-in-out !important;
}
```

### 6.2 Component Library Recommendations

- **UI Framework**: React + Tailwind CSS (configure with design tokens)
- **Icons**: Lucide React (consistent outline style, 2px stroke)
- **Markdown Editor**: CodeMirror 6 (extensible, syntax highlighting)
- **Markdown Renderer**: react-markdown + remark-gfm (GitHub Flavored Markdown)
- **Charts**: Recharts (for XP trends, streak calendars)
- **Animations**: Framer Motion (for micro-interactions, page transitions)
- **State Management**: Zustand (lightweight, theme persistence)

### 6.3 Performance Optimization

- **Code Splitting**: Lazy load right sidebar, modals, achievement animations
- **Theme Persistence**: Load from localStorage before first paint to prevent flash
- **Animation Performance**: Use `will-change: transform` on frequently animated elements
- **Dark Mode Images**: Serve WebP format, consider CSS `filter: brightness(0.8)` for photos in dark mode

---

**End of Specification** | **Total Sections**: 6 | **Word Count**: ~2,850 words
