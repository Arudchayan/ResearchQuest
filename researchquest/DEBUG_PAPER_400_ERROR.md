# Debugging Paper Creation 400 Error

## Root Cause

**Error:** `invalid input syntax for type date: "2025"`

The database was expecting a proper date format (YYYY-MM-DD) but CrossRef API returns just the year (e.g., "2025"). This caused all paper additions to fail with a 400 error.

## What I Fixed

### 1. Publication Date Format Conversion ⭐ (Main Fix)
**The Problem:** CrossRef returns years like "2025" but the database expects dates like "2025-01-01"

**The Solution:** Both `usePapers.ts` and `AddPaperView.tsx` now:
- Detect if publication_date is just a year (4 digits)
- Automatically convert it to proper date format: `YYYY-01-01`
- Example: "2025" becomes "2025-01-01"

### 2. Enhanced Error Logging
The error handling in `usePapers.ts` now logs:
- Full error object
- Error code
- Error message
- Error details
- Error hint
- JSON stringified error
- The exact data that failed

### 3. Improved Data Validation
Both `usePapers.ts` and `AddPaperView.tsx` now:
- Trim all string values to remove whitespace
- Check if strings are empty before including them
- Filter out the string "null" from publication_date
- Only include optional fields if they have valid values
- Ensure arrays are properly formatted

### 4. Better Error Display
- Error messages now show for 5 seconds instead of 3
- Multiple fallbacks for extracting error messages
- More detailed console logging

## How to Debug the Error

### Step 1: Check Browser Console
1. Open your browser's developer tools (F12)
2. Go to the Console tab
3. Try to add a paper
4. Look for these console logs:

```
Creating paper with cleaned data: { ... }
User ID: <your-user-id>
```

If it fails, you'll see:
```
Failed to create paper - Full error object: { ... }
Error code: <code>
Error message: <message>
Error details: <details>
Error hint: <hint>
Error stringified: { ... }
Paper data that failed: { ... }
```

### Step 2: Check Network Tab
1. Open the Network tab in developer tools
2. Try to add a paper
3. Look for a POST request to `papers`
4. Click on it and check:
   - Request payload (what data was sent)
   - Response (what error came back)
   - Status code (should be 400)

### Step 3: Common Causes of 400 Errors

#### Authentication Issues
**Symptom:** Error mentions "Row Level Security" or "policy"
**Cause:** User is not properly authenticated or userId doesn't match
**Fix:** Check that you're logged in and the auth token is valid

#### Data Type Issues
**Symptom:** Error mentions "invalid input syntax" or "type"
**Cause:** A field has the wrong data type
**Fix:** Check that all fields match the expected types:
- `title`: TEXT (required)
- `authors`: TEXT[] (array of strings)
- `doi`: TEXT (optional)
- `source_url`: TEXT (optional)
- `abstract`: TEXT (optional)
- `publication_date`: TEXT (optional)
- `status`: VARCHAR(50) (defaults to "To Read")
- `topic_ids`: TEXT[] (optional array)

#### Constraint Violations
**Symptom:** Error mentions "constraint" or "violates"
**Cause:** A unique constraint or check constraint is violated
**Fix:** Check if you're trying to add a duplicate paper (same DOI)

#### Missing Required Fields
**Symptom:** Error mentions "null value" or "not null constraint"
**Cause:** A required field is missing
**Fix:** Ensure `title` and `user_id` are provided

### Step 4: Test with Different Methods

Try adding a paper using each method to narrow down the issue:

1. **DOI Search**
   - Example: `10.1038/nature12373`
   - This fetches from CrossRef API

2. **Keyword Search**
   - Example: "CRISPR gene editing"
   - This also uses CrossRef API

3. **Manual Entry**
   - Just enter a title
   - This doesn't use the API at all

If manual entry works but API methods don't, the issue is with how CrossRef data is being transformed.

### Step 5: Check Supabase Dashboard

1. Go to https://YOUR_PROJECT_REF.supabase.co
2. Navigate to Table Editor → papers
3. Try to manually insert a row with the same data
4. This will show if the issue is with the data or with the application

## Expected Data Format

Here's what a valid paper insert should look like:

```json
{
  "user_id": "uuid-here",
  "title": "Paper Title",
  "authors": ["Author One", "Author Two"],
  "status": "To Read",
  "doi": "10.1234/example",
  "source_url": "https://doi.org/10.1234/example",
  "abstract": "Paper abstract here",
  "publication_date": "2023"
}
```

## What to Do Next

1. **Try to add a paper and check the console**
   - Copy all the error logs you see
   - Look for the specific error message

2. **Report back with:**
   - The full error message from the console
   - The data that failed (from console logs)
   - Your user ID (from console logs)
   - Which method you used (DOI/Search/Manual)

3. **Temporary Workaround:**
   - If API methods fail, try Manual Entry
   - Just enter the title and authors manually

## Fixed Issues

✅ Empty strings no longer sent to database
✅ "null" string filtered out from publication_date
✅ All string fields trimmed
✅ Optional fields only included if they have values
✅ Better error messages shown to user
✅ Comprehensive console logging for debugging

## Known Working Configuration

- Node version: Should work with Node 16+
- Browser: Chrome, Firefox, Safari (latest versions)
- Supabase Client: v2.x
- Database: PostgreSQL 15

## If Error Persists

If you still see a 400 error after these fixes:
1. Check that Supabase is running and accessible
2. Verify your auth token hasn't expired (try logging out and in)
3. Check the Supabase logs in the dashboard
4. Ensure RLS policies are properly set up
5. Try running the migrations again if needed

## Files Modified

- `/workspace/researchquest/src/hooks/usePapers.ts` - Enhanced error handling and validation
- `/workspace/researchquest/src/components/entities/AddPaperView.tsx` - Improved data cleaning
