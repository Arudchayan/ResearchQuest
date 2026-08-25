-- ARU-657 (follow-up): server-side DOI dedupe guarantee.
-- The app ships a check-then-insert guard (PR #692); this migration closes the
-- remaining race window (concurrent adds can both pass the check) and cleans
-- legacy duplicates already persisted before the guard existed.
--
-- 1) Canonicalize stored DOIs to match the app's normalizeDoi() convention
--    (lowercase, strip https?://(dx.)doi.org/ and doi: prefixes).
-- 2) Delete exact-duplicate rows per (user_id, doi), keeping the earliest.
-- 3) Enforce uniqueness at the database level going forward.

BEGIN;

UPDATE papers
SET doi = regexp_replace(
        regexp_replace(lower(btrim(doi)), '^https?://(dx\.)?doi\.org/', ''),
        '^doi:\s*', '')
WHERE doi IS NOT NULL AND doi <> '';

DELETE FROM papers p
USING papers p2
WHERE p.doi = p2.doi
  AND p.doi IS NOT NULL AND p.doi <> ''
  AND p.user_id = p2.user_id
  AND (p.created_at, p.id) > (p2.created_at, p2.id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_papers_user_doi_unique
  ON papers (user_id, doi)
  WHERE doi IS NOT NULL AND doi <> '';

COMMIT;