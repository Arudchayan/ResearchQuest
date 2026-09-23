# Edge Function platform JWT settings

**Status:** proposal pending RQ Architect LGTM. Do not merge or deploy
until that LGTM. Live production (`zsjczlmzhyzewpehmngc`) still has
`verify_jwt=false` on `api`, `fetch-paper`, and `deep-research`.
`create-admin-user` stays the JWT-on 410 stub.

Proposed end state in `supabase/config.toml`:

| Function | Platform `verify_jwt` | Notes |
| --- | --- | --- |
| `fetch-paper` | `true` | Defense in depth; handler still calls `supabase.auth.getUser()`. |
| `deep-research` | `true` | Same as `fetch-paper`. |
| `api` | `false` | Documented exception below. |
| `create-admin-user` | `true` | Unchanged 410 stub. Do not restore Admin API user-creation. |

This file is the exception record for **`api` only**. Flipping live
`verify_jwt` is out of scope here; the coordinator handles that after
Architect LGTM.

## `api` exception — keep `verify_jwt = false`

The Agent API gateway must accept callers that are **not** carrying a
Supabase user JWT:

1. **Public discovery (no `Authorization` required):**
   `GET /health`, `GET /v1/health`, `GET /openapi.json`,
   `GET /v1/openapi.json`, `GET /explore`.
2. **Dual auth on every other route:** `Authorization: Bearer <user JWT>`
   **or** `Authorization: Bearer rq_…`. `rq_` API keys are hashed
   secrets, not JWTs. Platform `verify_jwt=true` rejects them before
   `authenticateRequest` runs, which would break API-key clients.

`fetch-paper` and `deep-research` do not have those constraints: they
already authenticate with `getUser()` and are invoked with a user JWT,
so platform verification is additional defense in depth. CORS preflight
is not a reason to leave JWT off; the Supabase gateway allows `OPTIONS`
with `verify_jwt` enabled.

## Residual risk (handler-owned)

Platform JWT is off for `api`, so the function body is the control
plane. Keep these invariants:

- **Public allowlist stays tight.** Only the discovery routes listed
  above skip auth. Adding a new unauthenticated path requires updating
  this exception.
- **`authenticateRequest` gates all non-public routes.** It must run
  before key, entity, and feed handlers. Do not add routes after the
  discovery `if`s without going through it.
- **CORS is not an auth control.** If `ALLOWED_ORIGINS` is unset, `api`
  falls back to the production app hosts plus localhost Vite ports (not
  `*`). A wildcard (`*`) or overly broad allowlist would widen *browser*
  access to public discovery; non-browser clients ignore CORS and can
  already hit those routes.
- **API-key path uses the service role after hash lookup.** A valid
  `rq_` key is resolved by `key_hash` then served with
  `supabaseAdmin`. Scope checks (`requireScopes` / `hasScope`) and
  JWT-only rules (for example key minting) must stay correct; a missed
  scope check is a service-role data path.

## Owners

- **Edge Function Auth Engineer** — proposed this setting and owns the
  `api` public-route / `authenticateRequest` invariants.
- **RQ Architect** — required LGTM before merge or any live
  `verify_jwt` change.
