# ResearchQuest Agent API (Edge Gateway)

Supabase Edge Function gateway for agents and app integrations. The canonical
runtime contract is exposed by `GET /explore` and `GET /openapi.json`; use those
endpoints as the source of truth for schemas, examples, scope mappings, and
workflow recipes.

Append the paths below to the deployed prefix: `/functions/v1/api/v1`.

## Endpoints

| Method | Path | Auth / scope | Description |
| --- | --- | --- | --- |
| GET | `/health` | none | Health check with gateway version and timestamp |
| GET | `/openapi.json` | none | OpenAPI 3.1 document |
| GET | `/explore` | none | Agent-friendly discovery document; supports `resource`, `action`, and `include` filters |
| GET | `/keys` | JWT or API key with `keys:read` | List API keys for the authenticated user |
| POST | `/keys` | JWT only | Mint a scoped API key; the secret is returned once |
| DELETE | `/keys/:id` | JWT or API key with `keys:write` | Revoke an API key |
| GET | `/{resource}` | `{resource}:read` | List entities with `limit` and `offset` pagination |
| POST | `/{resource}` | `{resource}:write` | Create one entity |
| GET | `/{resource}/:id` | `{resource}:read` | Fetch one entity by UUID |
| PATCH | `/{resource}/:id` | `{resource}:write` | Update one entity |
| DELETE | `/{resource}/:id` | `{resource}:write` | Delete one entity |
| POST | `/{resource}:batchCreate` | `{resource}:write` | Create up to 50 entities; body may be an array or contain `items`/`data` |
| POST | `/topics/:id/attach` | `topics:write` | Attach a note, paper, or idea to a topic |
| POST | `/topics/:id/detach` | `topics:write` | Detach a note, paper, or idea from a topic |
| GET | `/feed-sources` | `feeds:read` | List feed sources |
| POST | `/feed-sources` | `feeds:write` | Create a feed source |
| GET | `/feed-sources/:id` | `feeds:read` | Fetch one feed source |
| PATCH | `/feed-sources/:id` | `feeds:write` | Update one feed source |
| DELETE | `/feed-sources/:id` | `feeds:write` | Delete one feed source |
| GET | `/feed-items` | `feeds:read` | List feed items; optional `type` and `status` filters |
| POST | `/feed-items` | `feeds:ingest` | Ingest one feed item |
| POST | `/feed-items:batchCreate` | `feeds:ingest` | Ingest 1-100 feed items, deduplicating by `external_id` |
| PATCH | `/feed-items/:id` | `feeds:write` | Triage a feed item to `new`, `triaged`, or `archived` |
| POST | `/feed-items/:id/promote` | `feeds:write` plus target write scope | Promote a feed item to a paper, task, or note |

Entity resources are `notes`, `papers`, `ideas`, `tasks`, `topics`, and
`goals`. The `research_goals` path is accepted as an alias for `goals`.

Topic attach/detach accepts:

```json
{
  "entity_type": "note",
  "entity_id": "00000000-0000-4000-8000-000000000000"
}
```

`entity_type` may be `note`, `paper`, or `idea`.

## Discovery endpoints

Use these before making authenticated calls:

- **`GET /explore`** — Start here for LLM agents and automation. Returns inline
  schemas, required fields, scope mappings, copy-paste examples, and workflow
  recipes. Supports optional filters: `?resource=notes`, `?action=create`,
  `?include=schemas,examples,workflows,scopes`.
- **`GET /openapi.json`** — Full OpenAPI 3.1 machine contract for codegen,
  Schemathesis fuzz testing, and strict schema validation.

```bash
curl "$SUPABASE_URL/functions/v1/api/v1/explore"

curl "$SUPABASE_URL/functions/v1/api/v1/explore?resource=notes&action=create"

curl "$SUPABASE_URL/functions/v1/api/v1/openapi.json"
```

## Auth, scopes, and limits

- **User JWT** — from Supabase Auth. Grants `*` and is required to mint new API
  keys.
- **API key** — `Authorization: Bearer rq_...`; hashed at rest and restricted to
  its configured scopes.
- **Scopes** — available scopes are `keys:read`, `keys:write`, `notes:read`,
  `notes:write`, `papers:read`, `papers:write`, `ideas:read`, `ideas:write`,
  `topics:read`, `topics:write`, `tasks:read`, `tasks:write`, `goals:read`,
  `goals:write`, `feeds:read`, `feeds:write`, and `feeds:ingest`.
- **Rate limiting (alpha)** — authenticated requests are limited in-memory per
  Edge Function isolate, currently 60 requests per minute per JWT user or API
  key. Limits reset when isolates restart and are not globally coordinated.

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
    "scopes": ["notes:write", "tasks:write", "feeds:ingest"]
  }'
```

### Entity CRUD and bulk writes

```bash
curl -X POST "$SUPABASE_URL/functions/v1/api/v1/notes" \
  -H "Authorization: Bearer $RQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Transformer scaling notes",
    "markdown_body": "Key takeaways from today...",
    "tags": ["agent", "literature"]
  }'

curl "$SUPABASE_URL/functions/v1/api/v1/notes?limit=25&offset=0" \
  -H "Authorization: Bearer $RQ_API_KEY"

curl -X POST "$SUPABASE_URL/functions/v1/api/v1/tasks:batchCreate" \
  -H "Authorization: Bearer $RQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "title": "Summarize new retrieval papers",
        "description": "Create notes for the top five relevant papers.",
        "priority": "high"
      },
      {
        "title": "Prepare experiment checklist",
        "description": "Turn agent findings into implementation tasks.",
        "priority": "medium"
      }
    ]
  }'
```

### Topic links

```bash
curl -X POST "$SUPABASE_URL/functions/v1/api/v1/topics/$TOPIC_ID/attach" \
  -H "Authorization: Bearer $RQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "paper",
    "entity_id": "'"$PAPER_ID"'"
  }'
```

### Feed ingest, triage, and promote

```bash
curl -X POST "$SUPABASE_URL/functions/v1/api/v1/feed-items:batchCreate" \
  -H "Authorization: Bearer $RQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "type": "paper",
        "title": "New preprint to review",
        "summary": "Short abstract or agent summary",
        "url": "https://example.com/paper",
        "external_id": "arxiv:0000.00000",
        "payload": {"source": "agent"}
      }
    ]
  }'

curl -X PATCH "$SUPABASE_URL/functions/v1/api/v1/feed-items/$FEED_ITEM_ID" \
  -H "Authorization: Bearer $RQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "triaged"}'

curl -X POST "$SUPABASE_URL/functions/v1/api/v1/feed-items/$FEED_ITEM_ID/promote" \
  -H "Authorization: Bearer $RQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "target": "paper",
    "status": "To Read"
  }'
```

Promotion targets are `paper`, `task`, and `note`. The request must include
`feeds:write` and the target write scope, for example `papers:write` when
promoting to a paper.

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
