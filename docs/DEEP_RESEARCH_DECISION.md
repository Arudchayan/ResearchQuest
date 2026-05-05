# Deep Research Feature — Decision Record

## Current State

The Deep Research feature is **not implemented**. The Supabase Edge Function (`supabase/functions/deep-research/index.ts`) does not exist. The UI surface (if any) that would invoke it is wired to a stub or absent.

## Decision Required

Choose one of three paths before M5-02 implementation begins:

| Option | Description | Effort |
|--------|-------------|--------|
| **A — Implement** | Build a real AI-powered deep research pipeline (Edge Function + AI provider integration) | High |
| **B — Relabel** | Rename/reframe the feature to match what the app already does (e.g., "Research Workspace") | Low |
| **C — Remove** | Delete any UI entry points for Deep Research entirely | Low |

## Recommendation

If an AI API key (OpenAI, Anthropic, etc.) is not budgeted for production, choose **Option B or C** to avoid shipping a broken or hidden feature to beta users.

## Status

- [ ] Decision made by product owner
- [ ] Option selected: ___
- [ ] M5-02 ticket updated accordingly
