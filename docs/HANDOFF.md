# WFACT 3.0 — Agent Handoff

**Written**: 2026-10-07, branch `huraira-work` at `1323cbe` (= `origin/main` and `origin/huraira-work`). Product and solution alignment pass.
**Purpose**: let a coding agent continue the build without reconstructing the project's history. Self-contained; the documents
it points to are the detail, this is the orientation.
**Evidence rule**: every status below was checked in this pass unless marked *(reported)*, meaning it comes from `PROGRESS.md`
or CI and was not re-run here. Sources I could not access: the Aug 26 team-call transcript, the WFACT 2.0 repo, the Factory
Book PDFs (not read), the live Cockpit while signed in, the live Supabase/Doppler/GitHub secrets, the AIW2.0STACK repo's
"website-factory shell" (not in that repo, per the Addendum), and earlier chat sessions other than what the repo records.

---

## 1. Product goals (non-technical)

### 1.1 What WFACT 3.0 is
An AI-run **web-agency factory**: a client request goes in; a verified website comes out; humans only decide money, launch, client
choice and final design. Its control room is the **Cockpit** (a web PWA) where every factory action is started, every human gate
decided, every outcome checked. It is also meant to become a SaaS-sellable product for other AI web agencies later. *(Playbook §1, Blueprint, PRODUCT.md — confirmed.)*

### 1.2 Who it serves
| User | Need |
|---|---|
| Nick (owner, non-technical) | "Is everything OK, and what needs me?" Approves money, launch, clients, final design. Must use it unaided. |
| Huraira (owner, technical cofounder) | Runs the factory daily, starts builds, reads failures, watches cost. Owns architecture and sequencing. |
| Admins / PMs | Approved team accounts; PMs see only their assigned clients (RLS). Role-specific views are Step 17. |
| Clients of the agency (DreamSign, Bennett & Co active; Rizm runs separately under Atif) | Receive the site. Self-edit via Owner's Key (not yet ported). |

### 1.3 Problems it solves
Speed and consistency of delivering client websites (DreamSign took 40+ correction batches in 2.0; goal is fewer), without the 2.0
failure of "done" claims nobody verified (a whole feature pack was never installed).

### 1.4 Success criteria (Blueprint §16K, confirmed, all must be independently verified)
| # | Criterion | Verified status today |
|---|---|---|
| 1 | One real client end-to-end with fewer than 40 correction batches | **Open.** Only synthetic client runs exist (Summit Line Roofing, 2 change rounds, not comparable). A real brief is Nick's. |
| 2 | Three concurrent clients, no firefighting | **Open** (Step 18; needs Step 8 queue). |
| 3 | 50-point audit + extended registry re-run on the new stack | **Partial.** 48-check registry exists and re-runs; the 78-check and 50-point *source lists are not in this repo*. |
| 4 | Real cost per client measured | **Partial.** Model traces exist; Agent 37 calls are unpriced (null cost). |
| 5 | Every agent action audited | **Largely met** (audit log + traces + permission denials). |
| 6 | Disaster-recovery drill run | **Not done** (Step 19). |
| 7 | Launch and Money hard-gated to a human, forever | **Met by design** (no deploy button; launch is a human stage move). |

### 1.5 Core user journeys
1. **Request → plan → approve → build → verify → launch gate** (works end-to-end for synthetic clients): paste request in Cockpit →
   Intake + Planner write a plan → owner approves/rejects and picks Track A or B → build + verify job on GitHub Actions →
   "awaiting launch approval" or a plain-language failure.
2. **Failure → recovery** (Step 4D, built and deployed; live use not yet exercised): a stopped build says why in plain words and can be continued.
3. **Account request → owner/admin approval → sign-in** (Step 3A, done).
4. **"What needs me?"** home screen from real rows (Step 4C, deployed; signed-in live check still pending).

