# ResearchQuest - Quick Reference Guide

## 🚀 Start Development

```bash
cd /workspace/researchquest
npm run dev
```

Visit: `http://localhost:5173`

---

## ✅ What's New

### 🔄 URL Routing (NEW!)
- **Now Works**: Refresh on any route (`/papers`, `/ideas`, etc.)
- **Deep Links**: Share URLs to specific items (`/papers/{id}`)
- **Bookmarks**: Save and return to any page
- **Browser Navigation**: Back/forward buttons work correctly

### 📄 Paper Management
- **Add Papers**: DOI search, keyword search, or manual entry
- **Location**: Main content area (not modal anymore!)
- **Edit**: Click edit button in detail view
- **Status**: Update reading status inline

### 💡 Idea Management
- **Detail View**: Rich display with inline editing
- **Stage Tracking**: Seed → Developing → Supported → Mature
- **URL Support**: Direct links to specific ideas

### 🔥 Gamification
- **XP**: Immediate updates after actions
- **Streaks**: Accurate daily streak counting
- **Progress**: Visible in sidebars

### ⚡ CRUD Operations
- **Instant Updates**: No manual refresh needed
- **Real-time Sync**: Changes appear across tabs
- **Optimistic UI**: Immediate feedback

---

## 🧪 Quick Test

### Test Routing Fix:
```bash
1. Go to http://localhost:5173/papers
2. Press F5 (refresh)
3. ✅ Should show AddPaperView (not "not found")
```

### Test Deep Linking:
```bash
1. Add a paper
2. Click it
3. Copy URL (e.g., /papers/abc123)
4. Open in new tab
5. ✅ Should load the same paper
```

---

## 📁 Project Structure

```
researchquest/
├── src/
│   ├── App.tsx                 ← Main app with routing
│   ├── components/
│   │   ├── entities/
│   │   │   ├── AddPaperView.tsx      ← NEW: Inline paper addition
│   │   │   ├── PaperDetailView.tsx   ← NEW: Enhanced paper display
│   │   │   ├── IdeaDetailView.tsx    ← NEW: Rich idea display
│   │   │   ├── PaperList.tsx
│   │   │   ├── IdeaList.tsx
│   │   │   └── NoteList.tsx
│   │   ├── ui/
│   │   │   ├── NotFound.tsx          ← NEW: Error handling
│   │   │   ├── ErrorFallback.tsx
│   │   │   └── Skeleton.tsx
│   │   ├── layout/
│   │   │   ├── LeftSidebar.tsx       ← Modified: URL updates
│   │   │   ├── RightSidebar.tsx
│   │   │   ├── TopNav.tsx
│   │   │   └── MobileMenu.tsx
│   │   ├── editor/
│   │   │   └── MarkdownEditor.tsx
│   │   └── tasks/
│   │       └── TaskManager.tsx
│   ├── hooks/
│   │   ├── usePapers.ts
│   │   ├── useIdeas.ts
│   │   ├── useNotes.ts
│   │   └── useTasks.ts
│   ├── store/
│   │   └── appStore.ts
│   └── utils/
│       └── gamification.ts    ← Modified: Fixed streaks
```

---

## 🎯 Key URLs

```
/                    → Notes (default)
/notes              → Notes list
/notes/{id}         → Specific note
/papers             → Add paper view
/papers/{id}        → Specific paper
/ideas              → Ideas list
/ideas/{id}         → Specific idea
/tasks              → Task manager
/topics             → Coming soon
```

---

## 🛠️ Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Preview build
npm run preview

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

---

## 🐛 Troubleshooting

### Issue: Page shows "not found" on refresh
**Solution**: ✅ Already fixed! Should work now.

### Issue: URL doesn't update when clicking items
**Solution**: ✅ Already fixed! URLs now update automatically.

### Issue: Can't share links to specific papers
**Solution**: ✅ Already fixed! Deep linking now works.

### Issue: XP not updating
**Check**: 
- Console for errors
- Supabase connection
- Real-time subscriptions

### Issue: Data not refreshing after CRUD
**Check**:
- Should auto-refresh (optimistic updates)
- Check console for errors
- Verify Supabase real-time is enabled

---

## ✨ Features Checklist

- [x] CRUD operations auto-refresh
- [x] Paper addition in main area (not modal)
- [x] Rich detail views for papers/ideas
- [x] Gamification tracking
- [x] **URL routing works on refresh**
- [x] **Deep linking supported**
- [x] **Browser navigation works**
- [x] **Error states handled**
- [x] Real-time sync across tabs
- [x] Responsive design
- [x] Dark/light theme
- [x] Markdown editor
- [x] Task management

---

## 📚 Documentation Files

1. **FINAL_IMPROVEMENTS_SUMMARY.md** - Complete overview
2. **ROUTING_IMPROVEMENTS.md** - Routing technical details  
3. **TEST_ROUTING_FIXES.md** - Quick routing tests
4. **HOW_TO_TEST.md** - Full testing guide
5. **QUICK_REFERENCE.md** - This file

---

## 🎓 Quick Tips

- **Refresh Anywhere**: F5 now works on all routes
- **Share Links**: Copy URL to share specific papers/ideas
- **Bookmark**: Save any page, it'll work when you return
- **Browser Buttons**: Back/forward work correctly
- **Multi-Tab**: Changes sync automatically across tabs
- **Mobile**: Fully responsive, works great on phones

---

## 📞 Support

If you encounter issues:

1. Check console (F12) for errors
2. Verify Supabase connection
3. Try hard refresh (Ctrl+Shift+R)
4. Check documentation files above

---

## 🎉 Status

**Build**: ✅ Success  
**Tests**: ✅ All Passing  
**Routing**: ✅ Fixed  
**Production**: ✅ Ready

---

*Last Updated: 2025-11-08*
*All features operational*
