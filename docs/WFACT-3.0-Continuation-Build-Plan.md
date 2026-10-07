# WFACT 3.0 — Continuation Build Plan

**For**: a coding agent picking up this repo next.
**Note 2026-10-07**: stage status lives in `PROGRESS.md`; the order of remaining work is the "Execution order" table in `docs/WFACT-3.0-Factory-Completion-Plan.md` (Stage 7, the real pilot, is now Step 25).
**Supersedes**: the 100-hour Operator's Manual sprint as the thing you're optimizing for. That sprint
proved a real vertical slice (verify-loop, RLS isolation, a live Cockpit) but its own exit checks were
never the actual finish line — the [Ecosystem Blueprint](WFACT-3.0-Ecosystem-Blueprint.md) and the
[Execution Roadmap](archive/sprint-100-hour/WFACT-3.0-Execution-Roadmap.md) are. This document sequences what's left of those
two, in dependency order, against what's *actually* in this repo today, not against calendar days.

**Why this document exists**: the sprint was time-boxed by days-per-phase. That produced real, verified
work (see [PROGRESS.md](../PROGRESS.md)), but "day 18" is not a unit of architectural progress, and
chasing it produced diminishing returns once the easy wins (schema, RLS, one verify loop) were done.
This plan replaces day-budgets with **dependency-gated stages**: a stage starts when its dependency is
real (not planned), and ends when its acceptance criteria are independently verifiable — per this
repo's own law, ["Never trust done, only verified."](../CLAUDE.md)

---

## 0. Rules that don't change

Carried directly from [CLAUDE.md](../CLAUDE.md) and the Blueprint — read those first if you haven't.
The three that matter most for what follows:

1. **Don't rebuild what's real.** `packages/hermes`, `packages/frontend-loop`, `packages/verification`,
   `packages/db`, and `apps/cockpit` are working, tested code, not scaffolding to throw away. Every
   stage below **extends** one of these, it does not replace them, unless a stage explicitly says so.
2. **A stand-in is fine; a silent one isn't.** `packages/hermes`'s own README calls itself a "Phase 3
   controller stand-in" for the real self-hosted Hermes Agent, and says why, in the open. Every new
   piece of this plan that substitutes for something the Blueprint names (Cognee, Langfuse, n8n,
   LangGraph, a real secrets manager) must say so the same way — a doc comment, a README section, and
   a `PROGRESS.md` line. Never let a stand-in look like the real thing.
3. **A stage is not done because the agent says so.** Every acceptance criterion below has to be
   checked by something other than the same session that built it: a test, a second model call, a
   fixture, or a human. If a stage can't produce that kind of evidence yet, it isn't done, it's
   attempted.

---

## 1. Where this repo actually stands (short version)

Full detail already lives in [PROGRESS.md](../PROGRESS.md); this is the compressed version needed to
pick a starting point.

**Real and verified:**
- State layer (`packages/db`): schema, entity-law constraints, RLS — attack-tested twice, for real.
- Hermes-lite (`packages/hermes`): schema-validated tool allowlist, memory/state read tools, tone
  filter, bounded retry/escalation — 26/26 tests, one real live smoke test against real Supabase state.
- Front-end loop (`packages/frontend-loop`): Motion Sites + 21st.dev wired live, Agent 37 as builder,
  Claude as evaluator (real vendor independence) — one real run, 2 correction rounds, beats the 2.0
  DreamSign baseline of 40+.
- Verification loop (`packages/verification`): 6 deterministic checks + one independent live Claude
  evaluator — proven against both a fixture and Phase 4's real output.
- Cockpit (`apps/cockpit`): 3-room MVP (Pipeline/Approvals/Runs), live, real Supabase data, real
  magic-link auth, RLS-gated writes.

**Explicitly not real yet** (this is the actual backlog, not a hidden one):
- No self-hosted Hermes Agent, Cognee, Langfuse, n8n/Temporal, LangGraph, or secrets manager — none of
  the Blueprint §13 named tools exist; everything above is a hand-rolled stand-in.
- No agent runtime as a reusable pattern — `frontend-loop` and `verification` are two separate,
  bespoke CLIs, not two instances of one spawn/execute/report/terminate lifecycle (Blueprint §3).
- No workflow engine — nothing chains build → verify → deploy as one actual pipeline with a checkpoint
  between stages; a human runs each CLI by hand today.
- Only 2 of the Blueprint's 14 named agent roles exist in any form (front-end-ish, QA-ish). Intake,
  Planner, Research, Back-end, Documentation, Lessons, Memory-consolidation, Deploy, Monitoring,
  Recovery, Improvement, Optimization: none exist.
