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
