# Step 28 Package 4 — Cockpit v2, phase 3: shell (2026-10-14)

- `8532f4e`: rail (typeset wordmark, nav with waiting count, Coming later, Simple/Detailed, account), top bar (breadcrumb,
  palette search, bell with unread count, New request), phone header + tab bar + More, keys (⌘K, /, G H P A C, N, D, ?, Esc),
  shortcuts sheet, Notifications inbox, /team. AskBox removed; Ask the factory is a palette action (requestJob("ask")).
- Roles follow RLS where the design disagrees (PM Activity, admin Costs, PM cost so far): BLOCKED-ON-NICK.md.
- Dev harness: COCKPIT_FAKE_DB=1 (launch config cockpit-fake) serves the synthetic test fake; never in a build.
- Evidence: Cockpit 175/175, build clean, axe 0 owner/PM light/dark 1440/375, scrollWidth 375, no target < 44 px.
- Also synced: phases 1–2 CI 38588413325 green and deployed; live serves v2.
- Next: phase 4 (lib/path.ts) on GO.
