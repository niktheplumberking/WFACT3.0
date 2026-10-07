# Documentation Index

**Last updated**: 2026-10-07 (alignment pass)

## Session start (essential)

- `docs/HANDOFF.md` (self-contained orientation: goals, verified state, backlog, next task; read first)
- `CLAUDE.md` (law file)
- `.claude/COMMON_MISTAKES.md`
- `.claude/QUICK_START.md`
- `.claude/ARCHITECTURE_MAP.md`

## The plan in force (read in this order)

| Doc | What it is |
|---|---|
| `wfact-3.0-blueprint.html` | Scope source of truth: 13 phases, Cockpit map (§9), Definition of Done (§16K) |
| `WFACT-3.0-Continuation-Build-Plan.md` | Stages 1–7 |
| `WFACT-3.0-Factory-Completion-Plan.md` | Steps 1–27, one agent prompt per step, Execution order (re-set 2026-10-07), Standard Operating Rules |
| `FRONTEND-UPGRADE-DESIGN.md` | Step 4B: the two front-end build tracks |
| `BUILD-RECOVERY-DESIGN.md` | Step 4D: why builds stop, what the Cockpit tells the owner, and how a stopped build carries on |

Live status: `../PROGRESS.md`. Waiting on Nick: `../BLOCKED-ON-NICK.md`.

## Reference (current, still cited by the law file and memory)

| Doc | Use |
|---|---|
| `WFACT-3.0-Playbook.md` | Five pillars, 11-stage pipeline (§7), carried-over laws |
| `WFACT-3.0-Ecosystem-Blueprint.md` | Markdown version of the Blueprint (text-friendly) |
| `COCKPIT-JOBS.md` | Cockpit job queue design and runbook |
| `SECRETS.md` | Doppler secrets runbook |
| `AGENT-PERMISSIONS.md` | Step 6: enforced agent scopes, role x capability inventory, injection defence, live attack evidence, NOT COVERED |
| `WFACT SOPS/` | The 3 SOPs, Factory Book and Factory Audit (PDFs, with markdown copies) |

## Proposals and history kept in place (not governing)

| Doc | Status |
|---|---|
| `WFACT-3.0-Agency-Scope-Addendum-DRAFT.md` | DRAFT scope proposal. Section 2 (dynamic tiers) is superseded by Nick's 2026-10-07 reply; sections 1, 3, 5 still open. Needs Huraira and Nick decisions (HANDOFF section 6) |
| `step-4c/PHASE-1-PROPOSAL.md` | Historical Step 4C audit; cited by Cockpit source comments |

## Planned outputs (created by later steps, not yet present)

`DISASTER-RECOVERY.md`, `nick-briefing-<date>.md`, and dated results under `learnings/`.

## Archive (history only, zero token cost, do not work from it)

`archive/` is listed in `.claudeignore`. See `archive/README.md` and `archive/MANIFEST.md` (every move, original path and reason).
