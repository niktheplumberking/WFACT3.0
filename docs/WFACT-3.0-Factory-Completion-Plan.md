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
**Status as of 2026-10-07**: Steps **1, 2, 3 and 3A are DONE**; Step 4 is **PARTIAL** (one criterion superseded by Step 4B);
Step 4B is **IN PROGRESS** (M0 6 of 7 inputs decided, M1, M2 and M3 done, M4 PARTIAL: built and verified in CI `37016971442`; live Track B
build `f696ba43` failed on page count and invented testimonials, fixed in `c64bd0e`, not yet re-run; M5 groundwork `4bbd4bc`, live run
blocked on Higgsfield credits; M6 not started); Step 4C is **BUILT AND DEPLOYED** (`main` `fb08be3`, live signed-in check pending);
Step 6 is **DONE** (enforced default-deny agent permissions, CI `37609559746` green); Step 5 is **DONE** (proven on live Cockpit builds 2026-10-07); Step 7 is **DONE** (CI `37617845669` green); Steps 8–24 are not started. Each step heading below carries its
status; Part E is the checklist.

## How to use this file

1. Huraira pastes **one step's prompt** into the coding agent (or tells the agent "do Step N from
   `docs/WFACT-3.0-Factory-Completion-Plan.md`").
2. The agent does **only that step**, verifies it independently, and sends the **Report** (format below).
3. Huraira reads the report and says **GO** for the next step. The agent never starts a step on its own.
4. Steps are ordered by priority. Do them in order unless Huraira says otherwise. Each step lists its
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

| # | Step / stage | What it does | Why it matters | Output | Priority |
|---|---|---|---|---|---|
| 1 | Fix Cockpit → GitHub dispatch | Confirms the dispatch token, gets a Cockpit job to run through GitHub Actions | Every Cockpit action depends on it; it has never worked | First successful `Cockpit job` run; queued plan built | P0 |
| 2 | Write pilot brief and business rules | Drafts a realistic fictional client brief and provisional business rules | Unblocks Stage 7 and the real-memory test | `brief.json` and `memory/context.md`, both flagged provisional | P0 |
| 3 | Retire plaintext secrets (Huraira acts, agent verifies) | Deletes `.env.local` files, rotates keys, revokes the leaked Doppler token | Stage 1 is unmet and a token is exposed | The plan's `grep` check passes | P0 |
| 3A | Password sign-in and approval-gated accounts (added 2026-09-30) | Email + password sign-in, account requests, owner/admin approval, forgot-password; fixed an admin-to-owner escalation hole | Huraira asked for it; magic-link-only sign-in was a blocker | Live in the Cockpit; 32/32 attack checks pass | P0 |
| 4 | Full run on the pilot brief | Intake → plan → approval → build → verify → human Launch | Proves the factory end to end; measures corrections | Verified live page, correction count, audit and trace rows | P0 |
| 4B | Front-end upgrade: two build tracks | Track A (local business, conversion-first, multi-page static) and Track B (motion-rich, Next.js); a direction step detects niche, requirements and brand direction and recommends a track; the owner picks per build in the Cockpit; rendered screenshot QA; anti-slop design rulebook | Step 4 output was one text-only page and checks never looked at the rendered page | Both tracks build multi-page sites that pass rendered QA; track choice in the Cockpit; Summit Line rebuilt | P0 |
| 4C | Cockpit UI/UX redesign | Information architecture, navigation, design system, plain copy, every factory action reachable, accessible and responsive | The Cockpit is the control room; today it grew room by room | A redesigned Cockpit verified in the browser at desktop and phone, with a usability walkthrough | P1 |
| 5 | Stage 6: Documentation agent | Writes structured episodic memory per stage, tied to task IDs | Blueprint wants machine-written memory | Auto-written `memory.md` entries; a passing "what happened" query | P1 |
| 6 | Enforce agent permissions | Makes each agent's permission scope enforced, not descriptive | Must land before more agents or concurrency | Out-of-scope calls denied and audited | P1 |
| 7 | Expand the evaluation registry | Grows 6 checks toward the 78-check registry and 50-point audit; adds cross-model review and the "tells" gate | Highest-priority Blueprint component; goal 3 | Larger check set, re-run results | P1 |
| 8 | Task/event queue and durable execution | Puts a queue and restart-safe execution in front of workflows | Needed for three concurrent clients (goal 2) | Jobs that survive restarts, retry with a cap, then escalate | P1 |
| 9 | Cockpit: "is everything OK" and System room | Top-level status plus health, queue depth, error rate, backup status | The founder's stated need; System category | One-glance status page | P1 |
| 10 | Cockpit: Agents room and Workflows drill-down | Agents room; failures show the failed check and link to the trace | Answers "what is happening and why" without logs | Agents room, drill-down, success-rate trend | P1 |
| 11 | Extend model routing and add a second model | Routes every agent by config; adds one more adapter; starts local-model evaluation | Blueprint Phase 4 acceptance | Same task on two models; cost and quality log | P1 |
| 12 | Cost governance per client | Rolls traces up per client; adds hard per-run budget ceilings | Goal 4; prevents runaway spend | Per-client cost view; budget guard | P2 |
| 13 | Remaining core agents | Research, Back-end, Content/SEO, Deploy (human-gated), Monitoring, Recovery, Lessons, Memory consolidation | The pipeline needs 14 agents; 4 exist | Registered agents with bounded scopes | P2 |
| 14 | Cockpit: Memory and Human Control rooms | Memory writes, contradictions, stale warnings; escalations, blocked tasks, intervention history | Two missing categories | Two new rooms | P2 |
| 15 | Cognee trial write-up | One time-boxed trial ending in adopt / don't adopt | Blueprint says trial, not lock in | Decision note | P2 |
| 16 | Tool-call tracing | Traces tool calls as well as model calls; decides on Langfuse | Goal 5; Blueprint §3 | Tool-call spans linked to runs | P2 |
| 17 | Alerts and role-based views | Push/Telegram alerts by severity; owner/admin/PM views | Blueprint §9 UX and permissions | Working alerts and role tiers | P2 |
| 18 | Three-concurrent-clients test | Runs three pilot briefs at once | Goal 2 | Result with no manual firefighting | P2 |
| 19 | Disaster-recovery drill | Restores the latest backup into a scratch project and verifies it | Goal 6 | Written drill result | P2 |
| 20 | Fix the Vercel serverless ceiling | Upgrades the plan or moves logic off serverless functions | Already caused one silent outage | No 12-function risk | P2 |
| 21 | Housekeeping | Fixes stale `CLAUDE.md` §0, decides on npm workspaces, dedupes Planner sections, fills null `entity_slug` | Removes drift and traps | Clean, consistent repo | P2 |
| 22 | Nick's items (Huraira acts, agent prepares) | Disclosures, Cockpit review, real brief and rules, budget and scope sign-off | Only Nick can close these; goal 1 needs his real brief | Logged decisions; real inputs replace provisional ones | P3 |
| 23 | Product features (Owner's Key port) | Rebuilds Owner's Key, closing reports, care plans on the new stack | Blueprint Phase 10; Business/Product category | Migrated features; re-run attack tests | P3 |
| 24 | Advanced autonomy and optimization | Earns auto-pass gates from measured runs; local-model migration decision | Blueprint Phases 11–12 need real data first | Evidence-backed autonomy upgrades | P3 |

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

---

### STEP 1 — Fix Cockpit → GitHub dispatch (P0) — DONE 2026-09-30

**Status: DONE.** Dispatch worked end to end: job `b952aaba` ran as `cockpit-job.yml` run `36455639903`; the browser leg was proven
live on 2026-09-30 (job `1dd90f25`, dispatched 8 s after the click); the failure path was proven by job `e5d29358`. Open
housekeeping: two orphaned `queued` jobs (`a2a41d2d`, `cbf8bf7b`) await Huraira's OK to close. The prompt is kept for the record.

**Depends on**: none.
**Maps to**: Cockpit jobs (unplanned work), Blueprint §14 headless runs; unblocks Steps 2–4.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 1.

CONTEXT
Cockpit -> GitHub job dispatch has never worked end to end. Two build_plan jobs (a2a41d2d, cbf8bf7b) for
approved plan 8f03181f are stuck in `queued`. The `Cockpit job` workflow (.github/workflows/cockpit-job.yml)
has zero runs. Root cause history is in PROGRESS.md "Cockpit jobs" and docs/COCKPIT-JOBS.md: CORS allow-list
in the dispatch-job Edge Function (now v4). It is still UNCONFIRMED whether GITHUB_DISPATCH_TOKEN is set in
the function's secrets, and whether the browser POST ever reaches the function.

TASK
1. Establish current truth: list_edge_functions (version, status), recent function logs, the jobs table rows
   for the two stuck jobs, and `gh run list --workflow cockpit-job.yml`.
2. Determine whether GITHUB_DISPATCH_TOKEN exists in the function's secrets (check by name only, never print
   a value). If it is missing, STOP and tell Huraira exactly what token scope and where to set it.
