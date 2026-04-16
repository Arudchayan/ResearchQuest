## 2025-04-16 - Edge Function Fetch Timeout Vulnerability
**Vulnerability:** Outbound requests via `fetch` were made without a timeout limit, leading to potential Denial of Service (DoS).
**Learning:** `fetch` in Deno defaults to no timeout. An external API that is slow or hangs can tie up function resources indefinitely, exceeding limits and failing subsequent executions.
**Prevention:** Implement a custom `fetchWithTimeout` wrapper using `AbortController` and `setTimeout` for all external outbound requests to strictly enforce timeouts.
