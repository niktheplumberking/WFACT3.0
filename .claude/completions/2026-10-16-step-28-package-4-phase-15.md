# 2026-10-16 — Step 28 Package 4 phase 15: Costs

Status: Step 28 IN PROGRESS; phase 15 built and pushed.

- Code: `1af12c7` (pages/Costs.tsx rebuilt; lib/costs.ts room helpers + fetchCostRoom; SPEND exported from lib/recovery.ts;
  app.css; dev ?fake-costs=1; page tests moved from src/costs.test.tsx to src/pages/costs.test.tsx). Trackers `4e6c072`.
- Tests: vitest 274/274 (13 new). Mutation: widening the cap window to 30 days fails the headline test (after adding a priced
  day 10 days back; the first fixture set did not catch it, history is never capped).
- tsc clean; build clean; dist/ grep for fake/dev strings: 0 files.
- Browser (cockpit-fake, synthetic): axe 0 at 1440x900 and 375x812, light and dark; 375 scrollWidth 375; no target under
  44 px in the room; no banned words outside Technical details; admin sees the owners-only notice; console clean in a fresh tab.
- Fixed while testing: axis labels wrapped to three lines at 375 (now the start date only).
- Logged in BLOCKED-ON-NICK: Costs gaps ("Change the caps", the stop rule, 7-day periods, no cap-stopped build yet).
- Noticed, not changed: the design's segmented control (rail Simple/Detailed) is 38 px inside a 46 px track, under the
  brief's 44 px rule; old Costs CSS (.cost-grid, .caps, .cap-bar, .tag-over) now unused, for phase 19 cleanup.
- Phase 14 CI: `38929657403` green incl. Deploy Cockpit to Vercel. Phase 15 push: CI `38934744558`.
