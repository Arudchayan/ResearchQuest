# Browser Smoke Test (RQ-M6-03)

A manual 10-step smoke test to verify the app is production-ready. Run against a deployed environment (Vercel preview or production) with a real Supabase project.

## Prerequisites

- A test Supabase user account (separate from any personal account)
- The deployed app URL
- A modern browser (Chrome recommended for Lighthouse)

## Test Steps

### Step 1 — Auth: Sign in

Navigate to the app root. Verify the auth screen appears when not logged in. Sign in with the test account.

**Pass:** Dashboard loads within 3 seconds. No console errors.

---

### Step 2 — Notes: Create and read

Navigate to Notes. Create a new note with a title and body. Verify it appears in the note list immediately.

**Pass:** Note is visible in the list after creation. No error toast.

---

### Step 3 — Papers: Add and verify

Navigate to Papers. Add a paper manually (title + authors at minimum). Verify it appears in the list.

**Pass:** Paper is visible after creation. No error toast.

---

### Step 4 — Ideas: Create and stage change

Navigate to Ideas. Create a new idea. Move it from "Seed" to "Mature" (or equivalent). Verify the stage change persists after moving to another view and back.

**Pass:** Stage change is reflected correctly. No error toast.

---

### Step 5 — Tasks: Create and complete

Navigate to Tasks. Create a task. Mark it complete. Verify the task is shown as completed or moves to the appropriate filter bucket.

**Pass:** Task completion state is reflected correctly. No error toast.

---

### Step 6 — Topics: Create and link

Navigate to Topics. Create a topic. Link the note created in Step 2 to the topic. Verify the note count on the topic card shows 1.

**Pass:** Note count on topic card reads 1. No error toast.

---

### Step 7 — Focus: Session flow

Navigate to Focus. Start a focus session. Complete it. Verify XP or the focus counter updated.

**Pass:** XP or session metric changed after completing the session. No error toast.

---

### Step 8 — Deep links: All five entity types

Copy the URL of the note created in Step 2 (should be `/notes/<id>`). Open it in a new tab. Verify the correct note opens. Repeat for a paper, idea, task, and topic.

**Pass:** All five deep links resolve to the correct entity. No 404 or blank detail pane.

---

### Step 9 — Export: Data completeness

Navigate to Settings → Data Management. Export all data. Open the downloaded JSON. Verify it contains keys: `notes`, `papers`, `ideas`, `tasks`, `topics`, `topicNotes`, `topicPapers`, `topicIdeas`.

**Pass:** All eight keys are present in the exported JSON. Counts are non-zero for entities created in Steps 2–6.

---

### Step 10 — Import: Round-trip

Using a second test user (or after clearing the first test user's data), import the JSON exported in Step 9. Verify the import success toast shows `Imported N items successfully` with N > 0. Verify entities appear in the app.

**Pass:** Import toast shows `Imported N items successfully`, N > 0. Entities are visible in the app for the importing user.

---

## Pass Criteria

All 10 steps pass with:
- No red console errors during any step
- No error toasts (unless specifically testing error paths)
- UI reflects data changes within 3 seconds of each action

## Known Limitations

- Deep Research feature is not deployed. The Deep Research UI (if visible) shows placeholder or is absent. This is an accepted beta limitation — see `docs/DEEP_RESEARCH_DECISION.md`.
- Lighthouse Performance score target: ≥ 70 on dashboard (authenticated). Scores below this threshold must be documented in `docs/LAUNCH_CHECKLIST.md`.

## Automation Notes

The test steps above are designed for manual execution. Playwright automation is feasible for Steps 1–7 but Step 8 (deep links in new tab) and Step 10 (two-user import) require additional browser context setup. Automation is out of scope for beta launch.
