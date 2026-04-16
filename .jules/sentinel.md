## 2025-04-15 - Unbounded API Requests in Edge Function
**Vulnerability:** The `fetch-paper` Edge Function (`supabase/functions/fetch-paper/index.ts`) made external API calls using `fetch()` without a timeout mechanism, exposing the function to Denial of Service (DoS) and resource exhaustion if the remote APIs (`api.crossref.org` or `api.openalex.org`) hang or take too long to respond.
**Learning:** Standard `fetch` in Deno/Edge Functions does not time out by default.
**Prevention:** Always implement a `fetchWithTimeout` wrapper utilizing `AbortController` and `setTimeout` (e.g., an 8-second limit) for all external API requests in serverless environments.
