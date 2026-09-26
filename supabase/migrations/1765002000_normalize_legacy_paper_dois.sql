-- Normalize legacy papers.doi spellings so the normalized dupe-check matches.
--
-- New writes store normalizeDoi() output (trim + lowercase, resolver and
-- `doi:` prefixes stripped). Rows written before that fix keep variants like
-- `https://doi.org/10.X`, `DOI: 10.X`, or uppercase, which never match the
-- normalized `.in("doi", …)` query. This one-time normalization rewrites only
-- rows whose normalized form differs, and only when normalization is
-- non-empty (never nulls a DOI).
--
-- Idempotent: re-running updates zero rows once all values are normalized.

UPDATE public.papers
SET doi = regexp_replace(
  regexp_replace(lower(trim(doi)), '^https?://(dx\.)?doi\.org/', ''),
  '^doi:\s*',
  ''
)
WHERE doi IS NOT NULL
  AND doi <> regexp_replace(
    regexp_replace(lower(trim(doi)), '^https?://(dx\.)?doi\.org/', ''),
    '^doi:\s*',
    ''
  )
  AND regexp_replace(
    regexp_replace(lower(trim(doi)), '^https?://(dx\.)?doi\.org/', ''),
    '^doi:\s*',
    ''
  ) <> '';
