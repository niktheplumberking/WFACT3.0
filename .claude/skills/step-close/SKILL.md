---
name: step-close
description: Update PROGRESS.md and docs/WFACT-3.0-Factory-Completion-Plan.md at the end of a Factory Completion Plan step (or milestone, e.g. 4B M4), from verified evidence, then check and commit them. Use whenever a step or milestone is finished, partly finished, or blocked, before sending the step Report; and whenever the Stop-hook tracker guard says the trackers are behind the code. Trigger: /step-close <step id> [<milestone>]
---

# /step-close — close out a step in both trackers

Run this **after** the step's work is verified and **before** sending the Part C Report. It replaces
nothing in Part C; it is the "Docs" rule made mechanical. For a full drift audit across many commits,
use `/progress-sync` instead; this skill is the per-step update.

Argument: the step id (`5`, `4B`, `4B M4`). If none is given, take it from the work just done; if that
is ambiguous, ask.

## The law this skill must not break

- **Never trust done, only verified.** A status of `DONE` needs every acceptance criterion MET with
  evidence you can point at (commit hash, CI run id, query result, command output, file path). If any
  criterion is unproven, the status is `PARTIAL` (or `IN PROGRESS` for a multi-milestone step), and the
  unproven part is written down in plain words.
- **Never fill "Approved by Huraira".** That column in Part E is Huraira's. Leave it as it is.
- **Status words are fixed**: `DONE`, `PARTIAL`, `IN PROGRESS`, `BUILT AND DEPLOYED`, `BLOCKED`,
  `NOT STARTED`. `scripts/check-trackers.mjs` parses them; do not invent new ones.
- Nothing pushed to `main`, nothing deployed, by this skill.

## 1. Gather evidence (do not write anything yet)

```bash
git log --oneline $(git log -1 --format=%h -- PROGRESS.md docs/WFACT-3.0-Factory-Completion-Plan.md)..HEAD
gh run list --branch huraira-work --limit 3     # CI ids, if the step pushed
```

Also collect: the step's acceptance criteria (Part D entry), the result of each check you ran, any
migration version, job/run ids, live URLs checked, and what you did NOT do. Another session may commit
in this checkout too: only describe commits that belong to this step.

## 2. Update `docs/WFACT-3.0-Factory-Completion-Plan.md` (four places)

1. **Part D heading** of the step: `### STEP <id> — <name> (<P>) — <STATUS> <YYYY-MM-DD>[, short qualifier]`.
   The status is the last ` — ` segment.
2. **Part E row**: `| <id> | <name> | **<STATUS>** (<commit/CI/job evidence>; <what is still open>) | <YYYY-MM-DD> | <leave as is> |`.
3. **Top "Status as of" line** (line ~13): rewrite it so it lists every step's current status correctly.
4. **Goal tracker** (end of Part E) and the **Cockpit expectations table** (Part A), only if this step
   changed a goal or a Cockpit room.

If the step's work changed what a later step must do, add a one-line note under that later step's
heading instead of rewriting its prompt.

## 3. Update `PROGRESS.md` (five places)

1. **`Last synced:`** line: today's date and time (+05), "via `/step-close <id>`", the commit range,
   CI run id if any. Move the old line into "Previous syncs".
2. **`**Status summary**`**: the step's new status in the same words as Part E.
3. **`**Next up**`**: at most 3 items, the first being what Huraira must do or approve next (usually
   "review the Step <id> report and GO for Step <next>").
4. **Step section** `## Step <id> — <name> (<STATUS> <YYYY-MM-DD>[ — qualifier])`: create it at the
   bottom if missing, following the Step 4C section's shape: a short "governed by" paragraph,
   `- [x]` / `- [ ]` checklist lines each ending in its evidence, **Verification**, and an
   **Exit check** quote from the plan with MET / PARTIALLY MET / NOT MET.
5. **Gaps noticed**: add anything found but not done; remove gaps this step closed.

Also update `BLOCKED-ON-NICK.md` if the step changed something waiting on Nick.

## 4. Verify, independently

```bash
node scripts/check-trackers.mjs
```

It must print `check-trackers: OK`. It checks that the Part D heading, Part E row and PROGRESS.md
section agree for every step, and that no code commit is newer than the trackers. Fix and re-run until
OK. Then re-read your two diffs once (`git diff -- PROGRESS.md docs/WFACT-3.0-Factory-Completion-Plan.md`)
and confirm every `DONE`/`[x]` you wrote has evidence next to it.

## 5. Commit (named paths only)

```bash
git add PROGRESS.md docs/WFACT-3.0-Factory-Completion-Plan.md [BLOCKED-ON-NICK.md]
git commit -m "Step <id>: trackers — <STATUS> (<one-line evidence>)"
```

Never `git add -A`: another session may have uncommitted work here. Do not push unless Huraira said so.

## 6. Finish

Write the completion note in `.claude/completions/YYYY-MM-DD-step-<id>.md` (session protocol), run
`graphify update .`, then send the Part C Report and stop for GO.

## Skipping the guard

Commits that truly need no tracker entry (typo fixes, tracker-only edits, tooling) carry `[no-tracker]`
in the commit message; the checker ignores them. Use this rarely and never for step work.
