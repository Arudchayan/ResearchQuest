# Backend deploy checklist (production)

The Vercel frontend (`research-quest-wine.vercel.app`) talks to Supabase project
`zsjczlmzhyzewpehmngc`. Console errors like CORS on `/functions/v1/api/v1/keys`
or `PGRST205` for `focus_sessions` mean the **database migrations and/or edge
functions in this repo have not been applied** to that project.

Verified against production (2026-07-21):

| Resource | Status |
|----------|--------|
| Core tables (`notes`, `papers`, `ideas`, …) | Present |
| `focus_sessions` | **Missing** (migration `1764300000_…`) |
| `api_keys` / `api_key_audit` | **Missing** (migration `1764600000_…`) |
| `feed_sources` / `feed_items` | **Missing** (migration `1764700000_…`) |
| Edge function `api` | **Not deployed** (`Requested function was not found`) |
| Edge functions `deep-research`, `fetch-paper`, `create-admin-user` | **Not deployed** |

The browser reports the missing `api` function as a **CORS** failure because the
Supabase gateway 404 on the OPTIONS preflight is not an HTTP OK response.

## 1. Apply pending migrations

From a machine with the [Supabase CLI](https://supabase.com/docs/guides/cli)
linked to the project:

```bash
supabase link --project-ref zsjczlmzhyzewpehmngc
supabase db push
```

Or apply SQL from `supabase/migrations/` in the dashboard SQL editor, starting
at `1764300000_create_focus_sessions.sql` through the latest file.

## 2. Deploy edge functions

```bash
supabase functions deploy api
supabase functions deploy fetch-paper
supabase functions deploy deep-research
supabase functions deploy create-admin-user
```

Optional: set a tight CORS allowlist once the site URL is stable:

```bash
supabase secrets set ALLOWED_ORIGINS="https://research-quest-wine.vercel.app"
```

If `ALLOWED_ORIGINS` is unset, the `api` gateway uses open CORS (`*`), matching
`deep-research` / `fetch-paper`, so production is not blocked by a localhost-only
default.

## 3. Smoke-check

```bash
curl -sS "$SUPABASE_URL/functions/v1/api/v1/health"
# expect: {"status":"ok",...}

curl -sS -o /dev/null -w "%{http_code}\n" \
  "$SUPABASE_URL/rest/v1/focus_sessions?select=id&limit=0" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
# expect: 200 (empty array / content-range), not 404 PGRST205
```

## CSP note (Vercel Live)

`researchquest/index.html` allows `https://vercel.live` in `script-src` /
`frame-src` so the Vercel Live feedback toolbar is not blocked by the app CSP.
That warning is unrelated to Supabase.
