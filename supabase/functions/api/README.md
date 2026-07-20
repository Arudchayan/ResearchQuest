# ResearchQuest Agent API (Edge Gateway)

Wave 0 foundation: health, OpenAPI stub, and API key management.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/functions/v1/api/v1/health` | none | Health check |
| GET | `/functions/v1/api/v1/openapi.json` | none | OpenAPI 3.1 document |
| GET | `/functions/v1/api/v1/keys` | JWT or API key (`keys:read`) | List keys |
| POST | `/functions/v1/api/v1/keys` | JWT only | Mint key (secret returned once) |
| DELETE | `/functions/v1/api/v1/keys/:id` | JWT or API key (`keys:write`) | Revoke key |

## Auth

- **User JWT** — from Supabase Auth; used by the app to mint/revoke keys. Grants all scopes.
- **API key** — `Authorization: Bearer rq_...`; hashed at rest; scoped.

## Env

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (standard)
- `ALLOWED_ORIGINS` — comma-separated CORS allowlist (defaults to localhost Vite ports)

## Tests

```bash
deno test --allow-env supabase/functions/api/tests/
```

## Future live contract testing

Once the gateway is deployed in an environment with test credentials, run
Schemathesis against the live OpenAPI endpoint:

```bash
schemathesis run "$SUPABASE_FUNCTIONS_URL/api/v1/openapi.json" \
  --base-url "$SUPABASE_FUNCTIONS_URL/api/v1" \
  --header "Authorization: Bearer $RQ_API_KEY"
```
