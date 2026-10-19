# Architecture Map

Checked against the tree 2026-10-20. Update this file in the same commit as any move, new package or new top-level folder.

```
apps/cockpit/            React+Vite PWA (the control room). Reads/writes Supabase under RLS only (anon key).
                         v2 UI follows the locked design in docs/design/cockpit-v2/ (Step 28 Package 4).
packages/
  agent-runtime/         agent registry, default-deny PermissionGate, injection defence
  audit/                 append-only audit + model-trace writer
  documentation/         Documentation agent (episodic memory -> clients/<slug>/memory.md)
  frontend-loop/         builder + evaluator loop; starters/track-a (static multi-page), starters/track-b (Next.js, motion)
  hermes/                "Hermes-lite" read-only status controller (ask jobs); entities.ts reads public.entities;
                         testing/ holds the shared test doubles (mockModel, entities)
  jobs/                  runner for cockpit-job.yml (src/run.ts -> handlers.ts); scripts/permissionsAttack.ts (manual live attack run)
  media/                 Seedance/Higgsfield video (Step 4B M5; no importer yet; unit tests in CI)
  planning/              Intake, Direction, Planner agents
  rendered-qa/           Chromium screenshots, axe, Lighthouse, design-rulebook detectors, screenshot reviewer
  verification/          eval registry v1.4.0 (54 checks, config/eval-registry.json), claims gate, cross-model evaluator
  workflow/              buildAndVerify orchestration with checkpoints
  db/migrations/         0001-0028 (0016 skipped in numbering; 0024 only on another branch, not applied), RLS_ATTACK_TEST_RESULTS.md
supabase/functions/dispatch-job/   Edge Function: Cockpit job -> GitHub workflow_dispatch (dispatch.test.ts, Deno, in CI)
supabase/functions/submit-lead/    Edge Function: client-site contact form -> public.leads (Step 25 M4)
scripts/                 check-trackers.mjs; rls_attack_test_*.sql (live by hand after a migration; in CI via rls-attack-local.sh
                         on a throwaway local Supabase database)
clients/<slug>/          memory.md (episodic, machine-written), brief.json; summit-line-roofing, dreamsign-pilot,
                         lanternworks-studio, example-agency-studio and example-local-trade are synthetic stand-ins (never real clients)
memory/                  context.md (business rules, provisional), lessons-ledger.md (proposals; human approves)
docs/                    plans and designs (index: docs/INDEX.md); docs/archive/ is history only (MANIFEST.md)
graphify-out/            knowledge graph: graph.json, GRAPH_REPORT.md, wiki/ are tracked; cache/ and dated snapshots are not
.claude/                 rules/ (auto-loaded working rules), skills/ (step-close, graphify), hooks/stop-tracker-guard.sh
                         (the only registered hook), completions/ (history), worktrees/ (agent worktrees, git-ignored)
.github/workflows/       ci.yml (all gates + deploy), cockpit-job.yml (dispatch-only job worker)
```

Job path: Cockpit -> `public.jobs` row -> `dispatch-job` -> `cockpit-job.yml` -> `doppler run -- tsx packages/jobs/src/run.ts <id>`
-> `handleJob` (intake, replan, direction, build_plan, resume, verify, ask).
Fixed paths code depends on (do not move): `memory/context.md`, `memory/lessons-ledger.md`, `clients/<slug>/memory.md`,
`clients/<slug>/brief.json`, `PROGRESS.md`, `BLOCKED-ON-NICK.md`, `docs/WFACT-3.0-Factory-Completion-Plan.md`,
`docs/WFACT SOPS/` (eval registry), `docs/step-4c/PHASE-1-PROPOSAL.md` (Cockpit source comments).
