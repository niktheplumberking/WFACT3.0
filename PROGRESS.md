# Sprint Progress — WFACT 3.0, 100-Hour Build

Source: `docs/wfact-3.0-operator-manual.html`. Work top to bottom. Nothing gets checked as done until
its **exit check** actually passed, not attempted. If a phase overruns its hour budget, cut scope inside
that phase first — never borrow hours from a later phase.

---

**Status summary**: We're actually in **Phase 4 — Model Routing & Front-End Loop v1**. Phases 1–3 are
built and independently verified (Hermes-lite: 26/26 tests re-run and passing today; RLS attack test:
PASS) modulo the access items still open in `BLOCKED-ON-NICK.md`. Phase 4's builder/evaluator loop,
hand-picked templates, brief loader, and correction-log writer are fully coded and unit-tested (20/20
passing) against the hand-picked-template + Claude-only fallbacks the Manual itself pre-authorizes —
but **no live run has happened yet** (no `ANTHROPIC_API_KEY`, no `.env` in this environment), and this
entire Phase 4 body of work (`packages/frontend-loop/`, `clients/dreamsign-pilot/`) currently sits
**uncommitted** in the working tree. Biggest blocker: `ANTHROPIC_API_KEY` (open since Day 1) is what
stands between "code that passes its own unit tests" and the actual generate→review→fix proof run
Phase 4's exit check requires.

**Next up**:
1. Commit the uncommitted Phase 4 work (`packages/frontend-loop/`, `clients/dreamsign-pilot/`) — it's
   real, tested, and currently unprotected by git.
