# Example clients (synthetic)

Written 2026-10-15 (Step 28 follow-up). Two fictional clients whose intake is complete and consistent, so a build of one
of them tests the factory, not the brief. Every failed build so far mixed "the factory is broken" with "the brief was
messy": Harbor Street `e6a71046` halted because its owner answers disagreed with each other, and Lanternworks' owner facts
are half test values. These two remove the brief as a variable.

| Folder | Business | Track | Pages |
|---|---|---|---|
| `clients/example-agency-studio/` | Quillmere Studio, a four-person brand and web studio. Shaped like Bennett & Co's MVP: services, process, three labelled sample case studies, trust signals, a contact form | B | Home, Services, Process, Work, About, Contact |
| `clients/example-local-trade/` | Brightwater Lane Plumbing, a one-van plumber opening on Tuesday 2 March 2027 | A | Home, Services, Pricing, Areas, About, Contact |

Each folder holds `raw-request.txt` (the client's email, pasted into the Cockpit unchanged), `plan-inputs.json` (every
Cockpit detail slot plus the uploads), `brief.json` (the brief as it would stand once approved, with every input applied),
`logo.svg`, `images/` (one picture per expected media slot) and `memory.md`.

## What they are for

1. **Regression baseline.** After any change to the builder, QA, the rulebook or the claims rules, run one of them. A
   failure is then the factory's, not the brief's.
2. **Step 26 calibration reference.** A known-good intake to score the quality evaluator against.
3. **A model of a complete intake.** What "everything the factory needs" looks like: every slot in
   `apps/cockpit/src/lib/inputs.ts` answered (or deliberately waived), the brand locked, the pages and sections named,
   no open questions, no two answers on one topic, no "unclear" labels.
4. **Demo.** A build that can be shown without a real client's data.

## How they stay honest

- **Clearly fake.** Phones are in the reserved 555-01xx range, emails and sites are on `example.com` / `example.org`,
  streets and towns are invented, and every name is made up. `raw-request.txt` opens with a SYNTHETIC line that says the
  customer quotes are invented stand-ins to be used word for word, like a real client's own.
- **Labelled samples.** Quillmere's Work page shows three illustrative sample projects; the request says each must be
  labelled as a sample.
- **Held by a test.** `packages/workflow/test/exampleClients.test.ts` checks that each brief passes `parseBrief` and
  `checkBriefConsistency`, that `plan-inputs.json` answers every Cockpit slot and produces exactly the brief's owner facts,
  that every contact detail is a reserved fictional one, that the logo and images are files the upload would accept, and
  that the readiness check passes with the logo attached. A slot added to `inputs.ts` later fails that test until both
  examples answer it.
- `brief.json` has `source: "synthetic-provisional-2026-09-30"` (the existing value for agent-written fictional briefs).
  It carries no `logo` or `images` record, because those exist only after an upload (a storage path and fingerprint).
- Facts with no Cockpit slot (Quillmere's team, trust signals and sample projects) are in the request text only, which is
  a fact source for the builder and the claims check. The Cockpit has no free-form field to type them in.

## How to run one today (live Cockpit, Huraira)

1. **New request**: paste `raw-request.txt` exactly as it is.
2. Wait for the plan. Check its questions: there should be none the request does not already answer (the planner now asks
   each topic once). **Approve** it and pick the track: **B** for Quillmere, **A** for Brightwater Lane.
3. On **What the site still needs**, enter each row of `plan-inputs.json` → `inputs`, one per slot (a row with
   `"waived": true` is **Build without it**). Upload `logo.svg` as the logo, and each image in `images/` to the slot the
   Cockpit lists whose id matches its filename. Slot ids come from the builder's content, so a slot may be named slightly
   differently; leave any that has no matching file as a placeholder.
4. **Start the build** and record the job id, the result and the cost in the client's `memory.md` (Runs table).

**Expected cost**: about $1 to $2 a run (Harbor Street's continue `e6a71046` was $1.22), under the $5 per build cap.
Spend is booked to `bennett-co`, like every rehearsal so far.

## Caution

A perfect brief flatters the factory. Real clients contradict themselves, leave gaps and send test values. Passing an
example proves the build path, not the intake path. A "realistically messy" example (contradictions, a missing logo, a
vague offer, half-answered questions) should follow, so the guards that handle mess are exercised too.

## Not built yet (waiting on the lead-form work and Huraira's GO)

These are proposals in `PROGRESS.md` "Gaps noticed", not features:

- a "Start from example" button in the Cockpit that loads one of these intakes;
- an `is_test` flag with its own test entity, so rehearsal spend stops landing on `bennett-co`;
- a `lead_sites` row for each example, so its contact form is connected rather than marked "not connected".
