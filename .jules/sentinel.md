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

## 2025-06-25 - Weak Password Policy
**Vulnerability:** The application allowed users to sign up with weak passwords (e.g., "123456") by only enforcing a minimum length of 6 characters (default Supabase behavior) and not checking complexity in the frontend.
**Learning:** Default backend constraints are often insufficient for modern security standards. Frontend validation provides immediate feedback and prevents weak credentials from ever reaching the database.
**Prevention:** Enhanced `isStrongPassword` utility to enforce complexity (uppercase, lowercase, number, special char) and integrated it into the signup flow in `App.tsx`. Added comprehensive unit tests in `security.test.ts`.

## 2025-07-15 - Missing Authentication in Edge Function
**Vulnerability:** The Supabase Edge Function `fetch-paper` was publicly accessible without any authentication check, allowing unauthorized users to execute code on the server and potentially abuse external API quotas.
**Learning:** Default configurations in serverless environments (like "Enforce JWT") are often assumed but not verified in code. Business logic that incurs cost or accesses external resources must explicitly verify the caller's identity.
**Prevention:** Implemented explicit JWT verification using `supabaseClient.auth.getUser()` inside the function handler. This ensures that only authenticated users can trigger the function.

## 2026-03-13 - Secure Logging Enforcement
**Vulnerability:** Lack of systematic use of the secure `logger` utility in components like `AddPaperView.tsx` meant that if a developer accidentally stringified an error or logged an unsanitized object (even though current code handled it manually), it would bypass the application's built-in defense against information leakage in production.
**Learning:** Standardizing security utilities (like a custom logger) is crucial. Relying on developers to manually sanitize `console.error` calls is error-prone. A security enhancement is enforcing the use of the centralized utility to guarantee sanitization.
**Prevention:** Replaced direct `console.error` calls with the secure `logger.error` wrapper in affected UI components. This creates a more robust architectural boundary where the centralized logger strictly controls what is exposed to the client console in production.

## 2026-06-25 - Information Leakage Prevention Bug and Centralized Logger Enforcement
**Vulnerability:** The centralized `logger` utility correctly sanitized `Error` objects and strings, but failed to recognize plain objects (like Supabase errors) when extracting `errorMessage`. This resulted in real errors being completely swallowed and logged as "Unknown error" in production, while some files in the codebase (e.g., `TopNav.tsx`, `useRelatedItems.ts`, `import.ts`) were still using inline `console.error` with the flawed plain-object extraction pattern.
**Learning:** Security utilities meant to prevent information leakage must correctly handle all expected input formats. Supabase errors, being plain objects with a `message` property rather than `Error` instances, need explicit handling. Additionally, security fixes must be applied holistically using the centralized utility to ensure robust architectural boundaries.
**Prevention:** Updated the `errorMessage` extraction in `src/utils/logger.ts` to properly identify and extract strings from plain objects (`typeof error === 'object' && 'message' in error`). Replaced all remaining insecure `console.error` calls with the secure `logger.error` wrapper.
## 2025-02-18 - Prevent XSS in clipboard operations
**Vulnerability:** XSS vulnerability during copy to clipboard
**Learning:** Copying `innerHTML` directly into `ClipboardItem` with `text/html` without sanitization can inadvertently expose malicious scripts or unwanted styling, even if the renderer (`react-markdown`) protected it visually in the app. The clipboard does not sanitize by default and pasting it elsewhere could lead to XSS execution.
**Prevention:** Wrap any usage of `element.innerHTML` being exported out of the app (like `ClipboardItem` for `text/html`) with `DOMPurify.sanitize()` to ensure clean HTML data.
