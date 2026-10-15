# Archive manifest

Every file ever moved into `docs/archive/`: where it came from, where it is now, and why. Nothing was deleted.
Restore with `git mv <archive path> <original path>`. Rounds are in date order.

## Round 1 — 2026-10-01 (commit `289ec00`, `git mv`, history preserved)

| Original path | Archive path | Reason |
|---|---|---|
| `docs/WFACT-3.0-Execution-Roadmap.md` | `docs/archive/sprint-100-hour/WFACT-3.0-Execution-Roadmap.md` | Sprint-era roadmap; replaced by the Continuation Build Plan and Factory Completion Plan |
| `docs/WFACT-3.0-Fast-Track-Plan.md` | `docs/archive/sprint-100-hour/WFACT-3.0-Fast-Track-Plan.md` | The 100-hour sprint is finished |
| `docs/WFACT SOPS/Claude outputs/WFACT-3.0-Fast-Track-Plan.md` | `docs/archive/sprint-100-hour/Fast-Track-Plan.sops-copy.md` | Duplicate copy of the Fast-Track Plan |
| `docs/wfact-3.0-nick-plan.html` | `docs/archive/sprint-100-hour/wfact-3.0-nick-plan.html` | Sprint-era Nick-facing plan |
| `docs/wfact-3.0-operator-manual.html` | `docs/archive/sprint-100-hour/wfact-3.0-operator-manual.html` | Sprint-era operating manual |
| `docs/wfact-3.0-nick-requirements.html` | `docs/archive/old-reports/wfact-3.0-nick-requirements.html` | Replaced by `BLOCKED-ON-NICK.md` |
| `docs/wfact-3.0-nick-progress-update.html` | `docs/archive/old-reports/wfact-3.0-nick-progress-update.html` | Early progress report; replaced by `PROGRESS.md` |
| `graphify-out/` snapshot of 2026-09-28 | `docs/archive/graphify-snapshots/2026-09-28/` | Dated graph snapshot; the live graph is `graphify-out/` |

## Round 2 — 2026-10-07 (alignment pass)

| Original path | Archive path | Reason |
|---|---|---|
| `PROGRESS.md` lines 240-376, section "100-Hour Sprint … Phases 1–7" | `docs/archive/2026-10-07-alignment/PROGRESS-sprint-phases-1-7.md` | Superseded sprint checklist (superseded 2026-09-28) was 137 of 1,118 lines in the live tracker and is not parsed by `scripts/check-trackers.mjs` (checked: it still prints OK). Moved verbatim; a pointer remains in `PROGRESS.md`. |
| `docs/WFACT-3.0-Factory-Completion-Plan.md` (full prior version) | `docs/archive/2026-10-07-alignment/WFACT-3.0-Factory-Completion-Plan.pre-realignment.md` | Plan recreated after realignment; copy keeps the 9 retired agent prompts of closed steps (1, 2, 3, 3A, 4, 4C, 5, 6, 7) |

## Reviewed in round 2 and deliberately NOT archived

| Path | Why it stays |
|---|---|
| `README.md` | Stale (sprint wording) but a front door; rewritten in place instead |
| `BLOCKED-ON-NICK.md` | Required by CI (`ci.yml:30`) and referenced by code comments; given an "open now" section on top instead |
| `docs/step-4c/PHASE-1-PROPOSAL.md` | Cited by Cockpit source comments (`App.tsx`, `ui.tsx`, `model.ts`, `tokens.css`) and the Factory Plan; marked historical in the INDEX |
| `docs/WFACT-3.0-Continuation-Build-Plan.md` | Still the tracked Stage 1-7 plan (Stage 7 open) |
| `docs/WFACT-3.0-Ecosystem-Blueprint.md` | Text copy of the Blueprint HTML; cited by `CLAUDE.md`; harmless duplicate |
| `docs/WFACT SOPS/` | Cited by `verification/config/eval-registry.json` |
| `docs/WFACT-3.0-Agency-Scope-Addendum-DRAFT.md` | Unresolved scope proposal; section 2 is known-superseded but the rest is live input |
| `.claude/hooks/*` (11 unregistered scripts) | Relevance not established; only 2 hooks are registered in `.claude/settings.json` |
| `packages/media` | Orphaned (no importer, no CI job) but is Step 4B M5 groundwork |
| `clients/dreamsign-pilot`, `clients/summit-line-roofing` | Read by code and tests; synthetic/provisional, labelled as such |

