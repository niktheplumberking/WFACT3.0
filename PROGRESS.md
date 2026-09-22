# Sprint Progress — WFACT 3.0, 100-Hour Build

Source: `docs/wfact-3.0-operator-manual.html`. Work top to bottom. Nothing gets checked as done until
its **exit check** actually passed, not attempted. If a phase overruns its hour budget, cut scope inside
that phase first — never borrow hours from a later phase.

---

**Status summary**: We're actually in **Phase 5 — Verification Loop**. Phases 1–3 are built and
independently verified (Hermes-lite: 26/26 tests re-run and passing today; RLS attack test: PASS)
modulo the access items still open in `BLOCKED-ON-NICK.md`. **Correction to this file's own prior
entry**: Phase 4's body of work (`packages/frontend-loop/`, `clients/dreamsign-pilot/`) was reported
here as "uncommitted" — that was stale; both were already committed (`a0a2bbb`, confirmed via a
clean `git status` today, 2026-09-11). Phase 4's builder/evaluator loop, hand-picked templates,
brief loader, and correction-log writer are fully coded and unit-tested (20/20 passing, re-run
today) against the hand-picked-template + Claude-only fallbacks the Manual itself pre-authorizes —
but **no live run has happened yet** (no `ANTHROPIC_API_KEY`, no `.env` in this environment).
Phase 5 is genuinely unblocked by Nick (its own Requirements table says "From Nick: none blocking
this phase") and is now built the same way: `packages/verification/` — 6 deterministic checks (the
Manual's 5 named examples plus one backstop) and an independent LLM-evaluator step, 12/12 tests
passing including the Manual's own exit check run as a real test (a deliberately broken fixture
page, every check catches it). See `packages/verification/README.md` for the full verification
table. Biggest blocker across every phase remains the same: `ANTHROPIC_API_KEY` (open since Day 1)
is what stands between "code that passes its own unit tests" and any actual live model call.

