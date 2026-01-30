## 2025-02-18 - Unsafe URL Rendering in Entity Views
**Vulnerability:** External links (like `source_url` in Papers) were rendered directly into `href` attributes without validation, allowing for potential XSS via `javascript:` URLs if the data layer was compromised.
**Learning:** React escapes content but NOT attribute values like `href`. Simply checking `if (url)` is insufficient for security.
**Prevention:** Always wrap external link rendering with `isValidUrl()` from `utils/security.ts`, specifically ensuring the protocol is whitelisted (http/https).
