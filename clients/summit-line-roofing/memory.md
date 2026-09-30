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

- Current stage: **4 Homepage build (attempted, failed, not complete)**
- Entered this stage on: 2026-09-30
- Waiting on: Huraira to top up Agent 37 credits (the builder's provider returned HTTP 402), then a fresh Build + verify

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
| 1 | 4 Homepage build (**synthetic pilot**, job `31c965ff`, workflow run `353b9945`) | The Claude evaluator reviewed the builder's first draft and requested changes (938 output tokens; the content of the request was not stored anywhere). | **Not fixed.** The builder's round-2 call failed with Agent 37 HTTP 402 (credits exhausted), the workflow escalated to a human, and the draft was lost (no checkpoint). Cockpit shows "0 builder correction rounds", which understates it. | 2026-09-30 |

## Notes

- The correction count from a run on this brief demonstrates the factory but does **not** count against
  DreamSign 2.0's 40+ batches (synthetic input; Factory Completion Plan, Step 4).
- The Provisional-rule register in `memory/context.md` applies (prices, timelines, banned claims).

## Step 4 run log (synthetic pilot, 2026-09-30)

- Intake + Plan via the Cockpit (job `1dd90f25`): entity `bennett-co` (certain), lead `new_website`, both planted
  ambiguities flagged; $0.0150 total (Intake $0.0027, Planner $0.0123), about 47 s.
- Owner rejected revision 1 (`cd5145f9`) with a note; re-plan (job `c62e24a4`) produced revision 2 (`825cfff6`),
  which carried the banned-claims list and SAMPLE testimonials; approved 2026-09-30 10:13:11 UTC.
- Build + verify (job `31c965ff`): **FAILED** after 1m49s. Builder draft 1 (Agent 37, 96 s, unpriced), evaluator
  requested changes (Claude, $0.0351), builder draft 2 call returned HTTP 402. No page was produced.
- No correction-count comparison to DreamSign 2.0's 40+ is possible from this run. It is synthetic in any case.
