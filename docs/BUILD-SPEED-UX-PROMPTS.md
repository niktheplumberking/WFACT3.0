# Build speed and progress UX — agent prompts

Written 2026-10-13 from a measured investigation (Supabase `jobs`, `audit_log`, `model_traces`; GitHub step timings for runs
`38444800281`…`37623962724`). Status: **proposed, not in Part B/D/E of the Factory Completion Plan.** When Huraira approves one, add it
there (Part F rule) and run `node scripts/check-trackers.mjs`. Each prompt is self-contained: paste it as-is to a coding agent.

## Baseline (measured 2026-10-13)

| What | Number |
|---|---|
| Build jobs | 20 `build_plan`: 2 succeeded (379 s, 498 s), 15 failed (mean 629 s, max 1,664 s), plus 3 failed `resume` |
| Runner wait (dispatched → started) | 45–90 s per job |
| Runner setup | ~55 s (npm ci 10–17 s, Track B cache warm 6–9 s, Chromium 20–27 s) |
| Builder step (Agent 37) | 60–140 s; Agent 37 call mean 67 s at ~46k input tokens vs direct Claude 11.5 s at ~5k |
| Checkpoint gap after builder | 15–20 s |
| Gap checkpoint → QA spawn | 25–44 s |
| QA, normal | 63–190 s |
| QA, reviewer hang | 1,247–1,392 s (Agent 37 reviewer: 4 of 4 calls cut at ~300 s, then retries) |
| Revision rounds | up to 3 builder+QA cycles, ~4–5 min each; 4 builds hit the 2-revision cap |
| Small jobs | intake 90 s total for 44 s of work; replan 76 s for 26 s; `ask` (no GitHub) 13 s |
| Visibility | GitHub "Run job" log printed only its final line in a 25-min run; no elapsed / remaining time in the Cockpit |

## Order and file ownership (two writers never share files)

| # | Prompt | Touches | Run |
|---|---|---|---|
| P0 | Verify and land the reviewer fix | `packages/rendered-qa/**`, `packages/frontend-loop/src/{modelClient,longFetch}.ts` | **First.** Everything else waits for its commit |
| P1 | Live build progress | `apps/cockpit/src/**`, `packages/jobs/src/run.ts`, `packages/workflow/src/**` (log lines only) | After P0; parallel with P2 |
| P2 | Runner cold start | `.github/workflows/cockpit-job.yml`, `supabase/functions/**`, `packages/jobs/src/handlers.ts` | After P0; parallel with P1 |
| P3 | Fewer wasted revision rounds | `packages/frontend-loop/**`, `packages/workflow/src/**` (loop logic) | After P0 and P1 |
| P4 | QA stage speed | `packages/rendered-qa/**`, `packages/verification/**` | After P0; not with P3 |
| P5 | Builder runtime bake-off (measure only) | new `scripts/bakeoff/**`, a report in `docs/reports/` | Any time; read-only on product code |
| P6 | Customer progress experience (design only) | new `docs/CUSTOMER-PROGRESS-DESIGN.md` | Any time |

MVP note: until 2026-10-14 the MVP cut-line (`docs/MVP-CUTLINE.md`) wins. P0 belongs to it (it unblocks a passing build); P1–P6 come
after it unless Huraira says otherwise.

---

### P0 — Verify and land the design-reviewer fix

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/ on branch huraira-work. Follow Part C
(Standard Operating Rules) of docs/WFACT-3.0-Factory-Completion-Plan.md. Do ONLY this task.
"Never trust done, only verified": this work is reported done but is uncommitted and unproven live.

ALREADY DONE (uncommitted in the working tree as of 2026-10-13; read the diff, do not redo):
- packages/rendered-qa/config/reviewer.json 1.1.0: reviewer switched from Agent 37 hermes-agent to
  anthropic/claude-sonnet-5, approved by Huraira 2026-10-13, with the vendor reasoning recorded.
- packages/rendered-qa/src/longFetch.ts and packages/frontend-loop/src/longFetch.ts: fetch without
  Node's 300 s header timeout (UND_ERR_HEADERS_TIMEOUT), used by the reviewer and the Agent 37 client.
