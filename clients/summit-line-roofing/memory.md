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
exist for this client. Step 4 showed none are needed: `plan_approvals` has no foreign key to entities or clients.

## Stage

`4 Homepage build`, built and QA-approved but **not launch-ready** (2026-09-30): see the Step 4 run log and the defects the checks missed.

- Current stage: **4 Homepage build (built, verified by the automated checks, human review found defects)**
- Entered this stage on: 2026-09-30
- Waiting on: Huraira's decision on a preview deploy, and on fixing the defects the checks missed (below)

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
| 0 | 4 Homepage build, first attempt (**synthetic pilot**, job `31c965ff`) | Evaluator requested changes on draft 1. | **Not fixed.** Agent 37 HTTP 402 (credits exhausted), workflow escalated, draft lost. No page. | 2026-09-30 |
| 1 | 4 Homepage build, attempt 2 (job `81c8607b`, workflow run `0cfc6675`) | Near-black hero/process backgrounds contradict the green/cream palette; body copy at weight 300 with 0.6-0.8 opacity lowers contrast; Google Fonts loaded with 8 weights; service rows invisible without JS. | Agent 37 (builder), round 2 | 2026-09-30 |
| 2 | same | Hero claims "140+ homeowners served" (unverified, banned-claim spirit); oversized Services heading hurts mobile readability; marquee duplicate list not `aria-hidden`. | Agent 37 (builder), round 3 | 2026-09-30 |
| 3 | same | Approved by the Claude evaluator (no issues); then QA evaluator approved, 0 failed checks. | n/a | 2026-09-30 |
| 1 | 4_homepage_build | (approved, no issues) | workflow build-and-verify run 470ea1b9 | 2026-10-01 |
| 1 | 4_homepage_build | index/packages: the note "We haven't settled on how to show pricing online yet" exposes the open pricing question as visitor-facing copy; the brief requires open questions to be flagged for a human reviewer, not stated as content on the live page. | workflow build-and-verify run 470ea1b9 | 2026-10-01 |
| 2 | 4_homepage_build | (approved, no issues) | workflow build-and-verify run 470ea1b9 | 2026-10-01 |
| 1 | 4_homepage_build | (approved, no issues) | workflow build-and-verify run 470ea1b9 | 2026-10-01 |
| 1 | 4_homepage_build | (approved, no issues) | workflow build-and-verify run 2bfca49e | 2026-10-01 |
| 1 | 4_homepage_build | (approved, no issues) | workflow build-and-verify run 2bfca49e | 2026-10-01 |
| 1 | 4_homepage_build | (approved, no issues) | workflow build-and-verify run 2bfca49e | 2026-10-01 |

## Notes

- The correction count from a run on this brief demonstrates the factory but does **not** count against
  DreamSign 2.0's 40+ batches (synthetic input; Factory Completion Plan, Step 4).
- The Provisional-rule register in `memory/context.md` applies (prices, timelines, banned claims).

## Step 4 run log (synthetic pilot, 2026-09-30)

- Intake + Plan via the Cockpit (job `1dd90f25`): entity `bennett-co` (certain), lead `new_website`, both planted
  ambiguities flagged; $0.0150 total (Intake $0.0027, Planner $0.0123), about 47 s.
- Owner rejected revision 1 (`cd5145f9`) with a note; re-plan (job `c62e24a4`) produced revision 2 (`825cfff6`),
  which carried the banned-claims list and SAMPLE testimonials; approved 2026-09-30 10:13:11 UTC.
- Build + verify attempt 1 (job `31c965ff`): **FAILED** after 1m49s. Builder draft 1 (Agent 37, 96 s, unpriced), evaluator
  requested changes (Claude, $0.0351), builder draft 2 call returned HTTP 402. No page was produced.
- Agent 37 credits were restored (checked 2026-09-30 with a 1-token call, HTTP 200). Build + verify attempt 2 (job `81c8607b`, run
  `36743601290`, workflow run `0cfc6675`): dispatched 16:21:32, finished 16:30:10 UTC (8m38s). **3 build->evaluator rounds,
  2 of which requested changes**, then approved; QA evaluator approved with 0 failed checks. Artifact
  `clients/summit-line-roofing/pages/clean-agency.html` (private `artifacts` bucket), 32,854 bytes, sha256
  `960b61bab2ff8a5247bf46c93fc167f12548bd496a218bc20a4818aae0ba8f37`. Nothing deployed.
- Model calls: builder (Agent 37 `hermes-agent`) x3, unpriced (22,214/13,695; 85,718/29,969; 108,601/14,691 tokens; 101.6 s, 210.8 s, 105.3 s);
  evaluator (`claude-sonnet-5`) x3 in the loop ($0.0468, $0.0497, $0.0406); QA evaluator x1 ($0.0370). Priced total $0.1741, plus Agent 37
  unpriced. Independent verification CLI run (`4a73fa57`): $0.0306.
- Independent verification: downloaded from storage, sha256 identical to the checkpoint; `npm run verify` 6/6 deterministic checks PASS and the
  evaluator APPROVED.
- **Defects the automated checks missed (found by human review of the file and the rendered page):**
  1. **Agent-tool output leaked into the page.** After `</html>` the file ends with "File-mutation verifier: 2 file edit(s) FAILED..."
     (`/dev/stdout`, `/tmp/never.html`); browsers render it as visible text under the footer.
  2. **Testimonials not labelled SAMPLE** although the approved plan required it; they show 5-star ratings and named-looking people (Janet K., Robert M., Teresa P.).
  3. **Invented facts**: phone (555) 014-7732 (the brief said 555-0142), service hours Mon-Sat 7-6 (the client said the phone is answered only in the mornings),
     six invented service-area neighbourhoods, "response within one business day", "no automatic charges, ever", and initials avatars "JK RM TP" as social proof.
  4. Packages are Inspection / Repair / Replacement, not the requested Repair / Replace / Care.
  5. Google Fonts loaded from third-party hosts (the original brief asked for none). 43 text elements under 14px and 8 tap targets under 44px at 375px.
  Good: no licence/insurance/best/lifetime/warranty/price text, contact section last, one h1, skip link, no horizontal overflow at 375px.
- Correction count for this run: **2 rounds requesting changes + 1 approval** (plus 1 lost round in the failed first attempt). Synthetic input, so it
  demonstrates the factory but is **not comparable** to DreamSign 2.0's 40+ correction batches.
