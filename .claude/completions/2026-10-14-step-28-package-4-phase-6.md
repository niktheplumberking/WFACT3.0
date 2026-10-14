# Step 28 Package 4 — Cockpit v2, phase 6: Projects (2026-10-14)

- `2cd7f6b`: Projects rebuilt (summary, search, sort, group, filter pills with counts, Save this view with Undo, Grid/List,
  pins, list as role=table stacked on phones, ids in Technical details). Reads useFactory().clients.
- Deviation kept with reason: "Add a client or project by hand" (a client needs a project before "Record that it is live").
- Found in the browser: Grid/List control stacked (CSS selector), owner saw "Not shared", phone headers hidden from
  screen readers; all fixed.
- Evidence: 212 tests; axe 0 grid/list, light/dark, 1440/375; scrollWidth 375.
- Next: New request on GO.
