# PROGRESS.md: Continuation Build Plan Stages 1–5, Cockpit jobs, CI history (all MET)

Moved verbatim from `PROGRESS.md` on 2026-10-15 (cleanup round 3, see `docs/archive/MANIFEST.md`). History only; do not work from it.

Everything below is committed. `main` = `huraira-work`'s `4ecfe4a` (CI `36750897743`); `huraira-work` is 5 docs-only commits
ahead and unpushed (`4cba33b`…`1ccae2b`); other editors' archive-path fixes are uncommitted in the working tree. CI history on `main`:

| Run | Commit | Result |
|---|---|---|
| `36421350704` | `77680c7` | failure: guardrails false positive |
| `36429819858` | `f1055a8` | failure: gitleaks false positives |
| `36433582813` | `b57eead` | failure: deploy, bad `VERCEL_TOKEN` |
| `36436468792` | `1bcf671` | success |
| `36439020452` | `123970f` | success |
| `36443734844` | `4653c67` | success, all 11 jobs incl. `Deploy Cockpit to Vercel` |
| `36453515469` | `a2ada14` | success |
| `36455388336` | `2e4a911` | success |
| `36458405540` | `6e72020` | success, 11 of 11 jobs |
| `36698432470` | `2223344` | success, all 11 jobs incl. deploy (account sign-up, rotated keys in CI) |
| `36699308136` | `856e483` | success, all 11 jobs incl. deploy (forgot-password flow) |
| `36699803027` | `856e483` | success (`Cockpit job`, Step 4 `intake` `1dd90f25`; not CI) |
| `36700769803` | `856e483` | success (`Cockpit job`, Step 4 `replan` `c62e24a4`; not CI) |
| `36750858892` | `79a0c67` | success (docs push) |
| `36750897743` | `4ecfe4a` | success (Factory Completion Plan added) |
| `36743601290` | `856e483` | success (`Cockpit job`, Step 4 `build_plan` `81c8607b` retry: built and QA-approved; not CI) |
| `36701102701` | `856e483` | workflow run succeeded, job **failed** (`Cockpit job`, Step 4 `build_plan` `31c965ff`, Agent 37 HTTP 402) |
| `36455639903` | `2e4a911` | success (`Cockpit job` workflow, `build_plan` `b952aaba`; not CI) |

All 10 migrations (`0001`–`0010`) are listed as applied on `mcaxxhgjptwowwrluhra`, checked via
`list_migrations`.

## Stage 1 — Close the Phase 0/1 debt (3 of 3 criteria MET as of 2026-09-30; CI path proven on `main`)

- [x] **Audit log — acceptance MET 2026-09-28** (`78169e0`).
      - `packages/db/migrations/0006_audit_log.sql` is applied. It's append-only by trigger for every
        role, service_role included.
      - Attack-tested live: UPDATE, DELETE and TRUNCATE were refused, malformed action names were
        rejected, `anon` insert was refused, and `anon` sees 0 rows. `get_advisors` shows nothing new.
      - New `packages/audit` (fail-closed). It's wired into Hermes-lite's `ToolRegistry` and
        `VerificationLoop.run`.
      - Queried back via SQL:
        - Hermes run `bbcefba8…` wrote 3 `tool.invoke` rows and 1 `hermes.answer` row.
        - Verification run `c762b467…` wrote 1 `verification.decision` (`approved`, 6 checks).
      - This sync: `audit_log` holds 43 rows across 10 action types, from 12:10 to 15:39 UTC today.
- [x] **CI auto-deploy — acceptance MET 2026-09-28.**
      - `.github/workflows/ci.yml` `deploy-cockpit` runs on push to `main` only and `needs` every
        check job. It takes secrets from Doppler only.
      - Steps: `vercel build` → `deploy --prebuilt --prod` → curl smoke-check.
      - `apps/cockpit/vercel.json` disables Git-triggered deploys on `main`, so CI is the only
        production deployer.
      - First success: run `36436468792` (a production deploy, and the job's own smoke-check got HTTP
        200). Re-confirmed on `36443734844`.
      - Production alias `wfact-cockpit-niktheplumberkings-projects.vercel.app`: HTTP 200 via curl,
        this sync.
      - Closes the sprint's Phase 1 "zero manual steps" exit check.
