# Security Policy

## Supported versions

ResearchQuest is in **Alpha**. Security fixes are applied on the `master` branch only.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Prefer one of:

1. [GitHub Security Advisories](https://github.com/Arudchayan/ResearchQuest/security/advisories/new) (private disclosure)
2. Email the maintainer via the address listed on the [GitHub profile](https://github.com/Arudchayan) with subject `ResearchQuest security`

Include:

- Affected component (web app, Supabase RLS/migrations, or edge function)
- Steps to reproduce
- Impact (e.g. cross-tenant read/write, auth bypass, XSS)
- Whether you have a suggested fix

You should receive an acknowledgement within **7 days**. We aim to share a remediation plan or status update within **14 days**.

## Scope

In scope:

- Client XSS / auth bypass
- Row Level Security gaps and IDOR in the Agent API
- Secrets or service-role exposure in the frontend or docs
- Dependency vulnerabilities that are exploitable in this project’s default setup

Out of scope:

- Denial of service against third-party APIs (Crossref, OpenAI, etc.)
- Issues that require a misconfigured self-hosted Supabase project (e.g. disabled RLS)
- Social engineering of maintainers or users

## Hardening notes for operators

- Never put `SUPABASE_SERVICE_ROLE_KEY` in Vite/`VITE_*` env vars — anon key only in the client.
- Do **not** deploy `supabase/functions/create-admin-user` to production unless you set a strong `ADMIN_API_KEY` and understand it creates users via the Admin API.
- Apply all migrations under `supabase/migrations/` before exposing a project; early permissive policies are superseded by later hardening migrations.
- Rotate keys if this repository’s history ever contained a live project URL or anon JWT.
- Treat every `VITE_*` value as public: Vite embeds it in the browser bundle. Never use this namespace for account passwords or privileged secrets.
- After rewriting Git history to remove a secret, rotate or revoke the original credential and run the full-history secret scan successfully before publishing a repository.