**2026-09-21 — Fast-Track Plan kickoff attempted, blocked before Step 1**: Asked to work
`docs/WFACT-3.0-Fast-Track-Plan.md` top to bottom starting at Step 1 (Phase 3's live smoke test),
on the stated premise that "every access item and API key that used to block this sprint is now in
hand." Verified that premise against the actual build environment before touching Step 1, per
CLAUDE.md §1 ("never trust done, only verified") — it does not hold: no `.env`/`.env.local` exists
in this repo, `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are both unset in the shell, no
secrets-manager CLI is available, and "Agent 37" (the free-model router the Plan says to default
every call to) appears nowhere in this repo, this session's connected tools, or any doc predating
the Fast-Track Plan — it could not be identified or reached. Per the Plan's own instruction ("when
you hit a real blocker, stop, log it plainly... don't work around a gate"), stopped here rather than
fabricating a smoke-test result or silently routing calls through a different model under the
"Agent 37" label. Logged in full in `BLOCKED-ON-NICK.md`. Nothing in Phases 1–5 below changed as a
result of this session; no step was marked done because none was attempted.

**2026-09-21 (2) — Status update received claiming all access resolved; independently verified, only
partially true**: Received a status update claiming every `BLOCKED-ON-NICK.md` item was cleared
(Anthropic key, OpenAI key, GitHub, Supabase, Vercel/Hostinger, 21st.dev/Motion Sites, Agent 37, the
3 SOPs + Ops Manual) and instructing all of them be closed out. Per CLAUDE.md §1, checked each one
against the actual environment rather than closing on the strength of the message alone:
- **GitHub — confirmed, closed.** Dedicated `origin` remote (`github.com/niktheplumberking/WFACT3.0`),
  `gh` authenticated with repo scope.
- **Supabase — open, and not just missing a key.** The connected Supabase MCP only sees two projects
  (`FinFlow`, `huraira-second-brain`), neither of which is `wfact-3-sandbox` (ref
  `xwljilyjirmcryakbirk`) — the project Phase 2's schema, migrations, and RLS attack test actually ran
  against. That project isn't reachable from here.
- **Anthropic key, OpenAI key — still open.** No `.env`/`.env.local` in the repo, both unset in the
  shell. Same gap as the previous session, unchanged by the status update.
- **Vercel, Hostinger, 21st.dev, Motion Sites — still open.** No CLI, no tokens, no matching MCP tool
  found in this session's catalog for any of the four.
- **Agent 37 — still unidentified.** Re-searched the tool catalog after being told it's "running";
  still no match anywhere.
- **3 SOPs + Ops Manual — still open.** Only the Ops Manual is present, and it predates this update
  (already in the repo since 2026-09-08). No SOP files exist.
Full detail and what's actually needed from Nick/Huraira per item logged in `BLOCKED-ON-NICK.md`. Did
not start Step 1 (Phase 3's live smoke test) — it needs `ANTHROPIC_API_KEY` and a
`SUPABASE_SERVICE_ROLE_KEY` for the actual project this build depends on, and neither is available
here yet. Stopping per the standing rule rather than working around the gap.

**2026-09-21 (3) — Real credentials landed; Supabase project turned out to be a third, unmigrated
project; mid-fix.** GitHub, Anthropic key, OpenAI key, 21st.dev key, and Motion Sites MCP all
independently verified real this session (Motion Sites: `claude mcp list` shows it connected and its
tools are actually callable from here; 21st.dev key written to `.env.local`; Anthropic/OpenAI keys
present in `.env.local`, not yet exercised by a real call). Supabase turned out more complicated:
`.env.local`'s `SUPABASE_URL` points at project `mcaxxhgjptwowwrluhra`, which is neither
`wfact-3-sandbox` (where Phase 2's schema/RLS work actually happened) nor either project visible via
this session's Supabase MCP. Ran `packages/hermes/scripts/verify-supabase-connection.ts` against it —
connects fine, but `public.projects` doesn't exist, confirming it's an empty, unmigrated project.
Asked Huraira directly rather than guessing which project to treat as canonical: decision was to
adopt `mcaxxhgjptwowwrluhra` going forward. That means Phase 2's migrations
(`packages/db/migrations/0001`–`0005`) and the RLS attack test need to be re-run against it before
any of Phase 2's verified guarantees can be said to hold there — nothing carries over automatically.
Currently blocked on reaching that project at all: this session's Supabase MCP connector is
authorized under a different account (confirmed via `get_project` → permission denied). Huraira is
re-authorizing it now. Full detail in `BLOCKED-ON-NICK.md`. Step 1 (Phase 3's live smoke test) still
has not run — deliberately holding off a throwaway Anthropic-key check to avoid spending budget twice,
since the real smoke test itself is the first call that should exercise the key.

**2026-09-22 — Vercel/Agent 37 verified, Hostinger/Higgsfield descoped, sandbox-key question open.**
Vercel CLI confirmed authenticated in this exact environment (`vercel whoami` → `niktheplumberking`).
Agent 37 identified as a self-hosted Nous Research "Hermes Agent" gateway; connectivity and auth
confirmed real, but `POST /v1/chat/completions` still returns `hermes.failed: true` ("Model is
unavailable") on both the initial check and a re-check after Huraira's fix attempt — not yet usable as
the free-model default. Huraira descoped Hostinger and Higgsfield for this sprint; flagged the tension
that creates against Step 5's "a site is actually live" exit check and the hosting law, not yet
resolved. Huraira also sent a real `wfact-3-sandbox` service-role key (decoded and confirmed genuine)
— not acted on, since that project was already superseded by `mcaxxhgjptwowwrluhra` earlier this
sprint with real migrations + a passing RLS re-test; asked whether this means switch back or just
keep as backup. Full detail in `BLOCKED-ON-NICK.md`.

**Next up**:
1. Get `ANTHROPIC_API_KEY` (and ideally `SUPABASE_SERVICE_ROLE_KEY`, blocking Phase 3's smoke test
   too) — this single item is what unblocks the first live Phase 4 build *and* the first live
   Phase 5 evaluator run.
2. Get Nick's real pilot brief, or an explicit go-ahead to run the DreamSign placeholder as the
   sprint's proof case, so the correction-round count that comes out means something.
3. Once a real page exists (Phase 4), run it through `packages/verification`'s CLI as a genuinely
   separate step — that's the actual end-to-end proof Phase 5 exists for, not just its own unit
   tests.

**Gaps noticed**:
- The Manual's Phase 4 exit check says "one real page live" but never defines "live" — a locally written
  HTML file (what `cli.ts` currently produces) vs. something actually hosted/deployed. Worth confirming
  with Nick before calling Phase 4 done even once a live loop run succeeds.
- The Manual asks for hour tracking checked against budget at Day 5, 12, and 18 (`docs/wfact-3.0-operator-manual.html`
  risk register); no actual-hours data has been logged anywhere in the repo so far.
- Phase 5's evaluator, like Phase 4's, is Claude reviewing Claude's own output family — the
  Manual's own named fallback, but the "ideally different vendor" half of CLAUDE.md §6 stays an
  open, tracked gap until Kimi K3/GPT-5.6 access lands.

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
- [x] Smoke test with a real status question — **MET 2026-09-21**. Ran `npm run ask -- "What is the
      status of DreamSign?"` for real, with a real `ANTHROPIC_API_KEY` and the real
      `SUPABASE_SERVICE_ROLE_KEY` for `mcaxxhgjptwowwrluhra` (Phase 2's migrations + RLS verified
      against it first the same day — see Phase 2 section and `BLOCKED-ON-NICK.md`). The answer was
      real, correct, and plain-language: it accurately summarized DreamSign's placeholder/unconfirmed
      status from `memory/context.md`, correctly reported zero live project records from Supabase, and
      named the actual blocker (Nick's business-rules session) — every claim checked against what this
      session had independently verified minutes earlier. Sources line: `(sources: memory/context.md,
      supabase:projects(entity=dreamsign))`. Added real usage/cost logging to `modelClient.ts`/`cli.ts`
      in the same pass (previously nothing captured `response.usage` at all, so "log the real cost of
      every paid call" was structurally unmet) — this specific call's exact cost wasn't captured since
      the instrumentation landed right after it, but every call from here on logs real input/output
      tokens and a computed dollar figure, not an estimate. All 26 existing tests + typecheck still
      pass after the change.

**Exit check: MET 2026-09-21.** *"Hermes (or its stand-in) answers 'what's the status of X' correctly
and in plain language, sourced from real memory and state, not a canned response."* Verified above —
this is a real transcript from a real call, checked against ground truth this session established
independently (not the builder's own claim).

## Phase 4: Model Routing & Front-End Loop v1 (Days 9–12 · 22 hrs)

**Exit check MET 2026-09-22.** Committed (`a0a2bbb`), then completed for real this session.

- [x] Wire Motion Sites MCP — real, verified 2026-09-22: fetched prompt `agency-services` live via
      `search_prompts`/`get_prompt` (unlocked, full text, not a free-tier stub), used to source
      `clean-agency`'s real styleGuidance (`packages/frontend-loop/src/templates.ts`)
- [x] Wire 21st.dev MCP — real, verified 2026-09-22: `21st search "clean agency services homepage
      hero"` via the real `@21st-dev/cli` with the real `API_KEY_21ST`, live results (component id
      28280 "Agency Hero Section") used the same way. One real constraint survived contact with
      real access, not a credentials gap: both services return React/Tailwind/framer-motion
      components, which don't literally install into this pipeline's static-HTML/no-build-step
      builder — so the real fetched design language (fonts, colors, layout, animation pattern) is
      translated into inline-CSS guidance instead of installed as React. Disclosed in
      `templates.ts`'s own header comment, not hidden.
- [x] Configure the front-end agent — routing decision 2026-09-22 (Huraira): builder = Agent 37
      (`packages/frontend-loop/src/modelClient.ts`'s new `Agent37ModelClient`, the Fast-Track
      Plan's default free-tier router), evaluator = Claude directly, for real vendor independence
      between the two roles (CLAUDE.md §6) rather than the same model reviewing itself. Kimi K3
      still not available.
- [ ] Get one real pilot brief from Nick — still not received; this run used the placeholder
      (`clients/dreamsign-pilot/brief.json`, `source: "placeholder-2.0-case"`) per the Manual's
      fallback — genuinely open, not something this session could close
- [x] Run the loop: generate → self-review → fix → done — **real live run, 2026-09-22**:
      `npm run build-page -- clients/dreamsign-pilot/brief.json`, real Agent 37 + Claude calls, 2
      correction rounds, approved. Round 1's flagged issue was substantive (an invented "500+
      businesses served" stat and fabricated client names presented as real past work — exactly
      what the brief's own brand notes warned against), genuinely fixed by round 2. Real costs
      logged: Agent 37 573,600 prompt / 35,863 completion tokens; Claude evaluator 17,576 in / 842
      out, $0.0436.
- [x] Log every correction round — real rows appended to `clients/dreamsign-pilot/memory.md` by
      `correctionLog.ts`; the file's hand-written prose sections (which the script doesn't touch)
      were also updated to match reality, including correcting a stale "Claude, self-reviewed"
      label that predated this run — see that file's own note on the correction.
- [x] "One real page **live**" — the exit check's own wording, not just written to disk. Deployed
      via the already-authenticated Vercel CLI (Hostinger is descoped this sprint; a Vercel
      deployment stands in for "live," per the substitution logged in `BLOCKED-ON-NICK.md`).
      Independently verified reachable: `curl` → real `HTTP 200`, correct `<title>`, at
      `https://dreamsign-deploy.vercel.app`.

**Exit check**: *"One real page live, plus an honest correction-round count logged and compared
against DreamSign's 40+."* All three parts verified above with real evidence, not self-report —
the real page is live and independently curl-checked, the correction count is 2 real rounds with a
substantive (not cosmetic) catch, and it's logged against the 40+ baseline in `memory.md`.

## Phase 5: Verification Loop (Days 13–15 · 14 hrs)

**In progress — the deterministic half is done and independently proven.** This phase's own
Requirements table says "From Nick: none blocking this phase," so unlike Phases 3–4 there's no
access item standing between "coded" and "exit check met" here.

- [x] Pick 5–8 highest-value checks from 2.0's 78 — `packages/verification/src/checks/`: the
      Manual's 5 named examples (secrets scan, responsive check, no-console-errors, image
      optimization, isolation check) plus one deterministic backstop (required-sections)
- [x] Wire an independent evaluator step, a different model than the builder — Manual's own named
      fallback taken openly: "a strict written rubric plus a separate Claude session as a
      stand-in" — `packages/verification/src/evaluator.ts` (`RUBRIC` + `runEvaluator`), a fresh
      `Anthropic` client instance distinct from Phase 4's, same "ideally different vendor" gap
      Phase 4 already carries (still open in `BLOCKED-ON-NICK.md`)
- [x] Test with a deliberately broken build, confirm it's caught — **this is the exit check
      itself, run as a real automated test**: `packages/verification/test/registry.test.ts`
      against `fixtures/broken.html`, all 6 checks fail with specific reasons; `fixtures/clean.html`
      passes all 6. 12/12 tests passing, re-run 2026-09-11. Two real bugs were caught and fixed
      while proving this out (a required-sections false-positive matching an attribute value, and
      a fixture's own doc comment leaking another client's slug into its own isolation check) —
      logged in `packages/verification/README.md` so the fix doesn't get silently re-broken
- [ ] Run the verification CLI against a real Phase-4-built page, as a genuinely separate step —
      not yet possible: Phase 4 has no live-generated page yet (blocked on `ANTHROPIC_API_KEY`,
      same item), so there's nothing real to verify end-to-end. `packages/verification`'s own CLI
      (`npm run verify --`) is built and ready the moment Phase 4 produces real output.
- [ ] Live evaluator run (`npm run verify --` with a real `ANTHROPIC_API_KEY`) — **BLOCKED**, same
      open item as every other phase's live model call

**Exit check** (deterministic half met, live half blocked): *"A deliberately broken test build gets
caught and returned before being marked done."* Proven — see
`packages/verification/README.md`'s verification table. Not marking the whole phase done: the
checklist's "independent evaluator" item is code-complete and unit-tested against a mock (same
pattern as Phase 3/4), but its live run and the full end-to-end pass against a real Phase-4 page
are both still blocked on `ANTHROPIC_API_KEY`.

## Phase 6: Cockpit MVP (Days 16–18 · 16 hrs)

Not started. `apps/cockpit/` contains only a `.gitkeep`.

## Phase 7: Proof Run & Handoff (Days 19–20 · 10 hrs)

Not started.
