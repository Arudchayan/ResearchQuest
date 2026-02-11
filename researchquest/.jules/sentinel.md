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
