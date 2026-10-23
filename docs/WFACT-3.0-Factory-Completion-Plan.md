# WFACT 3.0 — Factory Completion Plan

**Created**: 2026-09-30
**For**: Huraira (owner of the plan) and the coding agent that executes it.
**Scope source of truth**: `docs/wfact-3.0-blueprint.html` (the Blueprint).
**Relationship to other docs**: this plan sits on top of `docs/WFACT-3.0-Continuation-Build-Plan.md`
(Stages 1–7). It does not replace it. It maps every remaining Blueprint phase, every Cockpit expectation
(Blueprint §9) and every Definition-of-Done goal (Blueprint §16K) to a numbered step. Where a step maps
to a Continuation Stage, that is noted.
**Revised 2026-10-01**: added **Step 4B** (front-end upgrade: two build tracks, chosen per client) and **Step 4C** (Cockpit UI/UX
redesign), and the **design-quality rule** in Part C. Both new steps sit between Step 4 and Step 5 in priority order; 4C can run in
parallel with Steps 5-8 because it only touches `apps/cockpit`.
**Realigned 2026-10-07**: product-and-solution alignment pass (`docs/HANDOFF.md` is the orientation; `docs/archive/MANIFEST.md` lists what moved). Changes to this plan: closed steps (1, 2, 3, 3A, 4, 4C, 5, 6, 7) keep their heading, status and evidence but their long agent prompts moved to the archived pre-realignment copy; open steps keep full prompts; Steps 12, 20 and 21 gained the verified gaps found in the audit; Part F lists proposed, UNAPPROVED additions (agency scope) and the decisions that gate them. The execution order was re-set on 2026-10-07 (see "Execution order" after Part B); Steps 25 and 26 were added. The step table, headings and Part E remain machine-checked by `scripts/check-trackers.mjs`.
**Last synced 2026-10-20 (+05)** via `/progress-sync` (HEAD `6171bbc` = `origin/main` = `origin/huraira-work`; CI `39312285044` green). **Previous full sync 2026-10-15 (night +05)** via `/progress-sync`: every step re-checked against git (HEAD `3b5a94c`; `origin/main` = `origin/huraira-work` = `2a64471`, 16 local commits unpushed), CI (`38706155999` and `38711602641` green on `2a64471`, incl. the Cockpit deploy) and the live database (read-only SQL: 34 jobs, `caa201f1` cancelled, `e6a71046` failed, 177 `model_traces`, 5 `leads`, 0 `account_requests`, latest migration 20261015103026). No step changed status and none newly qualifies for Closed (3A: still 0 sign-ups; 4C, 21, 25, 28: live checks pending). Fixed stale notes: `8e6e09d` and `b8d240f` are pushed (were "local"); Harbor Street's live continue result recorded under Step 28. Added work found in git but cited nowhere: `a6f64cd` and `dde68a5` (Step 28), `3c79212` and `892c468` (Step 12), `e11c1ea` (Step 21). **Synced 2026-10-15 (13:30 +05)** via `/progress-sync`: re-synced after `626667a` (pushed; CI `38695633253` running at sync) and `8e6e09d` (brand-colour rule, local). Huraira decided the palette rule (tints and shades on-brief, CTAs in the true accent at 4.5:1). Step 28 updated; no step changed status and none newly qualifies for Closed (3A still 0 `account_requests`; 4C and 21 still need their live checks). The Part B table gained a **Depends on / waiting for** column, rows 3A, 4B, 12 and 26 were realigned, and the missing 4D row was added; Part E rows 3A, 4B, 12, 26 and 28 were refreshed. Live (read-only SQL): 33 jobs, `d3c45995` failed, `caa201f1` queued and never dispatched; 165 `model_traces`; 31 `plan_inputs`; latest migration 20261014140027. **Updated 2026-10-15 (12:10 +05)** via `/step-close 28`: Step 28 stays IN PROGRESS; build-failure guards added (`b8d240f`, local, `docs/BUILD-FAILURE-DIAGNOSIS.md`). **Last synced 2026-10-14 (17:00 +05)** via `/progress-sync`: Step 4D closed (exit check met live, `55ddba7c`); Steps 4B, 25, 26 updated from the first passing build since 2026-10-01; CI `38554457540` green on `8271858`, `38557714567` on `caf42bc` running at sync (all jobs green except Rendered QA, still running). Previous sync 2026-10-14 (00:45 +05) via `/progress-sync`: every step re-checked against git (`92fd4ac`; `a9b271f` and `92fd4ac` local only, remotes at `d5129e0`), CI (`38452956084` on `d5129e0` FAILED in Rendered QA only, fixed by `a9b271f`, unpushed) and the live database (Cockpit continue `e2a204fb` reached a real QA verdict with the Anthropic reviewer). No status changed. No step newly qualifies for Closed: 3A still lacks its live sign-up (0 `account_requests` rows). The step table row for 4B is fixed (its columns were misaligned) and the Part E rows for 3A, 4B, 4D, 12 and 26 are refreshed. Previous sync 2026-10-13 via `/progress-sync`: every step re-checked against git (`76e9d6c`, no code since `c97e329`), CI (`38437214851`, `38438423293` green incl. deploy) and the live database (no build since 2026-10-12); no status changed. Previous full re-audit 2026-10-12 (no commits since `072b391`,
2026-10-07), CI and the live database. Closed steps (DONE with citable evidence: 1, 2, 3, 5, 6, 7; 3A added 2026-10-15; 21 added 2026-10-20) moved to **"Closed steps"** at the end of
Part D; open steps carry a **Next action** line and a continuation or verification prompt.
**Status as of 2026-10-23 (`/progress-sync`)**: no status changed. No commits since 2026-10-20; R5 CI `39473603079` on `8a42721` green in all 18 jobs and deployed (live Cockpit 200), so pre-v2 rebuild R1–R5 are all deployed. Part E Step 28 row: stale "local, not pushed" notes and "R5 left" corrected. Next: Huraira's choice on `ClientNeedsPanel` or a separate GO for Package 5 (Step 28).
**Status as of 2026-10-20 (`/step-close 28` R5)**: no status changed. Step 28 stays IN PROGRESS: pre-v2 rebuild R1–R4 deployed (CI `39296573842`, `39301911101`, `39306953117`, `39312285044`); R5 (`f260cdc`) deleted what nothing used and re-ran the Package 4 exit check: PARTIALLY MET, only because `ClientNeedsPanel` is still a pre-v2 panel (axe 0 in 23 rooms, Lighthouse a11y 100 in every room measured, keyboard main flow on the fake). Waits on Huraira: rebuild that panel, or a separate GO for Package 5. No live build since 2026-10-15.
**Status as of 2026-10-20 (`/step-close 21`)**: Step 21 is **DONE and closed** (CI `39304787144` green in all 18 jobs on `37f99c7`, including the new RLS job; migrations 0027 and 0028 live and attack-tested). No other step changed.
**Status as of 2026-10-20 (`/progress-sync`)**: no status changed. Every open step re-checked against git since 2026-10-15 (only Steps 3A, 21, 25 and 28 have commits) and CI: R4 CI `39312285044` green in all 18 jobs and deployed, so pre-v2 rebuild R1–R4 are all deployed. Stale "local, not pushed" notes corrected (every such commit is in `origin/main`); Step 26 has a continuation prompt for items 2–4. Next: Huraira's GO for R5 (Step 28).
**Status as of 2026-10-20 (`/step-close 28` R4)**: no status changed. Step 28 stays IN PROGRESS: pre-v2 rebuild R1–R3 deployed (CI `39296573842`, `39301911101`, `39306953117`); R4, fix rounds as an Activity filter on Huraira's option (b) (`1a89421`: vitest 352/352, axe 0 and Lighthouse a11y 100, fingerprints of unchanged rooms identical). Package 4 exit check still PARTIALLY MET (R5 left: deletions and the exit check re-run). Waits on Huraira's GO for R5. No live build since 2026-10-15. Open verification prompts remain for 4C.
**Status as of 2026-10-15 (`/step-close 3A`)**: Step 3A is **DONE and closed**: the live sign-up was proven end to end (sign-up → owner approval as `pm` with audit row → password sign-in after approval in the Auth logs → role-limited view; attack test 32/32). Moved to Closed steps. No other step changed status. Open verification prompts remain for 4C and 21.
**Status as of 2026-10-15 (night, `/progress-sync`)**: no status changed. Open steps that need only a live check or a sign-off keep their verification prompts (3A, 4C, 21). The next move is Huraira's push of the 16 local commits, then the Harbor Street continue (Step 28) and Nick's CRM and brief answers (Step 25).
**Status as of 2026-10-15 (`/step-close 25`, live)**: Step 25 is **PARTIAL**: MVP M4 (contact form that saves leads) is met live on synthetic data (migrations 0025/0026 applied, attack test 43/43, `submit-lead` deployed, JS and no-JS submits on both tracks stored as rows); not pushed. The real-client run waits on Nick's brief. Step 28 stays IN PROGRESS. No other step changed status.
**Status as of 2026-10-15 (`/step-close 28`)**: Step 28 stays **IN PROGRESS**. Added: the brief consistency check (`fd67328`: two owner answers on one topic halt at the readiness check before any paid call; the owner's pick clears it; the Planner asks each known topic once; eval E6) and two synthetic example clients (`52f7088`, `docs/EXAMPLE-CLIENTS.md`). Local, not pushed; not proven on a live build. No other step changed status.
**Status as of 2026-10-14 (later)**: **Step 28** (build quality and Cockpit plain-language UX, added 2026-10-14 from
`docs/BUILD-QUALITY-AND-COCKPIT-UX-PROMPTS.md`) is **IN PROGRESS**: Package 1 (the builder sees the whole request) built and verified
and deployed (`3e493f6`, CI `38569635936`; migration 0022 live, attack test 11/11); Package 2 (Track B starter 1.4.0: logo, accent,
phone action, motion; four new rendered checks) green in CI and deployed (`d112f62`); Package 3 (image slots and labelled
placeholders, migration 0023 live) built and verified locally (`7e30b09`); Package 4 (Cockpit v2 rebuild to the locked design in
`docs/design/cockpit-v2/`) phases 1–13 built: phases 1–12 CI-green and deployed (last CI `38604205509`, `56e545f`),
phase 13 (Finished site review, `a01dbbf`) waiting on CI `38605626110`; Activity, Costs, Team, Settings, Notifications
preferences and the final cleanup left; Package 5 open.
Open Cockpit v2 decisions (caps, role rules, site-approval record, logo rule, stop-view actions, Ask for changes) wait on Nick (`BLOCKED-ON-NICK.md`); the owner-only database check for "launch with placeholders" is written (migration 0024, `562c5ae`, branch `claude/objective-engelbart-d65df7`), not merged or applied.

**Status as of 2026-10-14**: the evidence moved on Steps 4D, 12 and 26, but no status changed:
- **Step 4D**: the one-press continue is proven live on Summit `63278e56` and Lanternworks `e2a204fb`. The missing-facts form is still unproven live.
- **Step 12**: live `estimated` rows and reviewer rows were written on run `4c35703b`. The Run page and a live cap refusal are still unchecked.
- **Step 26 item 1**: 5 Anthropic reviewer rows from a Cockpit build. Summit Track A and a green CI are still open.
- **Step 25**: still NOT STARTED. The Lanternworks rehearsal is SYNTHETIC and failed QA because intake cannot take a logo.

**Status as of 2026-10-12**: Steps **1, 2, 3, 5, 6 and 7 are DONE and closed**. Step 3A is **DONE** but its live sign-up proof is still
pending, so it stays open with a verification prompt. Step 4 is **PARTIAL** (closed by 4B M6). Step 4B is **IN PROGRESS**: M4 still open.
Track A re-run `b880a7d5` (plan `b5a45a8e`, 2026-10-07 17:14 UTC) passed every deterministic check, but the required design review could not
run (Agent 37 HTTP 502, 4 attempts). Track B `4acbde1f` has not been re-run. M5 is blocked on Higgsfield credits and M6 has not started.
Step 4C is **BUILT AND DEPLOYED**, with the signed-in check pending. Step 4D is **PARTIAL**: deployed, but the live "continue" has not been
run (`b880a7d5` is the ready candidate). Step 12 is **PARTIAL** (MVP M6 slice `2223856`, deployed with CI `38433400406`: Agent 37 priced as an estimate, screenshot reviewer traced, caps on at $5 per build and $20 per week, Cockpit Costs page; migration 0020 live; one live build still to prove the new trace rows). Step 21 is **PARTIAL** (launch files, MVP M5, `9968019`; verification pending). Steps 8–11, 13–20 and 22–27 are not started. **Decision D3 (MVP on Bennett & Co by 2026-10-14) overrides the order**:
Nick's brief is not in the repo (no `clients/bennett*`); of the MVP items in `docs/MVP-CUTLINE.md` §2 M5 (launch files) and M6 (cost control) are built. Each step heading below
carries its status; Part E is the checklist.

## How to use this file

1. Huraira pastes **one step's prompt** into the coding agent (or tells the agent "do Step N from
   `docs/WFACT-3.0-Factory-Completion-Plan.md`").
2. The agent does **only that step**, verifies it independently, and sends the **Report** (format below).
3. Huraira reads the report and says **GO** for the next step. The agent never starts a step on its own.
4. Follow the **Execution order** table after Part B (re-set 2026-10-07), not the numeric order, unless Huraira says otherwise. Each step lists its
   `Depends on`; do not start a step whose dependencies are not reported done and approved.

---

## Part A — How the three views connect

| Goal (Blueprint §16K) | Blueprint phases it needs | Cockpit room that must show it | Steps |
|---|---|---|---|
| 1. One real client, fewer than 40 correction batches | 3, 5, 6, 7 | Pipeline, Workflows, Human Control | 1, 2, 4, 13, 22 |
| 2. Three concurrent clients, no firefighting | 6, 12 | System (queue depth), Agents | 6, 8, 18 |
| 3. 50-point audit and extended registry re-run on the new stack | 8 | Workflows (which check failed) | 7 |
| 4. Real cost per client measured | 4, 8 | Models (per client) | 11, 12 |
| 5. Every agent action covered by the audit log | 8 | Drill-down from any panel to the trace | 16, 21 |
| 6. Disaster-recovery drill actually run | 12 | System (backup status) | 9, 19 |
| 7. Launch and Money gates stay human, forever | all | Human Control (no deploy button) | every step (rule) |

### Cockpit expectations (Blueprint §9) → steps

| Blueprint category | Today | Step that closes it |
|---|---|---|
| Top-level "is everything OK" | partial: Home answers "what needs me" from real rows (Step 4C); factory health is not shown yet | 9 |
| System | missing | 9 |
| Agents | missing | 10 |
| Workflows (with the specific failed check, drill-down) | partial | 10 |
| Models | done (owner-only; now the Costs room, Step 4C) | 11, 12 (extend) |
| Memory | missing | 14 |
| Human Control | partial: plan, account and stage decisions in Decisions, Launch blocked as a stage move, stuck jobs closable (Step 4C); no escalations or intervention history | 14 |
| Business / Product | missing | 23 |
| Alerts (push / Telegram) and role tiers | missing | 17 |
| Serverless-ceiling fix | open | 20 |
| Overall UI/UX: clear navigation, plain copy, no clutter, every factory action reachable from the Cockpit | done (Step 4C, deployed 2026-10-01; live signed-in check pending) | 4C; rooms added later by 9, 10, 14, 17 slot into its "Coming next" entries and design system |

---

## Part B — The step table

Priority: **P0** unblocks everything · **P1** completes the core factory · **P2** completes the Cockpit and
the goals · **P3** later or depends on Nick.

**Depends on / waiting for** (added 2026-10-15): what each step waits for before it can move: another step (bold = not done yet), a
named person (Huraira or Nick) or a question only they can answer, its place in the execution order, or a live check that has to
verify work already built (**Needs verification**). Each step's own `Depends on` line in Part D is the source; this column adds the people
and checks. Keep it current at every sync.

| # | Step / stage | What it does | Why it matters | Output | Priority | Depends on / waiting for |
|---|---|---|---|---|---|---|
| 1 | Fix Cockpit → GitHub dispatch | Confirms the dispatch token, gets a Cockpit job to run through GitHub Actions | Every Cockpit action depends on it; it has never worked | First successful `Cockpit job` run; queued plan built | P0 | None. Closed. |
| 2 | Write pilot brief and business rules | Drafts a realistic fictional client brief and provisional business rules | Unblocks Stage 7 and the real-memory test | `brief.json` and `memory/context.md`, both flagged provisional | P0 | None. Closed; its inputs stay provisional until Nick supplies the real brief and rules (Step 22). |
| 3 | Retire plaintext secrets (Huraira acts, agent verifies) | Deletes `.env.local` files, rotates keys, revokes the leaked Doppler token | Stage 1 is unmet and a token is exposed | The plan's `grep` check passes | P0 | None. Closed. |
| 3A | Password sign-in and approval-gated accounts (added 2026-09-30) | Password sign-in with sign-up requests an owner approves; no account works until approved | Magic links alone were awkward and anyone could request access | **DONE** (`2223344`, `856e483`), 32/32 attack checks; live end-to-end sign-up proven 2026-10-15 | P0 | Closed. |
| 4 | Full run on the pilot brief | Intake → plan → approval → build → verify → human Launch | Proves the factory end to end; measures corrections | Verified live page, correction count, audit and trace rows | P0 | Steps 1 and 2 (done). What is left (a live preview) is superseded by **Step 4B M6**, so it closes with 4B. |
| 4B | Front-end upgrade: two build tracks | Track A (template, multi-page) and Track B (Next.js, motion-rich), chosen per client by a direction step; rendered QA and a screenshot reviewer | 2.0-quality sites were visually flat; one track cannot serve both local businesses and premium clients | **IN PROGRESS**: design approved 2026-10-01; M0 6 of 7 inputs; M1, M2, M3 done; M4: Track B live pass 2026-10-14 (Lanternworks `55ddba7c`, SYNTHETIC), human screenshot review and the Track A continue of `63278e56` pending; M5 blocked (Higgsfield credits); M6 not started (D3) | P0 | Step 4 (done enough). **M4 waits on Huraira**: the human screenshot review of `55ddba7c` and pressing continue on Track A `63278e56`. **M5 waits on Huraira/Nick**: Higgsfield credits and a key rotation. M6 waits on its turn (D3/D4 order). |
| 4C | Cockpit UI/UX redesign | Information architecture, navigation, design system, plain copy, every factory action reachable, accessible and responsive | The Cockpit is the control room; today it grew room by room | A redesigned Cockpit verified in the browser at desktop and phone, with a usability walkthrough | P1 | **Needs verification**: Huraira's live signed-in walkthrough. Step 28 Package 4 (Cockpit v2) rebuilds most rooms, so check the v2 rooms when it lands. |
| 4D | Build recovery (added 2026-10-07) | Says in plain words why a build stopped, asks for missing facts, and continues from the saved site in one press | Every stopped build used to be rebuilt from scratch and paid again | **DONE** 2026-10-14: exit check met live (continues `63278e56`, `e2a204fb`, `55ddba7c`) | P0 | None. Closed. |
| 5 | Stage 6: Documentation agent | Writes structured episodic memory per stage, tied to task IDs | Blueprint wants machine-written memory | Auto-written `memory.md` entries; a passing "what happened" query | P1 | None. Closed. |
| 6 | Enforce agent permissions | Makes each agent's permission scope enforced, not descriptive | Must land before more agents or concurrency | Out-of-scope calls denied and audited | P1 | None. Closed. |
| 7 | Expand the evaluation registry | Grows 6 checks toward the 78-check registry and 50-point audit; adds cross-model review and the "tells" gate | Highest-priority Blueprint component; goal 3 | Larger check set, re-run results | P1 | None. Closed. |
| 8 | Task/event queue and durable execution | Puts a queue and restart-safe execution in front of workflows | Needed for three concurrent clients (goal 2) | Jobs that survive restarts, retry with a cap, then escalate | P1 | Steps 4 and 6 (done), Step 7 preferred (done). **Sequencing**: the 8/12/20 reliability bundle, after Step 25; under D4 only if several clients build at once. |
| 9 | Cockpit: "is everything OK" and System room | Top-level status plus health, queue depth, error rate, backup status | The founder's stated need; System category | One-glance status page | P1 | Step 4 (done); Step 8 helps (queue depth). Step 4C must have landed (it has). **Sequencing**: after the 8/12/20 bundle. |
| 10 | Cockpit: Agents room and Workflows drill-down | Agents room; failures show the failed check and link to the trace | Answers "what is happening and why" without logs | Agents room, drill-down, success-rate trend | P1 | Steps 6 (done) and **9**; Step 5 preferred (done). |
| 11 | Extend model routing and add a second model | Routes every agent by config; adds one more adapter; starts local-model evaluation | Blueprint Phase 4 acceptance | Same task on two models; cost and quality log | P1 | Step 4 (done). **Waits on Huraira**: credits for a second-vendor model (OpenAI has none, `BLOCKED-ON-NICK.md`). |
| 12 | Cost governance per client | Prices every model call, caps spend per build and per week, shows cost per client | Goal 4; Agent 37 spend was invisible (Cockpit showed $1.33 of about $14.70) | **PARTIAL**: MVP M6 slice `2223856` (CI `38433400406`, migration 0020 live, caps $5/build and $20/week); live `estimated` and reviewer rows proven on run `4c35703b`; Run page check and a live cap refusal pending | P2 | Plan dependencies Steps 10 and 11 (bypassed for the MVP slice). **Waits on Huraira**: a signed-in look at the Run page for `4c35703b`, and one live cap refusal. **Waits on Nick**: the API spend ceiling and the Cockpit v2 caps conflict (`BLOCKED-ON-NICK.md`). The rest of the step is in the reliability bundle. |
| 13 | Remaining core agents | Research, Back-end, Content/SEO, Deploy (human-gated), Monitoring, Recovery, Lessons, Memory consolidation | The pipeline needs 14 agents; 4 exist | Registered agents with bounded scopes | P2 | Steps 5, 6, 7 (done), **8** and **11**. **Waits on Nick**: where the self-hosted second brain and Hermes run (infra and budget). |
| 14 | Cockpit: Memory and Human Control rooms | Memory writes, contradictions, stale warnings; escalations, blocked tasks, intervention history | Two missing categories | Two new rooms | P2 | Steps 5 (done), **10** and **13**. |
| 15 | Cognee trial write-up | One time-boxed trial ending in adopt / don't adopt | Blueprint says trial, not lock in | Decision note | P2 | Step 5 (done). **Deferred** until there is real data (execution order). |
| 16 | Tool-call tracing | Traces tool calls as well as model calls; decides on Langfuse | Goal 5; Blueprint §3 | Tool-call spans linked to runs | P2 | Steps 6 (done) and **10**. **Deferred** (execution order). |
| 17 | Alerts and role-based views | Push/Telegram alerts by severity; owner/admin/PM views | Blueprint §9 UX and permissions | Working alerts and role tiers | P2 | Steps **9**, **10** and **14**. Under D4 a slim build-stop and cap alert slice may come earlier, on Huraira's GO. |
| 18 | Three-concurrent-clients test | Runs three pilot briefs at once | Goal 2 | Result with no manual firefighting | P2 | Steps 6 (done), **8**, **9**, **10** and **12**; Step 13 preferred. |
| 19 | Disaster-recovery drill | Restores the latest backup into a scratch project and verifies it | Goal 6 | Written drill result | P2 | Step 3 (done); **Step 9** for the backup-status signal. |
| 20 | Fix the Vercel serverless ceiling | Upgrades the plan or moves logic off serverless functions | Already caused one silent outage | No 12-function risk | P2 | No step. **Waits on Nick**: upgrade the Vercel plan, or move logic off serverless functions (`BLOCKED-ON-NICK.md`). |
| 21 | Housekeeping | Fixes stale `CLAUDE.md` §0, decides on npm workspaces, dedupes Planner sections, fills null `entity_slug` | Removes drift and traps | Clean, consistent repo | P2 | None. **DONE 2026-10-20**: M5 launch files proven on live run `4c35703b`; the RLS attack tests run in CI (`rls-attack`, CI `39304787144`). |
| 22 | Nick's items (Huraira acts, agent prepares) | Disclosures, Cockpit review, real brief and rules, budget and scope sign-off | Only Nick can close these; goal 1 needs his real brief | Logged decisions; real inputs replace provisional ones | P3 | None. **Waits on Nick**: the real brief and business rules, budget and scope sign-off, the Cockpit review. **Waits on Huraira**: telling Nick the Hermes-lite and Vercel disclosures. |
| 23 | Product features (Owner's Key port) | Rebuilds Owner's Key, closing reports, care plans on the new stack | Blueprint Phase 10; Business/Product category | Migrated features; re-run attack tests | P3 | Steps 7 (done), **10** and **14**; Nick's real brief preferred. **Sequencing**: after the first paid delivery. |
| 24 | Advanced autonomy and optimization | Earns auto-pass gates from measured runs; local-model migration decision | Blueprint Phases 11–12 need real data first | Evidence-backed autonomy upgrades | P3 | Steps 4, 7 (done), **12**, **18**, and a real track record of runs. **Deferred**. |
| 25 | Real-client proof run (added 2026-10-07) | Runs one real client (Nick's brief, or the real 2.0 DreamSign case if his brief is not ready) through intake, build, verify and human launch; measures corrections, cost, time | Goal 1; the loop has only run on synthetic clients | Measured result against the 40+ baseline, with a failure analysis | P0 | Step 4B **M4** closed; Step **26** done (or Huraira waives it). **Waits on Nick**: a real brief (Bennett & Co is not in the repo as of 2026-10-15), or Huraira chooses the real 2.0 DreamSign case. The Lanternworks rehearsal is SYNTHETIC and does not count. |
| 26 | Quality calibration | Makes a passing check mean a good site: second-vendor reviewer, blind calibration against human ratings, a reference set, a cost report | A check that passes bad sites makes every later measurement meaningless | **PARTIAL**: item 1 met live 2026-10-14 (`67033f7`; Anthropic reviewer and evaluator rows on run `4c35703b`, build `55ddba7c` reached the launch gate, CI `38554457540` green); items 2–4 open, after the MVP | P0 | Item 1 met. Items 2–4: Step 4B **M4** closed; **after the MVP** (D3/D4). **Item 2 waits on people**: blind human ratings (Nick/Huraira). |
| 28 | Build quality and Cockpit plain-language UX (added 2026-10-14) | Five packages from the Lanternworks audit: the builder sees the whole request; Track B starter defects (logo, accent, phone CTA, motion); image slots and labelled placeholders; a Cockpit an owner can use without engineering words; a paid proof on Lanternworks | Lanternworks reached the launch gate with zero QA issues yet thin, off-brief pages; the Cockpit reads like an engineering console | Each package's fail-then-pass checks; Package 5's independent Lanternworks proof | P0 | No step dependency. **Each package or phase waits on Huraira's GO.** Package 4: **Nick's answers** on the Cockpit v2 conflicts (caps, roles, site-approval record, logo rule, stop-view actions, Ask for changes); until then the UI follows the database. Migration 0024 **waits on Huraira** to review, merge, apply and run its attack test. **Needs verification**: the brand-colour rule and the brief consistency check need one live continue on Harbor Street after the push (`caa201f1` is cancelled; `e6a71046` already proved the quote fix live). Package 5 (paid, $3 cap) needs Packages 1–4 and a GO. |
| 27 | Track A motion budget (added 2026-10-07, decision D1) | Makes Track A visibly richer within a motion budget (CSS/vanilla only, reduced-motion respected, no framework scripts) with conversion as a hard gate; builds one brief on both tracks for Nick's blind rating | Nick found delivered sites visually flat; Track B's framework cost hurts speed and reliability for local business | Richer Track A passing the existing performance, layout-shift and CTA checks; blind-rating result | P0 | Step 4B **M4** closed; Step 26 item 3 (reference set) preferred. **Waits on Nick** afterwards: blind-rating the sample builds (D1). |

### Execution order (approved by Huraira 2026-10-07; supersedes "do them in order of number")

Step numbers are identifiers, not the sequence. Do them in this order; each still needs Huraira's GO.

| Order | Step(s) | Why here |
|---|---|---|
| 1 | Huraira actions: close Step 4B M4 (re-run Track A `b5a45a8e`, Track B `4acbde1f`), press "continue" on a real stopped build (4D live proof), buy OpenAI and Higgsfield credits, rotate the Higgsfield key | Unblocks everything; nothing else is trustworthy until M4 closes |
| 2 | **26** Quality calibration | A passing check must mean a good site before we measure a real client |
| 3 | **27** Track A motion budget (D1) | The real client should be built on the richer Track A, and Nick's blind rating of both tracks settles D1 |
| 4 | **25** Real-client proof run (with 4B M5/M6 when credits land) | Goal 1: the core loop has never run on a real client; one client needs no queue |
| 5 | **8, 12, 20** as one reliability bundle, plus Step 21 sub-item H (CI coverage) | Queue, cost governance (price or cap Agent 37) and the Vercel ceiling belong together; attack tests move into CI |
| 6 | **9 then 10** as one thin Health room (what is running, what failed, which check failed) | Founders' stated need; defer the rest of the rooms |
| 7 | **11, 13, 14, 17** as needed | Second model, remaining agents, Memory and Human Control rooms, alerts |
| 8 | **18, 19**, plus defining the 50-point audit list (goal 3) | Scale and recovery proof |
| 9 | **21** (rest), **22** | Housekeeping and Nick's items |
| 10 | After the first paid delivery: **23** and the Part F proposals | Product features follow revenue |
| Deferred | **15, 16, 24** | Need real data first; revisit after step 7 |

Not in scope now: an e-commerce site type (Huraira 2026-10-07).

**Decision D3 (Huraira, 2026-10-10; MVP override of the order above until 2026-10-14)**: Nick wants the Website Build Module proven on one real project, Bennett & Co (colors and logo fixed, fonts free, proper web agency site), by Wednesday 2026-10-14, because he starts ads and mass client acquisition right after. Until that date the working sequence is: (1) Huraira's open actions and Nick's brief, (2) Step 26 item 1 only plus a minimal slice of Step 12 (price Agent 37, per-build cap), (3) Step 27 motion budget limited to what the Bennett build needs, (4) Step 25 on the Bennett & Co brief, stopping at "awaiting launch approval". Steps 8, 12 (rest), 20 and everything after them in the table above wait until after the MVP. The scope fence, schedule, cost evidence and proposed spend cap are in `docs/MVP-CUTLINE.md`. The date is a target, not a promise: it depends on Nick's brief arriving and on how many correction rounds the first build needs. Websites only; e-commerce stays out.

**Decision D4 (Huraira, 2026-10-13; ad campaign starts Mon 2026-10-19)**: until 2026-10-19 the work is the core loop needed to take ad-sourced clients, in this order. Tier 1: a Step 25 **rehearsal** on a synthetic brief (Lanternworks Studio, `clients/lanternworks-studio/`, labelled SYNTHETIC; it does not count toward Step 25's real-client acceptance or goal 1, and Step 25 stays open for a real brief); closing 4B M4 and the 4D live continue; Step 26 item 1 (second-vendor reviewer, needs OpenAI credits); Step 27 (Track A motion budget). Tier 2 if time allows: build-stop and cap alerts (a slim Step 17), a Step 21 slice (intake fields for the logo and live address, favicon, open questions out of the page source), cost per client (Step 12), and a minimal Step 8 queue only if several clients will build at once. Each still needs Huraira's GO.

**Decision D1 (Huraira, 2026-10-07)**: keep two tracks. Track A gets a motion budget (Step 27); Track B stays the full 21st.dev/React path; the direction step still recommends a track and the owner picks. Conversion is a hard gate: motion may not fail speed, layout-shift or visible-CTA checks. Nick confirms by blind-rating sample builds, not by conversation.

---

## Part C — Standard Operating Rules (apply to every step)

Every step prompt below says "Follow the Standard Operating Rules". Those rules are:

**Read first (every step, in this order)**
1. `CLAUDE.md` (the law file) and `.claude/CLAUDE.md`.
2. `PROGRESS.md`, `BLOCKED-ON-NICK.md`, `memory/context.md`.
3. `docs/WFACT-3.0-Continuation-Build-Plan.md`, and the Blueprint section(s) the step names.
4. This file's entry for the step.

**Non-negotiables**
- **Do only the named step.** Do not start the next one. Do not "helpfully" fix unrelated things; list
  them under "Noticed but not done" in the report instead.
- **Independent verification.** "Done" means you checked it with something other than your own claim: a
  real command, a SQL query, a CI run, a curl, a browser check. Paste the evidence (trimmed) in the report.
- **Launch and Money stay human.** Never add or use anything that deploys a client site to production or
  moves money without a human approval. Do not add a deploy button.
- **Secrets.** Never print, log, commit or paste a secret value. Refer to secrets by name only. Secrets
  come from Doppler, not from files. If you see a secret in output, say so and stop.
- **Truth over polish.** If something fails, is stubbed, or was only partly verified, say so plainly.
  Label every stand-in and every synthetic input as such.
- **Tests.** New behaviour gets tests. Existing tests must keep passing unchanged unless the step says
  otherwise. Run the affected suites and the CI-equivalent locally.
- **Migrations.** Inspect existing tables first. Migrations are append-only files in
  `packages/db/migrations/`. Attack-test any new table's RLS for real. Run `get_advisors` after.
- **Git.** Work on branch `huraira-work`. Make small, clear commits. **Do not push to `main`** and do not
  merge to `main`; pushing `main` triggers a production deploy. Push `huraira-work` only if Huraira says so.
- **Docs.** Update `PROGRESS.md` (status, evidence, date) and `BLOCKED-ON-NICK.md` when the step changes them.
  **Before sending the Report, run `/step-close <id>`** (`.claude/skills/step-close/SKILL.md`, added 2026-10-01): it updates this
  file (Part D heading, Part E row, top status line, goal tracker) and `PROGRESS.md` (last synced, status summary, next up, step
  section) from verified evidence, then requires `node scripts/check-trackers.mjs` to print OK and commits both files by name.
  A Stop hook (`.claude/hooks/stop-tracker-guard.sh`) blocks the agent from ending its turn once if code was committed after the
  last tracker update or the trackers disagree. The agent never fills "Approved by Huraira".
- **Design quality (client sites and the Cockpit), Huraira's rule 2026-10-01.** Nothing we build may look AI-generated
  ("AI slop"), basic, or like an unmodified template. Banned by default: purple/blue gradient heroes, the generic three-card
  feature row, emoji used as icons, centred-everything layouts, one default font with no pairing, fake "trusted by" logos or
  initials avatars, filler copy ("unlock your potential", "seamless", "cutting-edge"), glassmorphism everywhere, the same section
  rhythm repeated, gratuitous animation, thin low-contrast grey text. Every design starts from an explicit art direction (from the
  client's brand direction, or for the Cockpit from its design system), with deliberate type pairing, layout variety and real
  content hierarchy. **Coding agents must load these installed skills before any design work**: `impeccable` (design, critique,
  audit, polish), `design-taste-frontend` (anti-slop), `high-end-visual-design`, `ecc:frontend-design-direction`; for motion
  `ecc:motion-foundations` and `ecc:motion-patterns`; for accessibility `ecc:frontend-a11y`; for existing screens
  `redesign-existing-projects` and `ecc:make-interfaces-feel-better`. The factory's own builder cannot load Claude skills at run
  time, so the same rules live in the repo as a versioned **design rulebook** that is given to the builder and checked by the
  screenshot reviewer (Step 4B). A page or screen that trips the rulebook fails verification like any other check.
- **Stop conditions.** Stop and ask Huraira when a step needs money, an account, a credential you don't
  have, a destructive action, or a decision only a human can make. Do not guess.

**Report format (send this when the step is done, then stop and wait for GO)**
```
STEP N — <name> — <DONE | PARTIAL | BLOCKED>
What I did:           (5 lines max)
Evidence:             (commands/queries/CI run ids with trimmed output)
Acceptance criteria:  (each one: MET / NOT MET, with proof)
What I did NOT do:    (skipped, stubbed, or only partly verified)
Noticed but not done: (unrelated issues found)
Needs from Huraira:   (decisions, credentials, approvals)
Commits:              (hashes and one-line messages)
Ready for Step N+1?:  (yes/no and why)
```

---

## Part D — The prompts

Each prompt is self-contained. Paste it as-is. The line "Follow the Standard Operating Rules" refers to
Part C above; if the agent has not been given this file, paste Part C first.

**Layout (since 2026-10-12)**: open steps come first, in step-number order. Each open step carries a **Next action** line. A partly
done or blocked step has a **Continuation prompt** (paste it instead of the original, which would restart the step), and a step that
looks done but lacks independent proof has a **Verification prompt**. DONE steps with citable evidence sit in **Closed steps** at the
end of this part. `/progress-sync` (Step 4) and `/step-close` keep this current.

---

### STEP 4 — Full run on the pilot brief (P0) — PARTIAL 2026-09-30

**Status: PARTIAL.** Met: a raw request became a verified built page through the Cockpit with no hand-written intermediate (jobs
`1dd90f25` → `c62e24a4` re-plan → `81c8607b` build, run `36743601290`; 3 rounds, 2 requesting changes; 8m38s; $0.1741 priced plus 3
unpriced Agent 37 calls); independent re-hash and verification CLI passed; human visual check done and defects listed (leaked tool
text after `</html>`, unlabelled SAMPLE testimonials, invented phone/hours/areas). **Not met: the preview deploy.** It is not worth
deploying a text-only page; Huraira moved the remaining work into Step 4B, whose M6 repeats the full run on the new builder and
ends with a preview. Treat Step 4 as closed by Step 4B M6. The prompt is kept for the record.

**Depends on**: Steps 1 and 2 (Step 3 recommended).
**Maps to**: Continuation Stage 7 (third bullet); Blueprint Phase 7 acceptance; goal 1 (as a synthetic proof).

**Left (2026-10-12)**: only the preview deploy, which now happens in Step 4B M6. **Next action**: none of its own. Close Step 4 in the
same `/step-close` that closes 4B M6, citing M6's preview evidence. No continuation prompt: Step 4B's prompt carries this work.

*The original agent prompt for this step is retired from the live plan. It is preserved in `docs/archive/2026-10-07-alignment/WFACT-3.0-Factory-Completion-Plan.pre-realignment.md`.*

---

### STEP 4B — Front-end upgrade: two build tracks, chosen per client (P0) — IN PROGRESS (M0 mostly done, M1, M2 and M3 done, M4 partial)

**Status: IN PROGRESS.** Design approved 2026-10-01. M0 decisions recorded in `docs/FRONTEND-UPGRADE-DESIGN.md` §10: reference sites
per track (researched and checked live), niche taxonomy kept, AI images allowed if clearly labelled, $5 per-build spend ceiling.
**Still open**: image tool (needed by M5). **M1 DONE 2026-10-01**: claims gate, design rulebook v1.0.0,
rendered QA and a live screenshot review. Deviation: the reviewer is Agent 37 (the builder's vendor), by Huraira's decision while OpenAI has no
credits; recorded in `packages/rendered-qa/config/reviewer.json`. See `PROGRESS.md`. **M2 DONE 2026-10-01**: direction step, migration 0011 (owner's track, audited, no build without one), Cockpit
track choice, 14-case evaluation (track 14/14, niche 13/14). **Builder model decided 2026-10-01: stays on Agent 37.** **M3 DONE 2026-10-01**:
committed Track A starter + content-as-data builder (Agent 37 writes content only), multi-page sites through QA/workflow/jobs (manifest
checkpoint), migration 0012; acceptance fixtures pass/fail as required; live Summit Line build `2bfca49e` passed the whole gate and an
independent re-check. See `PROGRESS.md`. **M4 PARTIAL 2026-10-02** (`a9f4dcf`…`13ec854`): Track B Next.js starter, isolated build
(no network, allow-listed env, `npm ci --offline`, deterministic), artifact (output + source) checkpointed in the private bucket
(migration 0014), Track B budget + motion budget, all fixtures fail as required, all suites green locally and in CI `37016971442`
(isolated Linux build: network blocked, no secrets). **M4 since then (2026-10-03 to 10-07, details in `PROGRESS.md` Step 4B)**: there were
eight live Cockpit builds. Each failure was traced to a factory contradiction or an outage and fixed: page scope `c64bd0e`, invented quotes
`8dae180`, signup form, Agent 37 retry `e9abe87`, waived testimonials `db8b1e2`/`99766a8`, evaluator honesty rules `ed07d79`, and
`render.perf` on applied throttling `dfc2998` (Huraira, option 1). Track B `c7fba41a` passed all 44 registry checks and failed only on the
evaluator points fixed in `ed07d79`. **Latest (2026-10-07 17:14 UTC, after the last sync)**: Track A job `b880a7d5` (plan `b5a45a8e`, run
`15ad4086`, GitHub run `37657523407`) checkpointed the build and passed every deterministic check. It then halted because the required
`render.design-review` was NOT RUN: the Agent 37 reviewer returned HTTP 502 `upstream_unreachable` after 4 attempts. The site was not at
fault. **Left for M4**: one passing live build per track (Track A: continue `b880a7d5` once Agent 37 answers; Track B: re-run `4acbde1f`),
then the human screenshot review at desktop and phone, then `/step-close 4B M4`.

**Update (2026-10-14 sync)**: the review blocker is fixed (`67033f7`; the reviewer moved to Anthropic after Node's 300 s fetch cut). Track B
plan `403305ec` (synthetic Lanternworks, the D4 rehearsal) was built and continued (`83f2841f` → `e2a204fb`, run `4c35703b`). It reached a real
QA verdict, `failed_verification` after 2 revisions, on evaluator issues: the brief's logo was never embedded because intake cannot take a logo
file, and colours fell outside the brief. That is not an M4 pass. Track A Summit `63278e56` halted on the old reviewer before `67033f7`.
**Track B live pass (2026-10-14)**: Lanternworks plan `403305ec` (SYNTHETIC) continued with the uploaded logo, job `55ddba7c`, reached the launch
gate (verified checkpoint `4e4434db…`, rendered QA, claims gate and design review passed; one revision for 23 px contact links). The Track B half of M4
now needs only the human screenshot review at 1440 and 375 (Huraira looked at it 2026-10-14; the Cockpit preview showed the file list, fixed in `caf42bc`).
**Next action (2026-10-14)**: Huraira reviews the Lanternworks site in the Cockpit preview (desktop and phone) and lists what the checks missed; then
continue Summit Line `63278e56` (Track A).
**Previous next action**: once CI is green on the pushed head, Huraira presses "continue" on Summit Line `63278e56` (Track A). For Track B,
re-run `4acbde1f`, or Lanternworks once the intake logo slice lands. Then the human screenshot review.
**Previous next action (2026-10-12)**: Huraira checks that the Agent 37 gateway answers, then presses "continue" on `b880a7d5` in the Cockpit. That
one press also proves Step 4D live. Then re-run Track B `4acbde1f`. Under D3, M5 and M6 are replaced by the Bennett & Co build (Step 25,
`docs/MVP-CUTLINE.md`).

Continuation prompt — updated 2026-10-12 (use this instead of starting 4B from M0):
```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/ on branch huraira-work. Follow Part C of
docs/WFACT-3.0-Factory-Completion-Plan.md, including the design-quality rule. Do ONLY Step 4B, milestone M4,
then STOP for GO. Decision D3 (docs/MVP-CUTLINE.md) is in force until 2026-10-14: do not start M5 or M6.

ALREADY DONE (do not redo): M0 (6 of 7 inputs), M1, M2, M3 (see PROGRESS.md Step 4B). M4 code: Track B starter,
isolated build, artifact checkpointing (migration 0014), CI 37016971442; the live-build fixes c64bd0e, 8dae180,
e9abe87, db8b1e2, 99766a8, ed07d79, dfc2998, 7c68eb8 (all on main 072b391).

LEFT
1. Check that the Agent 37 gateway answers (GET /models; one tiny completion), without printing its URL or key.
   If it does not answer, STOP and tell Huraira. Do not switch the reviewer vendor without his decision.
2. Track A: Huraira presses "continue" on job b880a7d5 (run 15ad4086). Confirm by SQL (audit_log for that run:
   workflow.reopen, then verification.decision success), with no new builder calls before the review (the saved
   site is reused).
3. Track B: Huraira re-runs plan 4acbde1f. Confirm the verdict the same way. If it fails, diagnose against the
   registry results and fix only a real factory defect (with a failing test first).
4. Human screenshot review of both passing builds at 1440 and 375: list every defect the checks missed.
EXIT CHECK (M4): one live build per track passes rendered QA, the claims gate and the design rulebook, verified
independently (re-hash against the checkpoint, screenshots). Then run `/step-close 4B M4`, report in the Part C
format and STOP.
```

**Depends on**: Step 4. Design approved by Huraira 2026-10-01: `docs/FRONTEND-UPGRADE-DESIGN.md` (v2 + Next.js for Track B).
**Maps to**: Blueprint Phase 6-7 front-end loop, Playbook "Motion Sites + GSAP" and Stage 3 Assets; fixes the Step 4 finding that every
check read text and never looked at the rendered page. **Do milestones in order and STOP after each one for GO.**

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C, including the design-quality rule. Do ONLY Step 4B,
ONE milestone at a time (M0..M6 below). After each milestone, report in the Part C format and STOP for GO.

READ FIRST
docs/FRONTEND-UPGRADE-DESIGN.md (the approved design), clients/summit-line-roofing/memory.md (Step 4 run
log and the defects the checks missed), packages/frontend-loop (loop.ts, templates.ts), packages/planning,
packages/verification, packages/workflow, apps/cockpit, memory/context.md (banned claims, tone).
Before any design or front-end work, load the skills named in Part C's design-quality rule.

THE TWO TRACKS
- Track A, local business, conversion-first: multi-page static site (plain HTML/CSS/JS files, no
  framework), real images, gentle motion, click-to-call, quote/booking forms, LocalBusiness schema,
  consistent name/address/phone, service-area pages. Budgets: LCP < 2.0 s on mobile, total JS < 50 KB,
  CLS < 0.1.
- Track B, motion-rich brand site: Next.js (App Router, TypeScript) with `output: 'export'` so the result
  is plain static files that any host (Hostinger for live, Vercel only for previews) can serve. Tailwind
  CSS; shadcn/ui on Radix primitives for accessible components; Motion (formerly Framer Motion) for
  component and layout animation; GSAP with ScrollTrigger for scroll-driven sequences; Lenis for smooth
  scrolling; Lucide icons; React Three Fiber + drei ONLY when the brand direction calls for 3D. Every
  animation respects prefers-reduced-motion. Budgets: LCP < 2.5 s on mobile, CLS < 0.1, JS within a
  stated budget per page.
- Shared: one site map, one content-as-data JSON format, one asset pipeline, one rendered-QA stack.
  Each track has ONE committed, human-reviewed starter. The builder fills a starter; it may not add
  packages (pinned allow-list, lockfile committed) and may not change the stack.

DESIGN RULEBOOK (anti AI-slop)
Create packages/frontend-loop/design/rulebook.json (versioned data) plus a short README: the banned
patterns and required qualities from Part C's design-quality rule, each with an ID, how it is detected
(DOM/CSS rule, screenshot review question, or both) and a failing fixture. Give the rulebook to the
builder in its prompt, and make the screenshot reviewer check it. Distil it from the named skills; do
not copy any third-party prompt text verbatim.

MILESTONES
M0  (Mostly done 2026-10-01, see docs/FRONTEND-UPGRADE-DESIGN.md section 10.) Reference sites per track,
    niche taxonomy, image policy (AI images only if clearly labelled) and the $5 per-build ceiling are
    decided. Before M3, get the builder-model decision; before M5, the image tool. If either is still
    missing when you reach that milestone, STOP and ask. Never exceed $5 for one build without asking.
M1  [DONE 2026-10-01 - skip] Rendered QA + claims gate on TODAY's builder. Headless Chromium (Playwright) screenshots at
    1440/768/375; axe accessibility; Lighthouse performance; link and asset crawl; console errors; text
    checks for content after </html>, required SAMPLE labels, banned claims, and factual claims with no
    source field. Add a screenshot review by a model from a different vendor than the builder.
    Acceptance: re-checking the Step 4 artifact (sha256 960b61ba...) FAILS on the leaked tool text, the
    unlabelled testimonials and the invented phone/hours; clean fixtures pass. Results are exact check
    IDs that FrontendLoop.revise() can act on.
M2  [DONE 2026-10-01 - skip] Direction step + track choice. A new agent registered without editing agent-runtime runs after
    Intake: niche (fixed, versioned taxonomy), audience, primary conversion goal, requirements, brand
    direction (each point quoting the request), recommended track + confidence + reasons, open
    questions; no recommendation when confidence is low. Build 10-15 labelled synthetic fixtures across
    niches and report per-case results. Cockpit: plan card shows the direction summary and the
    recommended track pre-selected; owner chooses or overrides; stored on the plan (append-only
    migration, RLS attack-tested) and audited; no build can start without a track.
M3  [DONE 2026-10-01 - skip] Track A starter + multi-page build through the pipeline. Acceptance: a 3+ page local-business site
    builds, passes rendered QA, the rulebook and its budgets; a broken-link fixture and an over-budget
    fixture fail.
M4  [PARTIAL - built; only the live passes and screenshot review are left: use the
    continuation prompt above] Track B starter (Next.js static export) + multi-page build. The build runs in CI with no secrets in
    the build step and no network beyond the package cache; artifact = static output + source in the
    private artifacts bucket with a checkpoint hash. Acceptance as M3, plus reduced-motion respected and
    an over-budget animation fixture fails.
M5  [NOT STARTED - groundwork 4bbd4bc; blocked on Higgsfield credits; deferred by D3] Assets: generated or supplied images, always labelled, never presented as the client's own work,
    alt text required, size/format budgets. Use the image tool only with the access and budget Huraira
    approved in M0. An unlabelled generated image fixture is caught.
M6  [NOT STARTED - deferred by D3; the Bennett & Co build in Step 25 comes first] Full runs through the Cockpit: Summit Line Roofing (expected Track A) and a second synthetic,
    motion-led client (expected Track B). Record rounds, failed checks per round, model calls and cost
    per call, wall-clock time. Human review at desktop and phone with screenshots attached; list every
    defect the checks missed. Preview deploy ONLY after Huraira's explicit yes.

ACCEPTANCE (whole step)
- Both tracks produce multi-page sites that pass rendered QA, the claims gate and the design rulebook,
  verified independently (separate process, re-hash against the checkpoint, screenshots).
- The owner chooses the track per build in the Cockpit; the recommendation is shown with reasons; the
  choice is audited.
- Each planted defect class (leaked text, missing SAMPLE label, invented fact, banned claim, slop
  pattern, broken link, over budget) is caught by at least one failing fixture.
- Existing suites pass unchanged; no production deploy path exists.

REPORT in the Part C format after each milestone, then STOP.
```

---

### STEP 4C — Cockpit UI/UX redesign: the control room (P1) — BUILT AND DEPLOYED 2026-10-01, live signed-in check pending

**Status: BUILT AND DEPLOYED** (`70cd7d1`…`e76cff2`; CI `36905237284` green with the deploy, docs-only redeploy `fb08be3` CI `36907274448`).
Phase 1 (audit, IA, "signal-box panel" design system, 5 mockups: `docs/step-4c/PHASE-1-PROPOSAL.md`) approved by Huraira with D1–D8.
Phase 2: new shell (Home, Decisions, Projects, Activity, Costs, plus "Coming in Step N" entries for System 9, Agents 10, Memory 14,
Business 23), every old room migrated with redirects, one URL per screen, lazy rooms, installable PWA, self-hosted fonts. Decisions:
Launch is never a stage move (D3); multi-page re-check and the `qa` suite stay CLI-only until Step 7 (D4); Add client/project added (D5);
team management deferred to Step 17 (D6); migration `0013_jobs_cancel` lets an owner/admin close a job that never started, attack test
17/17 (D7). Evidence (`docs/step-4c/after/`): 23 tests in CI, walkthrough 7 tasks × 1440/375 each ≤ 3 clicks, axe 0 violations on 21
screens × 2 widths, Lighthouse accessibility 100 on every route, 0 `service_role` in the live bundle. **Not yet proven**: any room with a
real signed-in session (all browser evidence used rows copied read-only from the live DB). **Open**: Projects layout shift on phones
(CLS 0.118, target < 0.1); launch decisions stay listed until a Launch record exists (Step 14).

**Depends on**: none hard. Best after Step 4B M2 (so the track choice is designed in). Must land **before** Steps 9, 10, 14 and 17,
which then build their rooms inside this design system. Can run in parallel with Steps 5-8 (it only touches `apps/cockpit`).
**Maps to**: Blueprint §9 (founder-glanceable control room, category dashboards, drill-down), CLAUDE.md pillar 4 ("held to a
SaaS-sellable bar, not an internal-tool pass").

**Needs verification (2026-10-12)**: built and deployed. The live Cockpit answers HTTP 200 at
`wfact-cockpit-niktheplumberkings-projects.vercel.app` (checked 2026-10-12), but no room has been checked with a real signed-in session.
The Projects phone layout shift (CLS 0.118) is still open. Note: production deploys for `7cb475a`, `113276a` and `072b391` failed before
any step ran (CI `37653665566`, `37653814793`, `37653952730`), so the live Cockpit is the `01f6c9e` deploy (CI `37652704145`). `git diff 01f6c9e 072b391 -- apps packages` is
empty, so the app code is the same. **Next action**: Huraira signs in once, then run the prompt below. Not on the MVP path unless the Bennett run
needs a room fixed.

Verification prompt — updated 2026-10-12:
```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/ on branch huraira-work. Follow Part C of
docs/WFACT-3.0-Factory-Completion-Plan.md. Do ONLY the verification of Step 4C. Do not redesign anything.

ALREADY DONE (do not redo): new shell and rooms (70cd7d1…e76cff2, redeploy fb08be3; CI 36905237284, 36907274448),
migration 0013_jobs_cancel (17/17), 23 tests, axe 0 and Lighthouse a11y 100 on rows copied read-only.

VERIFY FIRST
1. Confirm which commit the live Cockpit serves (Vercel deployment or bundle hash) and that its app code equals main.
2. With Huraira signed in (he drives the browser; you never type his password), walk Home, Decisions, Projects,
   Activity and Costs at 1440 and 375: real rows show, no console errors, every action reachable in 3 clicks or fewer.
3. Re-measure Projects CLS at 375 (target < 0.1).
REPORT pass/fail per room with screenshots. Fix only gaps found (with tests). Then `/step-close 4C`: DONE only if every
room passed signed in; if so, move the Step 4C block into "Closed steps". STOP and wait for GO.
```

*The original agent prompt for this step is retired from the live plan. It is preserved in `docs/archive/2026-10-07-alignment/WFACT-3.0-Factory-Completion-Plan.pre-realignment.md`.*

---

### STEP 8 — Task/event queue and durable execution (P1) — NOT STARTED

**Depends on**: Steps 4 and 6 (Step 7 preferred).
**Maps to**: Blueprint §3 (queues, retries, failure recovery), §14, Phase 6; goal 2.

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 8.

CONTEXT
Today: a `jobs` table (migration 0009), GitHub Actions as the worker, and a hand-rolled in-process
buildAndVerify() with checkpoints but no queue and no auto-restart. The Continuation Plan listed a queue
under "do not build yet"; Huraira now approves it because goal 2 (three concurrent clients) and Blueprint
§14 require it. Keep the design as small as possible; do NOT introduce Temporal/n8n unless you justify it
against a hosted-and-simple alternative and Huraira approves.

TASK
1. Write a one-page design first and send it to Huraira for approval BEFORE building: options considered
   (extend jobs table + Postgres-based queue with SKIP LOCKED and leases; GitHub Actions concurrency
   groups; n8n; Temporal), your recommendation, costs, failure modes. STOP and wait for GO on the design.
2. After GO, implement: enqueue, lease/claim with visibility timeout, heartbeat, retry with exponential
   backoff and a hard cap, then escalate to a human (never retry forever), per-client concurrency limit,
   idempotency keys, dead-letter state visible in the Cockpit, resume from the last verified checkpoint on
   worker crash.
3. Keep everything audited (queue events with task IDs) and RLS-attack-test any new table.
4. Prove it: kill a worker mid-build and show the job resumes from the checkpoint with zero duplicate
   builder calls; show retries stop at the cap and escalate; show two jobs for two different clients
   leasing in parallel without collision, and two jobs for the SAME client serialising.
5. Update docs/COCKPIT-JOBS.md and the workflow README with the real behaviour.

ACCEPTANCE
- Crash-resume, backoff cap plus escalation, per-client serialisation and cross-client parallelism are each
  proven with evidence, not asserted.
- No secrets in queue payloads; RLS attack tests pass on new tables.
- Existing suites pass unchanged.

REPORT in the Part C format (include the approved design), then STOP.
```

---

### STEP 9 — Cockpit: "is everything OK" and System room (P1) — NOT STARTED

**Depends on**: Step 4 (Step 8 helps for queue depth).
**Maps to**: Blueprint §9 (top-level status, System category); goal 6 (backup status).

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/apps/cockpit. Follow the Standard Operating
Rules in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 9.

CONTEXT
Blueprint §9: the top level must be a single "is everything okay" status the non-technical founder can
glance at, then category dashboards with a clear colour-coded health signal, then drill-down. The System
category shows infrastructure health, integration status, queue depth and error rate. Cockpit today has
Pipeline, Approvals, Actions, Runs and Models rooms, dark theme, Supabase auth, RLS-based access.

TASK
1. Define health signals from REAL data only (no mocks): last CI result on main, Cockpit deployment reachable,
   Edge Function status and recent error rate, job queue depth and oldest queued age, failed/stuck jobs,
   audit_log last-write age, model_traces error rate, last backup age, open incidents. Put the definition
   of green/amber/red for each in code with tests.
2. Build the aggregation as a read-only Supabase view or Edge Function with no service-role key in the
   browser. Owner sees all; admins see operational signals but not raw cost.
3. Build the new landing view: one big status ("Everything OK" / "Needs attention" / "Something is broken")
   in plain language (apply the tone filter for anything generated), with the 3 most important reasons
   when not green, each linking to the relevant room.
4. Build the System room: the signals above, each with plain-language explanation and last-checked time.
   Failure to fetch a signal must show "unknown" (grey), never green.
5. Follow the existing Cockpit styling; use the impeccable/design skills only if they fit the dark theme and
   keep it accessible (contrast, keyboard, labels) and responsive to phone width.
6. Verify in the browser pane at desktop and phone widths with real data. Force a real amber state (e.g.
   stuck job) and a real unknown state, and screenshot both. Then restore.
7. Update Cockpit tests and the CI build must stay green.

ACCEPTANCE
- Landing status derives only from live data; unknown never shows as OK.
- System room shows each signal with correct colour proven by forced states.
- No service-role key in the bundle (grep the built bundle).
- Verified in browser at two widths; screenshots attached.

REPORT in the Part C format, then STOP.
```

---

### STEP 10 — Cockpit: Agents room and Workflows drill-down (P1) — NOT STARTED

**Depends on**: Steps 6 and 9 (Step 5 preferred).
**Maps to**: Blueprint §9 (Agents, Workflows, drill-down); Phase 9 acceptance ("what is happening and why").

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/apps/cockpit. Follow the Standard Operating
Rules in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 10.

CONTEXT
Blueprint §9. Agents: active agents right now, per-agent status, current workload, recent failures, cost per
agent (rolling), autonomy tier per gate. Workflows: running / queued / failed workflows (with the SPECIFIC
failed check, not just "failed"), bottleneck view, execution history, success-rate trend. Drill-down: from
any panel, click through to the specific trace, approval or memory record. Data exists in audit_log
(agent.spawn/complete/escalate/reject, workflow.*), model_traces, jobs, plans, and projects.

TASK
1. Agents room: list registered roles with status, last run, recent failures, rolling cost (owner-only),
   current autonomy tier per gate (read from the gates that exist; hard-gates shown as locked).
2. Workflows room: runs list with state, stage, elapsed time; a failed run shows the exact failed check IDs
   and revision count; bottleneck view (which stage takes longest / fails most); success-rate trend over
   the last N runs.
3. Run detail page: a timeline joining audit_log rows, model_traces rows (tokens, cost, latency) and
   checkpoints for one task ID. This is the drill-down target that Steps 9, 12 and 14 will link to.
4. Every number must come from real rows. Empty states are honest ("no runs yet").
5. Respect roles: owner sees cost; admins see operations without raw cost/margin.
6. Add RLS-backed views or functions as needed, with live attack tests (a stranger and a non-owner cannot
   read what they shouldn't).
7. Verify in the browser with the Step 4 run and at least one deliberately failed run so a failed-check
   drill-down is shown for real. Check desktop and phone widths.

ACCEPTANCE
- From the Cockpit alone (no logs, no SQL) Huraira can answer: what is running, what failed and which check,
  what it cost, and what each agent did on run X.
- Role visibility proven by live tests.
- Browser-verified with real data; screenshots attached.

REPORT in the Part C format, then STOP.
```

---

### STEP 11 — Extend model routing and add a second model (P1) — NOT STARTED

**Depends on**: Step 4.
**Maps to**: Blueprint §7, Phase 4 acceptance; Continuation Plan "gaps" (routing covers only Intake and Planner).

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 11.

CONTEXT
packages/hermes/config/model-routing.json routes only `intake` (claude-haiku-4-5) and `planner`
(claude-sonnet-5). The front-end builder (Agent 37), the QA evaluator (Claude) and Hermes-lite still pick
their models inside their packages. Blueprint Phase 4 acceptance: the SAME task routed to two different
models produces a comparable structured result; and at least one local/open-source candidate is run against
the same held-out briefs with a real quality and cost comparison logged (evaluation only; no production
routing to a self-hosted model until Phase 12 data exists).

TASK
1. Move every agent's model choice into the routing config (slots for front-end builder, QA evaluator,
   Hermes-lite, documentation, and future agents). Keep the per-run override and the "unknown slot refused"
   rule. Keep the builder != evaluator vendor separation enforced.
2. Add ONE more hosted adapter chosen from what credentials exist in Doppler (OpenAI is available; Kimi K3
   only if a key exists). Do not ask for or create new accounts; if none exists, use OpenAI and say so.
3. Prove routing abstracts the model: run one identical bounded task (for example Planner or Intake on the
   synthetic brief) on two models and show comparable schema-valid outputs, cost and latency from
   model_traces.
4. Local/open-source evaluation track: create a held-out set of 3 briefs (synthetic, labelled) and a scoring
   rubric. Run the hosted models on it and record results. For a local/open-source candidate, either (a)
   run it if Huraira has a working endpoint, or (b) build the adapter and harness and mark the run as
   PENDING. Do not fabricate results. Ask Huraira before spending more than a small, stated amount.
5. Record everything in a results file docs/learnings/model-bakeoff-YYYY-MM-DD.md with method, per-model
   scores, cost, latency, and honest caveats (benchmarks do not equal WFACT workload, Blueprint §16I).
6. Nothing in production routes to a self-hosted model.

ACCEPTANCE
- All agents' models are chosen from config; no hardcoded model IDs left in agent packages (grep proof).
- Same task on two models compared with real trace data.
- Held-out set and harness exist; local-model result is real or clearly PENDING.
- Existing suites pass unchanged.

REPORT in the Part C format, then STOP.
```

---

### STEP 12 — Cost governance per client (P2) — PARTIAL 2026-10-14, MVP M6 slice live; live trace rows proven (run `4c35703b`); Run page and live cap refusal pending

**Realignment note (2026-10-07)**: include a price basis or a token ceiling for Agent 37 calls (`model_traces.cost_usd` is null; ~190k tokens per builder run are invisible to every USD ceiling). Pull ahead of Step 9 if Huraira approves Part F decision D2.

**Depends on**: Steps 10 and 11.
**Maps to**: Blueprint §3 (cost control), Fuel Gauges / Cost Sentinel "extend into Cost Governance"; goal 4.

**Done (2026-10-13, MVP M6 slice, `2223856`; audit in `docs/AI-COST-AUDIT.md`)**:
- **Agent 37 priced:** `hermes-agent` is priced at the $3/$15 estimate (`model-routing.json` 1.4.0, basis `estimated`, migration 0020 applied live). Every per-role ceiling now counts it, so the builder ceiling went from $1 to $3: the worst real task at the estimate was $2.75.
- **Screenshot reviewer traced:** each call now writes a `model_traces` row (hooks in `rendered-qa/src/reviewer.ts`, `hermes/src/tracing.ts`).
- **Agent 37 output ceiling:** `max_tokens` 32,000, and a cut-off answer throws.
- **Spend caps:** `hermes/src/spendCaps.ts` adds a per-build cap (by run id, so retries and reopens count) and a weekly cap. They are checked before every model call in a Cockpit job and fail closed if spend cannot be read. The seeded over-cap test is refused with no model call (`hermes/test/spendCaps.test.ts`). Both caps are OFF (`config/spend-caps.json`, null) until Huraira and Nick agree the amounts (D5); $5 and $20 are proposed.
- **Cockpit:** the Costs page shows the true total with estimates labelled, the cap gauges, spend by day, client, model and build, and the biggest calls. The Run page shows each build's spend.

**Left:**
- Agree the cap amounts, set them in `spend-caps.json`, and bump its version.
- Push. CI and the Cockpit deploy then prove it.
- One live build. It must write `estimated` rows and reviewer rows. It is blocked today: Agent 37 answers HTTP 402 "AI credits exhausted" (probe 2026-10-13).
- The rest of Step 12 (per-client budgets and alerts) waits until after the MVP.

**Update (2026-10-13, later)**:
- **Pushed and deployed:** CI `38433400406` is green, the deploy smoke check returned HTTP 200, and both branches are at `17b1526`.
- **Caps on** (`3c79212`): Nick approved $5 per build and $20 per 7 days, and they are set in `spend-caps.json` 1.1.0. A read-only check against live spend allowed the real caps ($0.29 this week) and refused a seeded $0.10 cap.
- **Agent 37:** topped up and answering. The 32k output ceiling is accepted.
- **New leak:** Agent 37 adds about 21k hidden input tokens to every call (`docs/AI-COST-AUDIT.md` 1b).

**Earlier, not cited before (found in git 2026-10-15 sync)**: `892c468` (2026-10-07) set the per-run cost ceilings from live
`model_traces` (worst case per pipeline $10 -> $2.05). It is the first cost-governance change and predates the M6 slice.

**Update (2026-10-14 sync, SQL)**: verification item 3 is mostly met. Run `4c35703b` (Lanternworks) and run `2dcaacfa` (Summit) wrote:
- Agent 37 builder rows with `price_basis 'estimated'`: 4 rows, $1.021.
- Reviewer rows of their own: 5 Anthropic `metered` rows, $0.438.
- The only `unpriced` rows are 2 from 2026-10-12, under pricing 1.3.0, before M6.

**Left**:
- The Run page spend in the signed-in Cockpit (item 3).
- The live cap refusal (item 4).
- New: synthetic rehearsal runs are booked to `entity_slug 'bennett-co'`, so Bennett's cost per client includes rehearsal spend.

**Next action**: Huraira opens the Run page for `4c35703b` signed in, and the agent runs item 4 on GO. Then run `/step-close 12`.

Verification prompt (MVP M6):
```
Verify MVP M6 (Step 12 slice, commit 2223856). Do not rebuild it.
1. CI on the pushed commit: every job green, including the Cockpit deploy.
2. Signed in as owner, open /costs on the live Cockpit. The total must match a SQL sum over model_traces
   (priced rows plus unpriced hermes-agent rows at $3/$15). The caps panel must say Off, or show the
   agreed amounts.
3. After the next live build: its rows have price_basis 'estimated' for hermes-agent, the screenshot
   reviewer has rows of its own, and the Run page shows that build's spend.
4. With the caps set: run one job with WFACT_CAP_PER_BUILD_USD set below the run's recorded spend.
   It must fail with "Spend cap reached" and write no new model_traces row.
Fix only the gaps you find, then run /step-close 12.
```

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 12.

CONTEXT
model_traces has real per-call cost (provider tokens x list price; Agent 37 recorded as `unpriced`, never
$0). Goal 4: real cost per client, measured not estimated. Blueprint §3: hard per-run budget ceilings with
real-time tracking; 2.0's Cost Sentinel instinct formalised. Spend-ceiling decisions belong to Huraira/Nick.

TASK
1. Ensure every trace row carries client and entity (fix the null entity_slug gap where it originates, in
   the runtime context, not by patching rows).
2. Add a security_invoker view for cost per client, per project, per run, per role and per model; owner-only.
   Unpriced calls are shown separately as "unpriced N calls", never folded in as zero.
3. Budget ceilings: per-run ceiling (hard stop with escalation, audited) and a per-client and daily soft
   alert threshold, configured in one place. Propose defaults from the Step 4 measured cost and ask Huraira
   to confirm the numbers before enabling hard stops.
4. Enforce the per-run ceiling in the workflow: when exceeded, the run stops at the next checkpoint,
   escalates, and the Cockpit shows why. Prove it with a deliberately tiny ceiling on a test run.
5. Cockpit Models room: add cost per client and budget status; link to run detail (Step 10).
6. Backfill client/entity on existing trace rows only if it can be derived with certainty; otherwise leave
   them null and say so.
7. RLS attack-test the new views. Add tests, including the "unpriced is not zero" invariant.

ACCEPTANCE
- Cost per client for the pilot client matches an independent SQL sum you compute separately.
- A run with a tiny ceiling is stopped, escalated and visible in the Cockpit.
- Views are owner-only; attack tests pass.

REPORT in the Part C format, then STOP.
```

---

### STEP 13 — Remaining core agents (P2) — NOT STARTED

**Depends on**: Steps 5, 6, 7, 8 and 11.
**Maps to**: Blueprint §16D, §5 workflow table, Phase 7.

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 13, and only ONE agent group at a time
as listed below; after each group, run its tests and send a short interim note, but do not proceed to the
next group until Huraira says GO.

CONTEXT
Blueprint §16D core agents: Intake, Planner, Research, Front-end, Back-end, QA/Security, Documentation,
Lessons, Memory (consolidation), Deploy, Monitoring, Recovery, Improvement, Optimization. Registered today:
front-end-builder, qa-evaluator, intake, planner (and Documentation after Step 5). Each agent = a role
definition + skillset + enforced permission scope (Step 6), registered through the registry WITHOUT editing
agent-runtime, routed via config (Step 11), audited and traced. Read Blueprint §5 for each workflow's
trigger, models, decision points, approval and failure handling.

GROUPS (do in this order, one per GO)
  A. Research agent, Content/SEO agent (page copy and metadata inside brief constraints; no invented facts).
  B. Back-end agent (forms, integrations, Supabase functions for a client site; strict least privilege).
  C. Deploy agent (PREPARES a preview deploy and a launch checklist only; production launch stays a human
     hard gate; there is no code path that deploys to production without a recorded owner approval).
  D. Monitoring agent and Recovery agent (detect a failed or stuck run, propose or perform a safe resume from
     the last verified checkpoint, escalate otherwise).
  E. Lessons agent and Memory-consolidation agent (extract lessons from runs into memory/lessons-ledger.md;
     consolidate memory; flag contradictions and stale entries for a human; never silently overwrite).
  Improvement and Optimization agents are NOT built now (Blueprint §11, "do not build yet").

FOR EACH AGENT
1. Role, bounded task type, typed input and output schema (zod), permission scope, model slot, and the
   approval tier for its actions (auto-pass, notify-and-wait, hard-gate).
2. Implementation, tests (including a deliberately bad input and an escalation case), registration proof
   that agent-runtime is unchanged.
3. One real run on the pilot client's data, with audit and trace rows read back by SQL.
4. Wire into the workflow as a stage only where Blueprint §5 says so and only if the stage's verification
   passes; extend `build-and-verify` versioning (bump the workflow version, keep the old one runnable).

ACCEPTANCE (per group)
- Agents registered with enforced scopes; live run evidenced; existing suites unchanged; hard gates intact.

REPORT in the Part C format after each group, then STOP.
```

---

### STEP 14 — Cockpit: Memory and Human Control rooms (P2) — NOT STARTED

**Depends on**: Steps 5, 10 and 13 (group E).
**Maps to**: Blueprint §9 (Memory, Human Control).

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/apps/cockpit. Follow the Standard Operating
Rules in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 14.

CONTEXT
Blueprint §9. Memory panels: second-brain health (last consolidation run, size), retrieval-quality signal,
recent writes, flagged contradictions awaiting a human, stale-knowledge warnings. Human Control panels:
pending approvals (already built), escalations, blocked tasks, the exception queue, full intervention
history. Sources: memory files and entries written by the Documentation, Lessons and Memory agents;
audit_log (agent.escalate, agent.deny, plan.decision, workflow.gate); jobs (failed / dead-letter).

TASK
1. If memory files live only in git, add a read-only, RLS-protected index of memory entries in Supabase (or
   another safe read path) so the browser never reads the repo or holds a service key. Entries must link
   to their audit task IDs. No secrets or full PII in the index.
2. Memory room: recent writes, entries per client, last consolidation run, contradictions and stale flags
   awaiting a human with Resolve / Dismiss actions that are audited (human decisions only; agents cannot
   resolve their own flags). Retrieval-quality signal: a simple measured metric from a fixed set of test
   questions run on a schedule or on demand, with results stored.
3. Human Control room: one queue of everything waiting on a human (plan approvals, escalations, blocked
   tasks, dead-letter jobs, gate approvals) with plain-language reason, age, and the action to take; plus
   a chronological intervention history (who decided what, when).
4. Launch and Money gates appear as locked hard-gates in the UI; no way to bypass from the Cockpit.
5. RLS attack tests for every new table/view; role visibility as in Step 10.
6. Browser-verify with real data (create a real contradiction and a real escalation to see them; then
   resolve them). Desktop and phone widths.

ACCEPTANCE
- Huraira can see and act on everything waiting for him from one room, and every action is audited.
- Contradiction/stale flows work end to end with real data.
- Attack tests pass; no service key in bundle.

REPORT in the Part C format, then STOP.
```

---

### STEP 15 — Cognee trial write-up (P2) — NOT STARTED

**Depends on**: Step 5.
**Maps to**: Continuation Stage 6 bullet 2; Blueprint §8 ("leading candidate to trial, not a locked choice").

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Follow the Standard Operating Rules in
docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 15. Time-box: ONE working session; stop when
the box is up even if the trial is incomplete.

CONTEXT
Blueprint §8 names Cognee as the leading candidate for the self-hosted graph memory layer, to be TRIALLED,
not adopted by default, and warns against over-engineering before the simple version is proven
insufficient. The simple version now exists (structured memory files + Documentation agent + Hermes-lite
query).

TASK
1. Define before starting: 8-10 realistic memory questions about the pilot client and runs (some need
   multi-hop reasoning across runs, some are simple lookups, some are contradictions/stale-fact checks).
   Score the current simple approach on them first (correct / partly / wrong), as the baseline.
2. Trial Cognee locally in an isolated directory or container, no production data, no client secrets.
   Ingest the same memory files. Run the same questions. Record correctness, latency, cost, setup effort,
   operational burden (hosting, upgrades), security posture (data leaves the machine or not) and licence.
3. Compare against the baseline honestly. Say if Cognee's advantage only shows on questions the simple
   approach could answer with small changes.
4. Write docs/learnings/cognee-trial-YYYY-MM-DD.md ending with an explicit ADOPT / DON'T ADOPT /
   ADOPT LATER (with a named trigger) recommendation and the reasons. The decision is Huraira's; do not
   integrate Cognee into production code in this step.
5. Clean up: no leftover services, keys or data.

ACCEPTANCE
- The write-up exists with baseline vs Cognee numbers on the same questions and a clear recommendation.
- Nothing in production code or config changed.

REPORT in the Part C format, then STOP.
```

---

### STEP 16 — Tool-call tracing (P2) — NOT STARTED

**Depends on**: Steps 6 and 10.
**Maps to**: Blueprint §3 (observability), §13 (Langfuse trigger); goal 5; Continuation "gaps" (traces cover model calls, not tool calls).

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 16.

CONTEXT
model_traces records every model call with real cost. Hermes-lite tool calls are in audit_log with latency,
but there is no unified trace covering tool calls, file writes, DB writes, queue events and workflow stages
under one run. Blueprint §3: every agent run, tool call and model call traced with cost, latency, outcome.
Blueprint §13 names a dedicated observability tool (Langfuse) with a trigger condition; read that section.

TASK
1. Read Blueprint §13 and decide whether the Langfuse trigger condition is met. Present the decision with
   reasons. Default: do NOT add a new vendor unless the trigger is met; extend the Postgres approach.
2. Design a minimal span model: run -> stage -> agent task -> (model call | tool call | file write | DB
   write | gate). Each span: id, parent id, task ID, client/entity, start/end, outcome, error class, and
   references (not payloads) to inputs and outputs by hash. No secrets and no full PII in spans.
3. Implement spans through the same central choke point as the permission layer (Step 6) so coverage is
   structural, not opt-in. Append-only, owner-read, RLS attack-tested.
4. Make Step 10's run-detail timeline render spans as a tree with per-span latency and cost roll-ups.
5. Coverage proof: run the pipeline, then show by SQL that for each run every audit_log agent action has a
   matching span and vice versa; list any gaps. Fix null entity/client gaps at the source.
6. Tests: span parenting, redaction, failure spans, and a test that an unspanned tool call is impossible
   through the choke point.

ACCEPTANCE
- Every agent action in a run appears exactly once as a span and once in the audit log; the mismatch
  query returns zero rows on a fresh run.
- Cockpit shows the tree; no payload contents or secrets in spans.

REPORT in the Part C format, then STOP.
```

---

### STEP 17 — Alerts and role-based views (P2) — NOT STARTED

**Depends on**: Steps 9, 10 and 14.
**Maps to**: Blueprint §9 (alerts, permissions).

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 17.

CONTEXT
Blueprint §9: alerts are push and Telegram (carried over from 2.0), tiered by severity, with the
plain-language tone filter applied to anything Hermes-generated. Permissions: owner sees everything; admins
see operational panels but not raw cost/margin; PMs see only their own clients. Sending a message to an
external service is an outward-facing action: get Huraira's approval for each channel before any real send,
and never send anything but synthetic test alerts while testing.

TASK
1. Alert rules from real signals (Step 9 health, escalations, dead-letter jobs, budget breaches, failed CI,
   approval waiting too long). Three severities with distinct routing: info (Cockpit only), warn (push),
   critical (push + Telegram). De-duplicate and rate-limit so one incident is one alert with updates.
2. Delivery: web push for the Cockpit PWA; Telegram via a bot. Ask Huraira to create the bot / provide the
   channel via Doppler (never paste tokens in chat). Stop and ask if unavailable; build everything else.
3. Every alert body passes the tone filter (plain language, what happened, what to do, link to the room).
4. Roles: implement owner / admin / PM views end to end (data via RLS, not only hidden buttons). PM sees only
   assigned clients. Add the role-assignment mechanism with an audited change history.
5. Live attack tests: an admin cannot read cost data; a PM cannot read another PM's client; neither can
   change roles.
6. Test with a synthetic alert per severity, confirm delivery, and confirm de-duplication.

ACCEPTANCE
- Each severity delivers through its channels once; duplicates suppressed.
- Role isolation proven by live attack tests.
- No secrets in code or logs.

REPORT in the Part C format, then STOP.
```

---

### STEP 18 — Three-concurrent-clients test (P2) — NOT STARTED

**Depends on**: Steps 6, 8, 9, 10 and 12 (13 preferred).
**Maps to**: Blueprint §16K item 2; Phase 12 infrastructure; goal 2.

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 18.

CONTEXT
Definition of Done item 2: three concurrent clients run through the pipeline without manual firefighting.
Real spend is involved (three full builds). Get Huraira's explicit approval of a stated maximum spend BEFORE
running. Inputs are SYNTHETIC and labelled.

TASK
1. Create two more synthetic briefs (different industries and sizes) besides the Step 2 pilot, each on a
   different entity/client slot consistent with the entity law. If the entity law makes three concurrent
   clients impossible with two entities, STOP and ask Huraira how to proceed (do not bend the law).
2. Pre-flight: state the max budget, the per-run ceilings (Step 12), the expected duration, and what counts
   as "firefighting" (any manual restart, edit, DB fix, or re-dispatch). Get GO.
3. Launch all three from the Cockpit at once. Do not intervene except to record. Deliberately inject one
   realistic fault mid-run (for example kill a worker) as agreed in advance, to prove recovery is automatic.
4. Measure: per-run corrections, failed checks, cost, wall-clock, queue wait, retries, escalations, any
   cross-client interference (data or file bleed), any duplicate builder calls.
5. Independently verify: run the registry (Step 7) on all three artifacts; confirm entity isolation by
   inspecting rows and files.
6. Write docs/learnings/concurrency-test-YYYY-MM-DD.md with results, honest failures and fixes needed.
   If it failed, do not fix and re-run silently; report, propose fixes, wait for GO.

ACCEPTANCE
- Three runs complete (or fail honestly) with recorded metrics; zero cross-client bleed; the injected fault
  is recovered from automatically, or the failure is reported.
- Cost stayed within the approved budget.

REPORT in the Part C format, then STOP.
```

---

### STEP 19 — Disaster-recovery drill (P2) — NOT STARTED

**Depends on**: Step 3 (Step 9 for the backup-status signal).
**Maps to**: Blueprint §16K item 6, Phase 12.

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Follow the Standard Operating Rules in
docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 19. Creating a new Supabase project may cost
money and is outward-facing: ask Huraira first, state the cost (use get_cost / confirm_cost), and wait for GO.

CONTEXT
A backup exists at ../supabase-backup-coefcklxoeangqowzgif-2026-09-21/ (database schema/data/roles SQL,
config checklist, storage zips, functions). Note the folder name references a different project ref than
the canonical mcaxxhgjptwowwrluhra; establish which project it came from before relying on it. Definition of
Done item 6: a disaster-recovery drill has actually been run and the backup actually restored.

TASK
1. Read the backup README and config checklist. Establish what is and is not covered (auth users, RLS
   policies, triggers, storage objects, edge functions, secrets, auth settings such as Site URL).
2. Take a FRESH backup of the canonical project using the same method (do not overwrite the old one), and
   record how long it took. Keep backups out of git (check .gitignore).
3. After Huraira approves cost, restore the fresh backup into a SCRATCH Supabase project. Never touch the
   canonical project.
4. Verify the restore: table counts and checksums vs the source, migrations list matches, RLS policies and
   triggers present (re-run the RLS attack test against the scratch project), audit_log append-only triggers
   still refuse UPDATE/DELETE, storage objects present, edge functions deployable, and the Cockpit can be
   pointed at the scratch project (locally) and works.
5. Record the gaps honestly (for example secrets and Auth settings that a data restore does not carry) and
   write a runbook docs/DISASTER-RECOVERY.md with exact steps, expected time (RTO), how old the newest backup
   may be (RPO), and who does what.
6. Automate freshness: add a scheduled backup and a "last backup age" signal for the System room (Step 9).
7. Tear down the scratch project after Huraira confirms, so no cost is left running.

ACCEPTANCE
- A restore into a scratch project passes every verification in item 4, or the failures are listed.
- Runbook exists with measured RTO and stated RPO.
- Scratch project deleted (with Huraira's confirmation); no secrets in git.

REPORT in the Part C format, then STOP.
```

---

### STEP 20 — Fix the Vercel serverless ceiling (P2) — NOT STARTED

**Realignment note (2026-10-07)**: do this earlier if any new Cockpit endpoint is added (Part F, D2); the 12-function ceiling already caused one silent outage.

**Depends on**: none technically; needs Huraira's decision.
**Maps to**: Blueprint §1 (FIX, infrastructure), Phase 9 "Fix"; BLOCKED-ON-NICK "Vercel plan upgrade".

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Follow the Standard Operating Rules in
docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 20. Do not change billing or plans yourself.

CONTEXT
Blueprint §1: the 12/12 Vercel Hobby serverless-function ceiling already caused a silent outage in 2.0.
"Upgrade the plan or move heavier logic off serverless functions before the next outage, not after." The
3.0 Cockpit is a Vite SPA and its server logic is in Supabase Edge Functions and GitHub Actions, so the
ceiling may not bind 3.0 today. Verify, don't assume.

TASK
1. Measure current reality: number of Vercel serverless functions across the projects in use (Cockpit,
   dreamsign-deploy and any client previews), plan tier, limits, and how close each project is. List the
   client sites that would count against the same plan as the number of clients grows (3 clients, 10).
2. Project the ceiling: at what number of clients or features do we hit it, given the current architecture?
3. Options with costs: (a) upgrade plan, (b) keep logic off Vercel functions (Edge Functions, static
   sites, one project per client), (c) mixed. Recommend one, with monthly cost.
4. Present the decision to Huraira. STOP. Do not upgrade or spend.
5. After Huraira's decision, implement only the non-billing engineering part (moving logic, splitting
   projects, adding a function-count guard in CI that fails when a project approaches its limit).
6. Add a "function count / headroom" signal to the System room (Step 9) if that room exists.
7. Update BLOCKED-ON-NICK.md with the decision and its owner.

ACCEPTANCE
- Numbers and projections documented; a decision recorded; CI guard in place; no billing change made by you.

REPORT in the Part C format, then STOP.
```

---

### STEP 22 — Nick's items (P3, Huraira acts, agent prepares) — NOT STARTED

**Depends on**: none. Best after Step 4, so Nick sees real results.
**Maps to**: BLOCKED-ON-NICK.md; goal 1 (real brief); Blueprint calibration note.

**Next action (2026-10-12)**: one D3 item is due now. Nick's Bennett & Co brief, logo, colors, CRM target and credit top-up (`docs/MVP-CUTLINE.md` §6, asked once in one message). As of 2026-10-12 nothing is in the repo (no `clients/bennett*`). The rest of this step waits until after the MVP.

```
You are the coding agent for WFACT 3.0. Follow the Standard Operating Rules in
docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 22. You PREPARE materials; HURAIRA sends
them and talks to Nick. Never send a message to anyone yourself.

CONTEXT
Open Nick-only items: the real pilot brief; a 30-60 minute business-rules session; two disclosures owed in
person (Hermes-lite is a stand-in for real Hermes; Vercel substitutes for Hostinger); confirm the governance
split; confirm the two entities; the API spend ceiling; where the self-hosted brain and Hermes will run;
Vercel plan; Nick's 10-15 minute Cockpit review; comp and scope closed in writing (flagged across the docs
as the item that matters most).

TASK
1. Produce ONE short briefing document for Nick (plain language, no jargon, no library names, no em dashes)
   at docs/nick-briefing-YYYY-MM-DD.md: what has been built, what is real vs stand-in, what the factory did on
   the synthetic pilot (numbers from Step 4 and later steps), what it cost, and what is needed from him.
2. Make it a decision list: for each open item, the question, the options, your recommendation, what it
   blocks, and by when it is needed.
3. Prepare the disclosures in Huraira's voice as talking points (not a message to send): what Hermes-lite is
   and why, what Vercel-for-Hostinger means for the live-site rule, and what changes if Nick disagrees.
4. Prepare the business-rules session as a checklist generated from the Provisional-rule register in
   memory/context.md (Step 2): each provisional rule as "keep / change to ___".
5. Prepare the real-brief request: exactly what the brief must contain so the pipeline can run it, with the
   synthetic brief as the example.
6. Prepare a 10-minute Cockpit walkthrough script for Nick (which rooms, what to click, what "good" looks
   like), and a place to record his reactions.
7. When Huraira reports Nick's answers, update memory/context.md (replace provisional values, clear their
   register entries), BLOCKED-ON-NICK.md (close rows with dates and evidence) and PROGRESS.md.
8. Compensation and scope: do not draft terms or advise on them; only list that it is open and needed.

ACCEPTANCE
- The briefing, talking points, checklist, brief request and walkthrough script exist and are accurate to
  the repo's real state (every claim checked).
- Tracker files updated only with what Huraira reports.

REPORT in the Part C format, then STOP.
```

---

### STEP 23 — Product features: Owner's Key port (P3) — NOT STARTED

**Depends on**: Steps 7, 10 and 14 solid; Nick's real brief preferred.
**Maps to**: Blueprint Phase 10; Business/Product category; keeps 2.0's security bar.

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 23, and only the sub-part Huraira names;
this step is large, so work in the order below and stop after each sub-part.

CONTEXT
Blueprint Phase 10: port 2.0's proven Owner's Key design (client self-edit; isolation and upload gates held
under attack in 2.0), and rebuild the closing report and care-plan generation as agentic workflows on the
new runtime. Risk named in the Blueprint: regressing a proven security property during migration - re-run
the attack tests, do not assume they pass. "Do not build yet": multi-tenant SaaS billing and product
features. Source material for 2.0's design is in docs/, docs/archive/ and docs/WFACT SOPS/. If the 2.0 code
itself is not in this repo, say so and design from the documents; do not pretend to port code you cannot see.

SUB-PARTS
  A. Discovery: inventory 2.0's Owner's Key, its threat model and its attack scripts from available
     material. Write a port design (data model, RLS, upload gates, what a client can and cannot edit, how
     edits are audited, how a client is authenticated). STOP for GO.
  B. Owner's Key on the new stack: implement to the approved design, entity-isolated, audited, RLS-backed.
     Re-run the 2.0-style attack tests (isolation, upload gates, path traversal, oversize/wrong-type files,
     cross-client access) for real and report results. STOP for GO.
  C. Closing report generator as a workflow: a versioned agent workflow that builds a plain-language client
     report from real run data (no invented numbers), verified before delivery, with the send step
     hard-gated to a human. STOP for GO.
  D. Care-plan generator, same pattern. STOP for GO.
  E. Cockpit Business/Product room: client activity, feature usage, product health, and the Money/SEO/
     Content rooms carried over from 2.0 ONLY where a real data source exists. STOP.

RULES SPECIFIC TO THIS STEP
- Nothing client-facing goes live without Launch approval. No emails or messages are sent to real clients.
- Use synthetic clients only for tests.
- Money/Stripe integration is hard-gated: no payment action without explicit human approval per action.

ACCEPTANCE (per sub-part)
- Design approved / attack tests pass for real / generated reports verified against source data / gates
  intact.

REPORT in the Part C format after each sub-part, then STOP.
```

---

### STEP 24 — Advanced autonomy and optimization (P3) — NOT STARTED

**Depends on**: Steps 4, 7, 12, 18 and a real track record.
**Maps to**: Blueprint Phases 11–12, §11.

**Next action (2026-10-12)**: none until the MVP ships (Decision D3, `docs/MVP-CUTLINE.md` §3 defers this step); then follow the Execution order table. Prompt below unchanged and still current.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 24, and only the sub-part Huraira names.

CONTEXT
Blueprint Phase 11: raise autonomy only where the data supports it, using measured clean-run streaks
(2.0's "3 clean projects" rule is a reasonable starting bar). Phase 12: decide production migration of
high-volume, low-judgment task classes to self-hosted models using the evaluation data gathered since
Step 11. Launch and Money hard gates stay manual forever. Do not build autonomous self-improvement loops
that change prompts, code or gates on their own (Blueprint §11: prove evaluation works with a human reading
results first).

SUB-PARTS
  A. Autonomy evidence report: for each gate (plan approval, build launch, escalations, notifications),
     compute from real runs the clean-run streak, defect rate, correction count and cost. Recommend
     upgrades only where the evidence meets a stated bar, and state the bar first. Include gates that must
     NOT change. STOP for GO. Huraira decides any upgrade; you implement only what he approves, as a
     configuration change with an audit entry and an instant revert.
  B. Optimization analysis: which task classes are high-volume and low-judgment, what they cost now, what a
     self-hosted or cheaper model achieved on the held-out set (Step 11), and the projected saving with a
     measured quality comparison. A measured cost reduction without a quality regression is the acceptance
     bar. If the data is insufficient, say so and list what data to collect. STOP for GO.
  C. Only after approval: a controlled migration of ONE identified task class, behind config, with shadow
     mode first (run both, compare, do not use the new one), then a limited switch with a one-line
     rollback. Report measured results.

ACCEPTANCE
- Every proposed change is backed by a specific measured number, not a feeling; hard gates untouched.

REPORT in the Part C format after each sub-part, then STOP.
```

---

### STEP 25 — Real-client proof run (P0, added 2026-10-07) — PARTIAL 2026-10-15, MVP M4 contact form met live (synthetic); real-client run waits on Nick

**M4 contact form that saves leads (2026-10-15, MET live on synthetic data)**: built in `1da9a5a`, `60061b7`, `b1cd762`, `f8b1bf7`, fix `2154fda`. Live 2026-10-15: migrations 0025 (20261015102916) and 0026 (20261015103026, fixes a page_path check that made every insert fail, caught by the attack test) applied; attack test 43/43 live; advisors: no new security lint, no new performance WARN; `submit-lead` v1 deployed (verify_jwt false), LEAD_IP_SALT set by Huraira. SYNTHETIC proof (entity `synthetic-test`, client "Lanternworks Studio (SYNTHETIC)", lead site `d208427b`, is_test): Track A JS, Track A no-JS, Track B JS, Track B no-JS each landed as exactly one `leads` row (SQL: 4 rows, then 5 after the curl 5th post); curl: wrong origin 403, unknown key 404, honeypot and a 500 ms fill silently dropped and counted, 6th post 429 (form post: 303 to ?error=rate_limited), wrong-origin form post 403 with no redirect; logs name the refusals, no visitor content; 0 non-test rows, no IP text stored. **Next action**: Nick names the CRM target and whether a lead notifies him (BLOCKED-ON-NICK); the Bennett & Co run needs a real `clients` + `lead_sites` row with the live origin. Not pushed. The real-client run itself still waits on Nick's brief.

**Depends on**: Step 4B M4 closed; Step 26 done (or Huraira's explicit waiver); a real brief from Nick, or Huraira's choice of the real 2.0 DreamSign case.
**Maps to**: Blueprint §16K goal 1; Continuation Stage 7.

**MVP scope under D3 (2026-10-12)**: this is the MVP's main build. Run it on **Bennett & Co** (Nick's own LLC, a real client; colors and logo
fixed, fonts free, a proper web agency site, websites only). `docs/MVP-CUTLINE.md` §2 M1–M4 and M8 are its acceptance on top of the
prompt below. Target Wed 2026-10-14. Report slippage on Monday evening 2026-10-12. The dependency on "4B M4 closed" and "Step 26 done" is
narrowed by D3 to Step 26 item 1 and the cost-cap slice of Step 12.
**Rehearsal (D4, 2026-10-13)**: GO from Huraira to rehearse Step 25 on the synthetic Lanternworks Studio brief (`clients/lanternworks-studio/`) through the live Cockpit. Gap found before the run: intake cannot take a logo file or the live address (`siteUrl`), so M1 cannot be met by any brief yet. The real run still needs Nick's brief.
**Rehearsal result (2026-10-13, SQL-checked 2026-10-14)**: Lanternworks Track B plan `403305ec` was built (`83f2841f`; the runner crashed after
the build) and continued (`e2a204fb`, run `4c35703b`). It halted at QA with `failed_verification` after 2 revisions. The main issue is that the
brief's logo is never embedded, because intake cannot take one. About $1.53 of AI spend went on the run. Synthetic: this does not count toward
Step 25. **Rehearsal passed (2026-10-14)**: after the intake slice (`8b3caed`) the same Lanternworks run, continued with the logo and details (job `55ddba7c`), reached the launch gate in 14 min for ~$0.68. **Next action (2026-10-14)**: Nick's brief (Bennett & Co); the factory side of the rehearsal is ready.
**Next action (2026-10-12)**: blocked on **Nick's brief** (repo name or brief, logo file, exact colors, pages, real case studies, CRM target:
`docs/MVP-CUTLINE.md` §6). Nothing is in the repo yet. When it lands, record it under `clients/bennett-co/` (entity `bennett-co`) with the
locked colors and logo as constraints (M1), then run this prompt. Per the cut-line schedule this is already a day behind.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules in
docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 25.

TASK
1. Confirm with Huraira which real brief is used and that the client agreed to it being a pilot. Never use a synthetic brief here.
2. Run the brief through the Cockpit exactly as an owner would (intake, plan approval, track choice, build, verify). Do not hand-edit
   intermediates. Record every correction round with who asked and why.
3. Measure: correction batches (baseline DreamSign 40+), builder and evaluator cost per model (flag unpriced calls), wall-clock time,
   failed checks by name, and every manual intervention you had to make.
4. Write a failure analysis: where quality was lost (brief, direction, build, QA) and which defects a human found that the checks missed.
5. Launch stays human: stop at "awaiting launch approval". Do not deploy.

ACCEPTANCE
- A measured, honest result in docs and PROGRESS.md with evidence; defects the checks missed are listed.
- No synthetic input used or counted. Every stand-in labelled.

REPORT in the Part C format, then STOP.
```

---

### STEP 26 — Quality calibration (P0, added 2026-10-07) — PARTIAL 2026-10-14, item 1 met live (Anthropic reviewer and evaluator in passing build `55ddba7c`, CI green); items 2–4 open

**Item 1 progress (2026-10-14)**: the screenshot reviewer moved from Agent 37 to Anthropic claude-sonnet-5 (`reviewer.json` 1.1.0, Huraira
approved 2026-10-13), a different vendor from the Agent 37 builder, after every Agent 37 review was cut at Node's 300 s fetch header
limit (root cause, fixed in the same commit). Local live proof: Summit Line Track A, 5 pages, 15 images, review PASSED in 32 s, $0.071.
**Left**: a Cockpit build whose review writes an `anthropic` `model_traces` row (press "continue" on `83f2841f` or `63278e56` once CI
deploys `67033f7`); OpenAI as a third vendor stays blocked on credits; items 2–4 after the MVP.
**Cockpit proof (2026-10-13 19:24-19:40 UTC, SQL-checked 2026-10-14)**: job `e2a204fb` (continue of Lanternworks `83f2841f`, run
`4c35703b`) wrote 5 successful `anthropic` `agent:qa-evaluator` rows (claude-sonnet-5, $0.438, 31-63 s each) and reached a real verdict
(`failed_verification` on named evaluator issues, never "NOT RUN"). **Still left for item 1**:
- Summit Line `63278e56` (Track A) continued on the new reviewer.
- CI green on the pushed head. `38452956084` on `d5129e0` failed Rendered QA on Node 22. The fix `a9b271f` passes 18/18 locally on Node 24 (pushed since; CI `38554457540` green, see "Item 1 met" below).

**Item 1 met (2026-10-14 sync)**: the passing Cockpit build `55ddba7c` was reviewed and evaluated on Anthropic (2 `agent:qa-evaluator` rows, $0.167) with CI `38554457540` green. A Track A continue on the new reviewer (Summit `63278e56`) is still worth doing as Track A evidence for 4B M4, not for this item. **Next action**: items 2–4 after the MVP; item 2 needs Nick's or Huraira's blind ratings.
**Superseded verification prompt (2026-10-14)**: verify first. The Lanternworks half below is already proven (`e2a204fb`), so skip it. Confirm CI is green on the commit after `67033f7`. In the Cockpit, press "continue" on
the stopped Lanternworks build `83f2841f` (Track B) and on Summit Line `63278e56` (Track A). Each must reach "awaiting launch approval" or
fail on a named check, never on "design review NOT RUN". Query `model_traces` for `provider='anthropic'` rows from `agent:qa-evaluator` and
cite them. Fix only the gaps found, then run `/step-close 26` and move to Step 27.

Continuation prompt — updated 2026-10-20 (use this instead of the original below, which would restart item 1):

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/, branch huraira-work. Follow Part C of
docs/WFACT-3.0-Factory-Completion-Plan.md. Do ONLY Step 26, items 2-4. Item 1 is DONE: Anthropic reviewer
(packages/rendered-qa/config/reviewer.json 1.1.0, 67033f7) and evaluator rows on run 4c35703b; passing build 55ddba7c;
CI 38554457540. Do not redo it.
LEFT: 2. blind rating sheet of 10-15 real outputs (Track A and B, labels hidden) for Nick or Huraira; compare with the
reviewer's scores; change thresholds only with Huraira's approval. 3. one approved reference output per niche as a CI
visual-regression baseline that fails on a seeded regression; no invented clients presented as real. 4. cost per review and
per run from model_traces (SQL, cite the query).
BLOCKED: item 2 needs Nick's or Huraira's ratings; while waiting, build the sheet and item 4, and stop before scoring.
EXIT CHECK: calibration table in docs; the regression test red on a seeded regression; all suites pass unchanged.
Then /step-close 26 and REPORT in the Part C format, then STOP.
```

**Depends on**: OpenAI (or another different-vendor) credits; Step 4B M4 closed.
**Maps to**: Blueprint §1 "never trust done"; goal 3.

**MVP scope under D3 (2026-10-12)**: only **item 1** (one live different-vendor call from the evaluator and the screenshot reviewer, with a
`model_traces` row; `docs/MVP-CUTLINE.md` M7) runs before 2026-10-14. Items 2–4 wait until after the MVP. **Next action (2026-10-14, done 2026-10-14)**: push
`a9b271f` (pushed), confirm CI green (`38554457540`), item 1 met; the current next action is under "Item 1 met" above. (OpenAI credits no longer block item 1: Huraira chose
Anthropic as the second vendor on 2026-10-13. OpenAI remains a possible third vendor.)

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules in
docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 26.

TASK
1. Different-vendor evaluator: make one successful live call from the evaluator and from the screenshot reviewer on a vendor other than
   the builder's (Agent 37). If credits are missing, stop and tell Huraira. Record the vendor in packages/rendered-qa/config/reviewer.json.
2. Human calibration: prepare a blind rating sheet of 10-15 real outputs (Track A and B builds, mixed good and bad, labels hidden) for
   Nick or Huraira to score 1-5 on a short rubric. Compare to the automated reviewer's scores; report agreement and the biggest
   disagreements. Adjust thresholds or rubric only with Huraira's approval.
3. Reference set: per niche in the taxonomy, keep one approved output with screenshots as a visual-regression baseline run in CI;
   a regression beyond a stated threshold fails the check. No fake or invented clients presented as real.
4. Report the cost per review and per run for the new vendor.

ACCEPTANCE
- Live different-vendor call proven with a trace row; calibration table in docs; regression test fails on a seeded visual regression.
- Existing suites pass unchanged.

REPORT in the Part C format, then STOP.
```

---

### STEP 28 — Build quality and Cockpit plain-language UX (P0, added 2026-10-14) — IN PROGRESS 2026-10-20, Packages 1–3 of 5 built and verified; Package 4 phases 1–19 CI-green and deployed, pre-v2 rebuild R1 (other work pages), R2 (decided proposals), R3 (Decisions room kept, option b), R4 (fix rounds as an Activity filter, option b) and R5 (deletions, NotFound) built and verified, Package 4 exit check re-run PARTIALLY MET (one pre-v2 panel left); build-failure guards, brand-colour rule, brief consistency check and example clients built, live proof pending

**Source**: `docs/BUILD-QUALITY-AND-COCKPIT-UX-PROMPTS.md` (the full agent prompt, five packages; Huraira gave it as the task on
2026-10-14). One package at a time, report, wait for GO. Package 5 is a paid build (cap $3) and needs GO.

**Package 1 — the builder sees the whole request: built and verified locally** (`3e493f6`):
- `PilotBrief.requestText` (stored by code at intake, fenced as data) and `requested` (Intake extracts, code keeps only items in the
  request and never claims); carried through planner, re-plan and `briefForBuild`; old plans use the intake job's text, else build
  "summary only" (Cockpit note). `packages/frontend-loop/src/request.ts`.
- Deterministic checks before any build (both tracks): requested services, steps (in order), primary action label, pages and form
  fields by name; content floors (home 4 sections / 180 words, others 3 / 120, measured on Summit Line, Northfold, Lanternworks);
  copy about the website itself. Builder and reviewer prompts get the request.
- Planner: synonym sections collapse (hero/home, process/how-we-work); build task named for the whole site. Direction re-run alone for
  a pending plan: job kind `direction`, migration 0022 (applied live), Cockpit button "Prepare the direction again".
- Evidence: HEAD `cf2f04b` accepts the stored Lanternworks content with 0 errors; now 19 errors incl. "missing: Ongoing care",
  "missing step: discovery call, proposal, care", "primary action should be 'Book a discovery call'", meta copy. Suites: frontend-loop
  115, planning 42, jobs 33, workflow 42, verification 113, rendered-qa 79, Cockpit 123, all green; typecheck clean.
  `scripts/rls_attack_test_direction.sql`: before 0022 9 of 11 wrong, after 11/11; recovery attack 25/25 after. Independent review
  (separate agent) found 6 defects in the new checks; all fixed with tests that failed first.
- Not done: no live build (by design); CI not run at the time (pushed since: CI `38569635936`); Track A has no form-field "openQuestions" path beyond the check.

**Package 2 — Track B starter defects: built and verified locally** (`d112f62`, starter `track-b-starter/1.4.0`, Track A 1.3.0):
- Logo: explicit display size; an SVG with only a viewBox is served with width/height (`servedLogoData`; fingerprint still checked
  on the uploaded bytes). On 1.3.0 the Lanternworks header logo rendered **0x0 px** at 1440 and 375; Track A had the same CSS.
- Accent: buttons are the client's accent (`palette.action`; ink on #F26B38 is 5.28:1), never a panel fill; when the brief reserves
  the accent for actions (`accentForActionsOnly`) the rules, step numbers and closing button stop wearing a darkened accent.
- Phones: an action bar under 960 px with its height reserved (body and scroll padding); no empty band under the hero; the work reel
  swipes with scroll snap. Motion: an entrance per section type (CSS scroll-driven, IntersectionObserver fallback, transform only).
- New rendered checks `render.logo-visible`, `render.mobile-action-visible`, `render.accent-usage`, `render.motion-coverage`
  (registry 1.2.0, planted fixtures in `packages/rendered-qa/test/trackBBrand.test.ts`). On 1.3.0 all four FAIL on the clean
  Lanternworks site; on 1.4.0 all pass on every page and each planted fixture fails only its own check. Brand promise computed by
  code (`trackB/brand.ts`, workflow `brandPromiseFor`, also on a resume).
- Suites: rendered-qa 85, frontend-loop 118, workflow 44, verification 113, jobs 33. Screenshots at 1280 and 375, before and after.
- Not done: Lighthouse on the Lanternworks build (the Northfold build's LCP/CLS pass); the phone bar and the hero button both show at
  the top of the home page; the meta-copy check misses "replaced our single page site with six"; no live build.

**Package 3 — image slots and labelled placeholder cards: built and verified locally** (`7e30b09`; Track B starter 1.5.0,
Track A 1.4.0, content `track-b/2` and `track-a/2`, both upgraded from v1 on read; migration 0023 applied live):
- The builder describes each picture ({kind, alt, aspect, note}); it never sets a source or asks for a generated image. Code shows
  the owner's verified image for a slot, else an "Image to come: <note>" card in brand tints (`data-placeholder`). The home hero
  and every work item need a slot; a team section takes names only from the client's words. `src/media.ts`, `MediaFrame.tsx`.
- Supplied images: Cockpit upload (JPEG/PNG/WebP, 2 MB) -> plan input `asset.image.<slot>`, checked by the database (0023,
  `scripts/rls_attack_test_images.sql` 7 of 19 wrong before, 19/19 after; the 0021 suite 29/29 after, with a new "logo over
  512 KB still refused" case) and again by the build (fingerprint and format in the readiness check).
- Launch: placeholders are listed as still needed from the client (job result `placeholders`, Cockpit panel with per-slot upload);
  `content.placeholders-launch` (registry 1.3.0, launch stage) refuses them unless the owner ticks "launch with placeholders".
- `GeneratedImageProvider` interface only; no paid calls. Evidence: before this package the stored Lanternworks site had no
  image or placeholder at all and the schema had no slot to hold one.
- Suites: frontend-loop 125, rendered-qa 88 (the media site passes every rendered check on all six pages), verification 116,
  workflow 44, jobs 34, planning 42, Cockpit 124 plus build. Screenshots at 1440 and 375.
- Not done: no live build; an uploaded image's real use in a paid build is proven only in Package 5.

**Package 4 — Cockpit v2 rebuild to the locked design: phases 1–13 built** (`4a50b22`, `a8fa3cf`: CI `38588413325` green on
every job and deployed, live Cockpit serves v2, `theme-color #F4F2ED`, HTTP 200; `8532f4e` phase 3 pushed in `a87e6db`, whose CI
`38591851925` FAILED in the Cockpit job on a test race (sign-out test read the button before the lazy Settings page loaded), fixed in
the test; `fd020a5` phase 4, pushed in `b3a3707`, CI `38593657465` green on every job and deployed (phases 3–4 live); `00ec210`
phase 5 and `2cd7f6b` phase 6, CI `38595375699` and `38596185659` green and deployed; phases 7–12 (`9513166`, `fd7a08a`,
`74e1384`, `5a96bb2`, `99ba999`, `a94eb6f`) green and deployed, last CI `38604205509` on `56e545f` incl. Deploy Cockpit to Vercel
(smoke HTTP 200); phase 13 `a01dbbf` pushed in `47a2da4`, CI `38605626110` running at the 2026-10-15 05:30 sync). Source of truth: `docs/design/cockpit-v2/` (locked 2026-10-14); the build prompt is
`docs/design/cockpit-v2/docs/COCKPIT-V2-BUILD-PROMPT.md` (phases: tokens, components, shell, `path.ts`, then each screen).
- Phase 1 tokens (`4a50b22`): v2 light/dark values, four accents, density, type scale, motion, reduced motion (device or in-app),
  text-size zoom; `lib/appearance.ts`; Newsreader. `tokens.test.ts` proves the locked values and 4.5:1 for every text, status and
  accent pair in both themes. Pre-v2 rules render through a temporary alias block until phases 2–3 replace them.
- Phase 2 components (`a8fa3cf`): `kit.tsx` (Button, StatusChip, PathSegments, Segmented, EmptyState, ComingLater, TechDetails),
  `flow.tsx` (ProgressStrip, StepRow, StopFacts, FixCard, WhyDisclosure, NeedRow), `CommandPalette.tsx`, v2 ConfirmDialog
  (alertdialog, money line, focus to primary and back) and side-by-side SitePreview in `ui.tsx`, 9 s toast with Undo,
  `lib/detail.tsx` (Simple/Detailed by role). Money lines read `spend-caps.json` (`costLine`), never a hard-coded figure.
- Evidence: Cockpit 164/164 (26 new), typecheck and build clean; dev gallery `dev-components.html?axe=1` (axe-core 4.13.0, pinned):
  0 violations light and dark at 1440 and 375, also with the confirm and palette open; 375 px `scrollWidth` 375; no target under
  44 px; keyboard: palette filter, Enter runs, Esc and focus return checked in the browser.
- Deviation (accessibility over the design): waiting step rows are dimmed by colour, not 82% opacity (opacity failed 4.5:1).
- Conflict logged, not guessed: the design's "$2.00 per build, $20 a month, monthly cap stops new builds only" vs live caps $5 per
  build and $20 per rolling 7 days checked before every call (`BLOCKED-ON-NICK.md`, Nick).
- Phase 3 shell (`8532f4e`): 236 px rail with the typeset wordmark (WF tile gone, also on sign-in), nav with the waiting count,
  Coming later, Simple/Detailed and account; 68 px top bar (breadcrumb, search opening the palette, bell with unread count, New
  request); AskBox removed, "Ask the factory a question" is a palette action through `requestJob("ask")`; phone header, tab bar and
  More; keys ⌘K, /, G H P A C, N, D, ?, Esc with a shortcuts sheet; Notifications inbox from the Home attention source (unread
  per person); `/team` serves account requests until the Team room. Evidence: Cockpit 175/175 (`shell.test.tsx` 11 new), build
  clean; dev server with the synthetic fake (`COCKPIT_FAKE_DB=1`, launch config `cockpit-fake`, never in a build: 0 matches in
  `dist`): axe 0 on Home owner (light and dark, 1440), More (dark, 375), Notifications (light, 375), Coming later as a PM (375);
  375 px `scrollWidth` 375, no target under 44 px; palette by keyboard in the browser; 125% text size zooms the shell.
- Roles follow RLS where the design disagrees (logged for Nick, then Huraira): PMs get no Activity (`audit_log`/`jobs` owner/admin),
  admins no Costs (`model_traces` owner only), and the PM "cost so far" line has no readable source.
- Phase 4 path (`fd020a5`): `src/lib/path.ts` `derivePath()` gives step, state, tone, waiting on, sentence, next line and one next
  action for each client from the plan, its details, its jobs and the project stage; Details needed names what is missing with real
  counts; stops use the design's 8-case fix labels (`fixLabel`), credit and setup wait on Huraira, the spending limit is the owner's;
  `stripSteps()` gives the six strip cells. Evidence: `path.test.ts` 22 tests (every step, roles, resume, stale, cancelled, spend,
  banned words), Cockpit 197/197. Not used by a screen yet (phase 5 onward).
- No source for a recorded site approval: `path.ts` supports "Approved, waiting for launch" but nothing records it (logged).
- Phase 5 Home (`00ec210`): greeting and count, spend line, "What needs you" (stopped, then approvals, then missing details; one
  button or "<owner> decides this"), Running now (time left only from past builds), This week against the live cap (owner only),
  Every client on the six-step path; empty, loading, all-calm and failed-load states. `lib/clients.ts` is the one client list;
  `lib/attention.ts` is rebuilt on it (Home and Notifications share it, design words, no "plan"). Evidence: Cockpit 205/205
  (`home.test.tsx` 8), build clean; `cockpit-fake` dev server: axe 0 for owner (light and dark, 1440 and 375), admin and PM,
  `scrollWidth` 375, no target under 44 px, no banned word outside Technical details.
- Phase 6 Projects (`2cd7f6b`): summary sentence, search, sort, group, filter pills with counts, Save this view (with Undo),
  Grid/List, pins, list as role=table (stacked on phones, headers kept for screen readers), ids in a Technical details drawer.
  Deviation: "Add a client or project by hand" kept (closed, owner/admin) because a client needs a project before "Record that
  it is live" can work. Evidence: 212 tests (`projects.test.tsx` 7); axe 0 grid and list, light/dark, 1440/375; `scrollWidth` 375.
- Phase 7 New request (`9513166`): the client's words, business name (sent as a labelled first line: intake reads only the
  text), live address, logo drop zone (a real focusable file input), one primary "Send to the factory" with the cost beside it,
  "What happens next", sending state. Money confirms (hard rule; the design shows only the cost line): an alertdialog with the
  rough cost (owner: live average of past intake, planner and direction runs; otherwise "a few cents") and the live per-build
  stop. Deviation kept: "Re-check a built page" (closed; the only way to start a verify job). Fixed on the way: the large-button
  class `page` collided with the main wrapper's `.page`, renamed `btn-page`. Evidence: 217 tests (`newrequest.test.tsx` 5); axe 0
  light and dark at 1440 and 375 and with the confirm open; keyboard run text, drop zone, send, confirm.
- Phase 8 the client's page (`fd7a08a`): `/projects/:id` and `/clients/:slug`; strip with the one next action, the proposal, details and
  files with a real count, every build, cost so far (owner), the decisions timeline from the audit trail through one phrase table
  (`lib/phrases.ts`, reused by Activity), Technical details (ids; the internal stage move and fix rounds kept there). The design's
  "Test client" badge is not shown: no data source. Evidence: 224 tests (`client.test.tsx` 7); axe 0 light/dark at 1440 and 375.
- Phase 9 Proposal review (`74e1384`): pending proposals get the v2 review (client's words, kind of site as a radiogroup with the real
  reasons, pages, open questions, sticky bar). Approve is owner-only (locked rule) and confirms; Ask for changes saves the note and
  requests a new proposal, with the money confirm; "Prepare the direction again" kept with a money confirm. Decided proposals keep
  the pre-v2 page until the details-list screen. Evidence: 225 tests; axe 0 light/dark at 1440 and 375.
- Phase 10 What the site still needs (`5a96bb2`): approved proposals open it (meter, Files/Details/Words/Questions with Upload, Answer,
  Build without it; placeholders with the owner-only launch tick; sticky Start the build, disabled until the logo is in, with the
  money confirm). Same plan_inputs rows as before. Logged: the design's logo rule is stricter than the factory's. Evidence: 227
  tests; axe 0 light/dark at 1440 and 375.
- Phase 11 Live build (`99ba999`): `components/LiveBuild.tsx` on the build page: Now headline, step-change announcements, bar, figures,
  stall note, the ten steps mapped from deriveTimeline (unrecorded steps say so, never invented), rounds of fixes with each
  recheck's result. Not done: "Spent so far" on this page and the design's phone toggle (no push channel). 227 tests; axe 0.
- Phase 12 Stopped build (`a94eb6f`): `components/StoppedBuild.tsx` + `lib/stopCases.ts` replace RecoveryPanel: the 8 cases
  mapped from diagnoseJob(), facts (money only from records, owners only), checks that still fail, who acts, The fix, Why?.
  Every paid move confirms its cost. Not done (BLOCKED-ON-NICK): sending Nick a note (it is copied), the owner's per-build
  limit raise, quiet options with nothing behind them, a screenshot per stop. 243 tests; axe 0.
- Phase 13 Finished site review (`a01dbbf`): `components/SiteReview.tsx` on the newest passing build: chips, title, the
  site, placeholder pictures, owner-only launch tick, readiness line, Technical details, sticky bar. Not done
  (BLOCKED-ON-NICK): "Approve the site" is off (no approval record); "Ask for changes" not offered (no runner input);
  the tick is owner-only in the UI but not in the database. 248 tests; axe 0.
- Phase 14 Activity (`35a869d`, 2026-10-16): `lib/activity.ts` + `Activity()` in `pages/Activity.tsx`. Client, person and
  type filters (Everything, Decisions, Builds, Stops, Details, Team), "Save this view" (this device only: `profiles` has no
  settings column, logged), grouped by day, time · glyph · who · sentence · client. Person events through `lib/phrases.ts`
  (`personLines()`; account decisions added); factory events only from rows (proposal written, finished, stopped, round of
  fixes via `workflow.return_to_builder` + `job.run`). Build sentences link to the build page (the old list's Archived
  filter has no place in the design; logged). PMs see "Activity is for owners and admins". 265 tests (14 new in
  `pages/activity.test.tsx`; mutation-checked); axe 0 at 1440/375 light and dark. Pushed in `cf0b891`, CI `38929657403`
  green incl. Deploy Cockpit to Vercel.
- Phase 15 Costs (`1af12c7`, 2026-10-16): `Costs` in `pages/Costs.tsx` on `fetchCostRoom()` and the room helpers in
  `lib/costs.ts` (`capWeek`, `weekBlocks`, `usualRange`, `runsOfJobs`, `sumCalls`, `usd`). Headline on the live cap period
  ("Last 7 days: $X of your $20.00 cap", the same UTC days `spendCaps.ts` counts), last build cost, usual range only with 3+
  builds, six 7-day bars with a dashed cap line and a full text alternative, cost per client (run -> job -> proposal), "How
  the caps protect you" from a real build (none has hit a cap yet, said so), per-model and per-build tables only in
  Technical details with estimates labelled. "Change the caps" left out (no write path; logged). 274 tests (13 new in
  `pages/costs.test.tsx`; window mutation caught); axe 0 at 1440/375 light and dark. Pushed in `4e6c072`, CI `38934744558`
  green incl. Deploy Cockpit to Vercel.
- Phase 16 Team and access (`e5c6333`, 2026-10-16): `pages/Team.tsx` at `/team` (the pre-v2 `AccountsTab` removed;
  `/decisions/accounts` redirects). Requests approved as a role (owners choose; admins project managers only) or declined
  with a reason, through the existing `decide_account_request` rpc; people from `profiles` with role words and the clients
  each PM follows (`profile_clients`); what each role can do. Invite and per-person Change left out (no invite path, no
  role or assignment write; logged). 287 tests (13 new in `pages/team.test.tsx`; admin-role mutation caught); axe 0 at
  1440/375 light and dark, with the decline dialog open too; keyboard: Enter opens, focus on "Why", Escape returns focus.
  Pushed in `f9e9a74`, CI `38942505031` green incl. Deploy Cockpit to Vercel.
- Phase 17 Settings (`dc4b05b`, 2026-10-16): `pages/Settings.tsx` (the pre-v2 Settings in `pages/Misc.tsx` removed) and
  `lib/prefs.ts` (Home order/visibility, where the Cockpit opens, saved-view keys; Home, Work and Activity now read their
  keys from it). Searchable nav of the nine groups; Appearance edits a draft shown in a live preview (the preview carries
  its own theme, accent, density and size) with a sticky "N unsaved changes / Save / Discard" bar and Undo after saving;
  Home order, visibility and "Open the Cockpit on" (applied once per tab by `OpenOn` in `App.tsx`); saved views listed and
  deletable; keyboard from Shell's `SHORTCUTS`; Budget from `spend-caps.json` (owner/admin). Everything kept on this device
  and said so; formats, team defaults and notification channels shown as fixed (logged). Sign out kept. 303 tests (16 new
  in `pages/settings.test.tsx`; applying the draft at once fails the preview test); axe 0 for every group at 1440/375
  light and dark. Pushed in `0e78b28`, CI `38947151902` green incl. Deploy Cockpit to Vercel.
- Phase 18 Notifications (`b6a6e39`, 2026-10-19): `Tabs` in `components/kit.tsx` (a `role="tablist"` with the segmented
  look; arrows, Home and End; each tab controls its `tabpanel`); `Notifications()` in `pages/Misc.tsx`: Inbox rows as
  designed from the Home attention source (unread dot and "Unread.", chip, time, "client: title", line; seen-time key and
  event unchanged), loading, failed (`LoadError` + Try again) and empty states, PM empty state; Preferences shows only "In
  the app", "Always on" for three events, no Email/Phone checkboxes, quiet hours or digest, one wording with Settings
  (`lib/prefs.ts` `NOTIFY_LINES`). The design's spend notice is left out (Home attention is "What needs you"; logged with
  the channels in BLOCKED-ON-NICK.md). 314 tests (11 new in `pages/notifications.test.tsx`; tab role → radio and the PM
  table gate removed fail 4 tests, restore passes); typecheck and build clean, no dev code in `dist/`; axe 0 in both tabs
  at 1440/375 light and dark, and as PM; real Tab key shows the focus ring. Pushed in `0da4c79`; CI `39268206990` green incl.
  Deploy Cockpit to Vercel.
- Phase 19 cleanup and the Package 4 exit check (2026-10-19): `55e0a8a` renames the 185 pre-v2 alias uses to v2 tokens and
  deletes the `tokens.css` alias block (0 old names left; computed-style fingerprint of every element in 21 rooms identical
  before and after at 1440 light, 375 light and 1440 dark; guard test in `tokens.test.ts`, app.css now read raw in tests).
  `f76a1f6` drops Overpass sans (precache 1634.86 → 1582.33 KiB), deletes the unused pre-v2 Costs styles, keeps toasts clear
  of the Settings save bar and keeps that bar above the phone tab bar. `8bd6de1` puts plain words on the pre-v2 screens
  (DOM sweep found plan/track/job/run/entity words on the Decisions list and the build page; now clean for owner, admin and
  PM, every fake switch, stop cases 2/5/6 and a live build; no deploy or publish control) and keeps "WFACT Cockpit" in the
  rail link's name. `5589192` fixes what the keyboard-only run found: focus lost to `<body>` after Approve (ConfirmDialog)
  and after Upload/Answer (shell focus rescue), and a thrown upload failing silently (`brandUpload`). 319 tests; axe 0 in 21
  rooms at 1440/375 light and dark; Lighthouse accessibility 100 in all 16 rooms. The old icon stays (still used; no v2 mark;
  logged). Exit check PARTIALLY MET: the pre-v2 screens were cleaned, not rebuilt (PROGRESS.md lists them). Pushed in `2657fef`;
  CI `39286692404` green incl. Deploy Cockpit to Vercel.
- Phases 1–13 shipped: every push CI-green incl. Deploy Cockpit to Vercel; phase 13 `38605626110` (`47a2da4`) green incl. the deploy
  (re-checked 2026-10-15). Live URL not probed directly (held in Doppler).
- Not done: Activity, Costs, Team, Settings, Notifications preferences and the final cleanup; no Lighthouse run yet.

**Build-failure guards and the brand-colour rule (2026-10-15, filed under Step 28; `docs/BUILD-FAILURE-DIAGNOSIS.md`)**:
- Guards (`b8d240f`, pushed, `origin/main` at `626667a`): the claims gate accepts word-for-word supplied quotes (invented ones still
  need SAMPLE); a stuck breaker halts a run whose deterministic failures did not change after a revision; `wouldRepeat` refuses a
  continue with the same brief and code on a known result, with nothing spent (`repeat_refused`; `force` overrides). Evals E1–E4 in
  `packages/workflow/test/failureEvals.test.ts`, each mutation-checked. CI `38695633253` on `626667a`: green (re-checked 2026-10-15
  night).
- Brand-colour rule (`8e6e09d`, pushed: in `origin/main` at `2a64471`, CI `38706155999` green incl. the Cockpit deploy). **Decision (Huraira, 2026-10-15)**: tints and shades of the brief's colours (same
  hue mixed with white or black) are on-brief, and "only these colours" means no other hue. Buttons fill with the true accent wherever
  their text reads at 4.5:1, otherwise with a shade of that accent. The palette engines already did this (`8857819`, `d112f62`; both
  after `e2a204fb` ran). The fix is in the judges: `packages/verification/src/brandColours.ts` `BRAND_COLOUR_RULE` is quoted by the
  evaluator RUBRIC and the screenshot reviewer's system prompt. Eval E5 (4 cases) covers the following: Lanternworks yields only
  tints and shades, CTAs use `#F26B38`, and every text pair is at 4.5:1 or more; an unreadable accent falls back to a same-hue shade;
  both judges carry the rule. Five mutants turn E5 red: rule removed from either judge, CTAs always darkened, a blended hue (with or
  without the engine's refusal), and loosened `dim` contrast. Local tests: verification 116, workflow 66, frontend-loop 125,
  rendered-qa 88, jobs 34; typecheck clean in all five. No contrast or motion budget changed.
- Partly proven live: Harbor Street continue `e6a71046` (GitHub run `38711602641`, $1.22, 12 calls) ran on the deployed guards; the
  supplied-quote fix held and the stuck breaker correctly stayed off, but the run failed QA twice on contradictory owner answers
  (q2/q7, q3/q8), which led to the brief consistency check (`fd67328`, below). `caa201f1` is now `cancelled` (live SQL 2026-10-15
  night). Not yet proven live: a passing build with the brand-colour rule.
- Pre-v2 rebuild R1, the other work pages (2026-10-19, `f9d4842`): RunPage's fallback (a request that never started, a cancelled
  one, running work that is not a build, older and archived passing builds, a stop a later build fixed, the live build) now uses
  the stop/review grammar: StatusChip + title + plain lead, StepRow steps ("Not recorded" when the record has no time), checks by
  `checkLabel`/`issueLabel`, rounds of fixes as step rows, Technical details as the kit `<details>`. Placeholder pictures moved
  out of SiteReview into `usePlaceholderPictures` (same `plan_inputs` keys) and reused on older passing builds; PlaceholdersPanel
  is no longer used by RunPage. Start again / Close it / Archive / Unarchive kept working as quiet buttons; design gap logged in
  BLOCKED-ON-NICK. Found and fixed: the fallback flashed before the review while the job list loaded; "this run" and the
  builder's vendor name on screen. `pages/runpage.test.tsx` 16 (SYNTHETIC); vitest 335/335; 4 mutations caught; SiteReview,
  stop case 5 and Home computed-style fingerprints identical before and after; axe 0 in 8 rooms at 1440/375 light and dark;
  Lighthouse a11y 100 in 8 rooms. Pushed in `b88d308`; CI `39296573842` green, deployed.
- Pre-v2 rebuild R2, decided proposals (2026-10-19, `80f1391`): rejected proposals and ones approved before the kind of site
  existed show the proposal review page read-only (header, client's words, pages, open questions; shared ProposalHead and
  ProposalColumns, review DOM unchanged) with the design's decided line. "Revise from my note" (owner/admin, same re-plan,
  now behind a cost confirm; refused after two revisions with "Start a new request"; an existing revision is opened, not
  asked twice). Approved without a kind: cannot be built, one way forward. Removed: BeforeBuild, AfterDecision (with its
  unreachable build branch), PlanDetails, WhatTheClientWants (python count 3/2/2/2 → 0). `pages/decided.test.tsx` 7;
  vitest 342/342; 4 mutations caught; proposal review, needs and Home fingerprints identical; axe 0 in 3 rooms at
  1440/375 light and dark; Lighthouse a11y 100 in 3 rooms. Pushed in `dc54c3d`; CI `39301911101` green, deployed.
- Pre-v2 rebuild R3, the Decisions room and stage moves (2026-10-19, `1756b4a`): Huraira chose option (b), keep them restyled in
  the Projects grammar (logged in BLOCKED-ON-NICK: the design has no frame). Title and summary sentence, pill links
  (`aria-current`), titled groups of rows with a StatusChip; StageMove unchanged; D3 kept (never a move into Launch). Found and
  fixed: PMs were offered "Move to …" and an Accounts link that RLS refuses. `pages/decisions.test.tsx` 6; vitest 348/348;
  4 mutations caught (one survived at first: Proposals marked current on stage moves; the test was strengthened); Projects,
  the client's page, Activity and Home fingerprints identical; axe 0 on both pages at 1440/375 light and dark, and as admin
  and PM; Lighthouse a11y 100 on both. Pushed in `20ee51f`; CI `39306953117` green, deployed.
- Pre-v2 rebuild R4, fix rounds (2026-10-20, `1a89421`): Huraira chose option (b), keep them as an Activity filter (logged in
  BLOCKED-ON-NICK). "Fix rounds" pill; each `correction_rounds` row is an Activity line (`lib/activity.ts` roundLines), who found
  and fixed it in plain words (`lib/phrases.ts` roundActor; live rows record model and vendor names, which the old page printed
  raw). `/activity/fixes` and `/runs` open Activity on that filter; old FixRounds page, ActivityTabs, fetchRounds removed. PMs
  still cannot reach Activity. `pages/fixrounds.test.tsx` 4; vitest 352/352; 3 mutations caught; Home and client page
  fingerprints identical; axe 0 at 1440/375 light and dark, admin and PM; Lighthouse a11y 100. Pushed in `6171bbc`; CI `39312285044` green in all 18 jobs, deployed.
- Pre-v2 rebuild R5, deletions and the exit check (2026-10-20, `f260cdc`): RecoveryPanel with its dev harness and BuildTimeline,
  PlaceholdersPanel, Home's old helpers, PageHead, Aspect, Empty, RouteLine deleted (python counts → 0); 146 unused CSS selectors
  and two keyframes removed; NotFound in the soon-page grammar. vitest 354/354; fingerprints identical in 40 of 43 room×size pairs
  (404 by design; Notifications varies with clock times on the same code); axe 0 in 23 rooms; Lighthouse a11y 100 on the 404.
  Package 4 exit check re-run: PARTIALLY MET, only because `ClientNeedsPanel` is still a pre-v2 panel (PROGRESS.md has it item by
  item). CI `39473603079` on `8a42721` green in all 18 jobs, Cockpit deployed (recorded 2026-10-23).
- Also done for this step, not cited before (found in git 2026-10-15 sync): `a6f64cd` (2026-10-14, pushed) the Cockpit's "What was
  built" shows the built site itself (pages, styles, fonts, logo via signed links, page switcher; links caught in the sandboxed
  frame) instead of a file list, and advisory findings show as non-blocking notes (`verification.decision` rows flag advisory);
  `apps/cockpit/src/lib/sitePreview.ts` + 57-line test. `dde68a5` (2026-10-15, pushed since; Edge Function deployed and
  curl-checked) `dispatch-job` v6 allows the `wfact-3-cockpit.vercel.app` alias, whose presses were CORS-refused (why `caa201f1`
  and the first `e6a71046` press stayed queued).

**Next action** (2026-10-20, after pre-v2 rebuild R5): Huraira reviews the R5 report and the Package 4 exit check (PARTIALLY MET:
one pre-v2 panel left, `ClientNeedsPanel`) and decides: rebuild that panel in the v2 grammar, or accept it and give a separate GO for
Package 5 (paid; the stop questions in `docs/design/cockpit-v2/docs/COCKPIT-V2-PHASES-18-ON-PROMPT.md` come first). Still open:
Harbor Street's owner answers and continue; migration 0024 (`562c5ae`) and its attack test wait on Huraira; Nick's Cockpit v2
questions in BLOCKED-ON-NICK.

Agent prompt for rebuilding the pre-v2 screens (phases R1–R5, one per GO; R3 Decisions room and R4 fix rounds start with a question, since the design has no frame for them) — written 2026-10-19: `docs/design/cockpit-v2/docs/COCKPIT-V2-PRE-V2-REBUILD-PROMPT.md`.

Full agent prompt for phases 18–19 and Package 5 — written 2026-10-19: `docs/design/cockpit-v2/docs/COCKPIT-V2-PHASES-18-ON-PROMPT.md` (state after phase 17 with SHAs and CI ids, the measured facts phases 18–19 depend on, verification and push routine, and the Package 5 stop questions). Paste that file's block into a new session; the short block below stays as the summary.

Continuation prompt — updated 2026-10-19, after phase 19 (Step 28 Package 4, use this instead of starting the Cockpit v2 rebuild again):
```
You are a senior front-end engineer in the WFACT 3.0 monorepo, branch huraira-work. Read CLAUDE.md, then
docs/design/cockpit-v2/docs/COCKPIT-V2-BUILD-PROMPT.md (the full brief: hard rules, locked decisions, tokens,
components, shell, path.ts, every screen, verification). The design in docs/design/cockpit-v2/ is LOCKED: build it
faithfully, do not restyle, rename or simplify. A conflict with the code or database goes into BLOCKED-ON-NICK.md;
never guess. UI only: do not touch RLS, migrations, job runners or packages/*. One phase at a time, report, wait for GO.

ALREADY DONE (do not redo):
- Phase 1 tokens, 4a50b22: tokens.css v2, lib/appearance.ts, Newsreader, src/styles/tokens.test.ts (contrast proof).
- Phase 2 components, a8fa3cf: components/kit.tsx, components/flow.tsx, components/CommandPalette.tsx, v2 ConfirmDialog
  and SitePreview in components/ui.tsx, toast with Undo in lib/state.tsx, lib/detail.tsx, costLine() in lib/costs.ts,
  components/v2.test.tsx; dev gallery apps/cockpit/dev-components.html (?axe=1&theme=dark, window.__runAxe()).
- Phase 3 shell, 8532f4e: shell/Shell.tsx (rail, top bar, phone header, tab bar, palette items, keys, shortcuts sheet),
  Notifications inbox and More in pages/Misc.tsx, useNotifications() in lib/state.tsx, /team and /notifications routes,
  DetailProvider in App.tsx, shell/shell.test.tsx. Dev: COCKPIT_FAKE_DB=1 (launch config cockpit-fake) serves the synthetic
  fake so signed-in rooms can be screenshotted and axe-checked (inject /node_modules/axe-core/axe.min.js).
- Logged for Nick: caps conflict (design $2.00/build, $20/month, new builds only; live spend-caps.json $5/build,
  $20 per rolling 7 days, every call). Until he decides, every money line uses costLine()/buildStopLine(), never a figure.
- Logged for Nick, then Huraira: role conflicts. The UI follows RLS: no Activity for PMs, no Costs for admins, no PM cost line.
- The transitional alias block in tokens.css stays until the last pre-v2 page is rebuilt (phase 9); then delete it.
- Phase 4 path, fd020a5: src/lib/path.ts derivePath() / stripSteps() / fixLabel() / latestBuild() / knownNeeds(), tests in
  src/lib/path.test.ts. Every screen reads the step, sentence, next line and next action from it; never re-derive them.
- Logged: no place records a site approval yet; pass siteApprovedAt null until it exists (needed by phase 9).
- Phase 5 Home, 00ec210: pages/Home.tsx; lib/clients.ts (clientsOf: one list of clients with their path); lib/attention.ts
  rebuilt on it (groups stopped / approval / details, design words); FactoryProvider exposes clients, projects and decider.
  Next screens read useFactory().clients and .attention; never re-derive.
- Phase 6 Projects: default export Projects in pages/Work.tsx. Phase 7 New request: NewRequest in pages/Work.tsx
  Large buttons use size="page" -> class btn-page (never "page"). Phase 8 the client's page: ProjectPage in pages/Work.tsx
  (fd7a08a); lib/phrases.ts translates audit actions (reuse it in Activity). Phase 9 Proposal review: ProposalReview in
  pages/Decisions.tsx (pending only). Phase 10: NeedsScreen in pages/Decisions.tsx (5a96bb2) for approved proposals with a kind
  of site; rejected and pre-track proposals still use the pre-v2 AfterDecision.
- Phase 11 Live build, 99ba999: components/LiveBuild.tsx on RunPage (ten rows mapped from deriveTimeline; steps the run does
  not record say "Not recorded"). Not done: Spent so far, the phone toggle (no push channel).
- Phase 12 Stopped build, a94eb6f: components/StoppedBuild.tsx + lib/stopCases.ts (8 cases from diagnoseJob(); every paid
  move confirms its cost), pages/stopped.test.tsx. Dev: ?fake-stop=2|5|6. RecoveryPanel is no longer used by RunPage.
- Phase 13 Finished site review, a01dbbf: components/SiteReview.tsx on the newest passing build waiting for approval;
  Approve the site shown off (no approval record), Ask for changes not offered (no runner input), pages/review.test.tsx.
  Dev: ?fake-ph=1.
- Phase 14 Activity, 35a869d: lib/activity.ts (factoryLines, teamLines, byDay, matches) and Activity() in pages/Activity.tsx;
  lib/phrases.ts personLines() is the one phrase table (phrase() wraps it; account.approved/rejected added).
  Saved view: localStorage per person, said on screen ("Saved on this device"), logged. pages/activity.test.tsx.
  Dev: ?fake-activity=1.
- Phase 15 Costs, 1af12c7: pages/Costs.tsx on fetchCostRoom(); lib/costs.ts room helpers (capWeek, weekBlocks, usualRange,
  runsOfJobs, sumCalls, usd, stepOf). Live cap period words only; "Change the caps" left out (logged). pages/costs.test.tsx.
  Dev: ?fake-costs=1.
- Phase 16 Team and access, e5c6333: pages/Team.tsx (decide_account_request rpc; profiles + profile_clients read only);
  invite and Change left out (logged). pages/team.test.tsx. Dev: ?fake-team=1.
- Phase 17 Settings, dc4b05b: pages/Settings.tsx; lib/prefs.ts (device-only preferences); OpenOn in App.tsx; SHORTCUTS
  exported from shell/Shell.tsx. Everything on this device (logged). pages/settings.test.tsx. Note: the design's segmented control is 38 px (inside a 46 px track), under the brief's 44 px rule.
- Phase 18 Notifications, b6a6e39: Tabs (tablist) in components/kit.tsx; Notifications() in pages/Misc.tsx; NOTIFY_LINES in
  lib/prefs.ts (one wording with Settings); only the Cockpit channel shown; spend notice left out (logged).
  pages/notifications.test.tsx.
- Phase 19 cleanup, 55e0a8a f76a1f6 8bd6de1 5589192: tokens.css alias block gone (guard test in tokens.test.ts); Overpass sans
  removed; plain words on the pre-v2 screens; shell focus rescue in Shell.tsx and ConfirmDialog; brandUpload never throws.
  Dev: ?fake-live=1 (a running build), ?fake-logo=1 (logo on file for the approved proposal).
- Pre-v2 rebuild R1, f9d4842: RunPage fallback in the v2 grammar (pages/Activity.tsx chipOf/simpleSteps/Results);
  usePlaceholderPictures + PlaceholderPicturesSection exported from components/SiteReview.tsx; pages/runpage.test.tsx.
  Dev: ?fake-job=intake|ask|cancelled|archived|old.
- Pre-v2 rebuild R2, 80f1391: DecidedProposal in pages/Decisions.tsx (ProposalHead/ProposalColumns shared with
  ProposalReview); BeforeBuild, AfterDecision, PlanDetails, WhatTheClientWants deleted; pages/decided.test.tsx.
  Dev: ?fake-plan=rejected|rejected2|nokind.
- Pre-v2 rebuild R3, 1756b4a (Huraira chose option b): PlansTab and StagesTab in pages/Decisions.tsx in the Projects
  grammar (DecisionsHead, DecisionList); StageMove unchanged; PMs get no stage move or Accounts link; pages/decisions.test.tsx.
- Pre-v2 rebuild R4, 1a89421 (Huraira chose option b): fix rounds as the Activity "Fix rounds" filter (fetchCorrectionRounds,
  roundLines in lib/activity.ts; roundActor in lib/phrases.ts); /activity/fixes renders Activity type="round"; FixRounds page gone;
  pages/fixrounds.test.tsx. Dev: ?fake-rounds=1.
- Pre-v2 rebuild R5, f260cdc: RecoveryPanel, src/dev/TimelineHarness.tsx, dev-timeline.html, components/BuildTimeline.tsx,
  PlaceholdersPanel, Home's old helpers, ui.tsx PageHead/Aspect/Empty/RouteLine and 146 unused CSS selectors deleted; NotFound in
  the soon-page grammar (pages/notfound.test.tsx). Plate stays for ClientNeedsPanel.
- Not UI (side session, branch claude/objective-engelbart-d65df7, 562c5ae): migration 0024 makes launch.placeholders_ok
  owner-only in the database; not merged, not applied. Leave it to Huraira.
- Not UI, already done (do not touch): dispatch-job v6 dde68a5 (Cockpit alias allowed); a6f64cd "What was built" site
  preview (lib/sitePreview.ts, reuse it, do not rebuild it); build-failure guards b8d240f (claims gate, stuck breaker, wouldRepeat) and the
  brand-colour rule 8e6e09d (packages/verification/src/brandColours.ts, evals E1-E5 in packages/workflow/test/failureEvals.test.ts).
  Phases 1-19 are CI-green and deployed (phase 13: CI 38605626110; 14: 38929657403; 15: 38934744558; 16: 38942505031;
  17: 38947151902; 18: 39268206990; 19: 39286692404).

LEFT (Package 4 exit check PARTIALLY MET; each item only on Huraira's GO):
- Only on Huraira's GO: rebuild ClientNeedsPanel (components/Recovery.tsx; a titled Plate with DetailsForm, shown on a passing
  build whose result lists needsFromClient) in the v2 grammar, then re-run the exit check. R1–R5 are done.
- Package 5 (paid): separate GO naming the spend; stop questions first.
Each screen with empty, loading, running, waiting, stopped and success states; owner-only gates; PM view.
Every phase: npm test green; screenshots at 1440x900 and 375x812, light and dark, beside the matching frame in
Cockpit Screens*.dc.html; axe 0 per room; at 375 px scrollWidth === 375; banned-word grep of the DOM outside <details>;
no element labelled deploy or publish. Waiting step rows stay dimmed by colour (opacity failed contrast).

EXIT CHECK (Package 4): every room rebuilt to the locked design, axe 0 and Lighthouse a11y >= 95 per room, keyboard-only
main flow (new request, approve proposal, logo and a picture, build, stop and fix, ready, approve), PROGRESS.md updated
with evidence.
```

### STEP 27 — Track A motion budget (P0, added 2026-10-07, decision D1) — NOT STARTED

**Depends on**: Step 4B M4 closed; Step 26 item 3 (reference set) preferred.
**Maps to**: Decision D1; `docs/FRONTEND-UPGRADE-DESIGN.md` (Track A).

**MVP scope under D3 (2026-10-12)**: only the motion budget the Bennett & Co build needs, plus the seeded-violation check (task items 1–3).
The blind-rating sheet (item 4) is made only if Nick wants it. **Next action**: send the one-page design in task item 1 to Huraira for GO.
It can start now, since nothing it needs is blocked. If Bennett's track is picked as Track B, this step waits until after the MVP.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules in
docs/WFACT-3.0-Factory-Completion-Plan.md Part C, including the design-quality rule and the skills it names. Do ONLY Step 27.

CONTEXT
Huraira decided (2026-10-07): keep Track A (local business, static multi-page) and Track B (Next.js, full motion). Nick found delivered
sites visually flat. Track A gets a motion budget; conversion is a hard gate. E-commerce is out of scope.

TASK
1. Before building: read packages/frontend-loop starters and docs/FRONTEND-UPGRADE-DESIGN.md. Note that 21st.dev components are React and
   Track A is static HTML; state which patterns you port or restyle and which you skip. Send a one-page design and WAIT for GO.
2. After GO, implement the motion budget in the Track A starter: scroll reveals, hover/press states, a considered hero, sticky CTA,
   all CSS or vanilla JS, no framework scripts, prefers-reduced-motion respected, no layout shift.
3. Add rulebook items and checks so motion cannot fail conversion: LCP and CLS thresholds unchanged, CTA visible above the fold, no
   motion on first paint blocking content. A seeded violation must fail verification.
4. Build one brief on both tracks and prepare a blind rating sheet for Nick (labels hidden, short rubric, includes a conversion question).
5. Do not change Track B beyond what is needed to share the rulebook.

ACCEPTANCE
- Existing suites pass unchanged; rendered QA passes on the richer Track A; seeded motion violation fails.
- Blind-rating sheet delivered; result recorded in docs. Nick's rating confirms or reopens D1.

REPORT in the Part C format, then STOP.
```

---

### Closed steps

DONE and verified with citable evidence, ordered by step number. Moved here on 2026-10-12 by `/progress-sync`. Headings are unchanged so references and `scripts/check-trackers.mjs` still resolve. Their long prompts stay archived (`docs/archive/2026-10-07-alignment/WFACT-3.0-Factory-Completion-Plan.pre-realignment.md`). A step that regresses moves back up with a note.

---

### STEP 1 — Fix Cockpit → GitHub dispatch (P0) — DONE 2026-09-30

**Status: DONE.** Dispatch worked end to end: job `b952aaba` ran as `cockpit-job.yml` run `36455639903`; the browser leg was proven
live on 2026-09-30 (job `1dd90f25`, dispatched 8 s after the click); the failure path was proven by job `e5d29358`. Open
housekeeping: two orphaned `queued` jobs (`a2a41d2d`, `cbf8bf7b`) await Huraira's OK to close. (2026-10-12: the live `jobs` table has 0 queued or running rows, so they are no longer open.) The prompt is kept for the record.

**Depends on**: none.
**Maps to**: Cockpit jobs (unplanned work), Blueprint §14 headless runs; unblocks Steps 2–4.

*The original agent prompt for this step is retired from the live plan (step closed). It is preserved in `docs/archive/2026-10-07-alignment/WFACT-3.0-Factory-Completion-Plan.pre-realignment.md`.*

---

### STEP 2 — Write the pilot brief and business rules (P0) — DONE 2026-09-30 (provisional inputs)

**Status: DONE** (`2c188d0`). `memory/context.md` has concrete provisional rules and a 13-row register (R-01…R-13);
`clients/summit-line-roofing/` holds the synthetic brief, raw request and memory. Nick's real brief and rules session remain open
in `BLOCKED-ON-NICK.md` (Step 22). The prompt is kept for the record.

**Depends on**: none (can run in parallel with Step 1).
**Maps to**: Continuation Stage 7 prerequisites; Blueprint §8 context.md; Phase 2.

*The original agent prompt for this step is retired from the live plan (step closed). It is preserved in `docs/archive/2026-10-07-alignment/WFACT-3.0-Factory-Completion-Plan.pre-realignment.md`.*

---

### STEP 3 — Retire plaintext secrets (P0, Huraira acts, agent verifies) — DONE 2026-09-30

**Status: DONE** (`f74b0bc`). Both `.env.local` files deleted, grep criterion passes, keys rotated and working from Doppler,
CI deploys with the rotated keys (`main` runs `36698432470`, `36699308136`). Per this step's own acceptance, the old leaked CLI token
is **listed as not verified** (a fresh CLI login exists; confirm in the Doppler dashboard). The prompt is kept for the record.

**Depends on**: none.
**Maps to**: Continuation Stage 1 criterion 3; Blueprint §3 security.

*The original agent prompt for this step is retired from the live plan (step closed). It is preserved in `docs/archive/2026-10-07-alignment/WFACT-3.0-Factory-Completion-Plan.pre-realignment.md`.*

---

### STEP 3A — Password sign-in and approval-gated accounts (P0, added 2026-09-30) — DONE 2026-09-30, verified live 2026-10-15

**Status: DONE** (`2223344`, `856e483`; CI `36698432470`, `36699308136`). Migration `0010_account_requests`: a sign-up creates a pending
request and no profile, so it sees nothing until approved; owners approve any role, admins only `pm`; every decision audited; the
older policy that let an admin promote themselves to owner was replaced with owner-only profile writes. Cockpit: password sign-in,
"Create an account", "Forgot password?" and choose-new-password screens, magic link kept for existing accounts only, and an Account
requests panel in Approvals.

**Verified live 2026-10-15** (read-only SQL and Auth logs on `mcaxxhgjptwowwrluhra`): Huraira's test account
(user `60114a00`) signed up 11:13:33 UTC → `account_requests` row `pending`, no profile → approved by an owner as `pm` at 11:14:32
(`audit_log` `account.approved` `4ffd872c`, actor = decider, `decider_role` owner) → `profiles` row `pm` created at that same instant.
Auth logs: `/logout` 11:16:27, then a password sign-in (`/token`, `grant_type=password`) 11:16:33, after approval. Role view measured
under RLS as that user: profiles 1 of 2, account_requests 1 of 1, jobs 0 of 34, clients 0 of 2, audit_log 0 of 700, model_traces 0 of 177,
plan_approvals 0 of 8 (a `pm` sees only assigned clients and no jobs: `clients_select`, `jobs_select`). `scripts/rls_attack_test_accounts.sql`
re-run in a rolled-back transaction: 32/32, 0 leftover test users.
**Noted, not a step gap**: Supabase email confirmation is off in the live project (email confirmed 35 ms after sign-up, `immediate_login_after_signup`);
the approval gate still holds (no profile, so no data, until approved). Huraira decided 2026-10-15: leave confirmation off; the approval gate is enough.

*The original agent prompt for this step is retired from the live plan (step closed). It is preserved in `docs/archive/2026-10-07-alignment/WFACT-3.0-Factory-Completion-Plan.pre-realignment.md`.*

---

### STEP 4D — Build recovery: why a build stopped, and carry on from where it left off (P0, added 2026-10-07) — DONE 2026-10-14, exit check met live (`63278e56`, `e2a204fb`, `55ddba7c`)

**Status: DONE** (closed 2026-10-14 by `/progress-sync`). Design: `docs/BUILD-RECOVERY-DESIGN.md`. Code `a3198d8`…`a643d2d` (reopen, seven-bucket
diagnosis, details form on append-only `plan_inputs`, bounded reviewer retry, `job.run` link, one-active-build guard), extended 2026-10-14 in
`8b3caed`/`9597103` (continue from a chosen step `fromStep` qa/revise/rebuild, readiness check before any paid step, live step timeline).
Migration 0018 applied live (attack 26/26); CI `37644039022` and `38554457540` green incl. deploy.
**Exit check** — *"a build that stopped (failed checks, outage, missing facts) continues from its saved site in one press; missing facts are asked in
plain words and reach the builder as sourced facts; nothing is invented; nothing publishes."* — **MET live** (SQL-checked 2026-10-14):
- Outage/crash: Summit `63278e56` (run `2dcaacfa`, reopen, reviewer calls only, saved site reused); Lanternworks `e2a204fb` (run `4c35703b`, review first, real verdict).
- Failed checks plus missing facts: Huraira filled the details form (8 `plan_inputs` rows, 2026-10-14 11:13 UTC: phone, email, address, live address,
  the logo, 3 skips) and pressed "Fix and continue". Job `55ddba7c` wrote a reopen whose brief carries the facts as `ownerFacts`; the built
  `content/site.json` has phone, email and location with `source: "brief"` (not SAMPLE); the run reached the launch gate (verified `4e4434db…`).
- Nothing published: every run ends at the hard launch gate or a halt.
**Still not covered (by design, recorded)**: closing a stale `running` row from the Cockpit; saving approved content before the site build.

*The original agent prompt for this step is archived (`docs/archive/2026-10-07-alignment/WFACT-3.0-Factory-Completion-Plan.pre-realignment.md`); the
last continuation prompt was retired at close.*

---

### STEP 5 — Stage 6: Documentation agent and episodic memory (P1) — DONE 2026-10-07

**Status: DONE** (parallel worktree, GO 2026-10-07; `08fc069`…`530f4cb`, merged; proven on live Cockpit builds `ad49df57` and `c775c396`). `packages/documentation` writes one versioned, append-only episodic entry per stage from the run's audit rows (no model, $0 ceiling, scope-gated to the bound client); Hermes-lite answers "what happened" from those entries. Proven: in-process full workflow test, live backfill of 26 entries (SQL-matched), live `npm run ask` answer checked against SQL. Live: Cockpit job `c775c396` (3 cycles) got one entry per build and QA stage (6 `documentation.entry` rows), job `ad49df57` one for its halted build stage; CI `documentation` job green since `37614606732`.

**Depends on**: Step 4.
**Maps to**: Continuation Stage 6; Blueprint §8, §16D (Documentation agent).

*The original agent prompt for this step is retired from the live plan (step closed). It is preserved in `docs/archive/2026-10-07-alignment/WFACT-3.0-Factory-Completion-Plan.pre-realignment.md`.*

---

### STEP 6 — Enforce agent permissions (P1) — DONE 2026-10-06, CI green 2026-10-07

**Status: DONE** (parallel worktree, approved by Huraira 2026-10-06; `58bf776`…`ee08f9d`, merged into `huraira-work`). Typed, versioned, default-deny scopes enforced in `packages/agent-runtime/src/permissions.ts`; live attack run 2026-10-06 13:02 UTC denied and audited all four out-of-scope cases (7 `agent.deny` rows, re-counted independently by SQL); the real models did not obey an injected request. NOT COVERED (see `docs/AGENT-PERMISSIONS.md`): network egress outside the Track B sandbox, shared runner credentials, ungated local CLIs.

**Depends on**: Step 4 (Step 5 preferred).
**Maps to**: Blueprint §3 (tool calling, security/permissions), §12; Phase 5 note "Section 12 must land before this phase closes".

*The original agent prompt for this step is retired from the live plan (step closed). It is preserved in `docs/archive/2026-10-07-alignment/WFACT-3.0-Factory-Completion-Plan.pre-realignment.md`.*

---

### STEP 7 — Expand the evaluation registry (P1) — DONE 2026-10-07, CI green

**Status: DONE** (parallel worktree, GO 2026-10-07; `64222b1`…`0e13e30`, merged `c1e511a`). Registry v1.0.0 as data + code: 48 checks, each with a passing and a failing fixture, severity/stage gate, cost per check; one gate for every QA entry point; builder/evaluator model-family separation enforced by `config/evaluator.json` (+ OpenAI adapter, migration 0017 applied); QA-runner SSRF closed. Gaps stated, not hidden: the full 78-check list and 50-point audit are not in this repo (only summaries survive; recorded in the registry's `sourceInventory`/`notCovered`), model-judged checks proven on mocks, the OpenAI evaluator has no live success (no credits).

**Depends on**: Step 4.
**Maps to**: Blueprint §14 (Evaluation Registry), Phase 8, §16C "highest priority", goal 3.

*The original agent prompt for this step is retired from the live plan (step closed). It is preserved in `docs/archive/2026-10-07-alignment/WFACT-3.0-Factory-Completion-Plan.pre-realignment.md`.*

---

### STEP 21 — Housekeeping (P2) — DONE 2026-10-20, every sub-item A–L done or decided; CI `39304787144` green

**Status: DONE.** Two rounds on 2026-10-19. Round 1 (`ac314ae`..`f490904`; CI `39299701250` green): A (done 2026-10-07); B decision record
`docs/NPM-WORKSPACES-DECISION.md` (keep `file:` links); C section aliases pinned by a test; E graph 0 dangling edges; G INDEX; I open
questions only in `content.json`; L dead path fixed (hooks archived in `e11c1ea`); D runtime part (QA CLI and `job.run` carry the entity);
H `media`, `dispatch-job` and `check-trackers` in CI; J `permissionsAttack.ts` to `jobs/scripts/`. Round 2 (`32cfa80`..`fb6f922`, after
Huraira's answers; CI `39304787144` on `37f99c7` green in all 18 jobs incl. the Cockpit deploy): D migration `0027_audit_entity_fill`
(live 20261019182532; attack test 12/12 live, 5/12 without it; real job `ffcce674` wrote its job rows with `bennett-co`); H `rls-attack` CI
job replays every migration on a throwaway local database and runs every machine-checked attack script (CI: 26 migrations, 10 scripts PASS,
2 live-only checks NOT COVERED there, both pass live); J one shared mock model double; K migration `0028_entity_aliases` (live
20261019183408, `bennett-co` row and aliases, 10/10 live), `KNOWN_ENTITIES` removed, no entity-as-folder read; F left as is (Huraira);
I/M5 every launch-file check passes on live run `4c35703b`'s checkpoint-verified output (SYNTHETIC client). Detail: PROGRESS.md Step 21.
Not covered: a Cockpit job on the new runner code (first one after `37f99c7` will read the entity table); old audit rows keep null entity.

**Depends on**: none (best after Step 4).
**Maps to**: Continuation "Gaps noticed" list.

*The step's agent prompts are retired from the live plan (step closed); the last version is in git history at `37f99c7`.*

---

## Part E — Progress checklist (update as steps close)

| # | Step | Status | Reported | Approved by Huraira |
|---|---|---|---|---|
| 1 | Fix Cockpit → GitHub dispatch | **DONE** (job `b952aaba`, run `36455639903`; browser leg job `1dd90f25`) | 2026-09-30 | yes |
| 2 | Pilot brief and business rules | **DONE**, provisional inputs (`2c188d0`) | 2026-09-30 | yes |
| 3 | Retire plaintext secrets | **DONE** (`f74b0bc`); old CLI token listed as not verified, per the step's acceptance | 2026-09-30 | yes |
| 3A | Password sign-in and approval-gated accounts | **DONE** (`2223344`, `856e483`); verified live 2026-10-15: test account signed up, owner-approved as `pm` (audit `4ffd872c`), signed in with password after approval (Auth logs 11:16:33 UTC), RLS view limited to own rows, attack test 32/32; moved to Closed steps | 2026-09-30 | yes |
| 4 | Full run on the pilot brief | **PARTIAL**: built and QA-approved (job `81c8607b`), human review found defects; preview superseded by Step 4B M6 | 2026-09-30 | |
| 4B | Front-end upgrade: two build tracks | **IN PROGRESS**: design approved; M0 6 of 7 inputs decided; M1, M2 and M3 done; M4 partial: Track B live pass 2026-10-14 (Lanternworks `55ddba7c`, SYNTHETIC, launch gate), human screenshot review pending, Track A continue of `63278e56` pending; M5 groundwork `4bbd4bc` (live run blocked: no Higgsfield credits); M6 not started (D3) | 2026-10-14 | 2026-10-01 (design) |
| 4C | Cockpit UI/UX redesign | **BUILT AND DEPLOYED** (`e76cff2`, CI `36905237284`; redeploy `fb08be3`, CI `36907274448`): new IA and design system, every room migrated, migration 0013 (cancel stuck jobs, 17/17 attack test), 23 tests, axe 0 / Lighthouse a11y 100 on every room; live signed-in check pending Huraira | 2026-10-01 | 2026-10-01 (Phase 1 + D1–D8) |
| 4D | Build recovery | **DONE** (exit check met live 2026-10-14: continues `63278e56`, `e2a204fb`, `55ddba7c`; owner details reached the builder as `source: "brief"` facts; nothing published; code `a3198d8`…`a643d2d`, `8b3caed`, `9597103`; CI `38554457540`) | 2026-10-14 | |
| 5 | Documentation agent | **DONE** (`08fc069`…`530f4cb`; live Cockpit builds `c775c396` 6 entries / 6 stages and `ad49df57` 1 / 1; backfill 26 = 26 rows; live ask SQL-checked; CI `37614606732`) | 2026-10-07 | |
| 6 | Enforce agent permissions | **DONE** (`58bf776`…`ee08f9d`; 285 package tests + rendered-qa pass on the merged tree; live attack runs `050c3329`, `ed07cfaf`, `cb7739a2`, `7197fa12`, `9a692a2d`, 7 `agent.deny` rows verified by SQL; CI `37609559746` green; cost ceilings set from live traces 2026-10-07: builder $1, QA $0.50, Planner $0.25, Direction $0.15, Hermes $0.10, Intake $0.05) | 2026-10-06 | |
| 7 | Evaluation registry | **DONE** (`64222b1`…`0e13e30`, merged `c1e511a`; merged tree verification 98, rendered-qa 52 and all packages pass; migration 0017 applied live; CI `37617845669` green; 78-check and 50-point sources missing from the repo, OpenAI evaluator unproven live) | 2026-10-07 | |
| 8 | Queue and durable execution | not started | | |
| 9 | Cockpit: status and System room | not started | | |
| 10 | Cockpit: Agents and Workflows | not started | | |
| 11 | Model routing and second model | not started | | |
| 12 | Cost governance per client | **PARTIAL** (MVP M6 slice `2223856`, CI `38433400406` green incl. Cockpit deploy, migration 0020 live; caps ON $5/build and $20/week (Nick approved 2026-10-13); live `estimated` and reviewer trace rows proven on run `4c35703b` 2026-10-14; Run page check and a live cap refusal pending) | 2026-10-14 | |
| 13 | Remaining core agents (A–E) | not started | | |
| 14 | Cockpit: Memory and Human Control | not started | | |
| 15 | Cognee trial write-up | not started | | |
| 16 | Tool-call tracing | not started | | |
| 17 | Alerts and role-based views | not started | | |
| 18 | Three-concurrent-clients test | not started | | |
| 19 | Disaster-recovery drill | not started | | |
| 20 | Vercel serverless ceiling | not started | | |
| 21 | Housekeeping | **DONE** (every sub-item A–L done or decided; round 1 CI `39299701250`, round 2 CI `39304787144` green in all 18 jobs; migrations 0027/0028 live and attack-tested 12/12, 10/10; RLS runs in CI; M5 launch files proven on live run `4c35703b`) | 2026-10-20 | |
| 22 | Nick's items | not started | | |
| 23 | Product features (A–E) | not started | | |
| 24 | Advanced autonomy and optimization (A–C) | not started | | |
| 25 | Real-client proof run | **PARTIAL** (MVP M4 contact form MET live on synthetic data: migrations 0025/0026 applied (20261015102916, 20261015103026), attack test 43/43, `submit-lead` v1 deployed, 4 browser submits (JS and no-JS, both tracks) = 4 `leads` rows, curl refusals as designed; code `1da9a5a`..`2154fda`, pushed (first green CI containing it `38924123492` on `6e31172`, 2026-10-16; noted 2026-10-23); the real-client run still waits on Nick's brief) | 2026-10-15 | |
| 26 | Quality calibration | **PARTIAL**: item 1 met live 2026-10-14 (`67033f7`; Anthropic reviewer and evaluator rows on run `4c35703b`; build `55ddba7c` reached the launch gate; CI `38554457540` green); items 2–4 (blind calibration, reference set, cost report) open, after the MVP | 2026-10-14 | |
| 27 | Track A motion budget | not started | | |
| 28 | Build quality and Cockpit plain-language UX | **IN PROGRESS** (2026-10-15: Packages 1–3 built, verified and deployed (`3e493f6` CI `38569635936`, `d112f62` CI `38574380444`, `7e30b09` CI `38585878100`; migrations 0022 and 0023 live). Package 4 Cockpit v2 phases 1–13 CI-green and deployed (last `38605626110` on `47a2da4`); phase 14 Activity `35a869d` (CI `38929657403` green, deployed); phase 15 Costs `1af12c7` (CI `38934744558` green, deployed); phase 16 Team and access `e5c6333` (CI `38942505031` green, deployed); phase 17 Settings `dc4b05b` (CI `38947151902` green, deployed); phase 18 Notifications `b6a6e39` (CI `39268206990` green, deployed); phase 19 cleanup `55e0a8a`..`5589192` (2026-10-19, vitest 319/319, axe 0 in 21 rooms, Lighthouse a11y 100 in 16 rooms, keyboard main flow on the fake; CI `39286692404` green, deployed); pre-v2 rebuild R1, the other work pages, `f9d4842` (2026-10-19, vitest 335/335, axe 0 and Lighthouse a11y 100 in 8 rooms; CI `39296573842` green, deployed); R2, decided proposals, `80f1391` (2026-10-19, vitest 342/342, axe 0 and Lighthouse a11y 100 in 3 rooms; CI `39301911101` green, deployed); R3, the Decisions room kept (option b), `1756b4a` (2026-10-19, vitest 348/348, axe 0 and Lighthouse a11y 100 on both pages; CI `39306953117` green, deployed); R4, fix rounds as an Activity filter (option b), `1a89421` (2026-10-20, vitest 352/352, axe 0 and Lighthouse a11y 100; CI `39312285044` green, deployed); R5, deletions and NotFound, `f260cdc` (2026-10-20, vitest 354/354, axe 0 in 23 rooms, fingerprints unchanged; Package 4 exit check re-run PARTIALLY MET, only `ClientNeedsPanel` left; CI `39473603079` green, deployed); Package 4 exit check PARTIALLY MET (pre-v2 rebuild R1–R5 done; `ClientNeedsPanel` left). Build-failure guards `b8d240f` and brand-colour rule `8e6e09d` pushed (CI `38695633253`, `38706155999` green; decision by Huraira 2026-10-15; eval E5 mutation-checked); live continue `e6a71046` proved the quote fix and failed on contradictory owner answers; a passing live build is still pending. Also `a6f64cd` ("What was built" site preview, pushed) and `dde68a5` (`dispatch-job` v6, deployed, pushed). Migration 0024 written on the unmerged branch `claude/objective-engelbart-d65df7`, not applied. Brief consistency check `fd67328` (contradictory owner answers halt at preflight unpaid, owner's pick clears it, planner asks each topic once; eval E6 mutation-checked) and example clients `52f7088` (`docs/EXAMPLE-CLIENTS.md`), pushed, live proof pending. Package 5 open) | 2026-10-23 | |

**Goal tracker (Blueprint §16K)**

| # | Goal | Status | Closed by |
|---|---|---|---|
| 1 | One real client, fewer than 40 corrections | open (synthetic run done in Step 4: 2 change rounds, not comparable; comparable output needs Step 4B; real brief after Step 22) | 4B, 25, 22 |
| 2 | Three concurrent clients | open | 18 |
| 3 | 50-point audit and registry re-run | partial (Step 7: 48-check registry re-run on the Step 4 page with a per-check table; the 78-check and 50-point source lists are not in this repo) | 7, 26, 19 |
| 4 | Real cost per client | partial | 12 |
| 5 | Every agent action audited | largely met (Step 21 DONE: new audit rows carry the entity when knowable, migration 0027; tool-call tracing is Step 16) | 16 |
| 6 | Disaster-recovery drill | not verified | 19 |
| 7 | Launch and Money hard-gated | met by design | every step |

---

## Part F — Proposed additions (NOT APPROVED; not in Part B or Part E; not machine-checked)

Source: `docs/WFACT-3.0-Agency-Scope-Addendum-DRAFT.md` plus Nick's 2026-10-07 reply (agency pipeline: yes; lead-gen content engine: yes, after
delivery and with client consent; "static" meant visually flat; every site motion-rich with 21st.dev and conversion-focused; e-commerce
needs a different site type). Nothing here may be started until Huraira (sequencing) and Nick (scope, money) approve it. When approved, add the
steps to Part B, Part D and Part E in the same commit and run `node scripts/check-trackers.mjs`.

| ID | Proposed step | Gated by |
|---|---|---|
| N1 | Niche research and offer agents (cost-capped external data) | Steps 12 and 13, first paid delivery |
| N2 | Per-niche template capture and lessons write-back to starters | N2, Step 7 |
| N3 | Lead-gen content engine, agency-side only, after delivery and client consent | Steps 12 and 13, first paid delivery |
| N4 | Dynamic features, only if D3b shows they are needed (captured leads, client-editable content via Owner's Key, live data) | D3b |

Decisions (owners in `docs/HANDOFF.md` §6): **D1** DECIDED by Huraira 2026-10-07 (two tracks, Track A motion budget, conversion as a hard gate, e-commerce deferred; Nick confirms via the Step 27 blind rating; N1 is absorbed by Step 27); **D2** APPROVED by Huraira 2026-10-07: Steps 12 and 20 are pulled forward with Step 8 as one reliability bundle, after the real-client proof run (see Execution order);
**D3** DECIDED by Huraira 2026-10-10: the Website Build Module MVP on Bennett & Co by 2026-10-14 (`docs/MVP-CUTLINE.md`); **D3b** (was D3 before 2026-10-10) dynamic runtime shape within the Hostinger/Vercel law; **D4** obtain the AIW2.0STACK website-factory shell to compare real output;
**D5** spend caps for Higgsfield and Agent 37.
