-- PR20 item 83: document intentional Edge-only writes for api_keys / api_key_audit.
--
-- These tables expose SELECT-only RLS policies by design. Mint, revoke, and
-- audit writes go through the Edge gateway with the service role so clients
-- cannot forge key_hash, scopes, or audit rows. The absence of
-- INSERT/UPDATE/DELETE policies is intentional, not a gap: without a policy
-- the default-deny posture blocks direct client writes.
--
-- If a future client-side write path is ever needed, add an explicit policy
-- here AND update the Edge gateway guards; do not silently widen access.

COMMENT ON TABLE api_keys IS
  'Hashed per-user API keys for ResearchQuest agent REST gateway. SELECT-only RLS by design; mint/revoke writes are Edge (service-role) only.';

COMMENT ON TABLE api_key_audit IS
  'Audit log for API key usage and lifecycle events. SELECT-only RLS by design; inserts are Edge (service-role) only.';
