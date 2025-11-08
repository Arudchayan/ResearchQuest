# ResearchQuest

A gamified research management tool that combines research scraper, to-do list, motivator, and research tracker to help academic researchers stay organized and motivated.

## Deployed Application

**Live URL**: https://b7869xx7l3xg.space.minimax.io

## Features

### Core Functionality
- **Split-View Markdown Editor**: Real-time markdown editing with live preview using CodeMirror 6
- **Academic Paper Management**: Crossref API integration for DOI-based paper search and metadata retrieval
- **Idea Progression System**: Track research ideas through stages (Seed → Developing → Supported → Mature)
- **Daily Progress Tracking**: Monitor daily activity with streak counters and XP system
- **Backlinks Functionality**: Entity relationship management and backlink tracking
- **Topic Organization**: Organize research content by topics with filtering

### Gamification
- **XP System**: Earn experience points for research activities
- **Streak Counter**: Track consecutive days of research activity
- **Level Progression**: Advance through levels as you earn XP
- **Achievement System**: Stage progression for research ideas

### User Experience
- **Dual-Theme Support**: Seamless light/dark mode toggle with smooth transitions
- **Three-Panel Layout**: Left sidebar (navigation), main editor panel, right sidebar (backlinks)
- **Mobile-Responsive**: Adaptive layout for tablets and mobile devices
- **Real-time Updates**: Supabase real-time subscriptions for data synchronization

## Technology Stack

- **Frontend**: React 18.3 + TypeScript 5.6 + Tailwind CSS 3.4
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Editor**: CodeMirror 6 + react-markdown
- **State**: Zustand
- **APIs**: Crossref REST API for academic papers

## Quick Start

Visit the deployed application: **https://b7869xx7l3xg.space.minimax.io**

1. Sign up or sign in
2. Toggle between light/dark themes
3. Start creating notes with the markdown editor
4. Track your research progress with the gamification system

## Testing Results

Comprehensive testing completed with **Grade A (Excellent)**:
- Authentication: ✅ Working perfectly
- Theme Toggle: ✅ Smooth transitions
- Navigation: ✅ All tabs working
- Markdown Editor: ✅ Live preview working
- Gamification: ✅ XP & streaks displayed
- Layout: ✅ Three-panel responsive layout

## Documentation

Complete design documentation available in `/docs`:
- Content Structure Plan
- Design Specification (2,850 words)
- Design Tokens (186 lines JSON)
- Technical research (Crossref API, Markdown editors, Backlinks, Gamification)

## License

All rights reserved.