## Removed (not archived) 2026-10-07

Two leftover git worktrees `.claude/worktrees/agent-ac3844b…` and `agent-ad14ed1…` and their branches `worktree-agent-*`: every commit was already in `huraira-work` (checked with `merge-base --is-ancestor`), so nothing was lost. `.claude/worktrees/` is now in `.gitignore`. Stray `.DS_Store` files were deleted (already git-ignored).

## Round 3 — 2026-10-15 (cleanup pass)

| Original path | Archive path | Reason |
|---|---|---|
| `PROGRESS.md` "Previous sync" lines 5–37 | `docs/archive/2026-10-15-cleanup/PROGRESS-sync-log-to-2026-10-15.md` | 33 very long sync-log lines at the top of a file every agent reads; the latest "Last synced" and one "Previous sync" stay |
| `PROGRESS.md` Continuation Plan CI table, Stages 1–5, Cockpit jobs | `docs/archive/2026-10-15-cleanup/PROGRESS-continuation-stages-1-5.md` | All MET by 2026-09-30; history. A pointer remains in `PROGRESS.md` |
| `PROGRESS.md` sections Step 6, Step 5, Step 7, Step 4D | `docs/archive/2026-10-15-cleanup/PROGRESS-closed-steps-6-5-7-4D.md` | All DONE with evidence; status stays in the plan's Part E. `check-trackers.mjs` printed OK after the move. Net: `PROGRESS.md` 1,198 → 789 lines, 142 KB → 96 KB |
| `docs/COCKPIT-CLAUDE-DESIGN-PROMPT.md` | `docs/archive/2026-10-15-cleanup/COCKPIT-CLAUDE-DESIGN-PROMPT.md` | One-shot prompt for Claude Design; its output is locked in `docs/design/cockpit-v2/`. No references |
| `docs/reports/wfact-mvp-progress-2026-10-12.html` | `docs/archive/old-reports/wfact-mvp-progress-2026-10-12.html` | Dated client-style report; no references |
| `.claude/hooks/*.sh` except `stop-tracker-guard.sh` (12 files) | `docs/archive/2026-10-15-cleanup/claude-hooks-unregistered/` | Never registered in `.claude/settings.json` (checked, and not in user settings either), so they never ran |

**Removed, not archived (2026-10-15)**

- Untracked root folder `Design - WFACT Cockpit Control Room/`: a duplicate of `docs/design/cockpit-v2/` (`diff -rq`: identical, minus one
  build-prompt file that only the tracked copy has). Moved to the macOS Trash, not deleted.
- Worktree `.claude/worktrees/agent-aa666c5a80254fd81` and branch `worktree-agent-aa666c5a80254fd81`: `git cherry` showed all 3 commits
  already on `huraira-work` as equivalent patches; no uncommitted changes. Restore: `git branch worktree-agent-aa666c5a80254fd81 a02046e`.
- `packages/.gitkeep` (the folder has 12 packages); stray `.DS_Store`; empty `.claude/templates/` and `docs/reports/`.
- Untracked from git (files kept on disk, now git-ignored): `graphify-out/cache/` (248 files) and the dated snapshots
  `graphify-out/2026-10-*/`. Both are regenerable by `graphify update .` and made every commit noisy.

**Kept on purpose (2026-10-15)**: worktrees `agent-a8907207a63a55715` (1 commit not on `huraira-work`: live build step timeline) and
`objective-engelbart-d65df7` (migration 0024, awaiting Huraira's review); `docs/step-4c/{before,after,mockups}` (cited as evidence by
`PROGRESS.md`, the plan and `app.css`); every doc still referenced from code, CI or the trackers.
