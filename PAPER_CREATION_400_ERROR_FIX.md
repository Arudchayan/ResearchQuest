# Paper Creation 400 Error - Fix Summary

## Problem Description

Users were encountering a **400 error** when trying to add papers to their library. The error appeared as:
```
Failed to load resource: the server responded with a status of 400 ()
Failed to create paper: Object
```

## Root Cause Analysis

The error message was misleading - it wasn't actually a paper creation error. The issue was in the **paper search functionality** that runs before adding a paper:

### The Bug
In `AddPaperModal.tsx`, the search buttons were missing proper input validation:

**Before (Buggy Code):**
```tsx
// Line 215 - DOI Search Button
<button
  onClick={handleDOISearch}
  disabled={loading}  // ❌ Only checks loading, allows empty input!
>

// Line 271 - Query Search Button  
<button
  onClick={handleQuerySearch}
  disabled={loading}  // ❌ Only checks loading, allows empty input!
>
```

This allowed users to click the search buttons with **empty inputs**, which triggered a call to the `fetch-paper` Edge Function with no `doi` or `query` parameters. The Edge Function correctly returned a 400 error with the message: `"Must provide doi or query"`.

### Why It Happened
The `AddPaperView.tsx` component had correct validation, but when the code was duplicated to create `AddPaperModal.tsx`, the input validation was accidentally omitted from the `disabled` attributes.

## The Fix

### 1. Fixed Button Validation in AddPaperModal.tsx

**After (Fixed Code):**
```tsx
// Line 215 - DOI Search Button
<button
  onClick={handleDOISearch}
  disabled={loading || !doiInput.trim()}  // ✅ Now checks for empty input
  className="... disabled:cursor-not-allowed ..."  // ✅ Added cursor style
>

// Line 271 - Query Search Button
<button
  onClick={handleQuerySearch}
  disabled={loading || !searchQuery.trim()}  // ✅ Now checks for empty input
  className="... disabled:cursor-not-allowed ..."  // ✅ Added cursor style
>
```

### 2. Enhanced Error Handling in usePapers.ts

Added validation and better error messages in both search functions:

**searchPaperByDOI:**
```tsx
async function searchPaperByDOI(doi: string): Promise<CrossrefPaper | null> {
  // ✅ Added input validation
  if (!doi.trim()) {
    setError('Please enter a DOI to search')
    return null
  }

  try {
    const response = await supabase.functions.invoke('fetch-paper', {
      body: { doi },
    })

    if (response.error) {
      const errorMessage = response.error.message || 'Failed to search for paper'
      setError(errorMessage)
      toast.error(errorMessage)  // ✅ Added toast notification
      return null
    }

    return response.data?.data || null
  } catch (err: any) {
    const errorMessage = err.message || 'An error occurred while searching'
    setError(errorMessage)
    toast.error(errorMessage)  // ✅ Added toast notification
    return null
  }
}
```

**searchPapersByQuery:** (Similar improvements)

## Files Modified

1. **`/workspace/researchquest/src/components/entities/AddPaperModal.tsx`**
   - Added input validation to DOI search button (line 215)
   - Added input validation to query search button (line 271)
   - Added `disabled:cursor-not-allowed` CSS class for better UX

2. **`/workspace/researchquest/src/hooks/usePapers.ts`**
   - Added input validation to `searchPaperByDOI` function
   - Added input validation to `searchPapersByQuery` function
   - Enhanced error messages with fallbacks
   - Added toast notifications for search errors

## Testing

The fix ensures:
- ✅ Search buttons are disabled when input fields are empty
- ✅ Users cannot trigger 400 errors by clicking search with empty inputs
- ✅ Better error messages are displayed to users
- ✅ Toast notifications provide immediate feedback
- ✅ Consistent behavior between AddPaperView and AddPaperModal components
- ✅ No linting errors introduced

## Prevention

To prevent similar issues in the future:
1. Always include input validation in both the handler function AND button disabled state
2. When duplicating components, use a checklist to verify all validation is preserved
3. Add unit tests for edge cases (empty inputs, whitespace-only inputs)
4. Consider creating a reusable SearchButton component to enforce validation patterns

## Related Code

The Edge Function that returns the 400 error (for reference):
```typescript
// /workspace/researchquest/supabase/functions/fetch-paper/index.ts
if (!doi && !query) {
  return new Response(
    JSON.stringify({ 
      error: { 
        code: 'INVALID_REQUEST', 
        message: 'Must provide doi or query' 
      } 
    }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

This error response is correct and expected behavior when called without parameters.
