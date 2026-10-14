# Step 28 Package 4 — Cockpit v2, phases 1–2 (2026-10-14)

Rebuild of the Cockpit UI to the locked design in `docs/design/cockpit-v2/` (prompt: `docs/design/cockpit-v2/docs/COCKPIT-V2-BUILD-PROMPT.md`).

- Phase 1 tokens `4a50b22`: tokens.css v2 (light default, dark, accents, density, type, motion, reduced motion, text-size zoom),
  `lib/appearance.ts`, Newsreader. Pre-v2 rules render through a temporary alias block (remove in phases 2–3).
- Phase 2 components `a8fa3cf`: kit.tsx, flow.tsx, CommandPalette.tsx, ConfirmDialog (alertdialog + money line), SitePreview
  (side by side), toast with Undo, lib/detail.tsx. `.btn` restyled app-wide.
- Evidence: Cockpit 164/164, typecheck, build; dev gallery `/dev-components.html?axe=1` axe 0 light/dark at 1440 and 375.
- Deviation: waiting step rows dimmed by colour, not opacity (contrast).
- Conflict for Nick: design caps ($2/build, $20/month, new builds only) vs live caps ($5/build, $20 per 7 days, every call).
  UI reads spend-caps.json via `costLine()` until he decides.
- Next: phase 3 (shell) on GO. Not pushed.