### 1.6 Scope
| In the current release (the plan in force) | Later | Out of scope (for now) |
|---|---|---|
| Steps 4B (finish), 4D (live proof), 25, 26, 27, 8–22 of `docs/WFACT-3.0-Factory-Completion-Plan.md`, in the Execution order | Step 23 Owner's Key port, closing reports, care plans; Step 24 autonomy upgrades; self-hosted/local models; SaaS packaging | Auto-deploy of client sites; moving money; Rizm's pipeline (Atif's, separate); knowledge graph (Cognee) before the Step 15 trial; simulation environment |
| **Proposed, sequenced after the first paid delivery**: agency pipeline (niche research, offer design), lead-gen content engine, dynamic features if ever needed (Part F of the plan). **Deferred**: e-commerce site type | | |

### 1.7 Confirmed vs assumed
**Confirmed** (written, from the owners): the five pillars; entity law; hosting law; template-first doctrine; Launch/Money gates;
two build tracks A/B chosen per build (Huraira 2026-10-01); AI images allowed if labelled; ask before any single build over $5;
Agent 37 is the builder; Higgsfield is the image tool; Nick's 2026-10-07 answers (agency pipeline yes, content engine yes after
delivery with client consent, "static" meant visually flat, every site motion-rich with 21st.dev and conversion-focused, e-commerce needs a different site type). Huraira's decisions the same day: D1 (two tracks, Track A motion budget, conversion hard gate), D2 (reliability bundle after the real-client run), e-commerce deferred.
**Assumed / provisional**: all of `memory/context.md` business rules (R-01…R-13 are Huraira's drafts, Nick to replace); the
pilot client (synthetic); the governance table; the entity list.
**Recommendations (mine, not decisions)**: sequencing changes in §6.

### 1.8 Misunderstandings and direction changes on record
- 100-hour sprint superseded 2026-09-28 by the Continuation Plan, then the Factory Completion Plan (steps 1–24, since extended to 1–27).
- Hostinger descoped 2026-09-22 for the sprint; Vercel stood in for "live". The hosting law itself is unchanged and Nick was never told in conversation (written disclosure only).
- Hermes-lite replaced a real Hermes Agent by the manual's pre-authorised fallback; Nick not yet told in conversation.
- **D1 decided 2026-10-07 (Huraira)**: two tracks kept, Track A motion budget (Step 27), conversion as a hard gate, e-commerce deferred.
- Static output was a deliberate 4B choice, then Nick (2026-10-07) said "static" meant flat, not technically static — the Addendum's dynamic tiers D0–D4 misread this and are superseded. The revised direction is now decided (D1 above); Nick confirms it by rating sample builds.
- Track B builder: planned as a different vendor from reviewer; today both are Agent 37 (same vendor), recorded in `packages/rendered-qa/config/reviewer.json`.

---

## 2. Which documents govern (precedence)

1. `docs/wfact-3.0-blueprint.html` — scope source of truth (13 phases, Cockpit §9, Definition of Done §16K). `docs/WFACT-3.0-Ecosystem-Blueprint.md` is its text copy.
2. `CLAUDE.md` — the law (verification, governance, architecture rules). Where it disagrees with the Blueprint, fix `CLAUDE.md`.
3. `docs/WFACT-3.0-Continuation-Build-Plan.md` (Stages 1–7) and `docs/WFACT-3.0-Factory-Completion-Plan.md` (Steps 1–27, Execution order after Part B, Standard Operating Rules in Part C — **read Part C before any step**).
4. Step designs: `docs/FRONTEND-UPGRADE-DESIGN.md` (4B), `docs/BUILD-RECOVERY-DESIGN.md` (4D), `docs/AGENT-PERMISSIONS.md` (6), `docs/COCKPIT-JOBS.md`, `docs/SECRETS.md`; `PRODUCT.md` for the Cockpit's design constraints.
5. Live state: `PROGRESS.md`, `BLOCKED-ON-NICK.md` (top table is current; below it is sprint-era record).
6. Reference only: Playbook (pillars, 2.0 carry-over), SOPs/Factory Book PDFs.
7. **Not governing**: `docs/WFACT-3.0-Agency-Scope-Addendum-DRAFT.md` (proposal), `docs/step-4c/PHASE-1-PROPOSAL.md` (history), everything in `docs/archive/` (see `docs/archive/MANIFEST.md`).

Known conflicts and how they resolve: PROGRESS.md "Status summary" said 4D was unapplied/unpushed → corrected this pass (header, CI and the Plan show applied/deployed). `README.md` described the finished sprint → rewritten. `.env.example` listed unused vars and missed used ones → rewritten. Continuation plan names `packages/agent-runtime/registry.ts`; the file is `src/registry.ts`.

---

## 3. Verified current implementation

**Independently re-run in this pass** (local, 2026-10-07): typecheck clean for all 10 packages and the Cockpit; tests pass — agent-runtime 39, audit 14, documentation 18, hermes 48, jobs 24, media 8, planning 32, verification 100, workflow 33, frontend-loop 75, Cockpit 67. Not re-run: rendered-qa (needs Chromium; CI runs it), RLS attack SQL (needs the live DB). CI on `main`: run `37647398124` success *(checked via `gh run list`)*; recent history shows failures that were real and fixed (`37638990031`, `37627375120`).

| Capability | Status | Evidence / caveat |
|---|---|---|
| Cockpit job dispatch (UI → Edge Function → GitHub Actions) | **Complete, verified** | Step 1; no tests or CI for the Edge Function itself |
| Accounts, RLS, approval-gated sign-in | **Complete, verified** *(reported)* | Attack scripts `scripts/rls_attack_test*.sql` (3A 32/32, 4D 26/26); run by hand, not in CI |
| Intake → Direction → Planner | **Complete** | `packages/planning`, 32 tests; synthetic inputs only |
| Builder/evaluator loop, Track A (static multi-page) and Track B (Next.js, motion) | **Partial** | Track B live build passes all but a simulated-LCP check missing 2.5 s by 0.02–0.08 s *(reported)*; Track A last live re-run failed on a dropped connection, retry added. M4 not closed |
| Rendered QA (screenshots, axe, Lighthouse, design rulebook) | **Complete, CI-verified** | reviewer is same vendor as builder |
| Verification registry (48 checks) + evaluator | **Complete for what exists** | 78-check / 50-point lists missing; OpenAI evaluator never made a live call (429) |
| Agent permissions (default-deny) | **Complete** *(reported live)* | Step 6; Hermes-lite reads `clients/<entitySlug>/memory.md` (slug misuse) |
| Documentation agent / episodic memory | **Complete** *(reported live)* | Step 5 |
| Build recovery (stopped build → plain diagnosis → continue) | **Partial** | Built, migration 0018 applied, deployed; the continue button never pressed on a real stopped build |
| Cockpit rooms: Home, Decisions, Projects, Activity, Costs, Settings, More | **Complete** (real data, no mocks) | signed-in live check pending; 3 test files for ~5k LOC |
| Cockpit rooms: System, Agents, Memory, Business | **Placeholders** ("Coming in Step N", honest) | Steps 9, 10, 14, 23 |
| Hermes-lite controller | **Partial, live** | read-only `ask` jobs; `KNOWN_ENTITIES` hard-coded (`packages/hermes/src/controller.ts:19`) |
| `packages/media` (Seedance/Higgsfield) | **Orphaned groundwork** | no importer, no CI job; M5 blocked on Higgsfield credits |
| Task/event queue, durable execution | **Missing** | Step 8; jobs table + GH Actions only |
| Cost governance per client, alerts, DR drill, 3-client test, Owner's Key | **Missing** | Steps 12, 17, 19, 18, 23 (real-client run: 25; calibration: 26; Track A motion: 27) |
| Launch files in starters (sitemap, robots, canonical, og:image; Track A 404) | **Missing** | Step 7 launch checks fail on them |
| Hosting on Hostinger | **Blocked/descoped** | no live Hostinger deploy exists |

No TODO/FIXME markers in shipped source. Placeholders are explicit and labelled (SAMPLE content, synthetic provenance).
**Retain**: everything above. **Correct**: Track A writes brief open-questions into page HTML comments (move to `content.json`); four copy-pasted mock model clients; `jobs/src/permissionsAttack.ts` lives in `src/`. **Retire**: nothing in code is proven obsolete; "Hermes-lite is superseded" is *not* evidenced. Migration 0016 is absent (cause not recorded).

---

## 4. Architecture and key decisions

```
Cockpit PWA (Vercel) --anon key, RLS--> Supabase (Postgres, Auth, Edge Function dispatch-job)
   job row --> dispatch-job --> GitHub Actions cockpit-job.yml --> doppler run -- tsx packages/jobs/src/run.ts <id>
   run.ts --> planning | frontend-loop (builder + track starters) | rendered-qa | verification | workflow(checkpoints) | documentation | hermes(ask)
   every step --> audit log + model traces; every tool call --> agent-runtime PermissionGate (default deny)
```

| Decision | Rationale (product need) | Trade-off |
|---|---|---|
| Browser holds only the anon key; RLS is the access control | Client isolation is a 2.0 law | Every table needs an attack test |
| Work runs on GitHub Actions, Cockpit only displays/gates | Hermes/Cockpit never execute code (CLAUDE.md §6) | ~15 min CI, 26 min job cap; Step 8 needed for durability |
| Doppler is the sole secret store; one GH secret | CLAUDE.md §6 | Edge Function secrets live separately in Supabase |
| Two tracks: A static multi-page (content JSON, starter owns code; motion budget coming in Step 27); B Next.js static export, isolated build | Different clients need different bars | Track B output differs byte-wise by platform; needs sudo/unshare sandbox |
| Checkpoint-and-resume, evaluator ≠ builder | "Never trust done" | Same-vendor review today (gap) |
| Deploys only from CI on `main`; `huraira-work` is the working branch | Launch stays human | **Pushing `main` deploys production** |

Optional improvement, not required: a root workspace/`npm ci` script (Step 21 decides workspaces).

---

## 5. Known issues, risks, assumptions

| # | Item | Risk |
|---|---|---|
| 1 | Nick has not yet confirmed D1 (he will, via the Step 27 blind rating); the agency pipeline is sequenced after the first paid delivery | Medium |
| 2 | Only synthetic clients; business rules provisional | High for goal 1 |
| 3 | Same-vendor reviewer; OpenAI 429; evaluator second vendor unproven live | Medium |
| 4 | Agent 37 builder unpriced; no USD or token ceiling sees ~190k tokens/run | Medium (Step 12) |
| 5 | Vercel 12-function ceiling caused a silent outage once | Medium (Step 20) |
| 6 | Higgsfield key posted in chat — rotate; no credits; no spend cap | Medium, security |
| 7 | CI does not cover `media`, `dispatch-job`, `db` attack SQL, `check-trackers` | Medium |
| 8 | Hosting law (Hostinger) never exercised; Vercel stood in | Medium |
| 9 | Track B simulated-LCP miss; launch files missing | Low–medium |
| 10 | 11 of 13 `.claude/hooks` scripts unregistered; unknown if wanted | Low |

---

## 6. Unresolved decisions (ask, do not guess)

| # | Question | Owner | Why it matters |
|---|---|---|---|
| D1 | **DECIDED 2026-10-07 (Huraira)**: keep two tracks; Track A gets a motion budget; Track B stays full 21st.dev/React; conversion is a hard gate (speed, layout shift, visible CTA); e-commerce deferred. Nick confirms by blind-rating sample builds (Step 27), not by conversation | Huraira | — |
| D2 | **DECIDED 2026-10-07 (Huraira): approved.** Steps 12 and 20 join Step 8 as one bundle, after the real-client proof run | Huraira | — |
| D3 | Runtime shape for any dynamic features within the Hostinger/Vercel law | Huraira | Only if dynamic features are proposed |
| D4 | Obtain AIW2.0STACK "website-factory shell" to compare real output | Huraira | Comparison currently rests on Nick's description |
| D5 | Spend caps: Higgsfield per build/month; Agent 37 auto top-up | Nick | M5 |

---

## 7. Ordered implementation backlog

Order approved by Huraira 2026-10-07 (it replaces the numeric order; the full table is "Execution order" in the Factory Completion Plan). Each step: read its Part D prompt, follow Part C, report, wait for GO.

| Order | Item | Depends on | Acceptance / verification (summary) |
|---|---|---|---|
| 1 | **Huraira actions**: re-run Track B `4acbde1f` and Track A `b5a45a8e` (closes 4B M4); press "continue" on a stopped build (4D live proof); buy OpenAI and Higgsfield credits; rotate the Higgsfield key | CI green | M4 closes when one live build per track passes and screenshots are reviewed |
| 2 | **Step 26** quality calibration | OpenAI credits | Live different-vendor call with trace row; human-vs-automated calibration table; visual-regression baseline that fails on a seeded regression |
| 3 | **Step 27** Track A motion budget (decision D1) | Step 26 | One-page design approved first; richer Track A passes speed, layout-shift and CTA checks; seeded motion violation fails; blind-rating sheet for Nick |
| 4 | **Step 25** real-client proof run (with 4B M5/M6 when Higgsfield credits land) | Nick's real brief or the real 2.0 DreamSign case; Step 26 | Measured corrections, cost, time vs the 40+ baseline; defects the checks missed listed; stops at the launch gate |
| 5 | **Steps 8, 12, 20** as one reliability bundle, plus Step 21 sub-item H (CI coverage) | 4, 6 | Crash-resume, capped retries + escalation, per-client serialisation; Agent 37 priced or token-capped; no 12-function risk; attack tests in CI |
| 6 | **Steps 9 then 10**: one thin Health room | 8 | Real data; failed check named |
| 7 | Steps 11, 13, 14, 17 as needed | 8–12 | Bounded scopes under the Step 6 model |
| 8 | Steps 18, 19, plus define the 50-point audit list | 8 | Three-client test, DR drill, goal 3 closable |
| 9 | Step 21 (rest), 22 | real inputs | per plan |
| 10 | After the first paid delivery: Step 23 and Part F proposals | revenue | per plan |
| Deferred | Steps 15, 16, 24 | real data | revisit after item 8 |

Not in scope now: an e-commerce site type (Huraira 2026-10-07).

Housekeeping folded into Step 21: launch files for both starters; stop writing open questions into Track A HTML; dedupe model clients; real entity list instead of `KNOWN_ENTITIES`.

---

## 8. Setup, environment, commands

**Tools**: Node (npm), `doppler`, `gh`, `graphify`, Supabase connector for migrations. No root `package.json`; use `npm ci` inside each package.

**Environment variable names (no values)** — stored in Doppler project `wfact-3-0-codebase` (`dev`/`prd`) unless noted:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `AGENT37_BASE_URL`, `AGENT37_API_KEY`, `VERCEL_TOKEN` (prd, CI only), `HF_CREDENTIALS` (Higgsfield), optional `OPENAI_API_KEY`, `ANTHROPIC_MODEL`, `AGENT37_REQUEST_TIMEOUT_MS`, `AGENT37_RETRY_DELAYS_MS`, `WFACT_ROUTE_<SLOT>`, `WFACT_BUILDER_VENDOR`, `WFACT_BUILDER_MODEL`, `WFACT_TASK_ID`.
GitHub Actions secret: `DOPPLER_TOKEN` only. Supabase Edge Function secrets: `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO`, `GITHUB_DISPATCH_REF`. Vercel project env (public): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Session opt-out: `WFACT_TRACKER_GUARD=off`.

```bash
cd apps/cockpit && npm ci && npm run dev                         # dev, :5173
cd apps/cockpit && npm run typecheck && npm test && npm run build
cd packages/<name> && npm ci && npm run typecheck && npm test    # rendered-qa also: npx playwright install chromium
node scripts/check-trackers.mjs                                  # must print OK
doppler run -- npx tsx packages/jobs/src/run.ts <job-id>        # what the Actions worker runs
```
Deploy: push `main` → CI (`ci.yml`) → `deploy-cockpit` (vercel pull/build/deploy prebuilt, smoke-checks HTTP 200). Do not push `main` without Huraira's say-so. Migrations: append-only files in `packages/db/migrations/`, apply via the Supabase connector, attack-test RLS, then `get_advisors`.
Supabase project `mcaxxhgjptwowwrluhra` is canonical (BLOCKED-ON-NICK.md). There is no lint script.

---

## 9. Read these; ignore those

**Read**: this file → `CLAUDE.md` → Factory Completion Plan Part C and the step you are on → `PROGRESS.md` (top 60 lines + that step's section) → `BLOCKED-ON-NICK.md` top table → `memory/context.md` (provisional) → the Blueprint section the step cites.
**Do not use as guidance**: anything in `docs/archive/` (manifest explains), the Addendum's section 2, the sprint-era tables in `BLOCKED-ON-NICK.md`, `.claude/completions/*` and `.claude/sessions/*` (history).

---

## 10. Exact next task

**Task: Step 26, part 1 — prove one live call on a different vendor from the builder.** (Steps before it are Huraira's actions in §7 item 1.)

*Precondition*: ask Huraira whether M4 is closed and whether OpenAI credits are in place. If not, report BLOCKED and stop; do not substitute the builder's vendor.
*Do*: follow Step 26 in the Factory Completion Plan Part D, item 1 only: one successful live call from the evaluator and one from the screenshot reviewer on a non-Agent-37 vendor, with trace rows; record the vendor in `packages/rendered-qa/config/reviewer.json`; report cost per review.
*Expected outcome*: independent review is real, not same-vendor.
*Done when*: two `model_traces` rows (checked with SQL) show the second vendor, existing suites pass unchanged, `node scripts/check-trackers.mjs` prints OK, and the report is in the Part C format. Then STOP and wait for GO before items 2–4 of the step.