- [x] **Secrets manager — plaintext retired, MET 2026-09-30** (Factory Completion Plan Step 3; Huraira
      did the account actions, the agent verified).
      - Doppler workspace "WFACT 3.0", project `wfact-3-0-codebase`, configs `dev`/`prd`.
      - Both `.env.local` files are gone (`ls` errors, `find . -name ".env*"` finds only the tracked
        `.env.example` files, which hold 0 non-empty assignments).
      - The plan's grep criterion passes: the plan's grep for non-empty service-role and Anthropic key assignments (exact command in
        `docs/SECRETS.md`; run with the real `/usr/bin/grep`, excluding `node_modules`, `.git` and `SECRETS.md`)
        returns nothing (exit 1). This file is worded so it doesn't match its own pattern. A wider
        secret-shape scan hits only `packages/verification/test/fixtures/broken.html`, a deliberate fake key
        (`sk-ant-fakekey…`).
      - Runs from Doppler only: `doppler run -- npm run ask` wrote audit run `8baee338-88cf-4be5-8f46-5c2e33c17300`
        (3 `tool.invoke` + 1 `hermes.answer` rows, read back by SQL) with no env file present; the Cockpit
        builds from Doppler values (`index-DypAz2VC.js`, same hash as the live bundle), and the built bundle has
        no `service_role` string.
      - Rotated keys authenticate by HTTP status: Anthropic 200, OpenAI 200, Agent 37 200, Supabase service
        key 200 via REST, `VERCEL_TOKEN` resolves to `niktheplumberking`. Live Cockpit's baked anon key
        equals Doppler's and returns 200.
      - **Not independently proven:** (1) that each key actually changed (the old values weren't saved to
        compare; rotation is Huraira's report); (2) that the old Doppler CLI token is revoked (see
        Incidents); (3) ~~the CI path with the new keys~~ now PROVEN: `main` CI runs `36698432470` and `36699308136` passed the
        deploy job, which reads `VERCEL_TOKEN` from Doppler via the `DOPPLER_TOKEN` GitHub secret (still dated
        2026-09-28, i.e. never re-set, and it works); (4) the `dispatch-job`
        Edge Function's own `SUPABASE_SERVICE_ROLE_KEY` after rotation (an anon call still returns 401,
        but the service-key path needs a signed-in call).
      - Local hygiene: the two tracked `.env.example` files had also been deleted from disk and were
        recreated from `HEAD` (git status clean).

**Stand-in disclosed**: the plan asks for "a cloud provider's secrets manager, or HashiCorp Vault";
Doppler is a hosted third option. Setup is in `docs/SECRETS.md`.

## Stage 2 — Generalize the agent runtime (MET — committed `f1055a8`, CI green from `36436468792`)

- [x] **`packages/agent-runtime`**
      - The `Agent<I,O>` interface and `AgentTask` (UUID `taskId`, role, deadline, retry budget).
      - `runAgent()` runs spawn → validate → execute → report → terminate. Retry/escalation is
        imported from Hermes-lite (`@wfact/hermes-lite/escalation`), not re-implemented.
      - Every lifecycle step is audited (`agent.spawn` / `complete` / `escalate` / `reject`).
- [x] **Agent registry** (`src/registry.ts`), seeded with exactly `front-end-builder` and
      `qa-evaluator`. An unregistered role is rejected. `permissionScope` is descriptive only (the
      policy engine is on the "do not build yet" list), stated in the file header.
- [x] **frontend-loop and verification re-pointed**: `createFrontendBuilderAgent` and
      `createQaEvaluatorAgent` wrap the unchanged loops, and both CLIs run through `runAgent`.

**Acceptance**:
- *Existing suites pass unchanged*: **MET**. `git diff a57d977` shows no edits to pre-existing test
  files, and the frontend-loop and verification CI jobs are green on `36443734844`.
- *A new agent can be added without touching agent-runtime*: **MET**. Proven by `echo-test` in the
  tests, and for real by Stage 4's `intake`/`planner` via `registryWithPlanning()`.
- *Live*:
  - The verification CLI ran through the runtime: run `b564fde3…`, `agent.spawn` →
    `verification.decision` → `agent.complete` on task `69e94fcf…`, APPROVED.
  - The front-end CLI was not re-run live standalone. It is exercised live inside Stage 3's workflow
    run.

## Stage 3 — Workflow engine v1: build → verify (MET — committed `b57eead`, CI green from `36436468792`)

- [x] **`packages/workflow`, `buildAndVerify(brief)`**
      - Order: `front-end-builder` → `workflow.checkpoint` (`build`, artifact sha256) → `qa-evaluator`
        on the re-hashed checkpointed file.
      - On QA failure, the exact failed check IDs go back via `FrontendLoop.revise()`, with bounded
        revisions.
      - On pass: a `verified` checkpoint → `workflow.gate` (`launch`, `hard-gate`). **It never
        deploys.**
      - Versioned `build-and-verify@1.0.0`.
