# Build recovery (Step 4D): when a build stops, say why, and carry on from where it left off

Written 2026-10-07 after Track A and Track B builds kept stopping and each stop meant starting again from nothing.
Scope source: Huraira's request of 2026-10-07. Status and evidence: `PROGRESS.md` and the Factory Completion Plan, Step 4D.

## 1. What was wrong (found by reading the code, not guessing)

1. **A stopped build could never continue.** `resumeBuildAndVerify` refused any run that had written a `workflow.halt` row, which every
   domain failure does (`failed_verification`, `build_failed`, `qa_failed`, `not_verified_no_evaluator`). Only a run that crashed
   without a halt row was resumable. The Cockpit still showed "Resume build" (and told owners to press it) in exactly the cases where it
   did nothing, and hid it in the one case where it worked. Every real stop therefore cost a brand new, fully paid build.
2. **The Cockpit could not take an answer.** "Settle these before building" listed the planner's open questions, but nothing in the
   Cockpit let anyone answer them, and nothing carried an answer into the build. The builder's only fact sources were `goal` and
   `brandNotes`, so a phone number, opening hours or a customer quote the client gave was either invented (and caught) or left out.
3. **An exception inside a run lost the run.** Anything thrown (a storage 503, an audit write) ended the job with `result = null`, so
   the Cockpit had no run id and no way to continue a run that already had a saved site.
4. **A killed worker looked like a running one.** GitHub stops a job at 30 minutes and nothing after it runs, so the safety net never
   fired on a timeout; the Cockpit showed "Running" for ever. A run's saved site was unreachable because nothing linked the job to its run.
5. **Smaller causes of repeat failures:** a hung model call ran to the job limit; a garbled evaluator reply was sent to the builder as if
   it were a defect in the site; two clicks (or two admins) could start two builds of one plan; money failures were not recognised.

The full catalogue of ways a build can end (about 60 modes, with where each is thrown and what text it leaves) was compiled from the
code on 2026-10-07; section 2 is its owner-facing summary.

## 2. Why a build stops, in the owner's words

Every stopped build is put in exactly one of seven buckets. The Cockpit says which, in plain language, and offers the one thing to press.

| Bucket | What the owner reads | Examples (from the code) | The button |
|---|---|---|---|
| **needs details** | "It needs a few details" | an invented phone, hours, address, price, or a required testimonials section with no real quotes; the final review's "NEEDS CLIENT INPUT" | form of plain fields, then **Save the details and continue** |
| **out of credits** | "The site builder is out of credits" | Agent 37 HTTP 402; provider quota | **I've added credits, continue** |
| **setup** | "The factory worker isn't set up for this" | missing token or key, no Track B builder, the build's own spending limit | **Copy a report for Huraira**, then Try again |
| **temporary** | "A connection dropped" | no response, 5xx, 429, reviewer outage, upload failure, runner crash or timeout, saved site no longer matches | **Try again** (continues the saved site, or builds again when nothing usable was saved) |
| **fixable** | "The result failed its checks" | QA still failing after the revisions, the reviewer kept asking for changes | **Fix it and continue** (fresh revision budget on the saved site) |
| **factory** | "The factory hit a problem of its own" | a scope contradiction, the isolated build failing, an invalid brief | **Copy a report for Huraira** leads; Try again anyway is secondary |
| **unknown** | the first sentence of the raw error | anything not recognised | Try again, and the report |

Honesty rules: the buckets read the job's own `error`, `result.status`, `result.qaIssues` and the run's audit trail; nothing is
guessed. An unrecognised failure says so. A stop that repeats three times identically stops offering the same button and leads with the
report.

## 3. The owner's flow

Think of someone who does not know what a checkpoint is.

1. **Home** says one sentence: "1 thing needs fixing" or, for a missing detail, a card labelled **Needs your input**: "The Harbor Street
   Bakery build needs a few details from you". A stop that only Huraira can fix is labelled **With the technical team**. A worker
   that never reported shows **Stopped without reporting**, never "Running".
2. **The run page** opens on **What happened and what to do**:
   - one plain paragraph on what happened;
   - four steps with a tick or cross: *Plan approved, Site written and saved, Quality checks, Launch (always yours)*;
   - **What's kept**: "The site it had built is saved. Carrying on keeps that site and works from it, so the writing is not paid for twice."
     or "Nothing was saved before it stopped, so carrying on writes the site again from the plan.";
   - for missing details: a form with a plain label per item ("Business phone number", "Real customer quotes"), a hint, why the factory is
     asking, and **Skip this: build without it** (the site then labels that part as sample text or leaves it out);
   - one button. Technical details (run id, raw error, GitHub log) stay collapsed under **Technical details**.
3. **Before building**, the approved plan's page has **Details you can add before building**: the usual missing facts plus an answer box for each
   open question the planner raised. Optional; saves a round later.
4. **After a passing build** that still needs client input before launch ("NEEDS CLIENT INPUT"), the run page lists it under **Still needed
   from the client** with the same form and **Save and build again with these** (the passing build is left alone).
5. Nothing here publishes. Launch stays a human decision outside the Cockpit.

## 4. How "carry on from where it left off" works

- A person's button creates an ordinary `resume` job with `reopen: true` (and the plan id). Only an owner or admin can create it (jobs
  trigger). The runner writes a **`workflow.reopen`** row (who, why, which stop it was reopening, the brief it continues with) before it
  does anything, so the run's history stays honest.
