## 2024-05-18 - Missing Authentication in Admin Edge Function
**Vulnerability:** The `create-admin-user` Supabase Edge Function lacked an authorization check, allowing any unauthenticated HTTP request to create an admin user by leveraging the environment's `SUPABASE_SERVICE_ROLE_KEY`.
**Learning:** Edge Functions in Supabase that perform administrative actions with the Service Role key bypass Row Level Security. If the function itself does not implement authentication (e.g., via a Bearer token or API key check), it effectively exposes an unauthenticated administrative endpoint to the public internet.
**Prevention:** Always enforce explicit authorization validation (e.g., verifying an `ADMIN_API_KEY` header against `Deno.env.get()`) in Edge Functions before utilizing elevated privileges like the Service Role key.
## 2024-05-18 - Missing Content Security Policy (CSP)
**Vulnerability:** The application was missing a Content Security Policy (CSP) header/meta tag. While React handles a lot of XSS prevention by default via escaping, third-party libraries, improper use of `innerHTML`, or configuration mistakes could introduce XSS vulnerabilities.
**Learning:** Adding a restrictive CSP creates a defense-in-depth layer. It ensures that even if an XSS vulnerability exists, the malicious script cannot easily execute or communicate with unauthorized external servers.
**Prevention:** Always define a Content Security Policy (`default-src`, `script-src`, `style-src`, `connect-src`) in the entry point (e.g., `index.html`) or via HTTP headers to limit what resources the browser is permitted to load and execute.
## 2025-04-08 - Information leakage in Edge Functions
**Vulnerability:** Supabase edge functions (`create-admin-user/index.ts` and `fetch-paper/index.ts`) were exposing internal error details in their JSON response payloads by directly returning `error.message` or `adminResponse.text()`. Additionally, an undefined `logger` was being used.
**Learning:** Returning native error objects or raw server responses in catch blocks exposes internal implementation details which can be leveraged by attackers.
**Prevention:** Always catch and log native errors on the server side using `console.error` and return a generic error message (e.g. "An internal server error occurred") in the HTTP response to clients. Ensure all logging facilities are properly defined.

## 2024-06-25 - Stop error text leakage in create-admin-user Edge Function
**Vulnerability:** The `supabase/functions/create-admin-user/index.ts` was reading and directly logging `adminResponse.text()`.
**Learning:** Reading and logging raw server response strings via `.text()` can inadvertently leak underlying system details, schemas, or downstream errors into logs, which might be accessible to unauthorized entities if logs are exposed.
**Prevention:** Never log raw response body text blindly. If debugging is necessary, safely parse and select non-sensitive fields or simply log the HTTP status code (e.g. `Admin API error status 500`).
## 2024-05-18 - Missing Timeout on External API Calls
**Vulnerability:** The Edge Function `fetch-paper` made external API calls (`fetch`) without timeouts. If external services (like Crossref or OpenAlex) hang or are slow, the function would wait indefinitely, tying up resources and potentially leading to a Denial of Service (DoS) and excessive costs.
**Learning:** Network requests, especially to third-party endpoints, should never be trusted to resolve in a timely manner.
**Prevention:** Implement a timeout mechanism for all `fetch` requests (e.g., using `AbortController` and `setTimeout`) to fail fast and release resources if the external service takes too long.
## 2025-04-12 - Missing Timeout on External Edge Function Fetch Calls
**Vulnerability:** External `fetch` requests in the `fetch-paper` Edge Function (to OpenAlex and CrossRef APIs) lacked explicit timeouts. This exposed the function to Server-Side Request Forgery (SSRF) related resource exhaustion, where slow or hanging external responses could tie up Edge Function workers, leading to Denial of Service (DoS).
**Learning:** Default `fetch` calls in Supabase Edge Functions (Deno) do not time out automatically. In a highly concurrent environment, relying on the platform's default execution limit (which might be too generous or handled abruptly) is insecure.
**Prevention:** Always implement a custom `fetchWithTimeout` wrapper using `AbortController` and `setTimeout` for any outbound HTTP requests within an Edge Function.
## 2025-04-15 - Unbounded API Requests in Edge Function
**Vulnerability:** The `fetch-paper` Edge Function (`supabase/functions/fetch-paper/index.ts`) made external API calls using `fetch()` without a timeout mechanism, exposing the function to Denial of Service (DoS) and resource exhaustion if the remote APIs (`api.crossref.org` or `api.openalex.org`) hang or take too long to respond.
**Learning:** Standard `fetch` in Deno/Edge Functions does not time out by default.
**Prevention:** Always implement a `fetchWithTimeout` wrapper utilizing `AbortController` and `setTimeout` (e.g., an 8-second limit) for all external API requests in serverless environments.
## 2025-05-18 - Missing Timeout on External API Calls
**Vulnerability:** The `fetch-paper` Edge Function made external HTTP requests to OpenAlex and Crossref using the native `fetch` API without a timeout.
**Learning:** If the upstream API hangs or responds extremely slowly, the Edge Function execution can hang until it hits the platform's maximum execution limit, leading to resource exhaustion and potential Denial of Service (DoS).
**Prevention:** Always wrap external `fetch` calls in Edge Functions with a timeout mechanism (e.g., `AbortController` and `setTimeout`) to fail fast and release resources if the upstream dependency is unresponsive.
## 2025-04-16 - Edge Function Fetch Timeout Vulnerability
**Vulnerability:** Outbound requests via `fetch` were made without a timeout limit, leading to potential Denial of Service (DoS).
**Learning:** `fetch` in Deno defaults to no timeout. An external API that is slow or hangs can tie up function resources indefinitely, exceeding limits and failing subsequent executions.
**Prevention:** Implement a custom `fetchWithTimeout` wrapper using `AbortController` and `setTimeout` for all external outbound requests to strictly enforce timeouts.
## 2025-05-18 - Missing Timeout on External Edge Function Fetch Calls (Re-recorded)
**Vulnerability:** External `fetch` requests in the `fetch-paper` Edge Function (to OpenAlex and CrossRef APIs) lacked explicit timeouts again.
**Learning:** Default `fetch` calls in Supabase Edge Functions (Deno) do not time out automatically.
**Prevention:** Always implement a custom `fetchWithTimeout` wrapper using `AbortController` and `setTimeout` for any outbound HTTP requests within an Edge Function.

