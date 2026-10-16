# 2026-10-16 — Step 28 Package 4 phase 14: Activity

Status: Step 28 IN PROGRESS; phase 14 built and pushed.

- Code: `35a869d` (lib/activity.ts new; lib/phrases.ts personLines(); Activity() in pages/Activity.tsx; app.css; dev ?fake-activity=1).
- Trackers: `ac593ca`.
- Tests: vitest 265/265 (14 new in pages/activity.test.tsx; old list tests in flows/progress replaced or removed). Mutation: breaking the type filter fails 3.
- tsc clean; build clean; dist/ grep for fake/dev strings: 0 files.
- Browser (cockpit-fake, synthetic): axe-core 4.13.0, 0 violations at 1440x900 and 375x812, light and dark; 375 scrollWidth 375; no target under 44 px; no banned words; PM sees the owners/admins notice; console clean.
- Logged in BLOCKED-ON-NICK: saved views on this device only (profiles: id, role, full_name, created_at); Activity gaps (no archived list, costs left out of rows, round numbers, unaudited assignments).
- Not done: Lighthouse (phase 19); live data not viewed (read-only SQL only, for shapes).
