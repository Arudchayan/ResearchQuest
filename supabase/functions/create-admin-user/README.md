# create-admin-user (retired)

This edge function is a **hard 410 Gone** stub. Production was redeployed this
way after the previous Admin API user-creation surface was retired.

## Production policy

- Keep the stub **deployed** (`enabled = true`, `verify_jwt = true` in
  `supabase/config.toml`) so a catch-all deploy cannot revive the old
  privileged endpoint.
- Create users from the **Supabase Dashboard** or CLI. Do not restore
  service-role user creation in this function without a dedicated security
  review.
- CORS is self-contained (no `../api/_shared/cors.ts` import).

If you open-source a fork, keep this function as a 410 stub in default
deploys.
