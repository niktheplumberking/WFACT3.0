# Architecture Map

Checked against the tree 2026-10-15. Update this file in the same commit as any move, new package or new top-level folder.

```
apps/cockpit/            React+Vite PWA (the control room). Reads/writes Supabase under RLS only (anon key).
                         v2 UI follows the locked design in docs/design/cockpit-v2/ (Step 28 Package 4).
packages/
  agent-runtime/         agent registry, default-deny PermissionGate, injection defence
  audit/                 append-only audit + model-trace writer
  documentation/         Documentation agent (episodic memory -> clients/<slug>/memory.md)
  frontend-loop/         builder + evaluator loop; starters/track-a (static multi-page), starters/track-b (Next.js, motion)
  hermes/                "Hermes-lite" read-only status controller (ask jobs)
  jobs/                  runner for cockpit-job.yml (src/run.ts -> handlers.ts)
  media/                 Seedance/Higgsfield video (Step 4B M5; orphaned, no CI)
  planning/              Intake, Direction, Planner agents
  rendered-qa/           Chromium screenshots, axe, Lighthouse, design-rulebook detectors, screenshot reviewer
  verification/          eval registry v1.3.0 (53 checks, config/eval-registry.json), claims gate, cross-model evaluator
  workflow/              buildAndVerify orchestration with checkpoints
  db/migrations/         0001-0023 (0016 absent, cause not recorded), RLS_ATTACK_TEST_RESULTS.md
supabase/functions/dispatch-job/   Edge Function: Cockpit job -> GitHub workflow_dispatch
scripts/                 check-trackers.mjs, rls_attack_test*.sql (run by hand via the Supabase connector)
clients/<slug>/          memory.md (episodic, machine-written), brief.json; summit-line-roofing, dreamsign-pilot and
                         lanternworks-studio are synthetic stand-ins (never count them as real clients)
memory/                  context.md (business rules, provisional), lessons-ledger.md (proposals; human approves)
docs/                    plans and designs (index: docs/INDEX.md); docs/archive/ is history only (MANIFEST.md)
graphify-out/            knowledge graph: graph.json, GRAPH_REPORT.md, wiki/ are tracked; cache/ and dated snapshots are not
.claude/                 rules/ (auto-loaded working rules), skills/ (step-close, graphify), hooks/stop-tracker-guard.sh
                         (the only registered hook), completions/ (history), worktrees/ (agent worktrees, git-ignored)
.github/workflows/       ci.yml (all gates + deploy), cockpit-job.yml (dispatch-only job worker)
```

Job path: Cockpit -> `public.jobs` row -> `dispatch-job` -> `cockpit-job.yml` -> `doppler run -- tsx packages/jobs/src/run.ts <id>`
-> `handleJob` (intake, replan, build_plan, resume, verify, ask).
Fixed paths code depends on (do not move): `memory/context.md`, `memory/lessons-ledger.md`, `clients/<slug>/memory.md`,
`clients/<slug>/brief.json`, `PROGRESS.md`, `BLOCKED-ON-NICK.md`, `docs/WFACT-3.0-Factory-Completion-Plan.md`,
`docs/WFACT SOPS/` (eval registry), `docs/step-4c/PHASE-1-PROPOSAL.md` (Cockpit source comments).
