# create-admin-user (do not deploy casually)

This edge function creates a confirmed Supabase Auth user via the **service
role** Admin API. It is a privileged bootstrap tool.

## Production policy

- **Undeployed by default.** Do NOT include this function in default
  `supabase functions deploy` catch-all scripts or CI deploy jobs. Deploy it
  temporarily only when bootstrapping, then delete the deployment.
- Require a strong `ADMIN_API_KEY` and send it as `Authorization: Bearer …`.
  Startup + per-request guard: at least 32 chars, ≥16 unique chars, no
  `test`/`password`/`changeme`-style placeholders. Missing/weak keys fail
  closed (`500 CONFIG_ERROR`); wrong callers get `401`.
- `role` is whitelisted (`authenticated` only). Arbitrary role strings are
  rejected with `400 INVALID_ROLE`.
- CORS is intentionally self-contained (no `../api/_shared/cors.ts` import)
  so this function stays deploy-independent from the `api` gateway.
- Prefer the Supabase Dashboard / CLI for user creation in normal setups.

If you open-source a fork, keep this function out of default deploy scripts.
