# Website Build Module MVP: cut-line (Decision D3)

**Status (2026-10-20)**: the window closed on 2026-10-14. M5 (launch files) and M6 (cost caps) are met; M4 (contact form) is met
live on synthetic data; the real Bennett & Co run waits on Nick's brief (Step 25). The order of work is now `PROGRESS.md` "Next up".

Recorded 2026-10-10 from the Nikola/Huraira chat of 2026-10-08. Owner: Huraira (sequencing); Nick (money, client, final design call).
This file is the scope fence. Anything not listed under "Must work" is deferred, and adding to "Must work" costs time that must be named.

## 1. The decision

- **Goal**: prove the Website Build Module (Tracks A and B) on one real project, Bennett & Co (Nick's LLC), by **Wednesday 2026-10-14**. Nick starts ads about 2026-10-13/15 and needs a trustworthy agency site; then he tests 3 to 4 more builds for his own needs.
- **Proving project**: redesign and rebuild the Bennett & Co site as a proper web agency site. **Colors and logo are fixed. Fonts may change.** Nick shares the brief / GitHub repo (name like "bennett and co") on 2026-10-10.
- **Scope**: websites only. **No e-commerce or stores** (already decided 2026-10-07). Forms feed the CRM capture only; no product, payment or dedicated-CMS work.
- **Later in Nick's own queue (not this MVP)**: update 2 existing sites, create 2 new marketing sites, 1 sales landing page with a VSL.
- **No scope creep**: anything new added moves the date. The default answer to a new request is "after Wednesday".

## 2. Must work by Wednesday (the MVP)

| # | Capability | Done when (verified, not reported) |
|---|---|---|
| M1 | Brief intake from Nick's Bennett & Co material (brief and/or existing repo) into the Cockpit, with fixed colors, fixed logo and font freedom recorded as constraints | A Cockpit run whose stored constraints show the locked colors and logo; the build output uses exactly those colors and the supplied logo file |
| M2 | Direction step proposes a track and a vision plan (Brand DNA stage); owner picks the track | Direction output and owner pick are stored on the run |
| M3 | One full build on the chosen track, then rebuilt on the other if time allows (Step 27 blind rating) | A built site passes rendered QA (layout, speed, visible CTA, no invented testimonials or clients) with screenshots reviewed by a human |
| M4 | Agency-site content shape: services, process, proof or case studies (only real or clearly labelled sample), contact form, trust signals | Form submission lands in the CRM capture in a live test; no fake social proof |
| M5 | Launch files: sitemap, robots.txt, canonical, og:image, 404 | Step 7 launch-stage checks pass on the output (they fail today on both starters) |
| M6 | Cost control: per-build spend cap enforced, Agent 37 calls priced or token-capped (section 4) | A seeded over-cap run is refused; the cost per build is recorded |
| M7 | Different-vendor review live (Step 26 item 1), and a human review of the output by Huraira and Nick | Two `model_traces` rows on the second vendor; Nick's go/no-go recorded |
| M8 | Stop at "awaiting launch approval" | Launch stays a human gate, no deploy by the agent |

## 3. Explicitly deferred until after the MVP

- E-commerce, products, payments, dedicated CMS (later "additions and upgrades to the factory").
- Steps 8, 12 (full), 20 as the reliability bundle, queue and concurrency, Health room (Steps 9 and 10), Steps 11, 13, 14, 17, 18, 19, 21 (rest), 22, 23.
- Owner's Key self-editing, 50-point audit list, three-client test, disaster-recovery drill.
- 4B M5 image generation (Higgsfield) unless credits land and Huraira asks for it; use supplied assets and clearly labelled placeholders.
- VSL production. The sales landing page is Nick's next build, after the MVP.
- Step 26 items 2 and 3 (full calibration set, per-niche visual baselines): keep only what the Bennett run needs. Step 27: only the motion budget and the seeded-violation check; the blind-rating sheet is made if Nick wants it.

## 4. Cost and credits (evidence, 2026-10-10)

Read from the live `model_traces` table (project `mcaxxhgjptwowwrluhra`, 113 rows):

| Actor / provider | Calls | Input tokens | Output tokens | Priced USD |
|---|---|---|---|---|
| Front-end builder via Agent 37 (`hermes-agent`) | 53 | 2,412,292 | 385,703 | **not priced** (53 of 53) |
| Front-end builder via Claude Sonnet | 38 | 198,799 | 42,060 | 0.82 |
| QA evaluator (Claude Sonnet) | 9 | 128,080 | 6,132 | 0.32 |
| Planner, intake, direction, Hermes-lite | 14 | about 36,600 | about 12,400 | 0.18 |

- Priced Claude spend is about **$1.32 in total**. The credit drain is the Agent 37 builder: about 45k input and 7k output tokens per call, with 3 to 8 calls per build attempt.
- **Estimate, not a bill**: at Sonnet-class list prices ($3 and $15 per million tokens) the 53 Agent 37 calls would be about $13. That is consistent with the roughly $12 of the $15 top-up Huraira reports spent. Agent 37's real rate is unknown; check its dashboard.
- Per build attempt that is roughly $0.5 to $2 including retries, so the existing **$5 per-build ceiling** is about right for one attempt but nothing enforces a total across retries, and no ceiling sees Agent 37 because it has no price.

**Proposed cap (needs Huraira's yes; not yet implemented)**
1. Give Agent 37 a price basis in the pricing table (per-token, set from its dashboard; until known use the $3/$15 estimate and flag it as an estimate). This makes `cost_usd` non-null and the per-run ceiling effective.
2. Per-build hard cap **$5** across all attempts of one build (the retry total), plus a **$20 weekly cap** while credits are thin, refused with a clear message in the Cockpit. Raise only by Huraira's say-so.
3. Cheaper routing for the Bennett run: planner and intake stay on Haiku or Sonnet (already about $0.18 combined); the builder is the only expensive slot, so cap rebuild rounds at 2 per track before a human decides.
4. Nick tops up credits (Decision D5 in HANDOFF: spend caps need Nick's sign-off).

This cap is Step 12's per-run piece pulled forward as a minimal slice (item M6). The rest of Step 12 stays deferred.

## 5. Schedule (working back from Wednesday 2026-10-14)

| Day | Work | Needs |
|---|---|---|
| Sat 10-10 | Nick's brief arrives; record it and the constraints (M1); fix Huraira's open actions (M4 re-runs, credits) | Nick's brief; Huraira's actions |
| Sun 10-11 | Price Agent 37 and add the per-build cap (M6); different-vendor call (M7 part 1); launch files for both starters (M5) | OpenAI credits; Huraira's yes on the cap |
| Mon 10-12 | Direction and Brand DNA from the brief (M2); first full build on the picked track (M3) | M1 to M6 done |
| Tue 10-13 | Review, corrections (limited rounds), second track or motion pass if time allows; Nick reviews | Nick's review |
| Wed 10-14 | Final checks, human go/no-go, stop at awaiting launch approval (M8) | Nick's approval |

The date is at risk, not guaranteed. The largest unknowns are the quality of the first Bennett build and how many correction rounds it needs (the DreamSign baseline was 40+). Report slippage on Monday evening, not Wednesday.

## 6. Open questions for Nick (ask once, in one message)

1. The Bennett & Co repo name and brief; which pages the agency site needs; real case studies or testimonials available (if none, we build without them rather than invent).
2. Logo file and exact color values (or confirm they are in the repo).
3. Where the form should send leads (CRM target) and where the site will be hosted (Hostinger for live, per the hosting law).
4. Top up Agent 37 and OpenAI credits, and approve the spend caps in section 4.