3. Prove the dispatch leg WITHOUT the browser first: invoke dispatch-job with a valid owner session (or the
   documented service path) for one queued job and confirm a cockpit-job.yml run appears and the job goes
   queued -> running -> succeeded/failed with dispatched_at set.
4. Then prove it from the real Cockpit in the browser pane (sign-in is Huraira's; if login is required, ask
   Huraira to sign in, then continue). Click Start on a queued job. Confirm the POST reaches the function
   (function logs show POST, not just OPTIONS).
5. Fix any real defect found (CORS, headers, token, workflow inputs). Add or extend tests. Redeploy the
   function if changed, and record the new version.
6. Re-dispatch the build_plan job for plan 8f03181f and confirm the workflow runs `build-and-verify --plan`.
   Do NOT deploy the resulting page anywhere; Launch is human-gated.
7. Confirm the Cockpit Actions room shows the job's true status live.

ACCEPTANCE
- cockpit-job.yml has at least 1 successful run triggered from the Cockpit (dispatched_at not null).
- The build_plan job for plan 8f03181f finishes with a real result and audit_log rows (workflow.start /
  checkpoint / gate) read back by SQL.
- Failure path proven: a deliberately invalid job fails visibly (status failed with a reason), never silently
  queued.
- PROGRESS.md "Cockpit jobs" section updated to reflect reality.

