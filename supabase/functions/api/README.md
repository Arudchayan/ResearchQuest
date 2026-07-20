# ResearchQuest Agent API (Edge Gateway)

Wave 0 foundation: health, OpenAPI stub, and API key management.

## Endpoints

| Method | Path                                | Auth                          | Description                     |
| ------ | ----------------------------------- | ----------------------------- | ------------------------------- |
| GET    | `/functions/v1/api/v1/health`       | none                          | Health check                    |
| GET    | `/functions/v1/api/v1/openapi.json` | none                          | OpenAPI 3.1 document            |
| GET    | `/functions/v1/api/v1/keys`         | JWT or API key (`keys:read`)  | List keys                       |
| POST   | `/functions/v1/api/v1/keys`         | JWT only                      | Mint key (secret returned once) |
| DELETE | `/functions/v1/api/v1/keys/:id`     | JWT or API key (`keys:write`) | Revoke key                      |

## Auth

- **User JWT** — from Supabase Auth; used by the app to mint/revoke keys. Grants
  all scopes.
- **API key** — `Authorization: Bearer rq_...`; hashed at rest; scoped.

## Curl examples

Set these once in your shell:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export RQ_API_KEY="rq_your_agent_key"
```

### Health and key management

```bash
curl "$SUPABASE_URL/functions/v1/api/v1/health"

curl "$SUPABASE_URL/functions/v1/api/v1/keys" \
  -H "Authorization: Bearer $RQ_API_KEY"
```

Minting new API keys requires a signed-in user JWT, not another API key:

```bash
export USER_JWT="eyJ..."

curl -X POST "$SUPABASE_URL/functions/v1/api/v1/keys" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Local research agent",
    "scopes": ["notes:write", "tasks:write"]
  }'
```

### Agent note/task bulk writes

Entity CRUD may be delivered by a later PR, but agents should target these
gateway URLs with scoped API-key auth:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/api/v1/notes:batchCreate" \
  -H "Authorization: Bearer $RQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": [
      {
        "title": "Transformer scaling notes",
        "markdown_body": "Key takeaways from today...",
        "tags": ["agent", "literature"]
      },
      {
        "title": "Open questions",
        "markdown_body": "- Compare retrieval baselines\n- Check ablations",
        "tags": ["agent"]
      }
    ]
  }'

curl -X POST "$SUPABASE_URL/functions/v1/api/v1/tasks:batchCreate" \
  -H "Authorization: Bearer $RQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      {
        "title": "Summarize new retrieval papers",
        "description": "Create notes for the top five relevant papers.",
        "priority": "High"
      },
      {
        "title": "Prepare experiment checklist",
        "description": "Turn agent findings into implementation tasks.",
        "priority": "Medium"
      }
    ]
  }'
```

## Env

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (standard)
- `ALLOWED_ORIGINS` — comma-separated CORS allowlist (defaults to localhost Vite
  ports)

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
