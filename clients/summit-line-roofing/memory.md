# Client: summit-line-roofing

Copied from `clients/_template/memory.md`. **This is a SYNTHETIC, PROVISIONAL client, not a real one.**
Written 2026-09-30 under the Factory Completion Plan, Step 2, so the pipeline can be exercised before
Nick's real pilot brief lands. Every fact about "Summit Line Roofing" and "Dana Reyes" is invented. See
`clients/summit-line-roofing/brief.json` (`source: "synthetic-provisional-2026-09-30"`) and the
`BLOCKED-ON-NICK.md` rows for the real brief and business rules. Do not present anything in this folder
to anyone as a real client record.

## Entity

`bennett-co`, per `memory/context.md` §2 (the assignment is provisional, R-01 and R-13; Nick has not
confirmed the two active entities). Entity law: one client per entity. Bennett & Co has no other client
folder. There is **no `bennett-co` row in Supabase `entities` yet** (checked 2026-09-30), so no DB rows
exist for this client; registration is left to Step 4.

## Stage

`1 Intake`. Raw request written, not yet run through the Intake agent.

- Current stage: **1 Intake (not started)**
- Entered this stage on: 2026-09-30
- Waiting on (human or agent): Step 4 run (Cockpit: new request → Intake → Planner → owner approval)

## What's been decided

- Nothing has been decided with a client, because there is none. Package names (Repair, Replace, Care),
  section list and visual direction are the synthetic brief's own choices.
- Template preference: `clean-agency` (an existing template in `packages/frontend-loop/src/templates.ts`).

## What's waiting on a human

- Two deliberately planted ambiguities the Intake agent should notice and flag, not resolve:
  1. Whether to show package prices. The request contradicts itself ("I want the prices on there" vs
     "I don't really want numbers", "maybe 'from' prices, or none").
  2. Which booking method is real. The request wants online time-slot booking, but has no booking
     system, only a phone answered in the mornings; a callback form or phone-only are both offered.
- Forbidden-claim traps in the same request, which the build must refuse to publish as fact: "licensed
  and insured", "about 20 years, maybe 25", "best roofer in the county", "lifetime warranty".
- Nick to replace this whole synthetic client with his real pilot brief (`BLOCKED-ON-NICK.md`).

## Correction-round log

| Round | Stage | What was flagged | Fixed by | Date |
|---|---|---|---|---|

## Notes

- The correction count from a run on this brief demonstrates the factory but does **not** count against
  DreamSign 2.0's 40+ batches (synthetic input; Factory Completion Plan, Step 4).
- The Provisional-rule register in `memory/context.md` applies (prices, timelines, banned claims).