- A reopened run **restarts its revision count** from its last saved site (`cycleBase`): a run that stopped at its cap no longer stops again
  on the first failed check. Total attempts stay bounded per press, and repeated identical stops stop being offered.
- A run that reached the **launch gate is never reopened**. A run whose saved site no longer matches its hash (`checkpoint_corrupt`) is not
  reopened either (the Cockpit offers a fresh build of the same plan instead, keeping the owner's details).
- A run with **no saved site** builds again under the same run id (the history shows one run, reopened).
- The brief continues with the plan **plus the owner's details** (`PilotBrief.ownerFacts`). They are given to the builder as confirmed
  facts, are valid `source: "brief"` facts for the content validator, and are fact sources for the claims gate and the final reviewer.
  Values are data, never instructions; passwords and keys are refused in the Cockpit before storage.
- **Automatic retry, bounded:** only when every check passed and the *design reviewer* did not answer (not 401/402/403/404, not a missing
  key), the runner waits 60 s then 180 s and re-runs only the checks and review on the saved site, at most twice and never past 18 of the
  job's 30 minutes. Each retry is a `workflow.reopen` row (`by: auto`).
- **A job killed by a timeout or crash can still be continued.** The runner writes `job.run` (job id to run id) the moment a run starts; the
  Cockpit reads it (owners and admins can read the audit log) and the run's `workflow.checkpoint` rows to know what is saved. The Run step is
  limited to 26 minutes so the safety net can still run inside GitHub's 30.
- **An exception no longer loses the run:** the job still fails with the error, but its result names the run and what was saved.

## 5. Edge cases considered, and what happens

| Situation | Behaviour |
|---|---|
| Two clicks, two tabs, or two admins press continue | The database refuses a second build or continue for the same plan or run while one is active; the Cockpit says "already running, open it from Activity". |
| The details save but starting the build fails | Details are saved in one atomic insert first; the message says so; pressing again does not ask for them again. |
| The database update (0018) is not applied yet | The form is replaced by "Adding details isn't switched on yet. Ask Huraira"; nothing breaks, other recovery buttons still work. |
| The owner types a password or key | Refused before storage ("looks like a password or key"). |
| The owner skips everything | In recovery at least one answer or skip is required; skipping is allowed and recorded, the builder labels or omits that part. |
| The owner changes an answer later | Append-only: a newer row replaces the older as current; nothing is edited or deleted; each add is audited (key and length, never the text). |
| A later build of the same plan already passed | The old failure explains itself and offers no continue button; a pointer opens the later build. |
| The run was verified | No fix button (nothing to fix); the launch decision card is shown as before. |
| Failure before a run exists (dispatch, token, config) | "Try again" repeats the same request; no run id is invented. |
| A failed question, plan or page check | The same request is asked again with the same words. |
| A worker stopped reporting for 45 minutes | Shown as **Stopped without reporting**, the run is found through `job.run` and continued; the stale row stops blocking new attempts. |
| The same stop three times in a row | The button is demoted; the report for Huraira leads. |
| A viewer (PM) | Sees none of it (RLS and the existing role checks). |
| Plan rejected or superseded | The database refuses new details and builds for it; the Cockpit shows the refusal in plain words. |

## 6. Not covered (stated plainly)

- **Photos, logos and other files** cannot be supplied yet (Step 4B M5 builds the asset pipeline). The form is text only; the Cockpit does
  not pretend otherwise.
- **A job row that stays `running`** (a worker killed with no safety net) cannot be closed from the Cockpit; only `queued` jobs can be
  cancelled (migration 0013). It is shown as "Stopped without reporting" and no longer blocks anything.
- **Content that was approved but not yet built** is not checkpointed on its own: a failure after the builder's content review but before the
  site is saved starts the writing again. Only a saved site is carried on.
- **Cost across a whole build** is still per agent run (builder $1, QA evaluator $0.50 on metered models); there is no per-build $5 total yet
  (found while cataloguing; recorded, not changed here). Agent 37 is unpriced.
- Migration **0018 is written and its attack test is written (`scripts/rls_attack_test_recovery.sql`) but neither has been run against the live
  database**: applying a migration is Huraira's GO. Until it is applied, the details form says it is not switched on; reopening a halted run
  from the Cockpit needs the new jobs parameters and the active-build guard.
- Pushing, deploying the Cockpit and the worker are separate steps (Huraira's GO).

## 7. Files

Engine: `packages/workflow/src/buildAndVerify.ts` (reopen, `runProgress`, `cycleBase`, `onRunStart`, run id kept on exceptions),
`packages/jobs/src/handlers.ts` and `inputStore.ts`, `packages/frontend-loop/src/brief.ts` (`ownerFacts`), prompts in `loop.ts` and
`trackA/loop.ts`, `trackA/content.ts` (fact sources), `modelClient.ts` (request timeout), `packages/verification/src/evaluator.ts` (one
re-ask, then stop), `.github/workflows/cockpit-job.yml` (26-minute step). Database: `packages/db/migrations/0018_build_recovery.sql`.
Cockpit: `lib/recovery.ts` (diagnosis), `lib/inputs.ts`, `lib/runInfo.ts`, `components/Recovery.tsx`, `pages/Activity.tsx`, `pages/Decisions.tsx`,
`lib/attention.ts`, `jobsClient.ts`.
