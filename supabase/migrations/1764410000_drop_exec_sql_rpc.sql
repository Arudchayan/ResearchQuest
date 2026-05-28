-- Drop the exec_sql RPC that was created manually via Supabase dashboard.
-- This function allowed arbitrary SQL execution with the service_role key
-- and was not tracked in infrastructure-as-code.
-- The create-admin-user edge function has been rewritten to use the
-- Supabase Admin API instead.
DROP FUNCTION IF EXISTS public.exec_sql(query text, params text[]);