2. Get `ANTHROPIC_API_KEY` (and ideally `SUPABASE_SERVICE_ROLE_KEY`, blocking Phase 3's smoke test too)
   to unblock the first live loop run.
3. Get Nick's real pilot brief, or an explicit go-ahead to run the DreamSign placeholder as the sprint's
   proof case, so the correction-round count that comes out means something.

**Gaps noticed**:
- The Manual's Phase 4 exit check says "one real page live" but never defines "live" — a locally written
  HTML file (what `cli.ts` currently produces) vs. something actually hosted/deployed. Worth confirming
  with Nick before calling Phase 4 done even once a live loop run succeeds.
- The Manual asks for hour tracking checked against budget at Day 5, 12, and 18 (`docs/wfact-3.0-operator-manual.html`
  risk register); no actual-hours data has been logged anywhere in the repo so far.
- `packages/frontend-loop` has no CI job (unlike `packages/hermes`'s typecheck+test job in
  `.github/workflows/ci.yml`) — add the same pattern once this package is committed.

**Unplanned work done**:
- Local Claude Code tooling scaffold added: `.claude/` (Claude Token Optimizer hooks/settings,
  `COMMON_MISTAKES.md`, `QUICK_START.md`, `ARCHITECTURE_MAP.md`) and a `graphify` knowledge-graph skill,
  plus a `.claudeignore` and a "Session Start Protocol" + "graphify" section appended to `CLAUDE.md`.
  This is agent/dev-environment tooling, not a WFACT sprint deliverable from any phase checklist.
- Two Nick-facing progress-report docs published (`docs/wfact-3.0-nick-progress-update.html`, added and
  then reframed on 2026-09-08 to drop hour/day estimates in favor of phase names) — a communication
  artifact that isn't itself a phase checklist item, but supports Phase 7's "present to Nick" step.

---

## Phase 1: Foundation & Access (Days 1–2 · 8 hrs)

- [x] Set up repo skeleton (this commit)
- [x] Draft `CLAUDE.md` (law file)
- [x] Draft `memory/context.md` (marked placeholder pending Nick's session)
- [x] Set up `memory/lessons-ledger.md`
- [x] Set up per-client memory template (`clients/_template/memory.md`)
- [x] Set up `BLOCKED-ON-NICK.md` tracker
- [ ] Base CI skeleton (guardrails + hermes typecheck/test jobs exist in `.github/workflows/ci.yml`;
      still a placeholder `build` job pending Phase 6's `apps/cockpit`)
- [ ] Secrets manager wired, nothing in plaintext (pattern documented in `.env.example`; real secrets
      manager needs infra decision — see `BLOCKED-ON-NICK.md`)
- [ ] Confirm GitHub access: existing 2.0 repo + new 3.0 repo created — **blocked on Nick**
- [ ] Confirm Supabase project access — **blocked on Nick**
- [ ] Confirm Vercel + Hostinger account access — **blocked on Nick**
- [ ] Pull the 3 SOPs + Ops Manual from Nick's Drive — **blocked on Nick**
- [ ] Get Motion Sites MCP + 21st.dev premium credentials — blocked on Nick, not due until Day 9
- [ ] Get Higgsfield MCP credentials — blocked on Nick, not due until Day 9
- [ ] Confirm Claude/Anthropic API billing setup — **blocked on Nick**
- [ ] Confirm which 2 entities — **blocked on Nick** (using DreamSign + Bennett & Co as placeholder)

**Exit check** (not yet met): *"A commit reaches a deployed preview through CI with zero manual steps,
and every access item is either confirmed or has a tracked workaround in place."* — Cannot fully close
without GitHub + Vercel access (no remote to push to, no deploy target yet).

## Phase 2: State Layer & Second Brain v1 (Days 3–5 · 16 hrs)

- [x] Design Supabase schema: entities, clients, projects, tasks, correction_rounds, profiles/roles
      — `packages/db/migrations/0001_init_schema.sql`
- [x] Entity law encoded as a schema constraint (trigger), not just convention
      — `packages/db/migrations/0002_entity_consistency_triggers.sql`
- [x] Write RLS policies — `packages/db/migrations/0003_rls_policies.sql`
- [x] Run an isolation/RLS attack test — `scripts/rls_attack_test.sql`,
      results in `packages/db/RLS_ATTACK_TEST_RESULTS.md`: **PASS**, cross-entity isolation holds,
      the entity-consistency trigger correctly rejects a mismatched insert
- [x] Independent verification via `get_advisors(security)` — caught 2 real findings (mutable
      search_path, publicly-exposed SECURITY DEFINER functions), fixed in migration `0004`; fixing
      that then surfaced a genuine RLS recursion bug the attack test caught, fixed in migration `0005`
      (see `memory/lessons-ledger.md` for the full lesson)
- [x] Schema applied and verified against a real Postgres instance: `wfact-3-sandbox` (Supabase
      project `xwljilyjirmcryakbirk`, under the Designtive org) — a dedicated sandbox for this sprint,
      separate from Nick's real 2.0 project (still blocked)
- [ ] Draft `context.md`: business rules, entities, pricing bands — done as placeholder in Phase 1,
      still needs Nick's real business-rules session (Day 3–5) to become non-draft
- [x] Set up the per-client memory file template — done in Phase 1 (now has a real instance in use:
      `clients/dreamsign-pilot/memory.md`, see Phase 4)

**Exit check**: *"A test query ('what stage is client X is in') returns a correct answer from the memory
files, and the RLS attack test fails to cross entity boundaries."* — **RLS half: met and verified**, see
`packages/db/RLS_ATTACK_TEST_RESULTS.md`. Memory-file query half is trivially true today only because
`context.md` is a placeholder with no real client yet — re-verify once a real client and Nick's business
rules land.

## Phase 3: Hermes Controller Core (Days 6–8 · 14 hrs)

**Built as Hermes-lite**, the Operator's Manual's own named fallback. Self-hosting real Hermes has an
open infra/budget dependency in `BLOCKED-ON-NICK.md` that's still open — per the fallback rule, that
blocks real Hermes without blocking this phase. **Nick still needs to be told about this substitution
explicitly** — logged in `BLOCKED-ON-NICK.md`, not yet an actual conversation.

- [x] Wire to memory (`context.md` + per-client files) — `packages/hermes/src/tools/memoryTools.ts`,
      read-only, path-traversal-guarded, tested against the real `memory/context.md`
- [x] Wire to Supabase state — `packages/hermes/src/state.ts` + `tools/stateTools.ts`, read-only,
      no write path exists in this package at all
- [x] Schema-validated tool wrapper + allowlist (CLAUDE.md §6) — `packages/hermes/src/tools/schema.ts`,
      the allowlist itself is `tools/registry.ts`; nothing else can be called
- [x] Build the plain-language tone filter — `packages/hermes/src/toneFilter.ts`, built in this phase
      per the team's own call, not bolted on later
- [x] Bounded retry / escalation (CLAUDE.md §6: bounded, exponential backoff, hard cap, then
      escalate) — `packages/hermes/src/escalation.ts`
- [x] Configure Claude as the first model behind it — `packages/hermes/src/modelClient.ts`
      (`ClaudeModelClient`); one model path only, per Blueprint Phase 3 scope
- [x] 26 automated tests, no live credentials needed — `packages/hermes/test/`, re-run today
      (2026-09-11): **26/26 passing**, wired as a required CI job (`hermes` job in
      `.github/workflows/ci.yml`)
- [x] Live-query shape verified against the real `wfact-3-sandbox` Supabase project (admin path,
      `execute_sql`, 2026-09-10) — the `entities`/`clients`/`projects` join `state.ts` uses is correct
- [x] **New finding**: verified this app's *own* credential path (not the admin path above) actually
      reaches Supabase — it does, but with only the anon key it returns **0 rows** even though fixture
      data exists, because RLS correctly blocks an unauthenticated request. Hermes needs
      `SUPABASE_SERVICE_ROLE_KEY` to answer real status questions, not just `SUPABASE_ANON_KEY`. Logged
      as a lessons-ledger proposal; added to `BLOCKED-ON-NICK.md`.
- [ ] Smoke test with a real status question — **still BLOCKED**: re-confirmed today (2026-09-11) that
      no `ANTHROPIC_API_KEY` and no `.env` exist in this environment. The CLI (`npm run ask -- "..."`)
      refuses to fabricate an answer without a real key rather than mocking around the gap.

**Exit check** (not yet met): *"Hermes (or its stand-in) answers 'what's the status of X' correctly
and in plain language, sourced from real memory and state, not a canned response."* Everything up to
the live model call is built and independently tested against real files and a real database. The
call itself is blocked on `ANTHROPIC_API_KEY`.

## Phase 4: Model Routing & Front-End Loop v1 (Days 9–12 · 22 hrs)

**In progress, not yet committed to git.** Built against the Manual's own two named fallbacks for this
phase: hand-picked templates instead of dynamic 21st.dev selection, and Claude instead of Kimi K3 (both
credentials still open in `BLOCKED-ON-NICK.md`).

- [ ] Wire Motion Sites MCP — not started; still **OPEN** in `BLOCKED-ON-NICK.md` (credentials due Day 9)
- [ ] Wire 21st.dev MCP — not started; taking the Manual's own fallback instead: 3 hand-picked templates
      in `packages/frontend-loop/src/templates.ts` (`clean-agency`, `bold-startup`, `minimal-portfolio`)
- [x] Configure the front-end agent (Kimi K3 as candidate executor) — built with Claude as builder *and*
      evaluator (two separate client instances, `packages/frontend-loop/src/modelClient.ts` +
      `loop.ts`), per the Manual's explicit Kimi-K3-delayed fallback; Kimi K3 itself not yet available
- [ ] Get one real pilot brief from Nick — not received; running against a placeholder brief
      (`clients/dreamsign-pilot/brief.json`, `source: "placeholder-2.0-case"`, reused from the 2.0-era
      DreamSign homepage brief) per the Manual's "no pilot brief by day 9" fallback
- [ ] Run the loop: generate → self-review → fix → done — **code complete and unit-tested**
      (`packages/frontend-loop/src/loop.ts` + `test/loop.test.ts`, 20/20 tests passing, re-run today
      against a mocked model client, including hard-cap escalation and malformed-evaluator-response
      handling), but **no live run has happened** — blocked on `ANTHROPIC_API_KEY`
      (`packages/frontend-loop/src/cli.ts` refuses to fabricate a result without it, same pattern as
      Hermes's CLI)
- [ ] Log every correction round, this number is the whole point — the logging mechanism is built and
      tested (`packages/frontend-loop/src/correctionLog.ts`, appends to a client's `memory.md`), but the
      correction-round table in `clients/dreamsign-pilot/memory.md` is still empty because no real run
      has completed yet

**Exit check** (not yet met): *"One real page live, plus an honest correction-round count logged and
compared against DreamSign's 40+."* Everything short of an actual model call is built and passing its
own tests against a real placeholder brief. Not marking any part of this done until a real loop run
happens and something other than this same agent's own report checks it — see `CLAUDE.md` §1.

## Phase 5: Verification Loop (Days 13–15 · 14 hrs)

Not started. No files found under any plausible location for check scripts or evaluator wiring beyond
what Phase 4's loop already does structurally (separate builder/evaluator instances).

## Phase 6: Cockpit MVP (Days 16–18 · 16 hrs)

Not started. `apps/cockpit/` contains only a `.gitkeep`.

## Phase 7: Proof Run & Handoff (Days 19–20 · 10 hrs)

Not started.
