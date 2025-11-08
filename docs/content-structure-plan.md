# Content Structure Plan - ResearchQuest

## 1. Application Overview

**Type**: Single-Page Application (SPA) with dynamic content panels
**Reasoning**: Research management tool requires persistent navigation, real-time editing, and seamless transitions between interconnected content (notes, papers, ideas). Multi-panel layout with state management suits this better than traditional multi-page architecture.

## 2. Core Layout Structure

### Three-Panel Layout (Desktop: 1280px+)

```
┌─────────────────────────────────────────────────────────────┐
│                    Top Navigation Bar (64px)                 │
├──────────┬─────────────────────────────────┬────────────────┤
│          │                                 │                │
│   Left   │         Main Panel              │     Right      │
│ Sidebar  │      (Split View Editor)        │   Sidebar      │
│  (280px) │                                 │    (320px)     │
│          │  ┌──────────┬──────────────┐   │                │
│          │  │ Markdown │   Preview    │   │                │
│          │  │  Editor  │    Panel     │   │                │
│          │  │          │              │   │                │
│          │  └──────────┴──────────────┘   │                │
│          │                                 │                │
└──────────┴─────────────────────────────────┴────────────────┘
```

### Responsive Behavior

**Tablet (768px - 1024px)**: Hide right sidebar → Collapsible overlay
**Mobile (<768px)**: Stack vertically → Bottom nav + Full-width main panel + Slide-out sidebars

## 3. Screen/Panel Breakdown

### Top Navigation Bar
**Purpose**: Global context, theme toggle, user XP display, quick actions
**Component Pattern**: Horizontal Navigation (64px height)

| Section | Component Pattern | Function | Visual Asset |
|---------|------------------|----------|--------------|
| Logo + App Title | Text + Icon | Brand identity, home navigation | `imgs/logo.svg` (if available) or text "RQ" |
| XP Progress Bar | Linear Progress Indicator | Display current XP level and progress to next level | - |
| Streak Counter | Badge Component | Show current daily streak (e.g., "🔥 7 days") | - |
| Theme Toggle | Icon Button | Switch between light/dark mode | - |
| User Avatar | Circular Avatar | User profile access | - |

**FORBIDDEN**: No styling/alignment instructions. Pattern references only.

---

### Left Sidebar: Navigation & Entity Browser
**Purpose**: Navigate between entity types, browse items, access gamification overview
**Component Pattern**: Vertical Navigation + Scrollable List

| Section | Component Pattern | Data Source | Content to Extract | Visual Asset |
|---------|------------------|-------------|-------------------|--------------|
| Nav Menu | Tab Group (vertical) | Static | 4 tabs: Notes, Papers, Ideas, Topics | - |
| Search Bar | Input Field | N/A | Live search within current entity type | - |
| Entity List | Scrollable Card List | Database (dynamic) | Entity titles, metadata, reading status | - |
| Gamification Widget | Stats Card | User data | Today's XP, total XP, level, achievements | - |
| Daily Loop Tracker | Checklist Component | User progress | Daily tasks: Add paper, Write note, Develop idea | - |

**Notes on Entity List Cards:**
- Papers: Show DOI, authors (first), reading status badge (To Read/Reading/Read)
- Notes: Show title, tags, backlink count, last modified
- Ideas: Show title, stage badge (Seed→Developing→Supported→Mature), connection count
- Topics: Show tag name, entity count

---

### Main Panel: Split View Editor
**Purpose**: Primary content interaction - create/edit notes, view paper metadata, develop ideas
**Component Pattern**: Split Pane Layout (Resizable)

#### Left Pane: Markdown Editor

| Section | Component Pattern | Function | Visual Asset |
|---------|------------------|----------|--------------|
| Title Input | Large Text Input | Entity title editing | - |
| Metadata Bar | Horizontal Label Row | Tags, date, word count | - |
| Markdown Editor | Code Editor Component | Rich markdown editing with syntax highlighting | - |
| Toolbar | Icon Button Group | Formatting, linking, image insert | - |

#### Right Pane: Live Preview

| Section | Component Pattern | Function | Visual Asset |
|---------|------------------|----------|--------------|
| Rendered Content | Markdown Renderer | Live preview of formatted content | - |
| Link Highlights | Interactive Links | Clickable internal links ([[note]]) and external links | - |

**Paper-Specific View** (when viewing Papers entity):
- Replace editor with paper metadata display (DOI, authors, abstract, publication date)
- Add "Fetch from Crossref" button for DOI lookup
- Show reading status toggle (To Read → Reading → Read)
- Display linked notes below metadata

**Idea-Specific View** (when viewing Ideas entity):
- Show stage progression selector (Seed → Developing → Supported → Mature)
- Display connection graph (related notes, papers, topics)
- Add evidence tracker (supporting papers count)

---

### Right Sidebar: Backlinks & Context
**Purpose**: Show relationships, suggest connections, display research momentum
**Component Pattern**: Vertical Scroll Panel

