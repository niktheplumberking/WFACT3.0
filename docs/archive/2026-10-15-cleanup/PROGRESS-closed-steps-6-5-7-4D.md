# PROGRESS.md: closed steps 6, 5, 7, 4D (all DONE)

Moved verbatim from `PROGRESS.md` on 2026-10-15 (cleanup round 3, see `docs/archive/MANIFEST.md`). History only; do not work from it.

## Step 6 — Enforce agent permissions (DONE 2026-10-06 — CI green 2026-10-07)

Governed by `docs/WFACT-3.0-Factory-Completion-Plan.md` Step 6 and Blueprint §3/§12/§16I. Built by a coding agent in a separate worktree
(Huraira approved the parallel lane 2026-10-06), merged into `huraira-work` and re-verified in the main checkout. Full write-up, capability
inventory and NOT COVERED list: `docs/AGENT-PERMISSIONS.md`.

- [x] Capability inventory, role x capability — `docs/AGENT-PERMISSIONS.md`
- [x] `permissionScope` is a typed, versioned (policy 1.0.0), default-deny allowlist (model slots, tables/ops, read/write paths, tools,
      max cost per run); the registry refuses a malformed scope — `58bf776`, `packages/agent-runtime/src/permissions.ts`
- [x] One enforcement point: `decide()` + the per-run `PermissionGate` from `runAgent`; model clients, artifact reads/writes, `plan_approvals`,
      the Track B build, the QA browser and reviewer, Hermes-lite tools and the verify job all go through it — `b8dbe95`, `a319a59`, `89e80be`,
      `a10c225`, `5c82f0b`
- [x] Entity isolation in code: `clients/<slug>/` paths must be the run's client; a client owned by another entity is refused before start
- [x] Every denial audited as `agent.deny` (role, capability, reason, task id), never retried by the runtime, never reported completed
- [x] Injection: client text is data; instruction-like text is flagged `agent.injection_suspected`; tests for "ignore previous", "email the
      API key", "write to another client's folder" — `planning/test/injection.test.ts`
- [x] Live attack run 2026-10-06 13:02 UTC through the real runtime and live `audit_log` (`npm run attack:permissions -- --real-model`, `128cd0a`):
      A1 `050c3329`, A2 `ed07cfaf`, A3 `cb7739a2`, A4 `7197fa12` all denied (1, 1, 1, 4 denials); A5 `9a692a2d` real models did not obey
- [x] Registry header and docs updated ("descriptive only" removed) — `ee08f9d`
- [x] CI on the merged tree: `8b05a46` pushed to both branches 2026-10-07, CI `37609559746` all 13 jobs success (incl. Cockpit deploy)
- [x] Per-run cost ceilings: Huraira delegated the choice 2026-10-07 ("reduce cost, keep quality high"). Set from live `model_traces`
      worst real run per role, with 5-18x headroom: builder $1 (worst $0.137), QA $0.50 ($0.066), Planner $0.25 ($0.041), Direction
      $0.15 ($0.025), Hermes-lite $0.10 ($0.016), Intake $0.05 ($0.003, Haiku). Worst case per full pipeline drops from $10 to $2.05.

**Verification** (independent of the building agent)
- [x] Merged tree, main checkout: typecheck clean and tests pass in all packages — audit 14, agent-runtime 39, hermes 43, planning 32,
      verification 44, workflow 24, jobs 17, frontend-loop 64, media 8, rendered-qa 40 (real Chromium)
- [x] Supabase SQL, run separately from the attack script: 26 audit rows from the attack runs, 7 `agent.deny` all with a task id, all for
      `dreamsign`, no row forged for `bennett-co`
- [x] Code read of `decide()`: no scope, wrong policy version or unknown capability kind all deny; paths normalised before matching

**NOT COVERED** (stated plainly): network egress outside the Track B build sandbox (the QA link checker can fetch any URL: possible SSRF on
the runner); one service-role key per runner (the gate is an in-process boundary, not a credential boundary); local CLIs (workflow CLI's
correction-log append, rendered-QA CLI, Hermes-lite CLI) are not gated; the screenshot reviewer's and unpriced Agent 37 calls don't count
toward the cost ceiling (it can be exceeded by one call); Hermes-lite retries a denied model call up to 3 times (up to 3 `agent.deny` rows).

