## 2024-05-24 - Stop console.error from leaking raw error objects

**Vulnerability:** Many components like `AddPaperView`, `LeftSidebar`, and `RightSidebar` were catching errors and logging the raw `error` object using `console.error("...", error)`.
**Learning:** This is an information disclosure vulnerability. If an error is an instance of `PostgrestError` (Supabase API error) or a low-level library error, the full object can leak database schema details, API keys embedded in request configs, or stack traces directly to the client's console.
**Prevention:** Always sanitize the error object before logging it to the console on the frontend. Use the pattern `error instanceof Error ? error.message : "Unknown error"` when calling `console.error()`, or ideally use the `logger` wrapper in `src/utils/logger.ts` which is designed to handle this in a structured way.
