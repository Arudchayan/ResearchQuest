# Deployment Runbook (Edge Hardening)

## RLS audit — stale `USING(true)` policies (PR20-82)

Early migration `1762555347` created permissive `topics` policies
(`SELECT USING (true)`, `UPDATE USING (true)`, `DELETE USING (true)`,
`INSERT WITH CHECK (true)`). Later hardening may have replaced them; run this
retroactive check against **prod** on every deploy and treat any hit as a
release blocker:

```sql
-- Retroactive check: flag any permissive USING(true) / WITH CHECK(true)
-- policies, with emphasis on the known-stale topics policies.
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual = 'true'
    OR with_check = 'true'
    OR qual ILIKE '%USING (true)%'
  )
ORDER BY tablename, policyname;
```

Expected result: **zero rows** (or only rows with a linked waiver comment).
If `topics` rows appear, re-apply the owner-scoped policies before releasing.

## `api_keys` RLS intent (PR20-83)

`api_keys` / `api_key_audit` expose **SELECT-only** RLS policies by design.
Mint/revoke/audit writes go through the Edge gateway with the service role so
clients cannot forge `key_hash`, `scopes`, or audit rows (see migration
`1764900000`, `COMMENT ON TABLE`). The absence of INSERT/UPDATE/DELETE
policies is intentional default-deny — do not "fix" it by adding permissive
policies. Any future client-write path needs an explicit policy **plus**
updated Edge guards.

## `source_url` SSRF note (PR20-90)

The Edge gateway validates `source_url`/`url` as `http(s)` scheme-only
(`isHttpUrl`, `promotedPaperSourceUrl`) and **never fetches them
server-side**, so there is no SSRF surface today. Private-range/intranet hosts
are deliberately allowed (users file intranet papers). If the gateway ever
fetches these URLs (previews, embeds), add private-range + redirect-chain
blocking first.

## Edge error contract (PR20-89)

All Edge errors return `{ error: { code, message[, details] } }` with the
status code matching the failure (`401` auth, `403` scope, `400` validation,
`404` not found, `409` conflict, `500` internal). Frontend
`extractApiErrorMessage` reads `error.message` with a fallback — tests assert
this shape, not exact copy.

## `create-admin-user` (retired 410)

Production already serves this function as **410 Gone** with `verify_jwt =
true`. Keep it that way:

```bash
# From repo root. Deploys the stub in supabase/functions/create-admin-user.
# Do not restore Admin API user-creation in this function.
supabase functions deploy create-admin-user --project-ref zsjczlmzhyzewpehmngc
```

`supabase/config.toml` has `[functions.create-admin-user] enabled = true` and
`verify_jwt = true` so a catch-all `supabase functions deploy` cannot revive
the old privileged endpoint. Create users from the Supabase Dashboard or CLI.

## Live demo hosts

Canonical public demo: `https://research-quest-wine.vercel.app`.
`https://rq.arudchayan.com` is an alias on the same Vercel project
(`research-quest`). Do not delete the historical Vercel twin without checking
aliases and DNS. `ALLOWED_ORIGINS` must include both hosts.