- packages/rendered-qa/src/rendered.ts: screenshot slices 11 -> 7 per page.
- tests: reviewerAnthropic.test.ts (new), reviewerAgent37.test.ts, trackA.test.ts.
If `git status` shows these already committed, verify the commit instead and skip step 3.
Other uncommitted files (packages/planning/src/direction.ts + test, packages/hermes/src/tracing.ts,
clients/lanternworks-studio/) belong to other work: do NOT stage them unless you confirm they are part of
this fix. Another session may commit in this checkout: commit named paths only, check `git reflog`.

DO
1. Run the rendered-qa, frontend-loop and verification test suites and the CI-equivalent locally. Fix
   only failures caused by this change.
2. Bound the worst case. The reviewer still has REVIEW_REQUEST_TIMEOUT_MS = 600 s and
   REVIEW_RETRY_DELAYS_MS [15 s, 45 s, 120 s]. With longFetch removing Node's 300 s cut, a hung call now
   waits up to 600 s, so a hang could cost ~40 min instead of ~23. The Agent 37 builder client now waits
   up to 360 s per call. Lower the reviewer timeout to 120 s (direct Claude QA calls take 8–28 s, max
   seen 39 s) and treat a timeout as "no answer" with at most one retry; keep the backoff for fast
   5xx/429 replies only. Add a test asserting the worst-case review time is under 5 minutes.
3. Commit (named paths), then ask Huraira before pushing.
4. Live proof, after push and only with Huraira's GO: continue a stopped Track A build from its saved
   site (Step 4D flow, e.g. job b880a7d5 / run 15ad4086, or the 2026-10-13 build 83f2841f). Verify by
   read-only SQL: a model_traces row with actor agent:qa-evaluator, provider anthropic, outcome success,
   latency under 60 s; a verification.decision row; QA stage under 5 minutes; nothing published.
EXIT CHECK: tests green; worst-case review time stated and under 5 min; one live build whose design
review ran on the new reviewer, with trace ids. If a step's status changed (4B, 4D), run /step-close.
Report in the Part C format and STOP.
```

---

### P1 — Live build progress (team-facing)

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/ on branch huraira-work. Follow Part C of
docs/WFACT-3.0-Factory-Completion-Plan.md. Do ONLY this task. Load the design skills Part C lists
(impeccable, ecc:make-interfaces-feel-better, ecc:frontend-a11y) before UI work; keep the Cockpit's
existing design system.

PROBLEM (measured 2026-10-13): builds run 6–28 minutes and nobody can tell what is happening. The
GitHub "Run job" log printed one line in a 25-minute run. The Cockpit shows no elapsed time, no current
sub-step and no estimate. The real timeline exists only in public.audit_log (workflow.start,
agent.spawn / agent.complete per role, workflow.checkpoint, verification.decision,
workflow.return_to_builder, workflow.halt, workflow.reopen) and public.model_traces (per call: actor,
model, latency_ms, outcome).

BUILD
1. Run page timeline (apps/cockpit/src/pages/Activity.tsx, RunPage / Steps): one row per stage
   (Builder, Saved, Quality checks, Revision round N of 3, Stopped / Passed), each with start time and
   duration. For the running stage show a live elapsed counter and a plain sentence for the current
   wait, e.g. "Checking quality: design review running (1 min 10 s)" or "Waiting on the reviewer,
   attempt 2". Plain words per the Step 4C copy guide; never a slug as the main label.
2. Estimate: "usually takes about X min" from the median of past succeeded runs of the same track.
   With fewer than 3 such runs, say "not enough past builds to estimate" rather than guess.
3. Stall warning: if the current stage has run past 2x its median (or past 5 minutes for QA), show an
   amber "taking longer than usual" note that names what it is waiting on.
4. Heartbeat log lines: packages/jobs/src/run.ts (and workflow stage boundaries) print one line per
   stage start/finish with elapsed seconds, so the GitHub log shows progress. No secrets, no brief text.
5. Refresh: reuse the polling in apps/cockpit/src/lib/state.tsx; poll faster (about 5 s) only while a
   job on screen is running.
6. Respect RLS: cost figures stay owner-only, as today.

TESTS: unit tests for timeline derivation from audit rows (a halted run, a reopened run, a run with 3
rounds) and for the estimate with 0, 2 and 5 past runs.
VERIFY: in the browser preview against real past runs (c7fba41a = 3 rounds; b880a7d5 = 23-min QA stall;
81c8607b = succeeded) and a running job; screenshots at desktop and phone width; no console errors.
EXIT CHECK: a person watching a build can always tell which stage it is in, how long it has run, about
how long it normally takes, and what it is waiting on. Report in the Part C format and STOP.
```

