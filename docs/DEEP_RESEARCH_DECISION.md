# Deep Research Feature — Decision Record

## Current State

The Deep Research feature is implemented. The Supabase Edge Function at `supabase/functions/deep-research/index.ts` calls the **Semantic Scholar API** (free, no key required) to fetch up to 8 relevant papers for the user's idea title, then synthesises reasoning steps, a summary, and suggested keywords.

If `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set as a Supabase secret, the function uses that AI provider to generate a richer synthesis from the paper abstracts. If no AI key is set, it constructs the summary directly from paper metadata — still real, useful data.

## Decision

**Option A — Implement** was selected. Semantic Scholar paper search chosen as the data source.

## Configuration

| Env Var | Required | Purpose |
|---------|----------|---------|
| `SEMANTIC_SCHOLAR_API_KEY` | No | Increases rate limit from 100 to 1 req/s |
| `OPENAI_API_KEY` | No | Enables AI synthesis via gpt-4o-mini |
| `ANTHROPIC_API_KEY` | No | Enables AI synthesis via claude-haiku-4-5 (used if OPENAI not set) |

Set secrets in Supabase: **Project → Settings → Edge Functions → Secrets**.

## Status

- [x] Decision made by product owner
- [x] Option selected: A — Implement (Semantic Scholar + optional AI)
- [x] M5-02 implemented and deployed
