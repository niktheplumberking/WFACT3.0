# Secrets — Doppler

Continuation Build Plan **Stage 1, task 2**; Blueprint §12 ("a real secrets manager, never plaintext
environment variables") and §13. Decision (Huraira, 2026-09-28): **Doppler** — free tier, native
GitHub Actions + Vercel integrations, `doppler run -- <cmd>` replaces `.env.local`. Vault was the
Blueprint's named example but carries real ops burden (unseal, HA) for a team this size; Doppler can
be swapped for Infisical/Vault later without touching code, since every package reads plain env vars.

## Layout

| Doppler project | Config | Used by |
|---|---|---|
| `wfact-3-0-codebase` | `dev` | Local runs: `doppler run -- npm run ask -- "…"`, `npm run verify`, `npm run build-page` |
| `wfact-3-0-codebase` | `prd` | GitHub Actions `deploy-cockpit` job (via a **service token** in the `DOPPLER_TOKEN` GitHub secret) |

Variable names are exactly `.env.example`'s (plus `AGENT37_BASE_URL`, `AGENT37_API_KEY`, `API_KEY_21ST`,
`ANTHROPIC_MODEL` if overridden). No code change is needed — packages already read `process.env`.

`prd` needs, at minimum: `VERCEL_TOKEN` (for the deploy job). Everything the server-side packages need
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, …) goes in both configs.

The Cockpit's `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` stay as Vercel project env vars — they're
public by design (RLS is the access control, see `apps/cockpit/src/supabaseClient.ts`), not secrets.

## One-time setup (Huraira — account-owner steps, can't be done by an agent)

**Status 2026-09-28**: steps 1–3 DONE — workspace "WFACT 3.0", project `wfact-3-0-codebase`; the 9
non-empty `.env.local` values imported into `dev` and `prd` (hash-verified 9/9 identical;
`VERCEL_OIDC_TOKEN` deliberately skipped — short-lived, Vercel-generated). Proven as the real source:
`env -i … doppler run -- npm run ask` answered live with no `.env.local` loaded. Steps 4–5 and
`VERCEL_TOKEN` (empty in `.env.local`, needed by the deploy job) still open.

1. Create the Doppler workspace + project `wfact-3-0-codebase` (configs `dev`, `stg`, `prd`, `dev_personal`).
2. Install the CLI and log in locally: `brew install dopplerhq/cli/doppler && doppler login`, then in
   the repo root: `doppler setup --project wfact-3-0-codebase --config dev`.
3. Import the current values (from the repo root):
   `doppler secrets upload .env.local --project wfact-3-0-codebase --config dev` and the same for `--config prd`.
4. Create a **service token** for `wfact-3-0-codebase/prd` (read-only) and add it as the GitHub repo secret
   `DOPPLER_TOKEN` (repo Settings → Secrets and variables → Actions).
5. In Vercel → `wfact-cockpit` → Settings → Git, set **Production Branch = `main`**. `apps/cockpit/vercel.json`
   already disables Git-triggered deploys on `main`, so CI (gated on every check job) is the only thing
   that deploys production; other branches still get preview deploys.

## After setup — closing Stage 1's acceptance criteria

- Verify `doppler run -- npm run ask -- "What is the status of DreamSign?"` works from `packages/hermes`
  with `.env.local` moved aside (proves the manager, not the file, is the source).
- Then retire `.env.local` and `apps/cockpit/.env.local` (delete, don't just empty — and rotate
  `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY`, since they've lived in plaintext on a laptop).
- Acceptance check (Continuation Plan Stage 1): `grep -rE "SUPABASE_SERVICE_ROLE_KEY=.+|ANTHROPIC_API_KEY=.+" .`
  finds zero plaintext values.
- Push a commit to `main` → the `deploy-cockpit` job deploys and its smoke-check step gets HTTP 200.
