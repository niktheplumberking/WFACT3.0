# Documentation Index

**Last updated**: 2026-10-15 (cleanup round 3). Rule: a doc that is added, retired or renamed gets its row here in the same commit.

## Session start (essential)

- `docs/HANDOFF.md` (self-contained orientation: goals, verified state, backlog; read first)
- `CLAUDE.md` (law file) and `.claude/rules/` (working rules: context, workflow, quality bar; auto-loaded)
- `.claude/COMMON_MISTAKES.md`
- `.claude/QUICK_START.md`
- `.claude/ARCHITECTURE_MAP.md`

## The plan in force (read in this order)

| Doc | What it is |
|---|---|
| `wfact-3.0-blueprint.html` | Scope source of truth: 13 phases, Cockpit map (§9), Definition of Done (§16K) |
| `WFACT-3.0-Continuation-Build-Plan.md` | Stages 1–7 (1–5 met; 6 partial; 7 waits on Nick) |
| `WFACT-3.0-Factory-Completion-Plan.md` | Steps 1–28, one agent prompt per step, Execution order, Standard Operating Rules (Part C), checklist (Part E) |
| `MVP-CUTLINE.md` | Decision D3 (2026-10-10): the Bennett & Co MVP due 2026-10-14, scope fence, schedule, cost cap |

Live status: `../PROGRESS.md` ("Status summary" and "Next up" at the top). Waiting on Nick: `../BLOCKED-ON-NICK.md`.

## Step designs and evidence (current)

| Doc | Step | Use |
|---|---|---|
| `FRONTEND-UPGRADE-DESIGN.md` | 4B | The two front-end build tracks |
| `BUILD-RECOVERY-DESIGN.md` | 4D (DONE) | Why builds stop, what the owner is told, how a stopped build continues |
| `AGENT-PERMISSIONS.md` | 6 (DONE) | Enforced agent scopes, injection defence, live attack evidence, NOT COVERED |
| `AI-COST-AUDIT.md` | 12 | Model cost evidence (2026-10-13); caps $5 per build, $20 per 7 days |
| `BUILD-QUALITY-AND-COCKPIT-UX-PROMPTS.md` | 28 | The five-package agent prompt Step 28 runs from |
| `BUILD-FAILURE-DIAGNOSIS.md` | 28 | All 25 build jobs diagnosed (2026-10-15); source of the build-failure guards |
| `EXAMPLE-CLIENTS.md` | 28 | The two synthetic, complete example clients (`clients/example-*`): what they are for and how to run one |
| `BUILD-SPEED-UX-PROMPTS.md` | proposed | Build-time baseline and prompts P0–P6 (P0 cited by `rendered-qa/src/reviewer.ts`) |
| `design/cockpit-v2/` | 28 Pkg 4 | **Locked** Cockpit v2 design (Claude Design export) and its build prompts; extend, do not restyle |
| `step-4c/` | 4C | `PHASE-1-PROPOSAL.md` (historical audit, cited by Cockpit source) and before/after screenshots cited as evidence |

## Reference (current, still cited by the law file and memory)

| Doc | Use |
|---|---|
| `WFACT-3.0-Playbook.md` | Five pillars, 11-stage pipeline (§7), carried-over laws |
| `WFACT-3.0-Ecosystem-Blueprint.md` | Markdown version of the Blueprint (text-friendly) |
| `COCKPIT-JOBS.md` | Cockpit job queue design and runbook |
| `SECRETS.md` | Doppler secrets runbook |
| `WFACT SOPS/` | The 3 SOPs, Factory Book and Factory Audit (PDFs, with markdown copies); cited by the eval registry |
| `../PRODUCT.md` | Cockpit product and design constraints |

## Proposals kept in place (not governing)

| Doc | Status |
|---|---|
| `WFACT-3.0-Agency-Scope-Addendum-DRAFT.md` | DRAFT. Section 2 superseded by Nick's 2026-10-07 reply; sections 1, 3, 5 open (HANDOFF section 6) |

## Planned outputs (created by later steps, not yet present)

`DISASTER-RECOVERY.md`, `nick-briefing-<date>.md`, and dated results under `learnings/` (empty until then).

## Archive (history only, zero token cost, do not work from it)

`archive/` is listed in `.claudeignore`. See `archive/README.md` and `archive/MANIFEST.md` (every move, original path and reason).