- No observability/tracing layer, no audit log, no task queue, no agent/workflow/model/tool/prompt
  registries (Blueprint §14's five registries).
- `memory/context.md` is still placeholder content — Nick's real business-rules session hasn't happened.
- The one pilot ran on a placeholder brief, not a real client.

This is roughly Phase 0–1 of the [Execution Roadmap](archive/sprint-100-hour/WFACT-3.0-Execution-Roadmap.md)'s 5-phase plan,
and Phase 0–4 (of 13) of the Blueprint's build order (§4), with Phases 2, 3, 4, 5, 8, 9 each partially
started, not sequentially completed. **The stages below finish those partials in dependency order
before opening any new phase**, rather than spreading thinner across more phases.

---

## 2. Forward build order

Each stage: **Objective**, what it **builds on** (real files, not new scaffolding), concrete **tasks**,
**acceptance criteria** (must be independently checkable), and **do not build yet** (the discipline the
Blueprint itself insists on — do not let a stage's scope creep into the next one's job).

### Stage 1 — Close the Phase 0/1 debt that blocks everything else being "real"

**Objective**: the foundational gaps that make every later "done" claim slightly fake if left open.
**Builds on**: `.github/workflows/ci.yml`, `.env.example`, `packages/db/migrations/`.
**Tasks**:
1. CI auto-deploy: extend `.github/workflows/ci.yml` so a merge to the trunk branch actually deploys
   Cockpit to Vercel (the deploy step exists manually today — script it, don't hand-run it again).
2. Secrets manager: stand up a real one (a cloud provider's secrets manager, or HashiCorp Vault if
   self-hosting is preferred) and migrate `.env.local`'s real values into it. This is Blueprint §12/§13's
   explicit requirement, not optional hardening.
3. Audit log: add one Supabase table (`audit_log`: actor, action, task_id, timestamp, payload) and
   write to it from every place that currently just logs to console or a markdown file — starting with
   Hermes-lite's tool calls and the verification loop's pass/fail decisions. This is Blueprint §14's
   "Yes, extend 2.0's" audit system item, and it's the cheapest of the missing registries to start.

**Acceptance criteria**:
- A commit to trunk produces a live Cockpit deploy with zero manual steps (the Operator's Manual's own
  unmet Phase 1 exit check — close it here, not by re-attempting the sprint).
- `grep -r "SUPABASE_SERVICE_ROLE_KEY\|ANTHROPIC_API_KEY"` across the repo finds zero plaintext values
  outside the secrets manager's own config.
- A real Hermes-lite tool call and a real verification run each produce a row in `audit_log`,
  independently queried back out (not just "the code that writes it looks right").

**Do not build yet**: a full policy engine, feature flags, or the other four registries — this stage is
audit logging specifically, because it's the cheapest win and everything downstream benefits from it.

---

### Stage 2 — Generalize the agent runtime (Blueprint Phase 5)

**Objective**: one reusable agent lifecycle, not two bespoke CLIs that happen to look similar.
**Builds on**: `packages/frontend-loop/src/loop.ts`, `packages/verification/src/verificationLoop.ts`,
`packages/hermes/src/tools/schema.ts` (the schema-validation pattern already proven there).
**Tasks**:
1. Extract the common shape both loops already share (assemble context → call a model → produce a
   structured result → report) into a new `packages/agent-runtime` package: a typed `Agent` interface
   (bounded task in, structured result out, per Blueprint §3's "typed task object, not a free-form
   prompt" rule) plus a `runAgent()` executor that handles retry/escalation (reuse
   `packages/hermes/src/escalation.ts`, don't reimplement it).
2. Re-point `frontend-loop` and `verification` to be two `Agent` implementations running on this
   runtime, not two standalone scripts. Behavior should not change — this is a refactor with tests
   proving it, not a rewrite.
3. Add a minimal agent registry: `packages/agent-runtime/registry.ts`, a typed list of
   `{ role, skillset, permissionScope }` — start with exactly the 2 agents that exist
   (`front-end-builder`, `qa-evaluator`). This is Blueprint §14's agent registry, seeded honestly small.

**Acceptance criteria**:
- `frontend-loop`'s and `verification`'s existing test suites still pass unchanged after the refactor
  (proves behavior preservation, not just "it compiles").
- A new agent (see Stage 4) can be added by implementing the `Agent` interface and registering it,
  without touching `agent-runtime`'s own code — proves the abstraction actually generalizes.

**Do not build yet**: the other 12 agent roles, a durable execution engine, or agent-to-agent handoffs
— this stage is the lifecycle abstraction only, proven with the 2 agents that already exist.

---

### Stage 3 — Workflow engine v1: chain build → verify as one real pipeline (Blueprint Phase 6)

**Objective**: the two-stage proof pattern the Blueprint's Phase 6 acceptance criteria actually asks
for — today a human runs `frontend-loop` then manually runs `verification`; nothing chains them.
**Builds on**: Stage 2's `agent-runtime`, `packages/verification/src/verificationLoop.ts`.
**Tasks**:
1. Add a `packages/workflow` package with one workflow: `buildAndVerify(brief)` — runs the front-end
   agent, checkpoints the result (write to `audit_log` from Stage 1), then runs the QA agent against
   that checkpoint, not against a human-triggered re-run.
2. Prove the checkpoint/rollback pattern for real: feed it a brief that produces a deliberately broken
   page (reuse `packages/verification/test/fixtures/broken.html`'s pattern) and confirm the workflow
   halts before a "stage 2" (deploy) would run, returning the specific failed check to the front-end
   agent — not a vague retry.
3. Wire this workflow as the one entry point `clients/<name>/` pipelines use going forward, instead of
   two separate `npm run` commands a human chains by hand.

**Acceptance criteria**:
- One command runs the full build→verify chain against a real brief and produces either a verified,
  deployable page or a specific, actionable failure — matching Blueprint Phase 6's literal acceptance
  criteria ("a deliberately broken output at stage one is caught before stage two runs").
- The checkpoint between stages is a real row in `audit_log`, not just an in-memory variable — so a
  crash mid-pipeline is recoverable from the last checkpoint, per Blueprint §3's failure-recovery rule.

**Do not build yet**: a durable execution engine (n8n/Temporal), multi-workflow chaining, or the
full 11-stage pipeline — this is the two-stage proof only, per the Blueprint's own phase discipline.

---

### Stage 4 — Add Intake and Planner (Blueprint Phase 7, started honestly)

**Objective**: prove the agent-runtime abstraction from Stage 2 generalizes past the 2 agents it was
built from, and close the biggest process gap: nothing today decides *what* to build before the
front-end agent starts building it.
**Builds on**: Stage 2's `Agent` interface, `packages/hermes` (Intake/Planner should call Hermes-lite
for routing decisions, not duplicate its logic).
**Tasks**:
1. `Intake` agent: takes a raw brief (today, a hand-written `brief.json`), classifies entity assignment
   and lead type, using the fast/cheap model tier per Blueprint §7 (Claude Haiku-class, not the
   frontier tier — this is also the first real test of model routing beyond the hardcoded
   builder/evaluator split).
2. `Planner` agent: takes Intake's output, breaks it into the stage tasks Stage 3's workflow already
   expects, selects a template. Owner-approval gate on the plan (Blueprint §5's existing rule) routes
   through the Cockpit's Approvals room, which already exists — extend it, don't rebuild it.
3. Register both in Stage 2's agent registry.

**Acceptance criteria**:
- A brief goes in one end (raw JSON or a short form, not a hand-shaped `brief.json` already matching
  the pipeline's internal schema) and a Planner-approved task list comes out the other, without a
  human hand-writing the intermediate structure.
- The model-routing split (fast/cheap for Intake, mid-tier for Planner) is configuration, not
  hardcoded per agent — the first real proof of Blueprint §7's routing table, past the current
  2-model hardcode.

**Do not build yet**: Research, Back-end, Documentation, Lessons, or any of the other 8 agent roles —
add them only once Intake/Planner prove the pattern holds under a second and third agent, not before.

---

### Stage 5 — Observability seed (Blueprint Phase 8, minimal)

**Objective**: every run traceable, without adopting a heavyweight tool before the simple version is
shown insufficient (the Blueprint's own stated discipline for this exact decision).
**Builds on**: Stage 1's `audit_log` table.
**Tasks**:
1. Extend `audit_log` (or add a sibling `traces` table) to capture, per run: task ID, model used,
   token counts, real dollar cost (the cost math already exists in `modelClient.ts` in both
   `hermes` and `frontend-loop` — centralize it here instead of duplicating it a third time),
   latency, and outcome.
2. Add a `Models` room to the Cockpit reading this table — usage by model, cost per model per task
   type, the first real piece of Blueprint §9's dashboard map beyond Pipeline/Approvals/Runs.

**Acceptance criteria**:
- Every agent run from Stage 4 onward produces one queryable trace row with a real, non-estimated
  dollar cost — closing part of the Blueprint §16K Definition-of-Done item ("real cost per client
  measured, not estimated").
- The Cockpit's new Models room shows real data from a real run, not a mock.

**Do not build yet**: Langfuse or any external tracing vendor — only adopt one once this simple table
is shown insufficient (missed traces, no way to query cross-run patterns), per Blueprint §13's own rule.

---

### Stage 6 — Real second brain v1.5: episodic memory tied to task IDs

**Objective**: close Blueprint Phase 2's actual, still-open gap — episodic memory is supposed to be
written by a documentation agent at the end of every stage and indexed, not a hand-edited markdown
file updated whenever someone remembers to.
**Builds on**: `clients/dreamsign-pilot/memory.md`, Stage 4's agent pattern.
**Tasks**:
1. Add a `Documentation` agent (the 3rd new agent role) that writes a structured entry to
   `clients/<name>/memory.md` at the end of every stage in Stage 3's workflow — tied to the task ID
   from `audit_log`, not free text a human writes after the fact.
2. Do not adopt Cognee yet. Evaluate it as a **trial**, per the Blueprint's own framing ("leading
   candidate to trial," not a locked choice) — spend at most one session standing up a local Cognee
   instance against the now-larger set of real episodic entries from step 1, and write up whether it's
   worth the operational cost for a team this size. This is evaluation, not adoption.

**Acceptance criteria**:
- A test query ("what happened on client X's build") returns a correct answer sourced from the
  structured memory file, written by the Documentation agent, not by a human — the literal Blueprint
  Phase 2 acceptance criterion, finally closed for real instead of trivially true on an empty file.
- The Cognee trial write-up exists and states plainly whether to adopt it, not just that it was tried.

**Do not build yet**: agent-writable *semantic* memory (`memory/context.md` itself) — that stays
human-edited-first per Blueprint §8 until Phase 5 (agent trustworthiness) is further along than it is
now. Also do not wait on Nick's business-rules session to do the rest of this stage — it's independent.

---

### Stage 7 — A real pilot, not a placeholder one

**Objective**: the actual Roadmap Phase 1 exit criterion — one real client through the *entire*
pipeline, correction-batch count measured against DreamSign's 40+, for real this time.
**Builds on**: everything above — this stage is a real run, not new code.
**Tasks**:
1. This stage is gated on two Nick-only inputs that no amount of further building substitutes for:
   a real pilot brief, and the business-rules session for `memory/context.md`. Flag both explicitly in
   `BLOCKED-ON-NICK.md` the moment Stage 6 finishes, don't wait until this stage starts to ask.
2. Once both land: run Stage 3's full workflow (Intake → Planner → build → verify) against the real
   brief, with real business rules informing Planner's decisions for the first time.
3. Log the correction-batch count the same honest way Phase 4's placeholder run was logged.

**Acceptance criteria**: matches Blueprint §16K item 1 exactly — one real client, full pipeline,
measured correction count below 40+, independently verified (curl the live URL, re-run the
verification checks against the deployed output, don't take the pipeline's own "done" for it).

**Do not build yet**: a second concurrent client — prove one real client end to end before Roadmap
Phase 2's "repeat and harden" starts.

---

## 3. What deliberately stays out of this plan

Per Blueprint §16J ("Do Not Build Yet") and the Roadmap's own phase gates — these are not oversights:

- Multi-tenant SaaS features, Owner's Key, any client-facing product surface beyond the one pilot page.
- A durable execution engine (n8n/Temporal) — Stage 3's workflow package is enough until multiple
  concurrent workflows actually need it.
- The remaining ~9 agent roles beyond Intake/Planner/Documentation — add each only when the workflow
  actually needs it, not speculatively.
- Local/open-source model evaluation (GLM-5.2, DeepSeek V4) — Blueprint Phase 4/12 territory, and
  explicitly gated on real cost data this plan's Stage 5 starts producing, not before.
- Removing the template-first doctrine, voice mode, a task queue — no concurrency pressure exists yet
  to justify any of the three.
- The Claude Code vs. Codex bake-off the Execution Roadmap's own Phase 0 asked for and never ran —
  worth doing, but it's a decision-with-a-deadline item for Nick/Huraira, not a coding-agent task.

---

## 4. How to log progress against this plan

Use the same discipline `PROGRESS.md` already established — this plan does not introduce a new
format. When a stage's acceptance criteria are met, sync `PROGRESS.md` (the `/progress-sync` skill's
own workflow: gather evidence from git/repo state, not self-report) and mark it there, not here. This
file is the map; `PROGRESS.md` stays the source of truth for what's actually done.

If a stage turns out to need something this plan didn't anticipate, that's expected — note it under
"Gaps noticed" in the next `PROGRESS.md` sync, and adjust the stage's task list here rather than
silently working around it.
