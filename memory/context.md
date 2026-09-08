# WFACT — Business Context

**Status: DRAFT.** This file is a placeholder built from the Factory Book, the Playbook, and the
Ecosystem Blueprint, per the Operator's Manual's own fallback rule for Phase 2 ("draft context.md with
placeholder rules pulled from the Factory Book and Blueprint, mark them clearly as drafts, swap in
Nick's real answers when the session happens"). Every field below marked **[PLACEHOLDER]** needs Nick's
30–60 minute business-rules session (Operator's Manual, Phase 2) before it's trustworthy. Every agent
reading this file should treat placeholder fields as unverified.

This is the file every agent reads first (after `CLAUDE.md`), before doing any work.

---

## 1. What WFACT is

An AI-run agency factory that builds and operates websites for clients, with the goal of eventually
selling the factory itself as a $500–$1,500/month SaaS product to other AI web agencies and solo
operators. Not a general-purpose "run your business" tool (that's FounderOS's niche) — WFACT is
specifically niched to AI web agencies.

## 2. Entities

**[PLACEHOLDER — blocking, per `BLOCKED-ON-NICK.md`]**: which 2 entities are active for this build
phase. Best-documented answer from the docs: **DreamSign + Bennett & Co**, with **Rizm** running
separately under Atif for now. Not yet confirmed by Nick as of this writing.

The schema (Phase 2) must be N-capable, not hardcoded to 2 — Nick has separate SaaS plans that will
reintroduce more entities later.

| Entity | Status | Notes |
|---|---|---|
| DreamSign | [PLACEHOLDER] active | The 2.0 benchmark case — full flight, 40+ correction batches recorded |
| Bennett & Co | [PLACEHOLDER] active | Stripe account not yet connected as of the Blueprint |
| Rizm | Separate, Atif-owned | Not part of the 2-entity build scope for this sprint |

**One client per entity.** Never mix client paperwork across entities — this is the "cardinal sin" per
the Factory Book, already caught an invoice-numbering bug by test in 2.0.

## 3. Active clients / projects

**[PLACEHOLDER]** — none logged yet in this repo. Per Operator's Manual Phase 4, one real (or pilot)
project brief is needed from Nick by Day 9 to drive the front-end loop proof. See `clients/_template/`
for the per-client memory file structure; a new client gets `clients/<name>/memory.md` copied from that
template, never re-asking the client for info already given (2.0's intake law, carried over).

## 4. Standing rules

- **[PLACEHOLDER — pricing bands]**: not yet supplied. Needs Nick's business-rules session.
- **Template-first doctrine**: standing law until one-shot generation is proven at scale (see `CLAUDE.md` §5).
- **Hosting law**: Hostinger for live sites, Vercel for previews only.
- **Verification culture**: nothing is "done" on an agent's own report — see `CLAUDE.md` §1.
- **Launch and Money are hard-gated to Nick**, unconditionally, forever.

## 5. Current priorities (this sprint)

Per the 100-hour build plan (`docs/wfact-3.0-nick-plan.html`):

1. Phase 1 (Days 1–2): Foundation & access — in progress, see `PROGRESS.md`.
2. Phase 2 (Days 3–5): State layer (Supabase schema) + this file, for real, once Nick's session happens.
3. Phase 3 (Days 6–8): Hermes controller core, wired to memory + state, Claude as first model.
4. Phase 4 (Days 9–12): Model routing + front-end loop v1 — the centerpiece, one real page, measured
   correction-round count vs. DreamSign's 40+.
5. Phase 5 (Days 13–15): Verification loop — 5–8 checks + an independent evaluator.
6. Phase 6 (Days 16–18): Cockpit MVP — one screen, live status.
7. Phase 7 (Days 19–20): Proof run + honest results report, sets next sprint's scope.

## 6. Open decisions blocking this file from being "real"

See `BLOCKED-ON-NICK.md` for the full, current list. The highest-priority ones for this file
specifically: the entity confirmation, and the business-rules session for pricing bands and standing
rules.
