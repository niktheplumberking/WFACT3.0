# Architecture Map

```
apps/cockpit/            React+Vite PWA (the control room). Reads/writes Supabase under RLS only (anon key).
packages/
  agent-runtime/         agent registry, default-deny PermissionGate, injection defence
  audit/                 append-only audit + model-trace writer
  documentation/         Documentation agent (episodic memory -> clients/<slug>/memory.md)
  frontend-loop/         builder + evaluator loop; starters/track-a (static multi-page; motion budget planned, Step 27), starters/track-b (Next.js, motion)
  hermes/                "Hermes-lite" read-only status controller (ask jobs)
  jobs/                  runner for cockpit-job.yml (src/run.ts -> handlers.ts)
  media/                 Seedance/Higgsfield video (Step 4B M5; orphaned, no CI)
  planning/              Intake, Direction, Planner agents
  rendered-qa/           Chromium screenshots, axe, Lighthouse, design-rulebook detectors
  verification/          check registry (48 checks) + cross-model evaluator
  workflow/              buildAndVerify orchestration with checkpoints
  db/migrations/         0001-0018 (0016 absent, cause not recorded), RLS_ATTACK_TEST_RESULTS.md
supabase/functions/dispatch-job/   Edge Function: Cockpit job -> GitHub workflow_dispatch
scripts/                 check-trackers.mjs, rls_attack_test*.sql (run by hand)
clients/<slug>/          memory.md (episodic, machine-written), brief.json
memory/                  context.md (business rules, provisional), lessons-ledger.md
.github/workflows/       ci.yml (all gates + deploy), cockpit-job.yml (dispatch-only job worker)
```

Job path: Cockpit -> `public.jobs` row -> `dispatch-job` -> `cockpit-job.yml` -> `doppler run -- tsx packages/jobs/src/run.ts <id>`
-> `handleJob` (intake, replan, build_plan, resume, verify, ask).
Fixed paths code depends on (do not move): `memory/context.md`, `memory/lessons-ledger.md`, `clients/<slug>/memory.md`,
`clients/<slug>/brief.json`, `PROGRESS.md`, `BLOCKED-ON-NICK.md`, `docs/WFACT-3.0-Factory-Completion-Plan.md`.