REPORT in the Part C format, then STOP.
```

---

### STEP 2 — Write the pilot brief and business rules (P0) — DONE 2026-09-30 (provisional inputs)

**Status: DONE** (`2c188d0`). `memory/context.md` has concrete provisional rules and a 13-row register (R-01…R-13);
`clients/summit-line-roofing/` holds the synthetic brief, raw request and memory. Nick's real brief and rules session remain open
in `BLOCKED-ON-NICK.md` (Step 22). The prompt is kept for the record.

**Depends on**: none (can run in parallel with Step 1).
**Maps to**: Continuation Stage 7 prerequisites; Blueprint §8 context.md; Phase 2.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 2.

CONTEXT
Nick owes a real pilot brief and a business-rules session. Huraira has decided to proceed with realistic
FICTIONAL inputs written by you now, to be swapped for Nick's real ones later. Anything you write must be
honest about being provisional.

TASK
A. Business rules -> memory/context.md
   1. Read the current file, the Factory Book/SOP markdown in docs/WFACT SOPS/Claude outputs/, the Playbook,
      the Ecosystem Blueprint and the Blueprint's entity law. Reuse real facts already in those documents;
      do not contradict them.
   2. Replace every [PLACEHOLDER] with a concrete, sensible PROVISIONAL rule where you can reasonably infer
      one (pricing bands, package tiers, standard timelines, revision limits, approval rules, what needs
      owner sign-off, tone of client comms, banned claims such as invented statistics or fake client names).
      Where a value would need real business knowledge (actual prices, actual entity confirmation), give a
      clearly labelled provisional value and mark it: [PROVISIONAL - Nick to replace].
   3. Keep the entity law intact: N-capable schema, one client per entity, two active entities for now
      (DreamSign, Bennett & Co) with Rizm separate. Keep "Launch and Money are hard-gated to Nick".
   4. Add a short "Provisional-rule register" at the bottom listing every provisional value, so Nick's
      session becomes a checklist to confirm or change.
B. Pilot brief
   1. Design ONE fictional client that is new (not DreamSign, Northlight Signs or Harbor Street Bakery) and
      realistic enough to stress the pipeline: a local service business needing a multi-section marketing
      site (hero, services, proof/testimonials using clearly labelled sample content, pricing or packages,
      FAQ, contact/booking). Include real constraints: brand tone, colour or style direction, forbidden
      claims, required sections, a contact method, accessibility and performance expectations, and two
      ambiguities the Intake agent should notice and flag.
   2. Save it as clients/<slug>/brief.json in the exact shape frontend-loop's parseBrief accepts, with
      `source: "synthetic-provisional-2026-09-30"`. Also save a raw-email version at
      clients/<slug>/raw-request.txt, the way the lead would really write it, for the Intake test.
   3. Copy clients/_template/ for the rest of the client folder (memory.md etc.). Assign the client to the
      appropriate entity per the schema and the entity law. Do not break the one-client-per-entity rule; if
      it would, STOP and ask.
   4. Register the client in Supabase state only if the existing tooling does so through a documented path;
      otherwise leave DB state to Step 4.
C. Tracker
   Update BLOCKED-ON-NICK.md: keep the two Nick rows OPEN but change their status text to "PROVISIONAL
   DRAFT IN USE since 2026-09-30 - Nick to replace"; do not mark them closed. Update PROGRESS.md.

ACCEPTANCE
- context.md has no unlabelled placeholders; every provisional value is listed in the register.
- The brief passes parseBrief (run it) and the Intake agent, run on raw-request.txt, produces a valid
  classification (run it live only if Step 1 is done and the run is cheap; otherwise run with the existing
  test harness and say so).
- Nothing in either file presents invented facts as verified client or business facts.

REPORT in the Part C format, then STOP.
```

---

### STEP 3 — Retire plaintext secrets (P0, Huraira acts, agent verifies) — DONE 2026-09-30

**Status: DONE** (`f74b0bc`). Both `.env.local` files deleted, grep criterion passes, keys rotated and working from Doppler,
CI deploys with the rotated keys (`main` runs `36698432470`, `36699308136`). Per this step's own acceptance, the old leaked CLI token
is **listed as not verified** (a fresh CLI login exists; confirm in the Doppler dashboard). The prompt is kept for the record.

**Depends on**: none.
**Maps to**: Continuation Stage 1 criterion 3; Blueprint §3 security.

```
You are the coding agent for WFACT 3.0. Follow the Standard Operating Rules in
docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 3. This step needs HURAIRA to perform
account actions; you guide and verify. Never print a secret value.

CONTEXT
Doppler is the real secrets source (project wfact-3-0-codebase, configs dev/prd). But .env.local and
apps/cockpit/.env.local still hold plaintext keys, and a Doppler CLI token (dp.ct...) was exposed in a
session transcript on 2026-09-28 and is not confirmed revoked.

TASK
1. Verify (without printing values) that every key in .env.local and apps/cockpit/.env.local exists with an
   identical hash in Doppler dev/prd. List any key that exists only in the local file. If any exist, STOP
   and tell Huraira to add them to Doppler first.
2. Give Huraira a short numbered checklist (exact commands where safe) to: (a) delete both .env.local files,
   (b) rotate each key that sat in plaintext (Supabase service role, Anthropic, OpenAI, Agent 37, Vercel
   token, any others - list by NAME) and update Doppler, (c) run `doppler logout` and log in again to
   revoke the leaked CLI token, (d) confirm the rotated DOPPLER_TOKEN and VERCEL_TOKEN GitHub secrets still
   work.
   Wait for Huraira to confirm each action. Do not perform account or key-rotation actions yourself.
3. After Huraira confirms, verify: files are gone; the plan's grep criterion (docs/SECRETS.md) passes; a
   command run via `doppler run --` works (e.g. the ask CLI writes an audit row); the Cockpit still builds;
   a CI run on huraira-work is green; the new keys work in the deployed Edge Function paths you can test.
4. Confirm the old leaked token no longer authenticates (a harmless read call should fail) - only if that
   can be tested without exposing values.
5. Update docs/SECRETS.md, PROGRESS.md Stage 1 (criterion 3 MET only if proven) and the Incidents entry.

ACCEPTANCE
- No plaintext secret files on disk; grep criterion passes.
- Everything still runs from Doppler only.
- Old token shown to be revoked, or explicitly listed as "not verified".

REPORT in the Part C format, then STOP.
```

