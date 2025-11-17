# Backlinks and Related Items Implementation

**Date:** 2025-11-17  
**Status:** ✅ Complete

---

## Overview

Implemented the **Backlinks** and **Related Items** features that were previously just UI placeholders in the Right Sidebar. These features now provide meaningful connections between notes, papers, and ideas.

---

## Features Implemented

### 1. Backlinks Panel

**What it does:** Shows which other items in your workspace link to the currently selected note, paper, or idea.

**How it works:**
- **For Notes:** Finds other notes and ideas that have the current note's ID in their `linked_entity_ids` or `linked_note_ids` arrays
- **For Papers:** Finds ideas that have the current paper's ID in their `linked_paper_ids` array
- **For Ideas:** Finds notes that have the current idea's ID in their `linked_entity_ids` array

**Display:**
- Shows up to 5 backlinks with icon, title, and type
- Badge showing total count when there are backlinks
- Click any backlink to navigate to that item
- Empty state with helpful message when no backlinks exist

### 2. Related Items Panel

**What it does:** Discovers and displays items that share topics with the currently selected item.

**How it works:**
- Queries the topic junction tables (`topic_notes`, `topic_papers`, `topic_ideas`) to find the topics associated with the current item
- Searches for other items that share any of those topics
- Counts how many topics each related item shares
- Ranks items by number of shared topics (more shared topics = more related)

**Display:**
- Shows up to 5 related items sorted by relevance (shared topic count)
- Displays icon, title, type, and number of shared topics
- Badge showing total count when there are related items
- Click any related item to navigate to that item
- Empty state encouraging users to add topics

---

## Technical Implementation

### New Files Created

#### 1. `/workspace/researchquest/src/hooks/useBacklinks.ts`

**Purpose:** Custom React hook to fetch and manage backlinks for any entity.

**Key Features:**
- Accepts `entityId`, `entityType`, and `userId` as parameters
- Queries multiple tables (notes, ideas) to find all backlinks
- Returns sorted results (most recently updated first)
- Provides loading state and refresh function
- Automatic re-fetch when dependencies change

**Example Usage:**
```typescript
const { backlinks, loading, refresh } = useBacklinks(entityId, entityType, userId)
```

#### 2. `/workspace/researchquest/src/hooks/useRelatedItems.ts`

**Purpose:** Custom React hook to find items sharing topics with the current entity.

**Key Features:**
- Queries topic junction tables to find shared topics
- Uses nested joins to fetch related items efficiently
- Counts shared topics for each related item
- Sorts by relevance (shared topics count, then recency)
- Handles all three entity types (notes, papers, ideas)
- Provides loading state and refresh function

**Example Usage:**
```typescript
const { relatedItems, loading, refresh } = useRelatedItems(entityId, entityType, userId)
```

### Modified Files

#### `/workspace/researchquest/src/components/layout/RightSidebar.tsx`

**Changes Made:**
1. **Imports:** Added new icons (FileText, BookOpen, Lightbulb) and imported the new hooks
2. **State Management:** Added calls to `useBacklinks` and `useRelatedItems` hooks
3. **Helper Functions:** 
   - `handleNavigateToItem()` - Navigates to a backlink/related item when clicked
   - `getItemIcon()` - Returns the appropriate icon for each item type
   - `getItemTypeLabel()` - Returns user-friendly label for each type
4. **UI Updates:** Replaced placeholder panels with fully functional, interactive components

---

## Data Flow

### Backlinks Data Flow

```
1. User selects a note/paper/idea
2. RightSidebar determines entityId and entityType
3. useBacklinks hook queries:
   - Notes table: WHERE linked_entity_ids CONTAINS [entityId]
   - Ideas table: WHERE linked_note_ids/linked_paper_ids CONTAINS [entityId]
4. Results are merged, sorted, and returned
5. RightSidebar renders clickable list of backlinks
6. User clicks a backlink → navigate to that item
```

### Related Items Data Flow

```
1. User selects a note/paper/idea
2. RightSidebar determines entityId and entityType
3. useRelatedItems hook:
   a. Queries topic junction table for current item's topics
   b. For each topic, finds other items linked to that topic
   c. Counts shared topics for each related item
   d. Sorts by shared topic count (desc) then recency
4. Results returned to RightSidebar
5. RightSidebar renders clickable list with shared topic counts
6. User clicks a related item → navigate to that item
```

---

## User Experience

### When Backlinks Exist:
- Panel shows badge with count
- List displays up to 5 items with icons and titles
- Hover effect on each item
- Click to navigate seamlessly
- If more than 5, shows "+N more" indicator

### When No Backlinks:
- Shows helpful message: "No items link to this yet. Link from notes or ideas to create connections."
- Encourages users to create connections

### When Related Items Exist:
- Panel shows badge with count
- List displays items with shared topic counts
- Visual hierarchy: most related items first
- Hover effects and navigation on click
- If more than 5, shows "+N more" indicator

### When No Related Items:
- Shows helpful message: "No related items found. Add topics to discover connections."
- Encourages users to tag items with topics

---

## Database Queries

### Backlinks Queries

**For Notes (finding what links to this note):**
```sql
-- Notes linking to this note
SELECT id, title, markdown_body, updated_at 
FROM notes 
WHERE user_id = ? AND linked_entity_ids @> ARRAY[?]

-- Ideas linking to this note
SELECT id, title, updated_at 
FROM ideas 
WHERE user_id = ? AND linked_note_ids @> ARRAY[?]
```

