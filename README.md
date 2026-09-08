# WFACT 3.0

Private monorepo for WFACT 3.0. **Start here, in order:**

1. [`CLAUDE.md`](CLAUDE.md) — the law file. Every agent (human or AI) reads this first.
2. [`PROGRESS.md`](PROGRESS.md) — live status of the current 100-hour build sprint, phase by phase.
3. [`BLOCKED-ON-NICK.md`](BLOCKED-ON-NICK.md) — everything waiting on access, a decision, or budget.
4. [`memory/context.md`](memory/context.md) — business identity, entities, standing rules (currently
   draft, pending Nick's business-rules session).
5. [`docs/`](docs/) — the full planning documents this repo executes against: the Build Playbook, the
   Execution Roadmap, the Ecosystem Blueprint, and the 20-day sprint's Nick-facing plan + requirements +
   the Operator's Manual.

## Structure

```
CLAUDE.md               law file — read first
PROGRESS.md             sprint phase tracker
BLOCKED-ON-NICK.md       access/decision/budget tracker
.env.example             env var shape, no real values, ever
memory/
  context.md             business-wide semantic memory (draft)
  lessons-ledger.md       never-repeat mistakes, owner veto
clients/
  _template/memory.md    per-client memory file template
apps/
  cockpit/                the control room PWA (Phase 6+)
packages/                 shared logic across apps
scripts/                  automation, checks, attack tests
docs/                     source planning documents (do not treat this repo's other files as replacing
                           these — they summarize the docs, the docs are the source of truth)
```

## What this is, right now

Not the full multi-month build. This repo currently executes the **100-hour, 7-phase proof sprint**
described in `docs/wfact-3.0-nick-plan.html` and `docs/wfact-3.0-operator-manual.html`: prove one real
loop (controller → memory → front-end build → verification → cockpit visibility) end to end, on one
real or pilot client, with honest measured numbers — not a finished product. See `PROGRESS.md` for
where things stand today.