---

### P2 — Cut runner cold start

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/ on branch huraira-work. Follow Part C of
docs/WFACT-3.0-Factory-Completion-Plan.md. Do ONLY this task. Do not push to main (main deploys).

PROBLEM (measured 2026-10-13, .github/workflows/cockpit-job.yml): every Cockpit job waits 45–90 s for a
runner, then spends ~55 s on setup before any work: per-package npm ci 10–17 s, Track B starter cache
warm 6–9 s, `npx playwright install --with-deps chromium` 20–27 s. Short model-only jobs suffer most:
intake 90 s end to end for 44 s of work, replan 76 s for 26 s. The `ask` job does not use GitHub and
finishes in 13 s.

DO
1. Cache: actions/cache for the npm cache (keyed on every package-lock.json) and for the Playwright
   browser directory (keyed on the playwright version). With the cache warm, install only the system
   dependencies (`playwright install-deps chromium`). Keep the Track B offline cache correct: a Track B
   build installs with `npm ci --offline` inside a network sandbox and must still find every package.
2. Skip Chromium and the Track B warm-up for job kinds that never render (intake, replan, ask): pass
   the job kind into the workflow and gate those steps on it.
3. Assess moving intake and replan off GitHub to the path `ask` uses (find it: docs/COCKPIT-JOBS.md,
   supabase/functions/, packages/jobs/src/hermesAsk.ts). Write the trade-offs: Edge Function time
   limits, secrets handling (Doppler vs Supabase secrets), the tool-call allowlist law, audit and trace
   parity, failure handling. Implement only if it is small and keeps every law; otherwise leave a
   written recommendation for Huraira.
VERIFY: before/after step timings from real workflow runs (`gh api .../actions/runs/<id>/jobs`) for one
build_plan and one intake job with a warm cache; a Track B build still installs offline; CI green.
EXIT CHECK: setup under 25 s with a warm cache for render jobs and under 15 s for non-render jobs, or the
honest number and why. Report in the Part C format and STOP.
```

---

### P3 — Fewer wasted revision rounds

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/ on branch huraira-work. Follow Part C of
docs/WFACT-3.0-Factory-Completion-Plan.md. Do ONLY this task. Do not weaken any check, gate or rulebook
rule to make builds pass: the goal is to fail less and fail sooner, never to verify less.

PROBLEM (measured 2026-10-13, audit_log): each extra builder+QA round costs ~4–5 minutes, and builds
die for reasons that could be caught before the expensive steps:
- Builder content rejected after 3 attempts: "openQuestions.0: Too big: expected string to have <=300
  characters" (job 4d6e1abb); "The brief requires a section with id "testimonials" on some page; none has
  it" (job 9c853a49).
- QA revision cap hit 4 times (f696ba43, 6f68adbd, c775c396, c7fba41a), for issues such as visible
  "SAMPLE" placeholder badges, LCP 2.63 s vs a 2.5 s budget, and DR-REPEATED-RHYTHM.

DO
1. Give the builder the limits up front: the content schema's limits (lengths, required section ids
   from the brief, banned placeholder text) go into the builder prompt as a short checklist generated
   from the schema, so it cannot drift.
2. Repair retries send only the validation errors and the failing fields, not the whole site again.
   Keep the 3-attempt cap.
3. Cheap pre-QA gate: after the build and before rendering, run fast checks that need no browser
   (placeholder/sample text, required sections, link targets, image sizes and weights that predict
   LCP). If one fails, return to the builder at once with the exact finding instead of a full QA pass.
   It counts as a revision round like any other.
4. Revision feedback: the builder receives each failed check's id, the page and the exact evidence
   (e.g. measured LCP and the element), not a summary.
Measure: a small script that reports from audit_log the rounds per build and the failure reason per
round, before and after this change.
TESTS: the two builder rejections and the SAMPLE-badge case as fixtures that now pass, or fail early with
a precise message.
EXIT CHECK: fixtures green; on at least 2 real builds after the change, fewer rounds than the baseline,
with the before/after table. Report in the Part C format and STOP.
```

---

### P4 — QA stage speed

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/ on branch huraira-work. Follow Part C of
docs/WFACT-3.0-Factory-Completion-Plan.md. Do ONLY this task. Do not drop or loosen any check.