- [x] **Checkpoint/rollback proven**, 7 tests:
      - a broken first build is caught before any verified checkpoint;
      - broken-then-fixed passes;
      - a crash resume makes zero builder calls;
      - a tampered artifact is refused;
      - a finished run isn't re-opened;
      - a malformed brief writes no rows.
- [x] **One entry point**: `npm run build-and-verify -- <brief.json>` (or `--resume <run-id>` or
      `--plan <id>`).

**Stand-in disclosed**: this is a hand-rolled in-process workflow, not n8n/Temporal. There's no queue
and no auto-restart. It's disclosed in the file header, the README and here.

**Acceptance**:
- *One command, build → verify, real brief*: **MET, live.** Run `cb59c6a4…` →
  `awaiting_launch_approval`.
  - The audit rows were read back via SQL. This sync confirms `workflow.start` ×1,
    `workflow.checkpoint` ×2 and `workflow.gate` ×1, all at 13:47–13:49 UTC.
  - The file re-hashes to `6771ed270ff7…`.
  - A separate verification-CLI process gave PASS and APPROVED.
- *Checkpoint is a real, crash-recoverable row*: **MET.**
- Caveat: the "real brief" is still the placeholder (`source: placeholder-2.0-case`). That's gated on
  Nick until Stage 7.

## Stage 4 — Intake + Planner (MET — committed `1bcf671`, CI green on `36436468792`)

- [x] **Model routing as configuration**: `packages/hermes/config/model-routing.json` sends `intake`
      → `claude-haiku-4-5` (fast) and `planner` → `claude-sonnet-5` (mid). There's a per-run
      `WFACT_ROUTE_<SLOT>` override, and an unknown slot is refused.
- [x] **Intake agent** (`packages/planning/src/intake.ts`):
      - It uses structured outputs, re-validated with zod.
      - Entity assignment is cross-checked against Hermes-lite's `detectEntitySlug`.
      - It re-classifies once, then escalates.
- [x] **Planner agent** (`packages/planning/src/planner.ts`):
      - The brief must pass frontend-loop's `parseBrief`.
      - Tasks must be exactly the `build-and-verify@1` stages, with registered roles.
      - It retries once, then escalates.
- [x] **Registered without touching agent-runtime** (`registryWithPlanning()`).
- [x] **Owner-approval gate** (migration `0007`, applied):
      - Only owners/admins decide, and only once. The plan body is immutable, a rejection needs a
        note, and there are no deletes.
      - Each decision is audited as `plan.decision`.
      - Attack-tested live 9/9.
- [x] **Cockpit Approvals room extended** (`PlanApprovals.tsx`), with re-plan once then escalate, and
      a chain into Stage 3 via `--plan <id>` (only approved plans build; a pending plan was refused
      live).

**Acceptance**:
- *Raw brief in → Planner task list out, no hand-written intermediate*: **MET (live).**
  - Run `d189d25c…`, from synthetic `examples/sample-lead-email.txt` ("Northlight Signs").
  - Intake on haiku-4-5 gave `dreamsign`, `new_website`.
  - Planner on sonnet-5 gave `clean-agency`, 5 sections, 2 tasks, 9 open questions.
  - Stored as plan `8f03181f…`.
- *"Planner-APPROVED"*: **MET 2026-09-28** (new this sync). Plan `8f03181f` has `status = approved`,
  `decided_at` 14:33:35 UTC, and a matching `plan.decision` audit row. The second synthetic plan
  `ba93ddae` (Harbor Street Bakery) was rejected at 15:39:26 UTC, with a second `plan.decision` row.
  This closes the earlier gap about cleaning it up.
- *Routing split is configuration*: **MET.**
- Not yet done: building the approved plan (`build-and-verify --plan 8f03181f`). The two Cockpit
  attempts are stuck. See Cockpit jobs below.

## Stage 5 — Observability seed (MET — committed `123970f`, CI green on `36439020452`)

- [x] **`model_traces`** (migration `0008`, applied):
      - Append-only, one row per model call, with `price_basis` metered or unpriced. A metered row
        needs a cost; an unpriced row must have none.
      - Owner-only read, and the `model_usage_by_actor` view is `security_invoker`.
      - Attack-tested live 8/8.
- [x] **Cost math centralised**: one `models` price table and `costForModel()`. The four copied
      `PRICING` constants are gone. Agent 37 is recorded as `unpriced` (cost NULL, never $0).
- [x] **Per-call tracing** (`traceModelCalls`, `traceModelClient`, `runContext`), wired into all five
      CLIs.
