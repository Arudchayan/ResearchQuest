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