PROBLEM (measured 2026-10-13, audit_log): a normal QA pass takes 63–190 s, plus 15–20 s to save a
checkpoint after the builder and another 25–44 s before QA starts. Multi-page Track A sites take longest.

DO
1. Profile one Track A and one Track B QA pass: time per page for screenshots (3 viewports, 7 slices
   after P0), Lighthouse, the deterministic suite, the evaluator call and the design-review call. Put
   the numbers in the report before changing anything.
2. Find what fills the checkpoint gap (15–20 s) and the pre-QA gap (25–44 s): hashing, git, server
   start, browser launch?
3. Speed up without changing results: one browser per QA pass, pages in parallel up to a small cap,
   Lighthouse not competing with screenshots for CPU (its timings are sensitive: prove LCP is unchanged
   within noise on the same site), and the evaluator and design review running concurrently once the
   deterministic checks pass.
VERIFY: same site before vs after: identical pass/fail verdicts, LCP within ±5%, wall time per stage.
EXIT CHECK: QA pass time cut by at least a third on the profiled sites with identical verdicts, or the
honest number and the blocker. Report in the Part C format and STOP.
```

---

### P5 — Builder runtime bake-off (decision input, measure only)

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/ on branch huraira-work. Follow Part C of
docs/WFACT-3.0-Factory-Completion-Plan.md. Do ONLY this task. It is a measurement for a decision
Huraira owns (runtime/model choice, CLAUDE.md §3). Do NOT change the production builder.

FACT (model_traces, 2026-10-13): builder calls through Agent 37 (hermes-agent) average 67 s at ~46k
input tokens (~21k tokens of per-call overhead, docs/AI-COST-AUDIT.md); direct Claude Sonnet calls in
the same builder average 11.5 s at ~5k input tokens.

DO
1. Spend: stay under $3 in total and within the M6 caps ($5/build, $20/7 days). Stop and ask before
   going over.
2. Same three briefs (pilot brief plus two synthetic briefs, labelled synthetic), same prompts and
   schema, through Agent 37 hermes-agent and through the direct Claude model the builder already
   supports. Run each twice. Record latency, tokens, cost (priced or "estimate"), schema-valid on first
   try, and deterministic QA pass on the rendered result. A different model family judges quality blind;
   it must not be the builder.
3. Evaluator≠builder: if the builder moved to Claude, the design reviewer (Claude since reviewer.json
   1.1.0) would share its vendor. List the options (OpenAI once it has credits, Agent 37 as reviewer,
   etc.) without choosing.
OUTPUT: docs/reports/builder-bakeoff-2026-10.md with the table, raw trace ids and a recommendation marked
as a recommendation. EXIT CHECK: every number traceable to a model_traces row or a log. Report in the
Part C format and STOP.
```

---

### P6 — Customer progress experience (design only)

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/ on branch huraira-work. Follow Part C of
docs/WFACT-3.0-Factory-Completion-Plan.md. Do ONLY this task: a design document, no product code. Load
impeccable and ecc:frontend-design-direction first.

CONTEXT: builds run 6–28 minutes today (baseline in docs/BUILD-SPEED-UX-PROMPTS.md). Ad campaigns start
2026-10-19, so real customers will soon wait on builds. There is no customer portal yet (Owner's Key port
is Step 23). External sends (email to a client) are a hard gate (CLAUDE.md §6); the mail engine pattern
is an event bus off email, not paid webhooks.

WRITE docs/CUSTOMER-PROGRESS-DESIGN.md covering:
1. What a customer sees from "brief sent" to "preview ready": named milestones (e.g. Planning ->
   Writing your content -> Building your site -> Quality checks -> Ready for your review), honest time
   ranges, never an endless spinner.
2. When a build stops: the customer sees "we're polishing this, expect it by <time>", the stop lands in
   our Cockpit queue (Step 4D buckets), and nothing technical reaches the customer.
3. Notifications: "your preview is ready" by email through the mail engine, the approval tier each send
   needs (auto, notify-and-wait or hard-gate) and who approves.
4. Early value: showing the approved direction or homepage preview while the rest builds, only if it
   exposes no unverified work.
5. Which parts reuse P1's timeline data, and a list of build steps with rough sizes for Huraira to
   sequence.
Mark it PROPOSED. EXIT CHECK: Huraira can approve or reject each section separately. Report in the Part C
format and STOP.
```