---

### STEP 3A — Password sign-in and approval-gated accounts (P0, added 2026-09-30) — DONE 2026-09-30

**Status: DONE** (`2223344`, `856e483`; CI `36698432470`, `36699308136`). Migration `0010_account_requests`: a sign-up creates a pending
request and no profile, so it sees nothing until approved; owners approve any role, admins only `pm`; every decision audited; the
older policy that let an admin promote themselves to owner was replaced with owner-only profile writes. Cockpit: password sign-in,
"Create an account", "Forgot password?" and choose-new-password screens, magic link kept for existing accounts only, and an Account
requests panel in Approvals. `scripts/rls_attack_test_accounts.sql`: 32/32. **Not yet proven live**: a real new account signed up,
confirmed by email, approved and signed in (needs Huraira); the Supabase Auth settings below are Huraira's.

Remaining verification prompt (run once Huraira has done the dashboard settings and created a test account):

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY the Step 3A live verification.

CONTEXT
Password sign-in and approval-gated accounts shipped (migration 0010, apps/cockpit Login, AccessPending,
AccessRequests, SetPassword). Huraira has set Supabase Auth (email+password on, Confirm email on, minimum
password length, leaked-password protection) and created ONE test account himself. You never create
accounts or type passwords.

TASK
1. Read back by SQL (no secrets): the test account's account_requests row is 'pending' and it has no
   profiles row.
2. With Huraira signed in as owner in the browser pane, confirm the request appears in Approvals, then
   ask Huraira to approve it as 'pm' (his click, not yours).
3. Confirm by SQL: request 'approved', profiles row with role 'pm', an audit_log 'account.approved' row
   whose actor is Huraira's user id.
4. Ask Huraira to sign in as the test account in a private window and confirm it sees only what a pm
   should (live RLS, not just hidden buttons).
5. Ask Huraira to try "Forgot password?" for the test account and confirm the reset screen works.
6. Re-run scripts/rls_attack_test_accounts.sql: 0 failures. Run get_advisors.
7. Afterwards, with Huraira's OK, reject or remove the test account's access and confirm by SQL.

ACCEPTANCE
- One real account went pending -> approved -> signed in with the right access, end to end, audited.
- Attack test still 32/32; advisors show no new findings.

REPORT in the Part C format, then STOP.
```

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

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 4.

CONTEXT
The pilot brief and provisional business rules from Step 2 exist. Cockpit dispatch works (Step 1). Goal:
prove the whole factory on ONE run, through the Cockpit, measuring corrections honestly. The brief is
SYNTHETIC, so the correction count demonstrates the factory but does NOT count against DreamSign's 40+.

TASK
1. Submit clients/<slug>/raw-request.txt through the Cockpit Actions room (new request -> Intake + Plan).
   Confirm Intake's entity and lead-type, and that it flagged the two planted ambiguities. Record what it
   missed.
2. Owner approval of the plan is HURAIRA's step. Present the plan summary and ask for approve/reject. If
   rejected, run the Re-plan action once, then escalate (per the design).
3. After approval, run Build + verify from the Cockpit. Watch every stage. Record: correction rounds,
   which checks failed each round, model calls per role, real cost per call, wall-clock time.
4. Independently verify the built page with a SEPARATE process: run the verification CLI on the artifact and
   re-hash it against the checkpoint. Also open it in the browser pane and check it visually at desktop and
   phone widths; list any visible defects the automated checks missed.
5. LAUNCH IS HUMAN. Do not deploy. Ask Huraira for explicit go to deploy a PREVIEW to Vercel (not a client
   production site). After a yes, deploy the preview and curl-verify HTTP 200 and the page title.
6. Pull the audit_log rows and model_traces rows for the run by SQL and confirm they join by task ID.
7. Log the run honestly in the client's memory.md and PROGRESS.md as "synthetic pilot". Compare the
   correction count to DreamSign 2.0's 40+ with the caveat stated.
8. List every defect, friction point or manual step you hit; these become input for Steps 5-8.

ACCEPTANCE
- One raw request became a verified built page through the Cockpit with no hand-written intermediate.
- Independent verification and human visual check completed; defects listed.
- Preview URL live and curl-verified (only after Huraira's yes).
- Correction count, cost and time recorded; caveat stated.

REPORT in the Part C format, then STOP.
```

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
(isolated Linux build: network blocked, no secrets). **Open**: a live Agent 37 pipeline build (needs a decision on the synthetic client's entity), the screenshot
review's DR-SINGLE-DEFAULT-FONT verdict, and Huraira's decisions on the budgets and on Motion/Radix (design doc §11).

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
M1  Rendered QA + claims gate on TODAY's builder. Headless Chromium (Playwright) screenshots at
    1440/768/375; axe accessibility; Lighthouse performance; link and asset crawl; console errors; text
    checks for content after </html>, required SAMPLE labels, banned claims, and factual claims with no
    source field. Add a screenshot review by a model from a different vendor than the builder.
    Acceptance: re-checking the Step 4 artifact (sha256 960b61ba...) FAILS on the leaked tool text, the
    unlabelled testimonials and the invented phone/hours; clean fixtures pass. Results are exact check
    IDs that FrontendLoop.revise() can act on.
M2  Direction step + track choice. A new agent registered without editing agent-runtime runs after
    Intake: niche (fixed, versioned taxonomy), audience, primary conversion goal, requirements, brand
    direction (each point quoting the request), recommended track + confidence + reasons, open
    questions; no recommendation when confidence is low. Build 10-15 labelled synthetic fixtures across
    niches and report per-case results. Cockpit: plan card shows the direction summary and the
    recommended track pre-selected; owner chooses or overrides; stored on the plan (append-only
    migration, RLS attack-tested) and audited; no build can start without a track.
M3  Track A starter + multi-page build through the pipeline. Acceptance: a 3+ page local-business site
    builds, passes rendered QA, the rulebook and its budgets; a broken-link fixture and an over-budget
    fixture fail.
M4  Track B starter (Next.js static export) + multi-page build. The build runs in CI with no secrets in
    the build step and no network beyond the package cache; artifact = static output + source in the
    private artifacts bucket with a checkpoint hash. Acceptance as M3, plus reduced-motion respected and
    an over-budget animation fixture fails.
M5  Assets: generated or supplied images, always labelled, never presented as the client's own work,
    alt text required, size/format budgets. Use the image tool only with the access and budget Huraira
    approved in M0. An unlabelled generated image fixture is caught.
M6  Full runs through the Cockpit: Summit Line Roofing (expected Track A) and a second synthetic,
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

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/apps/cockpit. Follow the Standard
Operating Rules in docs/WFACT-3.0-Factory-Completion-Plan.md Part C, including the design-quality rule.
Do ONLY Step 4C. Before any design work, load the skills named in Part C (impeccable,
design-taste-frontend, high-end-visual-design, ecc:frontend-design-direction, redesign-existing-projects,
ecc:make-interfaces-feel-better, ecc:frontend-a11y, ecc:design-system).

CONTEXT
The Cockpit is the founders' control room. It grew room by room (Pipeline, Approvals incl. plan and
account approvals, Actions, Runs, Models, login/sign-up/reset). Huraira wants it to be the ONE place where
every factory feature, option and action is available, with a clean, uncluttered, well-designed UI, easy
navigation and clear plain-language copy. Nick (non-technical) must be able to use it without help.

