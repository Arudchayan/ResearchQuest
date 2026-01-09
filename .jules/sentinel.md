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
