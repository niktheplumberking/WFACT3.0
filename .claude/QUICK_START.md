# Quick Start

No root `package.json`. Each package and `apps/cockpit` has its own lockfile; run commands inside it.
Packages link with `file:`; CI install order: audit, hermes, agent-runtime, documentation, frontend-loop, verification,
planning, rendered-qa, workflow, jobs.

```bash
# Cockpit
cd apps/cockpit && npm ci && npm run dev          # http://localhost:5173
cd apps/cockpit && npm run typecheck && npm test && npm run build

# Any package (agent-runtime audit documentation frontend-loop hermes jobs media planning verification workflow)
cd packages/<name> && npm ci && npm run typecheck && npm test
# rendered-qa needs Playwright Chromium: cd packages/rendered-qa && npx playwright install chromium

# Trackers (must print OK before and after any step)
node scripts/check-trackers.mjs

# Knowledge graph
graphify query "<question>"        # before grepping raw files
graphify update .                  # after code changes
```

Secrets: `doppler run -- <command>` (project `wfact-3-0-codebase`, config `dev`). Full list: `docs/HANDOFF.md` section 8.
Deploy: automatic from CI on push to `main` (job `deploy-cockpit`). Do not run `vercel deploy` by hand.
Full orientation: `docs/HANDOFF.md`.