| Section | Component Pattern | Data Source | Content to Extract | Visual Asset |
|---------|------------------|-------------|-------------------|--------------|
| Backlinks Panel | Compact Card List | Database query | Entities linking to current item | - |
| Related Entities | Tag Cloud or List | Algorithm (tags, keywords) | Suggested related notes/papers | - |
| Research Momentum | Mini Dashboard | User activity data | Weekly XP chart, streak calendar | - |
| Quick Stats | Stat Grid (2x2) | Current entity | Backlink count, creation date, edit count, connections | - |

**Backlinks Display Format:**
- Show entity type icon (note/paper/idea)
- Excerpt of linking context (sentence containing link)
- Last modified timestamp

**Research Momentum Visual:**
- 7-day XP bar chart (mini, 80px height)
- Streak calendar (last 30 days, grid layout)
- Progress ring for daily goal

---

## 4. Modal/Overlay Screens

### Add Paper Modal
**Component Pattern**: Centered Modal (600px width)

| Section | Component Pattern | Function |
|---------|------------------|----------|
| DOI Input | Search Input with Button | Enter DOI, trigger Crossref API fetch |
| Manual Entry | Form Fields | Title, authors, year, URL (if DOI fails) |
| Reading Status | Radio Group | Select To Read/Reading/Read |
| Actions | Button Group | Save, Cancel |

### Settings Modal
**Component Pattern**: Tabbed Modal (700px width)

| Tab | Content |
|-----|---------|
| Appearance | Theme toggle (light/dark/auto), font size, editor width |
| Gamification | XP goals, streak reminders, achievement notifications |
| Data | Export notes, backup, import from Zotero |
| Account | Profile, email, password |

### Achievement Toast
**Component Pattern**: Toast Notification (top-right)

| Element | Function |
|---------|----------|
| Icon | Achievement badge visual |
| Title | "Achievement Unlocked!" |
| Description | "First 7-day streak!" |
| XP Reward | "+50 XP" |

---

## 5. Gamification Element Specifications

### XP System Components

| Element | Display Location | Visual Treatment |
|---------|------------------|-----------------|
| XP Progress Bar | Top nav (global) | Linear gradient progress, level indicator |
| Daily XP Counter | Left sidebar widget | Large number + "+XP today" label |
| XP Gain Animation | Toast notification | "+X XP" floating text with fade-out |
| Level Badge | User avatar overlay | Small circular badge with level number |

### Streak Tracking Components

| Element | Display Location | Visual Treatment |
|---------|------------------|-----------------|
| Streak Counter | Top nav (global) | Fire emoji + number + "days" label |
| Streak Calendar | Right sidebar | 30-day grid, filled squares for active days |
| Streak Warning | Toast notification | "Don't break your streak!" when last activity >20 hours |

### Idea Stage Progression

| Stage | Badge Color (Light) | Badge Color (Dark) | Icon |
|-------|---------------------|-------------------|------|
| Seed | Yellow (#f59e0b) | Amber (#fbbf24) | Seedling |
| Developing | Blue (#3b82f6) | Blue (#60a5fa) | Sprout |
| Supported | Purple (#a855f7) | Purple (#c084fc) | Tree |
| Mature | Green (#22c55e) | Green (#4ade80) | Oak |

### Reading Status Indicators

| Status | Badge Color (Light) | Badge Color (Dark) | Label |
|--------|---------------------|-------------------|-------|
| To Read | Gray (#71717a) | Zinc (#a1a1aa) | "To Read" |
| Reading | Blue (#3b82f6) | Blue (#60a5fa) | "Reading" |
| Read | Green (#22c55e) | Green (#4ade80) | "Read" |

---

## 6. Content Analysis

**Information Density**: Medium-High
- Application interface with persistent navigation, dual editing panels, relationship visualizations
- Primary content: User-generated markdown notes, paper metadata (from Crossref API), research ideas
- Data visualizations: XP charts, streak calendars, backlink graphs
- Content Type: Mixed (text-heavy editing + data visualization + relationship mapping)

**Interaction Intensity**: High
- Real-time markdown editing with live preview
- Frequent entity switching (notes → papers → ideas)
- Continuous gamification feedback (XP gains, streak updates)
- Link creation and backlink navigation

**Session Characteristics**:
- Typical duration: 30 minutes (per requirement)
- Primary activities: Writing notes (60%), researching papers (25%), idea development (15%)
- Context switching: High (average 8-12 entity views per session)
- Engagement hooks: XP progress, streak maintenance, idea stage advancement

**Visual Asset Balance**:
- Icons: SVG icons for navigation, entity types, actions (primary visual elements)
- User-generated content: Markdown notes, linked references
- Gamification graphics: Progress bars, badges, achievement icons
- Data visualizations: Charts (XP trends), calendars (streaks), graphs (backlinks)
- Minimal decorative imagery (focus on functionality)
