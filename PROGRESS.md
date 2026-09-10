# Sprint Progress — WFACT 3.0, 100-Hour Build

Source: `docs/wfact-3.0-operator-manual.html`. Work top to bottom. Nothing gets checked as done until
its **exit check** actually passed, not attempted. If a phase overruns its hour budget, cut scope inside
that phase first — never borrow hours from a later phase.

---

## Phase 1 — Foundation & Access (Days 1–2 · 8 hrs)

**Objective**: unblock every account/credential/decision before writing code; get the repo running with
checks from day one.

- [x] Set up repo skeleton (this commit)
- [x] Draft `CLAUDE.md` (law file)
- [x] Draft `memory/context.md` (marked placeholder pending Nick's session)
- [x] Set up `memory/lessons-ledger.md`
- [x] Set up per-client memory template (`clients/_template/memory.md`)
- [x] Set up `BLOCKED-ON-NICK.md` tracker
- [ ] Base CI skeleton (in progress, this commit)
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
without GitHub + Vercel access (no remote to push to, no deploy target yet). Local scaffold + CI
skeleton is proceeding per the Day-0 fallback rule ("don't sit idle").

## Phase 2 — State Layer & Second Brain v1 (Days 3–5 · 16 hrs)

**In progress**, started against placeholder entities per the Operator's Manual fallback ("entity
decision still pending → use placeholder names now, don't block Phase 2 on it, rename later").

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
- [x] Set up the per-client memory file template — done in Phase 1

**Exit check**: *"A test query ('what stage is client X is in') returns a correct answer from the memory
files, and the RLS attack test fails to cross entity boundaries."* — **RLS half: met and verified**, see
`packages/db/RLS_ATTACK_TEST_RESULTS.md`. Memory-file query half is trivially true today only because
`context.md` is a placeholder with no real client yet — re-verify once a real client and Nick's business
rules land.

## Phase 3 — Hermes Controller Core (Days 6–8 · 14 hrs)

**In progress**, built as **Hermes-lite**, the Operator's Manual's own named fallback ("Hermes
self-hosting eats more time than budgeted → build Hermes-lite... Tell Nick if you do this, don't
substitute silently"). Self-hosting real Hermes has an open infra/budget dependency in
`BLOCKED-ON-NICK.md` ("Where the self-hosted second brain + Hermes run") that's still open at Day 6
— per the fallback rule, that blocks real Hermes without blocking this phase. **Nick needs to be
told about this substitution explicitly** — it isn't hidden, but it hasn't been said to him yet.

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
- [x] 26 automated tests, no live credentials needed — `packages/hermes/test/`, run via `npm test`,
      wired as a required CI job (`.github/workflows/ci.yml`, `hermes` job)
- [x] Live-query shape verified against the real `wfact-3-sandbox` Supabase project (admin path,
      `execute_sql`, 2026-09-10) — the `entities`/`clients`/`projects` join `state.ts` uses is correct
- [x] **New finding, not previously known**: verified this app's *own* credential path (not the
      admin path above) actually reaches Supabase — it does, but with only the anon key it returns
      **0 rows** even though fixture data exists, because RLS correctly blocks an unauthenticated
      request. Hermes needs `SUPABASE_SERVICE_ROLE_KEY` to answer real status questions, not just
      `SUPABASE_ANON_KEY`. Logged as a lessons-ledger proposal; added to `BLOCKED-ON-NICK.md`.
- [ ] Smoke test with a real status question — **BLOCKED**: `ANTHROPIC_API_KEY` is unset
      (`BLOCKED-ON-NICK.md`, "Claude / Anthropic API billing confirmation," open since Day 1). The CLI
      (`npm run ask -- "..."`) refuses to fabricate an answer without a real key rather than mocking
      around the gap — see `packages/hermes/README.md`'s verification table for exactly what is and
      isn't proven yet.

**Exit check** (not yet met): *"Hermes (or its stand-in) answers 'what's the status of X' correctly
and in plain language, sourced from real memory and state, not a canned response."* Everything up to
the live model call is built and independently tested against real files and a real database. The
call itself is blocked on `ANTHROPIC_API_KEY`. Not marking this done until that call actually runs
and is checked by something other than this same agent's own report — see `CLAUDE.md` §1.

## Phase 4 — Model Routing & Front-End Loop v1 (Days 9–12 · 22 hrs)

Not started. Needs Nick's pilot project brief by Day 9 (fallback: reuse a DreamSign-style page if late).

## Phase 5 — Verification Loop (Days 13–15 · 14 hrs)

Not started.

## Phase 6 — Cockpit MVP (Days 16–18 · 16 hrs)

Not started.

## Phase 7 — Proof Run & Handoff (Days 19–20 · 10 hrs)

Not started.

---

## Hour tracking

Check running total against budget at Day 5, Day 12, and Day 18 (Operator's Manual risk register).

| Phase | Budget | Actual so far |
|---|---|---|
| 1 | 8 hrs | — |
