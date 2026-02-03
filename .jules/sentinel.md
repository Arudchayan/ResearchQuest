## 2024-01-05 - Hardcoded Supabase Credentials
**Vulnerability:** Hardcoded Supabase URL and Anon Key found in `researchquest/src/lib/supabase.ts`.
**Learning:** Developers sometimes hardcode "public" keys for convenience, but this prevents environment separation and key rotation.
**Prevention:** Use `import.meta.env` for all configuration. Added `.env` and `.env.example` and updated `.gitignore`.

## 2024-05-22 - Unvalidated URL Input
**Vulnerability:** The Markdown editor allowed inserting arbitrary URLs (e.g., `javascript:alert(1)`), which could potentially bypass sanitization or mislead users if the renderer's sanitization was ever weakened or removed.
**Learning:** Relying solely on output sanitization (like `rehype-sanitize`) is a single point of failure. Defense in depth requires validating input at the source.
**Prevention:** Created a reusable `isValidUrl` utility and enforced protocol validation (http, https, mailto) at the input stage in `MarkdownEditor`.

## 2025-01-28 - Information Leakage in Logs
**Vulnerability:** Full error objects from Supabase, which can include internal database schema details (e.g., column names, error codes, hints), were being stringified and logged to the console in `src/utils/gamification.ts`.
**Learning:** `console.error` is often treated as a debug tool, but in production, these logs can expose sensitive system internals to attackers via the browser console.
**Prevention:** Replaced indiscriminate logging `JSON.stringify(error)` with targeted logging of `error.message`. Added optional chaining `error?.message` to prevent crashes if the error object is null but the error flag is set.

## 2025-02-18 - Hardcoded Test Credentials in UI
**Vulnerability:** Hardcoded email and password for a test account were found in `AuthScreen.tsx`.
**Learning:** "Dev-only" features like test logins often leak into production code if not explicitly gated. Hardcoded secrets in source code are a critical risk, even if intended for testing.
**Prevention:** Removed hardcoded strings. Implemented conditional rendering for the "Test Login" button, checking for `VITE_TEST_EMAIL` and `VITE_TEST_PASSWORD` environment variables. The feature now only activates if explicitly configured in the environment.

## 2025-02-23 - Missing Input Length Limits
**Vulnerability:** Task and Topic creation endpoints allowed unbounded string inputs, posing a Denial of Service (DoS) risk and potential database issues.
**Learning:** Frontend `maxLength` attributes are necessary for UX but insufficient for security; backend-adjacent hooks (or backend itself) must enforce limits.
**Prevention:** Added `maxLength` to inputs and validation logic to `create`/`update` hooks.
