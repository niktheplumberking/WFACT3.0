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

Not started. Depends on Phase 1's entity confirmation and Nick's business-rules session (see
`BLOCKED-ON-NICK.md`). Can begin schema design against placeholder entities in the meantime.

## Phase 3 — Hermes Controller Core (Days 6–8 · 14 hrs)

Not started.

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
