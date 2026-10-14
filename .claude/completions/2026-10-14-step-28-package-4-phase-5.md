# Step 28 Package 4 — Cockpit v2, phase 5: Home (2026-10-14)

- `00ec210`: Home rebuilt to the design (greeting + count, What needs you in order with one button or "<owner> decides
  this", Running now, This week vs the live cap (owner only), Every client on the six-step path; empty/loading/calm/
  failed-load states). lib/clients.ts = one client list; lib/attention.ts rebuilt on it, shared with Notifications.
- Found and fixed while checking in the browser: a failed load showed "no clients"; now it says the status could not load.
- Evidence: 205 tests; axe 0 owner/admin/PM, light/dark, 1440/375; scrollWidth 375; no banned words.
- Next: Projects on GO.
