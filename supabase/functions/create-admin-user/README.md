# create-admin-user (do not deploy casually)

This edge function creates a confirmed Supabase Auth user via the **service
role** Admin API. It is a privileged bootstrap tool.

## Production policy

- **Do not deploy** this function to a public Supabase project unless you
  explicitly need it.
- Require a strong `ADMIN_API_KEY` and send it as `Authorization: Bearer …`.
- Prefer the Supabase Dashboard / CLI for user creation in normal setups.

If you open-source a fork, keep this function out of default deploy scripts.