**Exit check**: *"Default-deny works; each role can do exactly its scope, proven by tests and a live attack run. Cross-entity access and the
injection cases are denied and audited. Existing suites pass unchanged (or minimal, justified changes listed)."* — **MET**. Justified
changes: `runAgent.test.ts` echo role uses a typed scope; one `trackA.test.ts` test supplies the role's gate; `verification.decision` rows
inside an agent run now carry the run's entity in `entity_slug` (client slug moved to the payload). CI green: `37609559746`.

## Step 5 — Stage 6: Documentation agent and episodic memory (DONE 2026-10-07)

Governed by `docs/WFACT-3.0-Factory-Completion-Plan.md` Step 5 (Continuation Stage 6). Built by a coding agent in a parallel worktree (GO
2026-10-07), merged into `huraira-work` and re-verified in the main checkout.

- [x] Versioned episodic entry format (v1: heading, one JSON record line, rendered bullets; parser re-renders, hand-edited = "tampered";
      secrets/emails/phones redacted; brief stored as a hash) — `08fc069`, `packages/hermes/src/tools/episodes.ts`
- [x] Workflow announces the end of every build and QA stage to an optional `StageObserver`; a documentation failure writes
      `workflow.documentation_escalated` and never undoes the stage — `bba3093`
- [x] `packages/documentation`: Documentation agent on a minimal default-deny scope (reads own-entity `audit_log`/`model_traces`, appends
      only the bound client's `memory.md`, no model, $0 ceiling); deterministic extraction, append-only with an unchanged-prefix check,
      refuses another entity's run — `791d67a`, `bd62314`
- [x] Wired into the build-and-verify CLI and the Cockpit jobs runner; each entry also stored as a `documentation.entry` row (runner disks
      are lost), `npm run document` writes them into the file and backfills; CI job `documentation` — `e2c7a12`
- [x] Live backfill: 26 entries in `clients/summit-line-roofing/memory.md` over 8 runs — `530f4cb`
- [x] A live Cockpit build with the agent attached: Cockpit job `ad49df57` (2026-10-07) — entry `ep-7fc49965fcf0d73c` appended for its halted build stage, `documentation.entry` row 12:02:04Z, `agent.complete` (allowed 7, denied 0)
- [x] CI `documentation` job green on `main` — CI `37614606732` (`ed84610`) and every push since

**Verification** (independent of the building agent)
- [x] Merged tree: every package typechecks and passes — documentation 18, hermes 48, workflow 27, jobs 17 and the rest unchanged
- [x] SQL: 26 `documentation.entry` rows, 8 runs, 0 without a task id = 26 entry headings in the memory file
- [x] Agent's evidence (not re-run here): live `npm run ask` on Summit Line answered from the entries, every fact matched SQL, $0.0278

**NOT COVERED**: redaction misses personal names and street addresses in free text (excerpts capped at 240-300 chars); on a runner the
file is lost with the disk until `npm run document` is run and committed; client detection in a question is a whole-word folder-name match.

**Exit check**: *"one correct entry per stage after a workflow run, written by the agent and joined to the audit task ids; `npm run ask`
answers correctly, checked against SQL; existing suites pass unchanged."* — met in process and through the live backfill
path, and since on live Cockpit builds: job `c775c396` (3 cycles) got exactly one entry per build and QA stage (6 rows), job `ad49df57` one
for its halted build stage. **MET**.

## Step 7 — Expand the evaluation registry (DONE 2026-10-07 — CI green)

Governed by `docs/WFACT-3.0-Factory-Completion-Plan.md` Step 7. Built by a coding agent in a parallel worktree (GO 2026-10-07), merged
(`c1e511a`) and re-verified in the main checkout. Docs: the registry's own `_doc`/`notCovered`, the egress write-up and `docs/AGENT-PERMISSIONS.md`.

- [x] Registry as versioned data + code: `packages/verification/config/eval-registry.json` v1.0.0, 48 entries (33 text checks, 23 new; 10
      rendered; screenshot review; evaluator; 3 attack checks), each with id, category, severity, mode, stage, source, model, passing and
      failing fixture; blocker/major fail the gate, minor warns; 6 launch checks N/A until `--stage launch`; cost per check — `64222b1`
- [x] Cross-model separation by config (`config/evaluator.json`): same-family pair, unknown model or same instance refused at composition;
      OpenAI evaluator adapter, traced and metered; migration `0017_model_traces_openai` applied live 2026-10-07 (20261007114354), constraint
      verified by SQL, advisors nothing new — `681b9a8`
- [x] QA-runner SSRF closed: QA browser and Lighthouse confined to the site's own server; same-site links checked against built files;
      external links public-only (post-DNS check, pinned, redirects re-checked, 8 s timeout); attack tests (30 forbidden URL forms, DNS
      rebinding, metadata, a live Chromium canary reached only without confinement) — `e28f328`
- [x] One registry gate for every QA entry point (jobs runner, workflow CLI, `npm run qa`, `npm run verify`); advisory failures not sent to
      revise — `7988390`; docs and CI fixture-drift check — `0e13e30`
- [x] Step 4 pilot page through the full gate with a per-check table: 33 text checks 20 PASS / 4 FAIL / 2 WARN / 7 N/A; browser 6 PASS /
      3 FAIL (agent's evidence)
- [x] CI on the merged tree: `7180260` pushed after the M4 re-runs were dispatched; CI `37617845669` all jobs success
- [ ] Live screenshot-review / evaluator run through the registry (mocks only so far); OpenAI evaluator live (HTTP 429, no credits — Huraira)

**Verification** (independent of the building agent)
- [x] Merged tree, main checkout: typecheck clean and tests pass in every package — verification 98, rendered-qa 52 (real Chromium), workflow
      27, jobs 17, frontend-loop 67, hermes 48, documentation 18, planning 32, agent-runtime 39, audit 14, media 8
- [x] Runner composition read: the Cockpit runner's builder is Agent 37, so `evaluatorModelClientFromEnv` still picks Claude; OpenAI is only
      picked for a Claude builder

**NOT COVERED** (stated plainly): the full 78-check registry and 50-point audit (source lists not in this repo; 10 of the 20 "tells" named,
the other 10 counted as missing); model-judged checks proven on mocks; launch stage not called by anything (nothing launches); Agent 37's
upstream model is undisclosed, so its "family" rests on the gateway's self-description.

**Exit check**: *"registry versioned with fixtures that behave; pilot page re-run with a per-check table; cross-model separation enforced by
config; existing verification tests pass unchanged."* — **MET** (44 -> 98 tests, additions only), with the source-list and live-model
gaps above. CI `37617845669` green.


## Step 4D — Build recovery (DONE 2026-10-14 — exit check met live: `63278e56`, `e2a204fb`, `55ddba7c`)

- [x] **Continue from a chosen step and readiness check (2026-10-14)**: built in `8b3caed`, pushed (CI `38554457540` green incl. deploy), live in job `55ddba7c` (reopen `fromStep: revise`, `workflow.preflight` ok, builder first): resume `fromStep` qa/revise/rebuild, `workflow.preflight` before any paid step, Agent 37 timeouts not retried, live step timeline in the Cockpit. Evidence: workflow 41, jobs 28, Cockpit 115 tests. Not live yet.

Governed by `docs/BUILD-RECOVERY-DESIGN.md`. Huraira's request: stop Tracks failing again and again; when a build fails say why, offer a button
that fixes it and continues from where it left off; when something is missing, ask for it in the Cockpit and continue.

- [x] Audit of every way a build ends (about 60 modes, file and line, text left behind, what is saved): found that a halted run could never be
      resumed (`already_finished`), the Cockpit offered "Resume build" where it did nothing, thrown errors lost the run id, a timed-out job showed
      "Running" for ever, and open questions could not be answered. Evidence: `docs/BUILD-RECOVERY-DESIGN.md` §1, §2.
- [x] Reopen a stopped run (`workflow.reopen`, who/why, fresh revision budget, newest brief); never a run at the launch gate or with a changed
      saved site. `a3198d8`; workflow tests 33 (+6 new, fail on the old code).
- [x] Owner details carried into the build (`PilotBrief.ownerFacts`, `ownerSkipped`): builder prompts, content fact validation, claims gate and final
      reviewer fact sources. frontend-loop 75 (+3).
- [x] Cockpit: plain-language diagnosis in seven buckets, what is saved, one button, details form with skip, report for Huraira, "Needs your
      input" on Home, "Stopped without reporting", details before building, "Still needed from the client". Cockpit tests 67 (+39).
- [x] Prevention: bounded auto-retry of a reviewer outage (jobs tests), request timeout on Agent 37 calls, evaluator re-asked once then stopped
      instead of blaming the site, Run step limited to 26 minutes so the safety net can fire, job linked to run (`job.run`), thrown errors keep the run.
- [x] Independent review (separate agent): no critical or high findings; the 5 real findings fixed (stale revision base on a crashed run, unrecorded
      newer brief, full rebuild offered for a verified run, "skip" not reaching the builder, panel flash).
- [x] Migration 0018 applied live 2026-10-07 (version 20261007144150, Huraira's GO) and `scripts/rls_attack_test_recovery.sql` run in a rolled-back transaction: 26/26 as intended (anon/PM/other-user inserts refused, unapproved plan refused, bad key/empty/oversize/unknown kind refused, no edit or delete for anyone, audit row carries no text, duplicate build and continue refused, different run not blocked); afterwards 0 synthetic users, plans, inputs or audit rows remain.
- [x] Pushed and deployed: `a643d2d`, CI `37644039022` green, Deploy Cockpit to Vercel success; live bundle `/assets/index-DyE0Yzn2.js` contains the new copy; the worker (GitHub Actions) runs the pushed `main` code on its next job.
- [x] One live stopped build continued from its saved site in one press (2026-10-13, confirmed by SQL 2026-10-14):
      - Summit Line `63278e56` resumed run `2dcaacfa` with a `workflow.reopen` row (17:53 UTC). Its only model calls were reviewer calls, so there was no rebuild. It halted on the old Agent 37 reviewer (`not_verified_no_evaluator`).
      - Lanternworks `e2a204fb` resumed run `4c35703b` after the runner crash of `83f2841f`. Its first call was the review (19:24 UTC), with no builder call before it. It reached a real QA verdict (`failed_verification`, see Step 26).
      - Nothing was published.
- [x] Missing facts asked in the Cockpit and passed to the builder, live (2026-10-14): Huraira's details form wrote 8 `plan_inputs` rows; job `55ddba7c`'s reopen brief carries them as `ownerFacts`; the built `content/site.json` has phone, email and location with `source: "brief"`; launch gate reached (`4e4434db…`). Earlier note "0 rows" is superseded.
- [ ] Not covered: file uploads (photos, logos: Step 4B M5), closing a stale `running` row from the Cockpit, a per-build total spend cap, saving the
      approved content before the site build.

**Verification**: workflow 33/33, jobs 24/24, frontend-loop 75/75, verification 100/100, Cockpit 67/67, all typechecks clean, Cockpit builds. Live (2026-10-13): continues `63278e56` and `e2a204fb`, above.
**Exit check**: *"a build that stopped continues from its saved site in one press; missing facts are asked in plain words and reach the builder as sourced facts; nothing is invented; nothing publishes."* — **PARTIALLY MET**: met in tests; migration 0018 is live and the Cockpit is deployed (corrected 2026-10-12: this line said "migration and deploy pending", which was out of date after `9730d99`/`a643d2d`); 2026-10-14: the one-press continue from the saved site is proven live (`63278e56`, `e2a204fb`). Still unproven live: the missing-facts form (0 `plan_inputs` rows).

