# 2026-10-13 — Step 12 slice (MVP M6): AI cost control and transparency

- Audit: docs/AI-COST-AUDIT.md. Real spend to date is about $14.70; the Cockpit showed $1.33. Agent 37 carries 87% of the tokens.
- Code: 2223856. Trackers: Step 12 PARTIAL.
- Migration 0020_model_cost_m6 applied live: 'estimated' basis, model_cost_by_run and model_cost_by_day views.
- Caps are built but OFF (packages/hermes/config/spend-caps.json) until Huraira and Nick agree the amounts.
- Blocker: Agent 37 HTTP 402 "AI credits exhausted".
- Left:
  - set the caps;
  - push, then CI and the deploy;
  - one live build that writes estimated rows and reviewer rows;
  - section 3B token cuts, after the MVP.