**For Papers (finding what links to this paper):**
```sql
-- Notes linking to this paper
SELECT id, title, markdown_body, updated_at 
FROM notes 
WHERE user_id = ? AND linked_entity_ids @> ARRAY[?]

-- Ideas linking to this paper
SELECT id, title, updated_at 
FROM ideas 
WHERE user_id = ? AND linked_paper_ids @> ARRAY[?]
```

### Related Items Queries

**Step 1: Get topics for current item**
```sql
SELECT topic_id 
FROM topic_notes/topic_papers/topic_ideas 
WHERE note_id/paper_id/idea_id = ?
```

**Step 2: Find related notes**
```sql
SELECT note_id, topic_id, notes.* 
FROM topic_notes 
INNER JOIN notes ON topic_notes.note_id = notes.id
WHERE topic_id IN (?) AND note_id != ? AND user_id = ?
```

**Step 3: Find related papers**
```sql
SELECT paper_id, topic_id, papers.* 
FROM topic_papers 
INNER JOIN papers ON topic_papers.paper_id = papers.id
WHERE topic_id IN (?) AND paper_id != ? AND user_id = ?
```

**Step 4: Find related ideas**
```sql
SELECT idea_id, topic_id, ideas.* 
FROM topic_ideas 
INNER JOIN ideas ON topic_ideas.idea_id = ideas.id
WHERE topic_id IN (?) AND idea_id != ? AND user_id = ?
```

---

## Performance Considerations

### Optimizations Implemented:
1. **Efficient Queries:** Uses array containment operators (`@>`) for fast lookups
2. **Limit Results:** Shows only top 5 items (queries return all but UI limits display)
3. **Smart Sorting:** In-memory sorting after fetch (minimal overhead)
4. **Loading States:** Shows loading indicator while fetching
5. **Automatic Updates:** Hooks re-run when entityId changes
6. **User Scoping:** All queries filtered by user_id for security and performance

### Potential Future Optimizations:
1. Add caching layer for frequently accessed backlinks
2. Implement pagination for items with many backlinks
3. Add real-time updates when new links are created
4. Create database indexes on `linked_entity_ids`, `linked_note_ids`, `linked_paper_ids`

---

## Testing Recommendations

### Test Case 1: Backlinks for Notes
1. Create a note (Note A)
2. Create another note (Note B) with a link to Note A in its content
3. Create an idea that links to Note A
4. Select Note A
5. **Expected:** Right sidebar shows 2 backlinks (Note B and the Idea)

### Test Case 2: Related Items via Topics
1. Create a topic "Machine Learning"
2. Add this topic to Paper A, Note B, and Idea C
3. Select Paper A
4. **Expected:** Right sidebar shows Note B and Idea C as related items, each with "1 topic" badge

### Test Case 3: Empty States
1. Create a new note with no topics and no backlinks
2. Select the note
3. **Expected:** Both panels show helpful empty state messages

### Test Case 4: Navigation
1. Select a paper that has backlinks
2. Click on a backlink
3. **Expected:** App navigates to that note/idea, URL updates, item displays

### Test Case 5: Multiple Shared Topics
1. Create topics "AI" and "Research"
2. Add both topics to Paper A and Note B
3. Add only "AI" to Note C
4. Select Paper A
5. **Expected:** Note B appears first (2 shared topics), Note C second (1 shared topic)

---

## Known Limitations

1. **Display Limit:** Currently shows only top 5 items per panel. Items beyond 5 are counted but not displayed.
2. **No Pagination:** Cannot browse all backlinks/related items if more than 5 exist.
3. **Topic-Based Only:** Related items are found only through shared topics, not through other potential connections.
4. **No Sorting Options:** User cannot change sort order (e.g., alphabetical vs chronological).

---

## Future Enhancement Ideas

1. **Expandable Lists:** "Show All" button to view all backlinks/related items
2. **Search/Filter:** Allow filtering backlinks by type or searching related items
3. **Strength Indicators:** Visual indicators showing link strength (e.g., how many times mentioned)
4. **Bidirectional Links:** Auto-create reverse links when linking items
5. **Link Types:** Support different relationship types (references, contradicts, supports, etc.)
6. **Graph View:** Visualize connections in a network graph
7. **Smart Suggestions:** "You might also be interested in..." based on patterns

---

## Migration Notes

**No database migrations required.** This feature uses existing tables and data structures:
- `notes.linked_entity_ids` (already exists)
- `ideas.linked_note_ids` (already exists)
- `ideas.linked_paper_ids` (already exists)
- `topic_notes`, `topic_papers`, `topic_ideas` (already exist)

---

## Success Metrics

To measure the success of this feature, track:
1. **Engagement:** Number of clicks on backlinks/related items per session
2. **Discovery:** Number of new connections created after viewing related items
3. **Retention:** Do users with active backlinks/related panels stay longer?
4. **Navigation:** Percentage of users who navigate via sidebar vs other methods

---

## Conclusion

The Backlinks and Related Items features transform the Right Sidebar from a placeholder into a powerful discovery tool. Users can now:
- ✅ See which items reference their work (backlinks)
- ✅ Discover related research through shared topics
- ✅ Navigate their knowledge graph with one click
- ✅ Build a more connected research workspace

This implementation provides the foundation for future enhancements like graph visualization and advanced relationship types.