PHASE 1 — Audit and plan (no code). STOP for GO at the end.
1. Inventory every capability: each room and action today; every job kind in packages/jobs; every CLI
   command in packages/* that has no Cockpit equivalent; every planned room in this plan (Steps 9, 10,
   12, 14, 17, 23). Produce a table: capability, who uses it (owner/admin/pm), where it lives today,
   where it should live.
2. Heuristic review of the current UI with screenshots at desktop and phone: navigation, hierarchy,
   clutter, copy, empty states, error states, loading states, contrast, focus, tap targets.
3. Propose the information architecture: top-level navigation (few, clearly named areas), what goes in
   each, primary action per screen, and how future rooms slot in. A "home" view that answers "is
   everything OK and what needs me?" first.
4. Propose the design system: tokens (colour, type pairing, spacing, radius, elevation, motion), core
   components (nav, page header, card, table, status badge, form controls, dialogs, toasts, empty and
   error states), dark theme first with a light theme, and a copy guide (plain language, verbs on
   buttons, no jargon, every error says what happened and what to do).
5. Provide 3-5 key screen mockups (HTML or images) applying the design-quality rule. STOP and send
   the audit, IA, design system and mockups to Huraira for GO.

PHASE 2 — Build, after GO.
6. Implement the design system and the new navigation shell; migrate every existing room onto it
   without losing any behaviour; keep RLS as the only access control and never put a service key in the
   bundle.
7. Make every capability from the inventory reachable in the Cockpit (or listed as deliberately
   CLI-only with a reason). Do not fake data: a future room appears only when its step builds it, or as
   an honest "coming in Step N" entry if Huraira prefers.
8. Accessibility WCAG 2.2 AA (contrast, keyboard, focus visible, labels, reduced motion), responsive
   from 360 px, installable PWA, fast (lazy-load rooms, no layout shift).
9. Tests: component and interaction tests for navigation and the main flows; Cockpit typecheck and
   production build pass; CI green.

VERIFY (independently, in the browser pane, with screenshots at 1440 and 375 px)
- Usability walkthrough with timed tasks, each in <= 3 clicks from home: start intake from a pasted
  request; approve or reject a plan (with track choice); start a build; open a run and see why it
  failed; approve an account request; sign out. Report clicks and any confusion honestly.
- Lighthouse accessibility >= 95 and no axe violations on every room; no horizontal scroll at 375 px.
- Before/after screenshots of every room; the design-quality rule passes (list each banned pattern
  checked).
- grep the built bundle for "service_role" (must be 0); existing behaviour preserved (list each room
  and action checked live).

ACCEPTANCE
- Huraira approved the IA and design direction before build; every capability is reachable or
  deliberately excluded with a reason; the walkthrough passes; accessibility and responsiveness proven
  with evidence; CI green; no production client deploy path added.

REPORT in the Part C format (Phase 1 report first, then the build report), then STOP.
```

---

### STEP 5 — Stage 6: Documentation agent and episodic memory (P1) — DONE 2026-10-07

**Status: DONE** (parallel worktree, GO 2026-10-07; `08fc069`…`530f4cb`, merged; proven on live Cockpit builds `ad49df57` and `c775c396`). `packages/documentation` writes one versioned, append-only episodic entry per stage from the run's audit rows (no model, $0 ceiling, scope-gated to the bound client); Hermes-lite answers "what happened" from those entries. Proven: in-process full workflow test, live backfill of 26 entries (SQL-matched), live `npm run ask` answer checked against SQL. Live: Cockpit job `c775c396` (3 cycles) got one entry per build and QA stage (6 `documentation.entry` rows), job `ad49df57` one for its halted build stage; CI `documentation` job green since `37614606732`.

**Depends on**: Step 4.
**Maps to**: Continuation Stage 6; Blueprint §8, §16D (Documentation agent).

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 5.

CONTEXT
Stage 6 of docs/WFACT-3.0-Continuation-Build-Plan.md, Blueprint §8. No `documentation` agent exists in any
registry. Memory today is hand-written or appended by loops. The acceptance query is: "what happened on
client X's build" answered from a structured memory file written by an agent, not a human.

TASK
1. Read Stage 6 of the Continuation Plan and Blueprint §8 (memory types, episodic memory tied to task IDs).
2. Design the entry format (versioned): task ID, run ID, stage, timestamp, actor/role, inputs (hashes, not
   contents), outcome, failed checks, corrections, cost, links to audit_log and model_traces rows. Keep it
   both human-readable markdown and machine-parseable.
3. Build the Documentation agent as a NEW package or module registered through the agent registry WITHOUT
   editing agent-runtime's core (prove the extension point again). It runs at the end of every workflow
   stage in packages/workflow, writes to clients/<name>/memory.md, and is audited like every agent.
4. Hard rules: it appends only; never rewrites history; never records secrets or full client PII; if it
   cannot write it escalates rather than silently skipping. Agent-writable memory is allowed now because
   Phase 5 proved the runtime (Blueprint Phase 2 note).
5. Backfill: generate entries for the Step 4 run from its audit_log and traces (marked backfilled).
6. Add a memory query path: extend Hermes-lite's memory tool so `ask` can answer "what happened on client
   X's build" from these entries. Keep the tone filter and tool allowlist.
7. Tests: format validity, append-only behaviour, escalation on write failure, secret/PII redaction, and a
   test proving the agent needs no changes to agent-runtime.

ACCEPTANCE
- After a workflow run, the memory file gets one correct entry per stage, written by the agent, joined to
  audit task IDs.
- `npm run ask -- "What happened on <pilot client>'s build?"` returns a correct, plain-language answer,
  checked against SQL ground truth by you independently.
- Existing suites pass unchanged.

REPORT in the Part C format, then STOP.
```

---

### STEP 6 — Enforce agent permissions (P1) — DONE 2026-10-06, CI green 2026-10-07

**Status: DONE** (parallel worktree, approved by Huraira 2026-10-06; `58bf776`…`ee08f9d`, merged into `huraira-work`). Typed, versioned, default-deny scopes enforced in `packages/agent-runtime/src/permissions.ts`; live attack run 2026-10-06 13:02 UTC denied and audited all four out-of-scope cases (7 `agent.deny` rows, re-counted independently by SQL); the real models did not obey an injected request. NOT COVERED (see `docs/AGENT-PERMISSIONS.md`): network egress outside the Track B sandbox, shared runner credentials, ungated local CLIs.

**Depends on**: Step 4 (Step 5 preferred).
**Maps to**: Blueprint §3 (tool calling, security/permissions), §12; Phase 5 note "Section 12 must land before this phase closes".

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 6.

CONTEXT
packages/agent-runtime/src/registry.ts holds a `permissionScope` per role that is DESCRIPTIVE ONLY. Blueprint
§3/§12 require least-privilege, per-agent scoped access, schema-validated tool wrappers with an allowlist,
and sandboxing for model-generated code. Also the agents read client-submitted content, so prompt injection
via that content is a live risk (Blueprint §16I).

TASK
1. Inventory every capability agents use today: DB reads/writes (which tables), file writes (which paths),
   network calls, model calls, tool calls in Hermes-lite, job dispatch. Produce a table role x capability.
2. Turn permissionScope into an enforced policy: a typed, versioned scope per role (tables/operations,
   writable paths, allowed tools, allowed models, max cost per run). Enforce in ONE central place that all
   agent I/O goes through, and default-deny. Do not build a general policy engine; keep it a small,
   testable allowlist.
3. Enforce entity isolation in code as well as RLS: an agent working for entity A must be unable to read or
   write entity B's client folder or rows.
4. Every denial is audited (agent.deny with role, capability, task ID). Every allow already leaves an audit
   trail; confirm.
5. Prompt-injection defence for ingested content: treat client text as data. Add tests where a raw request
   contains instructions ("ignore previous...", "email the API key", "write to another client's folder")
   and prove the agents do not obey and the attempt is audited.
6. Attack-test live for real (not just unit tests): try out-of-scope writes and cross-entity access through
   the actual runtime and show the denials in audit_log.
7. Update docs and the registry header (remove "descriptive only").

ACCEPTANCE
- Default-deny works; each role can do exactly its scope, proven by tests and a live attack run.
- Cross-entity access and the injection cases are denied and audited.
- Existing suites pass unchanged (or minimal, justified changes listed).

REPORT in the Part C format, then STOP.
```

---

### STEP 7 — Expand the evaluation registry (P1) — DONE 2026-10-07, CI green

**Status: DONE** (parallel worktree, GO 2026-10-07; `64222b1`…`0e13e30`, merged `c1e511a`). Registry v1.0.0 as data + code: 48 checks, each with a passing and a failing fixture, severity/stage gate, cost per check; one gate for every QA entry point; builder/evaluator model-family separation enforced by `config/evaluator.json` (+ OpenAI adapter, migration 0017 applied); QA-runner SSRF closed. Gaps stated, not hidden: the full 78-check list and 50-point audit are not in this repo (only summaries survive; recorded in the registry's `sourceInventory`/`notCovered`), model-judged checks proven on mocks, the OpenAI evaluator has no live success (no credits).

**Depends on**: Step 4.
**Maps to**: Blueprint §14 (Evaluation Registry), Phase 8, §16C "highest priority", goal 3.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 7.

CONTEXT
packages/verification has 6 deterministic checks plus an independent Claude evaluator. The Blueprint's
Evaluation Registry grows from 2.0's 78-check registry and 50-point security audit, adds the "tells" list
(20 vibecode signs) as a real gate, and requires cross-model review (evaluator is a different model from
the builder). The 2.0 registry and audit material is in docs/ and docs/archive/ and the Blueprint §1, §14.

TASK
1. Find and read all 2.0 registry / 50-point audit / "tells" source material available in this repo
   (docs/, docs/archive/, docs/WFACT SOPS/). If the 78-check list is not present in full, list exactly what
   IS available, build from that, and report what is missing rather than inventing it.
2. Design a registry format: each check has an ID, category, severity (blocker/major/minor), automated or
   model-judged, what it proves, and a failing fixture. Store it as versioned data plus code, not prose.
3. Port checks in priority order: security and integrity checks first, then content-honesty (no invented
   stats or client names, no lorem ipsum, no placeholder text), accessibility, performance, SEO basics,
   responsive, console errors, link and asset integrity, and the "tells" list. Automate whatever can be
   deterministic; use the independent evaluator only for genuinely judgment-based checks.
4. For each check: a passing fixture AND a deliberately broken fixture that it must catch (Blueprint Phase 8
   acceptance: at least one deliberately introduced defect caught before a human sees it).
5. Cross-model review: ensure the evaluator model differs from the builder model by config; fail loudly if
   they resolve to the same model family.
6. Wire the registry into the verification loop and the workflow gate, keep returned failures as exact check
   IDs for FrontendLoop.revise().
7. Run the whole registry on the Step 4 pilot page. Report pass/fail per check and any false positives.
8. Keep an honest NOT-COVERED list (as 2.0 did) for anything you could not automate.

ACCEPTANCE
- Registry is versioned data + code; each check has a passing and a failing fixture and they all behave.
- Pilot page run through it with a per-check result table.
- Cross-model separation enforced by config.
- Existing verification tests pass unchanged.

REPORT in the Part C format, then STOP.
```

---

### STEP 8 — Task/event queue and durable execution (P1) — NOT STARTED

**Depends on**: Steps 4 and 6 (Step 7 preferred).
**Maps to**: Blueprint §3 (queues, retries, failure recovery), §14, Phase 6; goal 2.

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

### STEP 12 — Cost governance per client (P2) — NOT STARTED

**Depends on**: Steps 10 and 11.
**Maps to**: Blueprint §3 (cost control), Fuel Gauges / Cost Sentinel "extend into Cost Governance"; goal 4.

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

**Depends on**: none technically; needs Huraira's decision.
**Maps to**: Blueprint §1 (FIX, infrastructure), Phase 9 "Fix"; BLOCKED-ON-NICK "Vercel plan upgrade".

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

### STEP 21 — Housekeeping (P2) — NOT STARTED (note: uncommitted edits to CLAUDE.md §0, docs/INDEX.md and docs/archive were seen on disk 2026-10-01; verify and commit them as sub-items A and G)

**Depends on**: none (best after Step 4).
**Maps to**: Continuation "Gaps noticed" list.

```
You are the coding agent for WFACT 3.0. Work in wfact-3.0-build/. Follow the Standard Operating Rules
in docs/WFACT-3.0-Factory-Completion-Plan.md Part C. Do ONLY Step 21. Each sub-item is separate: commit
each separately with its own evidence.

TASK (from PROGRESS.md "Gaps noticed")
A. CLAUDE.md section 0 is stale ("Current phase: Phase 1"). Rewrite the current-state section to reflect the
   Continuation plan, this Factory Completion Plan, the current step, and the Standard Operating Rules. Keep
   the law sections intact. Add a pointer to docs/WFACT-3.0-Factory-Completion-Plan.md and docs/INDEX.md.
B. npm workspaces decision. There are 9+ linked `file:` packages with a hand-ordered install per CI job.
   The repo root deliberately has no package.json (Phase 6 Vercel Root Directory incident). Investigate
   whether workspaces can live in a separate root file or subfolder without reintroducing that incident.
   Present the decision and the risk; only implement if you can prove a fresh git-shaped Vercel build of the
   Cockpit still succeeds and CI stays green. Otherwise document why not and keep the current approach.
C. Planner near-duplicate sections ("process" vs "how-it-works"): add a section-normalisation rule with a
   test, without loosening the parseBrief contract.
D. Null entity_slug in audit rows: pass entity context through the runtime everywhere (QA CLI included);
   add a test that fails when a row is written without entity context where one is knowable.
E. Knowledge graph: the graphify output has ~52 dangling edges and PDFs not extracted. Re-run graphify
   after Steps 1-20 land, or do it now and note it is stale; fix dangling edges if the tool allows; report
   what remains.
F. The stale deployed DreamSign page: decide with Huraira whether to redeploy or leave; do not deploy
   without a yes.
G. Docs: update docs/INDEX.md so every doc, including this plan, is indexed.

ACCEPTANCE
- Each sub-item done or explicitly deferred with a reason; CI green; no regressions.

REPORT in the Part C format, then STOP.
```

---

### STEP 22 — Nick's items (P3, Huraira acts, agent prepares) — NOT STARTED

**Depends on**: none. Best after Step 4, so Nick sees real results.
**Maps to**: BLOCKED-ON-NICK.md; goal 1 (real brief); Blueprint calibration note.

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

## Part E — Progress checklist (update as steps close)

| # | Step | Status | Reported | Approved by Huraira |
|---|---|---|---|---|
| 1 | Fix Cockpit → GitHub dispatch | **DONE** (job `b952aaba`, run `36455639903`; browser leg job `1dd90f25`) | 2026-09-30 | yes |
| 2 | Pilot brief and business rules | **DONE**, provisional inputs (`2c188d0`) | 2026-09-30 | yes |
| 3 | Retire plaintext secrets | **DONE** (`f74b0bc`); old CLI token listed as not verified, per the step's acceptance | 2026-09-30 | yes |
| 3A | Password sign-in and approval-gated accounts | **DONE** (`2223344`, `856e483`); live end-to-end sign-up still to prove | 2026-09-30 | yes |
| 4 | Full run on the pilot brief | **PARTIAL**: built and QA-approved (job `81c8607b`), human review found defects; preview superseded by Step 4B M6 | 2026-09-30 | |
| 4B | Front-end upgrade: two build tracks | **IN PROGRESS**: design approved; M0 6 of 7 inputs decided; M1, M2 and M3 done; M4 partial (`a9f4dcf`…`13ec854`, migration 0014, CI `37016971442` green; live Track B `f696ba43` failures fixed in `c64bd0e`/`8dae180`, not pushed or re-run; screenshot review pending); M5 groundwork `4bbd4bc` (live run blocked: no Higgsfield credits) | 2026-10-06 | 2026-10-01 (design) |
| 4C | Cockpit UI/UX redesign | **BUILT AND DEPLOYED** (`e76cff2`, CI `36905237284`; redeploy `fb08be3`, CI `36907274448`): new IA and design system, every room migrated, migration 0013 (cancel stuck jobs, 17/17 attack test), 23 tests, axe 0 / Lighthouse a11y 100 on every room; live signed-in check pending Huraira | 2026-10-01 | 2026-10-01 (Phase 1 + D1–D8) |
| 5 | Documentation agent | **DONE** (`08fc069`…`530f4cb`; live Cockpit builds `c775c396` 6 entries / 6 stages and `ad49df57` 1 / 1; backfill 26 = 26 rows; live ask SQL-checked; CI `37614606732`) | 2026-10-07 | |
| 6 | Enforce agent permissions | **DONE** (`58bf776`…`ee08f9d`; 285 package tests + rendered-qa pass on the merged tree; live attack runs `050c3329`, `ed07cfaf`, `cb7739a2`, `7197fa12`, `9a692a2d`, 7 `agent.deny` rows verified by SQL; CI `37609559746` green; cost ceilings set from live traces 2026-10-07: builder $1, QA $0.50, Planner $0.25, Direction $0.15, Hermes $0.10, Intake $0.05) | 2026-10-06 | |
| 7 | Evaluation registry | **DONE** (`64222b1`…`0e13e30`, merged `c1e511a`; merged tree verification 98, rendered-qa 52 and all packages pass; migration 0017 applied live; CI `37617845669` green; 78-check and 50-point sources missing from the repo, OpenAI evaluator unproven live) | 2026-10-07 | |
| 8 | Queue and durable execution | not started | | |
| 9 | Cockpit: status and System room | not started | | |
| 10 | Cockpit: Agents and Workflows | not started | | |
| 11 | Model routing and second model | not started | | |
| 12 | Cost governance per client | not started | | |
| 13 | Remaining core agents (A–E) | not started | | |
| 14 | Cockpit: Memory and Human Control | not started | | |
| 15 | Cognee trial write-up | not started | | |
| 16 | Tool-call tracing | not started | | |
| 17 | Alerts and role-based views | not started | | |
| 18 | Three-concurrent-clients test | not started | | |
| 19 | Disaster-recovery drill | not started | | |
| 20 | Vercel serverless ceiling | not started | | |
| 21 | Housekeeping | not started | | |
| 22 | Nick's items | not started | | |
| 23 | Product features (A–E) | not started | | |
| 24 | Advanced autonomy and optimization (A–C) | not started | | |

**Goal tracker (Blueprint §16K)**

| # | Goal | Status | Closed by |
|---|---|---|---|
| 1 | One real client, fewer than 40 corrections | open (synthetic run done in Step 4: 2 change rounds, not comparable; comparable output needs Step 4B; real brief after Step 22) | 4B, 22 |
| 2 | Three concurrent clients | open | 18 |
| 3 | 50-point audit and registry re-run | partial (Step 7: 48-check registry re-run on the Step 4 page with a per-check table; the 78-check and 50-point source lists are not in this repo) | 7 |
| 4 | Real cost per client | partial | 12 |
| 5 | Every agent action audited | largely met | 16, 21 |
| 6 | Disaster-recovery drill | not verified | 19 |
| 7 | Launch and Money hard-gated | met by design | every step |
