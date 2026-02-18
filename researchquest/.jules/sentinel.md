## 2025-02-18 - Unsafe URL Rendering in Entity Views
**Vulnerability:** External links (like `source_url` in Papers) were rendered directly into `href` attributes without validation, allowing for potential XSS via `javascript:` URLs if the data layer was compromised.
**Learning:** React escapes content but NOT attribute values like `href`. Simply checking `if (url)` is insufficient for security.
**Prevention:** Always wrap external link rendering with `isValidUrl()` from `utils/security.ts`, specifically ensuring the protocol is whitelisted (http/https).

## 2025-05-23 - Missing Input Length Limits in Ideas
**Vulnerability:** Idea creation and updates lacked input length validation on both frontend and backend-adjacent hooks, allowing potentially unbounded strings to be sent to the database (DoS risk).
**Learning:** Frontend `maxLength` attributes are necessary for UX but insufficient for security; validation must be enforced in the data layer (hooks) before RPC calls.
**Prevention:** Added `maxLength` attributes to UI inputs and enforced strict length limits (Title: 255, Description: 5000) in `useIdeas.ts` prior to Supabase interactions.

## 2025-05-24 - Missing Input Length Limits in Papers
**Vulnerability:** Paper creation and updates lacked input length validation in `usePapers.ts`, allowing potentially unbounded strings to be sent to the database (DoS risk).
**Learning:** Similar to the Ideas module, missing validation for `title` and `abstract` could lead to database errors or performance issues if constraints are hit.
**Prevention:** Added `PAPER_TITLE_MAX_LENGTH` (255) and `PAPER_ABSTRACT_MAX_LENGTH` (5000) constants and enforced them in `createPaper` and `updatePaper` before Supabase interactions.

## 2025-05-25 - Missing Input Length Limits in Notes
**Vulnerability:** Note creation and updates lacked input length validation in `useNotes.ts`, allowing potentially unbounded strings to be sent to the database (DoS risk).
**Learning:** Consistent input validation across all entity types is crucial. While Notes are often longer than other entities, they still require reasonable upper bounds to prevent abuse.
**Prevention:** Added `NOTE_TITLE_MAX_LENGTH` (255) and `NOTE_BODY_MAX_LENGTH` (100000) constants and enforced them in `createNote` and `updateNote` before Supabase interactions.

## 2026-02-14 - Insecure Direct Object Reference (IDOR) & Info Leakage in Tasks
**Vulnerability:** The `useTasks` hook lacked `user_id` verification in `update`, `complete`, and `delete` operations, relying solely on RLS. Additionally, error handling exposed internal database `details` and `hint` to the UI, potentially leaking schema information.
**Learning:** Defense-in-depth requires explicit `user_id` checks in mutation queries even if RLS is present. Fallback error messages must never expose `details` or `hint` properties from the database driver.
**Prevention:** Added `.eq('user_id', userId)` to all mutation queries in `useTasks.ts` and sanitized error message construction to only show `message` or a generic error.

## 2026-03-01 - Bypassed Validation in Custom Components
**Vulnerability:** The `MarkdownEditor` component implemented its own data mutation logic (`saveNote`) instead of using the centralized `useNotes` hook, bypassing critical input length validation (`NOTE_BODY_MAX_LENGTH`) and leaking raw error objects via `console.error`.
**Learning:** Custom components should never implement direct data access if a centralized hook exists. Hooks act as the "security gateway" for frontend data operations, enforcing validation and safe error handling.
**Prevention:** Refactored `MarkdownEditor` to use `useNotes().updateNote`, ensuring all security constraints are applied consistently and removing the insecure logging.