- [x] **Cockpit Models room**: totals, cost per model per role, and the latest 25 calls.

**Acceptance**:
- *Every agent run produces a queryable trace row with a real cost*: **MET (live).**
  - Planning run `345cf9ae…` plus one verification run gave:
    - `intake`: $0.001635
    - `planner`: $0.015928
    - `qa-evaluator`: $0.014300
  - Each joins to its `agent.complete` row.
  - This sync: `model_traces` has 4 rows (those 3 plus the Cockpit `ask` job).
  - "Real" means provider-reported tokens × list price, not invoice reconciliation.
- *Models room shows real data from a real run*: **data half MET.** The view queried as the owner
  returns those rows. Browser rendering has **not been independently verified by this sync**, even
  though the owner was demonstrably signed into the Cockpit today (plan decisions and job requests).

## Cockpit jobs — every pipeline action from the Cockpit (unplanned; committed `4653c67`, CI green on `36443734844`) — DISPATCH PROVEN LIVE 2026-09-28; browser check pending

Huraira's direction; see "Unplanned work done". Design and runbook are in `docs/COCKPIT-JOBS.md`.

- [x] **`public.jobs` queue + private `artifacts` bucket** (migration `0009`, applied).
      - Per-kind param validation; `build_plan` only for an approved plan and `replan` only for a
        rejected one.
      - Status is forward-only, the request is immutable, there are no deletes, and requests are
        audited.
      - Attack-tested live (spoofing, path traversal, injection strings, a stranger reading, backwards
        status, edits, deletes all refused).
- [x] **`dispatch-job` Edge Function**: `ACTIVE`, **version 5**, `verify_jwt: true` (`list_edge_functions`
      2026-09-30). Deployed source is identical to the repo copy at `aac412b` (v4 source); v5 has no commit
      of its own. Live negative tests pass (no token gives 401; the anon key gives "not signed in").
- [x] **`packages/jobs` runner** and **`.github/workflows/cockpit-job.yml`**: UUID-validated
      `job_id` via `env`, secrets from Doppler `prd`, and a `--mark-failed` safety net.
- [x] **Local live proof**: `ask` job `1141b711` went queued → running → succeeded (15:04 UTC) with
      the runner run locally on Doppler `prd`. It was not dispatched through GitHub (`dispatched_at`
      null).
- [x] **GitHub dispatch leg — MET 2026-09-28.** Job `b952aaba` (`build_plan`, plan `8f03181f`): requested
      17:05:06 UTC, `dispatched_at` 17:05:15, run `36455639903` on `2e4a911` (success, 6m38s, all steps
      green, `--mark-failed` skipped), finished 17:11:49 with `awaiting_launch_approval` and `qaIssues: []`.
      `audit_log` shows `job.requested`, `job.dispatched`, `workflow.start`, two `workflow.checkpoint`
      rows and the `workflow.gate` (launch, hard-gate; "this workflow never deploys"), all read back by SQL.
- [x] **Failure path proven**: `e5d29358` failed visibly (16:52 UTC, 09-28) with "Dispatcher not
      configured: GITHUB_DISPATCH_TOKEN is not set", so a broken dispatcher never leaves a job looking
      queued. Token is set now (the next dispatch got GitHub's 204). Its presence by name could not be
      listed (`supabase secrets list` errored), so this is inferred from behaviour.
- [ ] **Two orphaned jobs**: `a2a41d2d` and `cbf8bf7b` (15:34 and 15:39 UTC, 09-28) are still `queued`
      with `dispatched_at` null, left from before the CORS fixes. Waiting on: Huraira's OK to mark them
      failed/cancelled (a DB write), or to click **Start** on one.
- [x] **Cockpit Actions room built**: new request → intake + plan, Build + verify (approved plans),
      Re-plan (rejected), Resume, Verify a page, Ask Hermes, and a live job list. There's **no deploy
      button**; Launch stays human. Built-page previews render in a sandboxed iframe (`6e72020`). The
      Cockpit build job is green on `36458405540`; the live URL returns HTTP 200 (2026-09-30).
- [x] **Actions room checked in a browser with live data (2026-09-30)**: on the `dist-rho-lime-95` alias, signed in as
      the owner, a paste of the raw request created job `1dd90f25` and it was dispatched 8 s later (10:01:13,
      run `36699803027`, success). The room showed each job's true status with its real reason, including
      the failed build `31c965ff` ("builder escalated: … HTTP 402 …") and the approved-plan list. Two rough
      edges: it offers "Resume from last checkpoint" on a failed build that has no checkpoint, and reports
      "0 builder correction rounds" though the evaluator had requested one.

