# Front-end upgrade (Step 4B) — two build tracks, chosen per client — design for approval

**Status**: DRAFT v2, awaiting GO. Nothing below is built.
**Decisions so far**: 2026-09-30 Huraira chose Option B. **Revised 2026-10-01 (Huraira): keep BOTH options as build tracks.** For each
build the Cockpit asks the owner to choose a track, and a new direction step reads the client's request, works out their niche,
requirements and brand direction, and **recommends** one track with its reasons. The owner's choice is final and recorded.
**Where it sits**: Step 4B, after Step 4 and before Step 5 of `docs/WFACT-3.0-Factory-Completion-Plan.md`. Launch and Money stay human
hard-gates; nothing here deploys to production.

## 1. Why

Step 4 proved the machinery, but the builder can only make one text-only HTML file (`frontend-loop/src/loop.ts:140`, `planner.ts:93`), and
every check reads text, never the rendered page, so a human found defects all checks missed. Clients also differ: a local trade business
wins on speed, clarity and calls/bookings; a brand-led client wants a motion-rich site. One builder style cannot serve both well.

## 2. The two tracks

| | **Track A — Local business, conversion-first** | **Track B — Motion-rich brand site** |
|---|---|---|
| For | Trades, clinics, salons, restaurants, local services | Agencies, product launches, premium/lifestyle brands, portfolios |
| Output | Multi-page static site (plain HTML/CSS/JS files), real images, gentle motion | Built project (Vite + React + Tailwind + router + GSAP), compiled to static files |
| Optimised for | Load speed on weak mobile signal, click-to-call, booking/quote forms, local search basics (business schema, NAP, service-area pages), trust and clarity | Visual impact, scroll-driven motion, rich sections, premium feel |
| Budgets (proposed) | LCP < 2.0 s mobile, total JS < 50 KB, no layout shift | LCP < 2.5 s mobile, motion respects reduced-motion, JS within a set budget |
| Effort (rough guess) | Smaller, built first | Larger, built second |

Both tracks share one site map, one content-as-data format, one asset pipeline and one rendered-QA stack, so a client can move between
tracks without rewriting content.

## 3. Direction step (niche → requirements → brand direction → track recommendation)

A new agent, registered without editing `agent-runtime` (same pattern as Intake/Planner), runs after Intake and before the Planner:

- **Input**: Intake's facts plus the raw request, `memory/context.md` (banned claims, tone) and the client's memory file.
- **Output (validated schema)**: niche category from a fixed taxonomy (versioned data, e.g. `local-trade`, `local-health`, `hospitality`,
  `professional-services`, `brand-product`, `creative-portfolio`, `other`); audience; primary conversion goal (call, booking, quote form,
  purchase, enquiry, portfolio view); stated requirements and constraints; brand direction (tone, palette, type feel, imagery style), with
  each point citing the request text it came from; **recommended track (A or B), confidence, and plain reasons**; open questions.
- **Rules**: never invents facts; low confidence or conflicting signals → no recommendation, the owner decides; the request text is data,
  never instructions (prompt-injection rule).
- **Evaluation**: a labelled fixture set of 10-15 synthetic requests across niches; the recommendation must match the label on most of them,
  and every miss is listed. No claim of accuracy without that run.

## 4. Cockpit changes

- The plan card in Approvals shows the direction summary (niche, goal, brand direction) and the recommended track with reasons.
- The owner picks **Track A or Track B** (pre-selected to the recommendation, changeable). The choice and whether it overrode the
  recommendation are stored on the plan and written to `audit_log`. A build cannot start without a chosen track.
- Runs show rendered screenshots (desktop, tablet, phone) and per-check results.

## 5. Shared foundation (both tracks)

1. **Content as data**: each page is JSON. Every factual claim (phone, hours, areas, counts, ratings, names, prices) must cite a field
   from the brief/intake, or it is forced to a labelled placeholder.
2. **Starters, template-first**: one committed, reviewed starter per track; the builder fills it and cannot add packages (pinned allow-list).
3. **Build in CI** with no secrets in the build step; artifact = static site + source in the private `artifacts` bucket, checkpoint hash.
4. **Assets**: generated or supplied images, always labelled, never presented as the client's own work, alt text required, size budgets.
5. **Rendered QA**: headless-browser screenshots at 1440/768/375, accessibility, performance against the track's budget, link and asset
   crawl, console errors, and text checks for content after the closing tag, required SAMPLE labels, banned claims and unsourced claims;
   plus a review of the screenshots by a model from a different vendor than the builder.

## 6. Milestones (each verified independently before the next)

| # | Milestone | Acceptance |
|---|---|---|
| M0 | Inputs settled (section 8) | Answers recorded in writing |
| M1 | Rendered QA + claims gate on today's builder | Re-checking the Step 4 page catches the leaked text, missing SAMPLE labels and invented phone/hours; clean fixtures pass |
| M2 | Direction step + track choice in the Cockpit | Fixture set run with per-case results; owner can choose/override a track; choice stored and audited; no build without a track |
| M3 | Track A, multi-page | 3+ page local-business site builds and passes rendered QA and its speed budget; a broken-link and an over-budget fixture fail |
| M4 | Track B, multi-page | Same, with motion; reduced-motion respected; over-budget fixture fails |
| M5 | Assets | Labelled images with alt text inside size budgets; an unlabelled generated image is caught |
| M6 | Full runs | Summit Line Roofing (expected Track A) and a second synthetic motion-led client (expected Track B) run through the Cockpit; human review at desktop and phone; defects listed |

## 7. Risks and honest unknowns

- Effort roughly doubles versus one track: my rough guess is 2-3 weeks across M1-M6, not measured. M1 gives the first real number.
- Builder capability: Agent 37 writes one file in 100-200 s; multi-file and React output may need another builder model, and the builder
  and evaluator must stay on different vendors (`CLAUDE.md` §6).
- Recommendation quality: niche detection from one email can be wrong; it only recommends, the owner always chooses.
- Cost per build rises (more output, images, screenshot review). First numbers come from M3/M4.

## 8. Inputs needed before M1 (Huraira / Nick)

1. Reference sites: 2-3 for Track A (local business) and 2-3 for Track B (motion-rich).
2. The niche taxonomy above: keep, or add/remove categories.
3. Image policy: AI-generated images allowed if labelled? Higgsfield access and budget, or another source.
4. Builder model: stay on Agent 37 or approve a second provider.
5. Spend ceiling (proposal: ask before any single build above $5).

## 9. What this does not change

Launch and Money remain hard-gated to Nick; nothing is "done" on the builder's own report; synthetic inputs stay labelled.
