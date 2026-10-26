-- Migration: atlas_* RLS consolidation — scope to authenticated, initPlan-wrap
--            helpers, merge duplicate permissive SELECT policies, cover 2 FKs.
-- Created at: 1765600000
--
-- Clears Supabase advisors on the 7 atlas_* tables (live 2026-09-28):
--   WARN auth_rls_initplan (0003)            x14 -> 0
--   WARN multiple_permissive_policies (0006) x42 -> 0
--   INFO unindexed_foreign_keys (0001)       x2  -> 0
--
-- Access model (unchanged; see atlas-sync Edge Function header, not touched):
--   Tier 0 "owner": opaque client UUID claim in GUC app.current_atlas_client.
--     Browsers cannot set Postgres GUCs through PostgREST and no SQL function
--     in the database sets this GUC, so the ONLY live Tier-0 path is the
--     atlas-sync Edge Function using service_role (BYPASSRLS). The owner
--     predicate is kept verbatim as defense-in-depth for non-bypass roles.
--   Tier 1 "linked": a ResearchQuest user whose auth.uid() equals
--     atlas_identities.auth_user_id may READ that identity and its rows.
--
-- Changes:
--   1. Policies were TO public (incl. anon). anon has no reachable use:
--      auth.uid() is NULL and the GUC cannot be set by an API client, so every
--      anon predicate is already false (live check as anon: 0 rows on all 7
--      tables). New policies are TO authenticated.
--   2. auth.uid() and current_setting() wrapped as (SELECT ...) -> initPlan
--      (form matches Supabase lint 0003: 'select auth.uid()' / 'select current_setting(').
--   3. FOR ALL owner policy + FOR SELECT linked policy (2 permissive SELECTs)
--      split into: ONE SELECT policy (owner OR linked — exact same visible set)
--      plus INSERT / UPDATE / DELETE owner-only policies.
--   4. Every write policy binds ownership: INSERT WITH CHECK owner,
--      UPDATE USING owner + WITH CHECK owner, DELETE USING owner.
--      Linked (Tier-1) users stay read-only, as before.
--   5. Covering indexes for atlas_identities(auth_user_id) and
--      atlas_validation_sessions(identity_id) (also serve the linked-read
--      subqueries).
--   6. Grants: anon loses all table privileges on atlas_* (no policy grants it
--      anything, and TRUNCATE ignores RLS); authenticated loses TRUNCATE /
--      TRIGGER / REFERENCES (keeps SELECT/INSERT/UPDATE/DELETE, gated by RLS).
--      service_role unchanged. Section 6 is separable if a policy-only change
--      is preferred.
--
-- Not touched: atlas-sync or any Edge Function, service_role, table shapes,
-- migrations 1764800000..1765000000, save_idea_with_links (1765500000).
--
-- All policy DDL is literal (no dynamic EXECUTE) so the static RLS audit can
-- read it. Idempotent & replay-safe: each table block is guarded by to_regclass (the
-- atlas_* tables were created on live by migrations 20260925084550..
-- 20260925163557 that are not in this repo), DROP POLICY IF EXISTS,
-- CREATE INDEX IF NOT EXISTS.