---

## Merged from `researchquest/.jules/sentinel.md` (app-scoped journal)

## 2024-05-24 - Stop console.error from leaking raw error objects

**Vulnerability:** Many components like `AddPaperView`, `LeftSidebar`, and `RightSidebar` were catching errors and logging the raw `error` object using `console.error("...", error)`.
**Learning:** This is an information disclosure vulnerability. If an error is an instance of `PostgrestError` (Supabase API error) or a low-level library error, the full object can leak database schema details, API keys embedded in request configs, or stack traces directly to the client's console.
**Prevention:** Always sanitize the error object before logging it to the console on the frontend. Use the pattern `error instanceof Error ? error.message : "Unknown error"` when calling `console.error()`, or ideally use the `logger` wrapper in `src/utils/logger.ts` which is designed to handle this in a structured way.

## 2024-10-24 - Always sanitize innerHTML before passing to external APIs (like ClipboardItem)

**Vulnerability:** In `src/components/editor/MarkdownEditor.tsx`, the function `handleCopyRichText` was passing `previewElement.innerHTML` directly into a `ClipboardItem` as `"text/html"` content without sanitization.
**Learning:** While the DOM might be generated by a sanitizing Markdown parser (like ReactMarkdown with rehype-sanitize), passing raw DOM structure outwards via the Clipboard API bypasses some React protections and can propagate XSS vulnerabilities if malicious HTML is somehow present or interpreted differently by the receiving application.
**Prevention:** Always explicitly wrap raw DOM output (e.g., `element.innerHTML`) with `DOMPurify.sanitize()` before sending it to system APIs, including `document.write` or `ClipboardItem`, to establish defense-in-depth and ensure output encoding is safe.

## 2024-11-20 - Prevent exposing error stack traces in UI components

**Vulnerability:** The `ErrorFallback` component in `src/components/ui/ErrorFallback.tsx` was rendering `error.stack` inside a details block.
**Learning:** Displaying raw stack traces in the UI can leak sensitive internal file paths, component structures, and other implementation details to users in production, violating secure failing practices.
**Prevention:** Never directly display `error.stack` in UI components. Error boundaries should fail securely by only rendering user-friendly error messages (e.g., `error.message`).

## 2024-06-25 - Stop error.message leakage in fetch-paper Edge Function

**Vulnerability:** The catch block in `supabase/functions/fetch-paper/index.ts` was directly returning `error.message` in its 500 JSON response.
**Learning:** Returning native error objects or dynamic `error.message` strings directly to the client can inadvertently leak stack traces, internal system paths, or downstream API secrets.
**Prevention:** Always fail securely on the backend (Edge Functions). Return a standardized, generic error message to the client (e.g., `'An unexpected error occurred'`) while logging the raw error securely on the server-side if needed.

## 2024-05-18 - Sanitize errors in Edge Functions and implement fetch timeouts

**Vulnerability:** Information Leakage & DoS via unconstrained requests in `create-admin-user` and `fetch-paper` Edge Functions.
**Learning:** `fetch` requests inside Deno Edge Functions lacked timeouts, allowing potential unbounded blocking on external calls. Additionally, catch blocks passed raw `error` objects to `console.error()`, which risks leaking stack traces and internal metadata in server logs.
**Prevention:** Always wrap external `fetch` calls with `AbortController` and `setTimeout` (e.g. `fetchWithTimeout`). Always sanitize error outputs in catch blocks before logging (e.g. `error instanceof Error ? error.message : 'Unknown'`).
