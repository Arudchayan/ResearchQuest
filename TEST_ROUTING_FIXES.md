# Test Routing Fixes - Quick Guide

## 🚀 Quick Start

```bash
cd /workspace/researchquest
npm run dev
```

Open: `http://localhost:5173`

---

## ✅ Critical Tests

### Test 1: Refresh on /papers
```
1. Start at homepage
2. Click "Papers" tab
3. Observe URL changes to /papers
4. Press F5 (refresh)
5. ✅ Should stay on Papers view
6. ✅ Should show AddPaperView (not "not found")
```

**Expected Result:**
- No errors in console
- Papers view loads correctly
- AddPaperView is displayed

---

### Test 2: Refresh on /ideas
```
1. Click "Ideas" tab
2. Observe URL changes to /ideas
3. Press F5 (refresh)
4. ✅ Should stay on Ideas view
5. ✅ Should show empty state or idea list
```

**Expected Result:**
- Ideas view loads correctly
- No "not found" errors

---

### Test 3: Refresh on /tasks
```
1. Click "Tasks" tab
2. Observe URL changes to /tasks
3. Press F5 (refresh)
4. ✅ Should stay on Tasks view
5. ✅ Should show TaskManager
```

**Expected Result:**
- Tasks view loads correctly
- All task features work

---

### Test 4: Deep Link to Specific Paper
```
1. Add a paper (any method)
2. Click the paper from sidebar
3. Copy the URL (should be /papers/{some-id})
4. Open URL in new tab/window
5. ✅ Should load the specific paper
6. ✅ Paper detail view should display
```

**Expected Result:**
- Paper loads from URL
- Detail view shows correct paper
- Can edit, update status, etc.

---

### Test 5: Invalid Paper ID
```
1. Manually type: /papers/invalid-id-12345
2. Press Enter
3. ✅ Should show "Paper Not Found" message
4. ✅ Should have "Back to List" button
5. Click "Back to List"
6. ✅ Should go to /papers
7. ✅ Should show AddPaperView
```

**Expected Result:**
- Graceful error handling
- User-friendly message
- Easy recovery path

---

### Test 6: Invalid Route
```
1. Type: /completely-invalid-route
2. Press Enter
3. ✅ Should redirect to /
4. ✅ Should show Notes view
5. ✅ No visible errors to user
```

**Expected Result:**
- Automatic redirect
- No crash or error page
- Smooth user experience

---

### Test 7: Root Path
```
1. Type: /
2. Press Enter
3. ✅ Should show Notes view
4. ✅ URL should be /
```

**Expected Result:**
- Default view loads
- Clean URL

---

### Test 8: Direct URL Entry (All Views)

Test each of these URLs directly:

```
http://localhost:5173/
    ✅ Should show notes

http://localhost:5173/notes
    ✅ Should show notes

http://localhost:5173/papers
    ✅ Should show AddPaperView

http://localhost:5173/ideas
    ✅ Should show ideas list or empty state

http://localhost:5173/tasks
    ✅ Should show TaskManager

http://localhost:5173/topics
    ✅ Should show "Coming Soon"
```

---

### Test 9: Browser Back/Forward
```
1. Navigate: / → /papers → /ideas → /tasks
2. Click browser back button 3 times
3. ✅ Should go: /tasks → /ideas → /papers → /
4. Click browser forward button 3 times
5. ✅ Should go: / → /papers → /ideas → /tasks
```

**Expected Result:**
- History works correctly
- Views restore properly
- No errors

---

### Test 10: Create and Select Item Flow
```
1. Go to /papers
2. Add a paper (DOI: 10.1038/nature12373)
3. ✅ Paper appears in sidebar
4. Click the paper
5. ✅ URL changes to /papers/{id}
6. ✅ Paper detail view shows
7. Refresh page (F5)
8. ✅ Same paper still selected
9. ✅ Detail view still showing
```

**Expected Result:**
- URL persistence works
- State restored on refresh
- No data loss

---

## 🔍 Advanced Tests

### Test A: Rapid Navigation
```
1. Click tabs rapidly: Papers → Ideas → Tasks → Notes → Papers
2. ✅ No errors
3. ✅ Each view loads correctly
4. ✅ URL updates correctly
```

### Test B: Multiple Tabs
```
1. Open /papers in tab 1
2. Open /ideas in tab 2
3. Add paper in tab 1
4. Switch to tab 2
5. Switch back to tab 1
6. ✅ Paper should be in list (real-time sync)
```

### Test C: Slow Network Simulation
```
1. Open DevTools → Network → Throttle to "Slow 3G"
2. Refresh on /papers
3. ✅ Should show loading state
4. ✅ Should eventually load correctly
5. ✅ No crashes during load
```

---

## 📋 Checklist

After testing, verify:

- [ ] All routes work on refresh
- [ ] Deep links to items work
- [ ] Invalid routes redirect gracefully
- [ ] Non-existent items show error
- [ ] URL updates when navigating
- [ ] Browser back/forward works
- [ ] No console errors
- [ ] No "not found" messages (except for invalid items)
- [ ] Can bookmark any page
- [ ] Can share links with others

---

## 🐛 If Something Doesn't Work

### Check Console:
```
F12 → Console Tab
Look for:
- "Route changed to: ..."
- "Setting view to: ..."
- Any red errors
```

### Verify Supabase:
```
1. Check Supabase connection in console
2. Verify data is loading
3. Check real-time subscriptions
```

### Clear Cache:
```
1. Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)
2. Clear site data: DevTools → Application → Clear Storage
3. Restart dev server
```

---

## ✨ What's New

### Before These Fixes:
- ❌ Refresh on /papers → Error
- ❌ Deep links → Don't work
- ❌ Share URLs → Broken
- ❌ Bookmarks → Fail

### After These Fixes:
- ✅ Refresh anywhere → Works
- ✅ Deep links → Perfect
- ✅ Share URLs → Success
- ✅ Bookmarks → Reliable

---

## 🎯 Success Criteria

**All tests must pass:**
- Page refresh works on all routes
- Deep linking with IDs works
- Invalid routes handled gracefully
- Browser navigation (back/forward) works
- URL always reflects current state
- No "not found" on valid routes
- User-friendly errors on invalid routes

**If all pass:** ✅ **Routing is Production Ready!**

---

## 📝 Notes

- Console logs are intentional for debugging
- Can be removed in production if desired
- NotFound components provide better UX than blank pages
- URL is now the single source of truth for navigation

---

**Happy Testing!** 🚀

If you find any issues, check:
1. Console for errors
2. Network tab for failed requests
3. ROUTING_IMPROVEMENTS.md for technical details