-- ---------------------------------------------------------------------------
-- atlas_identities
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.atlas_identities') IS NOT NULL THEN
    DROP POLICY IF EXISTS atlas_identities_owner ON public.atlas_identities;
    DROP POLICY IF EXISTS atlas_identities_linked_read ON public.atlas_identities;
    DROP POLICY IF EXISTS atlas_identities_select ON public.atlas_identities;
    DROP POLICY IF EXISTS atlas_identities_owner_insert ON public.atlas_identities;
    DROP POLICY IF EXISTS atlas_identities_owner_update ON public.atlas_identities;
    DROP POLICY IF EXISTS atlas_identities_owner_delete ON public.atlas_identities;

    CREATE POLICY atlas_identities_select ON public.atlas_identities
      FOR SELECT TO authenticated
      USING (
        client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
        OR auth_user_id = (SELECT auth.uid())
      );

    CREATE POLICY atlas_identities_owner_insert ON public.atlas_identities
      FOR INSERT TO authenticated
      WITH CHECK (client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid);

    CREATE POLICY atlas_identities_owner_update ON public.atlas_identities
      FOR UPDATE TO authenticated
      USING (client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid)
      WITH CHECK (client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid);

    CREATE POLICY atlas_identities_owner_delete ON public.atlas_identities
      FOR DELETE TO authenticated
      USING (client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid);

    -- Covers atlas_identities_auth_user_id_fkey + the linked-read lookups.
    CREATE INDEX IF NOT EXISTS atlas_identities_auth_user_id_idx
      ON public.atlas_identities (auth_user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- atlas_progress_snapshots
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.atlas_progress_snapshots') IS NOT NULL THEN
    DROP POLICY IF EXISTS atlas_owner_rw ON public.atlas_progress_snapshots;
    DROP POLICY IF EXISTS atlas_linked_read ON public.atlas_progress_snapshots;
    DROP POLICY IF EXISTS atlas_select ON public.atlas_progress_snapshots;
    DROP POLICY IF EXISTS atlas_owner_insert ON public.atlas_progress_snapshots;
    DROP POLICY IF EXISTS atlas_owner_update ON public.atlas_progress_snapshots;
    DROP POLICY IF EXISTS atlas_owner_delete ON public.atlas_progress_snapshots;

    CREATE POLICY atlas_select ON public.atlas_progress_snapshots
      FOR SELECT TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
           OR i.auth_user_id = (SELECT auth.uid())
      )
      );

    CREATE POLICY atlas_owner_insert ON public.atlas_progress_snapshots
      FOR INSERT TO authenticated
      WITH CHECK (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    CREATE POLICY atlas_owner_update ON public.atlas_progress_snapshots
      FOR UPDATE TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      )
      WITH CHECK (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    CREATE POLICY atlas_owner_delete ON public.atlas_progress_snapshots
      FOR DELETE TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- atlas_proof_drafts
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.atlas_proof_drafts') IS NOT NULL THEN
    DROP POLICY IF EXISTS atlas_owner_rw ON public.atlas_proof_drafts;
    DROP POLICY IF EXISTS atlas_linked_read ON public.atlas_proof_drafts;
    DROP POLICY IF EXISTS atlas_select ON public.atlas_proof_drafts;
    DROP POLICY IF EXISTS atlas_owner_insert ON public.atlas_proof_drafts;
    DROP POLICY IF EXISTS atlas_owner_update ON public.atlas_proof_drafts;
    DROP POLICY IF EXISTS atlas_owner_delete ON public.atlas_proof_drafts;

    CREATE POLICY atlas_select ON public.atlas_proof_drafts
      FOR SELECT TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
           OR i.auth_user_id = (SELECT auth.uid())
      )
      );

    CREATE POLICY atlas_owner_insert ON public.atlas_proof_drafts
      FOR INSERT TO authenticated
      WITH CHECK (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    CREATE POLICY atlas_owner_update ON public.atlas_proof_drafts
      FOR UPDATE TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      )
      WITH CHECK (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    CREATE POLICY atlas_owner_delete ON public.atlas_proof_drafts
      FOR DELETE TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- atlas_fresh_check_attempts
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.atlas_fresh_check_attempts') IS NOT NULL THEN
    DROP POLICY IF EXISTS atlas_owner_rw ON public.atlas_fresh_check_attempts;
    DROP POLICY IF EXISTS atlas_linked_read ON public.atlas_fresh_check_attempts;
    DROP POLICY IF EXISTS atlas_select ON public.atlas_fresh_check_attempts;
    DROP POLICY IF EXISTS atlas_owner_insert ON public.atlas_fresh_check_attempts;
    DROP POLICY IF EXISTS atlas_owner_update ON public.atlas_fresh_check_attempts;
    DROP POLICY IF EXISTS atlas_owner_delete ON public.atlas_fresh_check_attempts;

    CREATE POLICY atlas_select ON public.atlas_fresh_check_attempts
      FOR SELECT TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
           OR i.auth_user_id = (SELECT auth.uid())
      )
      );

    CREATE POLICY atlas_owner_insert ON public.atlas_fresh_check_attempts
      FOR INSERT TO authenticated
      WITH CHECK (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    CREATE POLICY atlas_owner_update ON public.atlas_fresh_check_attempts
      FOR UPDATE TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      )
      WITH CHECK (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    CREATE POLICY atlas_owner_delete ON public.atlas_fresh_check_attempts
      FOR DELETE TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- atlas_validation_sessions
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.atlas_validation_sessions') IS NOT NULL THEN
    DROP POLICY IF EXISTS atlas_owner_rw ON public.atlas_validation_sessions;
    DROP POLICY IF EXISTS atlas_linked_read ON public.atlas_validation_sessions;
    DROP POLICY IF EXISTS atlas_select ON public.atlas_validation_sessions;
    DROP POLICY IF EXISTS atlas_owner_insert ON public.atlas_validation_sessions;
    DROP POLICY IF EXISTS atlas_owner_update ON public.atlas_validation_sessions;
    DROP POLICY IF EXISTS atlas_owner_delete ON public.atlas_validation_sessions;

    CREATE POLICY atlas_select ON public.atlas_validation_sessions
      FOR SELECT TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
           OR i.auth_user_id = (SELECT auth.uid())
      )
      );

    CREATE POLICY atlas_owner_insert ON public.atlas_validation_sessions
      FOR INSERT TO authenticated
      WITH CHECK (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    CREATE POLICY atlas_owner_update ON public.atlas_validation_sessions
      FOR UPDATE TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      )
      WITH CHECK (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    CREATE POLICY atlas_owner_delete ON public.atlas_validation_sessions
      FOR DELETE TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    -- Covers atlas_validation_sessions_identity_id_fkey + RLS subqueries.
    CREATE INDEX IF NOT EXISTS atlas_validation_sessions_identity_id_idx
      ON public.atlas_validation_sessions (identity_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- atlas_link_checks
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.atlas_link_checks') IS NOT NULL THEN
    DROP POLICY IF EXISTS atlas_owner_rw ON public.atlas_link_checks;
    DROP POLICY IF EXISTS atlas_linked_read ON public.atlas_link_checks;
    DROP POLICY IF EXISTS atlas_select ON public.atlas_link_checks;
    DROP POLICY IF EXISTS atlas_owner_insert ON public.atlas_link_checks;
    DROP POLICY IF EXISTS atlas_owner_update ON public.atlas_link_checks;
    DROP POLICY IF EXISTS atlas_owner_delete ON public.atlas_link_checks;

    CREATE POLICY atlas_select ON public.atlas_link_checks
      FOR SELECT TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
           OR i.auth_user_id = (SELECT auth.uid())
      )
      );

    CREATE POLICY atlas_owner_insert ON public.atlas_link_checks
      FOR INSERT TO authenticated
      WITH CHECK (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    CREATE POLICY atlas_owner_update ON public.atlas_link_checks
      FOR UPDATE TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      )
      WITH CHECK (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    CREATE POLICY atlas_owner_delete ON public.atlas_link_checks
      FOR DELETE TO authenticated
      USING (
      identity_id IN (
        SELECT i.id FROM public.atlas_identities i
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- atlas_validation_scores
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.atlas_validation_scores') IS NOT NULL THEN
    DROP POLICY IF EXISTS atlas_owner_rw ON public.atlas_validation_scores;
    DROP POLICY IF EXISTS atlas_linked_read ON public.atlas_validation_scores;
    DROP POLICY IF EXISTS atlas_select ON public.atlas_validation_scores;
    DROP POLICY IF EXISTS atlas_owner_insert ON public.atlas_validation_scores;
    DROP POLICY IF EXISTS atlas_owner_update ON public.atlas_validation_scores;
    DROP POLICY IF EXISTS atlas_owner_delete ON public.atlas_validation_scores;

    CREATE POLICY atlas_select ON public.atlas_validation_scores
      FOR SELECT TO authenticated
      USING (
      session_id IN (
        SELECT s.id FROM public.atlas_validation_sessions s
        JOIN public.atlas_identities i ON s.identity_id = i.id
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
           OR i.auth_user_id = (SELECT auth.uid())
      )
      );

    CREATE POLICY atlas_owner_insert ON public.atlas_validation_scores
      FOR INSERT TO authenticated
      WITH CHECK (
      session_id IN (
        SELECT s.id FROM public.atlas_validation_sessions s
        JOIN public.atlas_identities i ON s.identity_id = i.id
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    CREATE POLICY atlas_owner_update ON public.atlas_validation_scores
      FOR UPDATE TO authenticated
      USING (
      session_id IN (
        SELECT s.id FROM public.atlas_validation_sessions s
        JOIN public.atlas_identities i ON s.identity_id = i.id
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      )
      WITH CHECK (
      session_id IN (
        SELECT s.id FROM public.atlas_validation_sessions s
        JOIN public.atlas_identities i ON s.identity_id = i.id
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );

    CREATE POLICY atlas_owner_delete ON public.atlas_validation_scores
      FOR DELETE TO authenticated
      USING (
      session_id IN (
        SELECT s.id FROM public.atlas_validation_sessions s
        JOIN public.atlas_identities i ON s.identity_id = i.id
        WHERE i.client_uuid = NULLIF((SELECT current_setting('app.current_atlas_client', true)), '')::uuid
      )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Grants (separable section). anon gets no atlas_* privileges: no anon policy
-- exists and TRUNCATE ignores RLS. authenticated keeps DML only (RLS-gated).
-- service_role is unchanged (atlas-sync Edge Function, BYPASSRLS).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'atlas_identities',
    'atlas_progress_snapshots',
    'atlas_proof_drafts',
    'atlas_fresh_check_attempts',
    'atlas_validation_sessions',
    'atlas_validation_scores',
    'atlas_link_checks'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.%I FROM authenticated', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    END IF;
  END LOOP;
END $$;
