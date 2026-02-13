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

## 2025-05-21 - Recurrence of Information Leakage in Task Hooks
**Vulnerability:** `useTasks.ts` was found logging full error objects using `JSON.stringify(error, null, 2)` to `console.error`, exposing potential database schema details and internal error codes.
**Learning:** Security fixes (like the one on 2025-01-28) must be applied systematically across the entire codebase, not just in isolated files. Copy-paste coding can reintroduce previously fixed vulnerabilities.
**Prevention:** Audit all hooks for `JSON.stringify` usage in error handling. Replaced vulnerable logging in `useTasks.ts` with safe `error.message` logging. Added `useTasksSecurity.test.ts` to prevent regression.

## 2025-05-22 - Information Leakage in Topic Hooks
**Vulnerability:** `useTopics.ts` was logging full error objects to the console, potentially exposing internal database schema details.
**Learning:** Inconsistent application of security patterns across similar hooks leads to gaps.
**Prevention:** Replaced all instances of insecure logging in `useTopics.ts` with safe message-only logging. Added regression test `useTopicsSecurity.test.ts`.

## 2025-05-24 - Database Schema Leakage in Error Toasts
**Vulnerability:** `usePapers.ts` was explicitly falling back to `error.details` and `error.hint` when displaying error toasts to users. This exposed internal Postgres schema details (table names, constraints) in the UI.
**Learning:** Fallback error handling logic often tries to be "helpful" by showing more detail, but this violates the security principle of "fail securely". Users should never see database-level hints.
**Prevention:** Removed checks for `details` and `hint` properties. Enforced using only `error.message` or generic error codes. Added regression tests in `usePapersSecurity.test.ts` to explicitly assert that sensitive details are not leaked.

## 2025-06-03 - CSV Injection (Formula Injection)
**Vulnerability:** Export functionality in `researchquest/src/utils/export.ts` did not sanitize user input before creating CSV files. Malicious input starting with `=`, `+`, `-`, or `@` could be executed as formulas in spreadsheet software (like Excel).
**Learning:** Data exported from the application is often treated as trusted by external tools (Excel). Developers must sanitize data for the consuming context (CSV), not just the application context (HTML/SQL).
**Prevention:** Implemented `escapeCSV` with formula injection protection by prepending a single quote `'` to risky fields. Added regression test `researchquest/src/test/utils/export.test.ts`.
