# Brightwater Lane Plumbing — client memory (SYNTHETIC EXAMPLE)

**Status**: SYNTHETIC example client, written 2026-10-15 (Step 28 follow-up). Fictional business, people, phone, email,
address and quotes. Not a real client; never counted toward Step 25's real-client acceptance or Blueprint goal 1. What it
is for and how to run it: `docs/EXAMPLE-CLIENTS.md`.

- Shape: a local trade business opening on Tuesday 2 March 2027 (services, prices, areas, process, quotes, booking form).
  **Track A**, multi-page (Home, Services, Pricing, Areas, About, Contact).
- Entity: `bennett-co` (only DreamSign and Bennett & Co are active entities, so rehearsal spend is booked there).
- Request: `raw-request.txt`, pasted into Cockpit New request unchanged. Brief as approved, with every owner input
  applied: `brief.json` (`source: synthetic-provisional-2026-09-30`). Owner inputs and uploads: `plan-inputs.json`.
- Brand (fixed): harbour blue #12324A, off-white #F7F5F0, amber #B45309 (buttons and links); Archivo-style headings with
  a Source Sans 3-style body. Logo `logo.svg` (synthetic). Live address https://brightwaterlane.example.org.
- Complete intake: every Cockpit slot answered, including the opening date. No open questions, no two answers on one
  topic, no "unclear" labels; `packages/workflow/test/exampleClients.test.ts` holds it to that.
- Fake on purpose: (503) 555-0182, example.org addresses, an invented street and suburbs. Quotes are invented stand-ins
  and say so at the top of `raw-request.txt`. No licence number (the request says the owner adds it later).
- Images (`images/`, abstract shapes in the brand colours, no people): `index.hero`, `services.services.1`-`4`,
  `about.team`. Slot ids come from the builder's content, so upload each to the slot the Cockpit shows that matches.

## Runs

| Date | Job | Track | Result | Cost |
|---|---|---|---|---|
| (none yet) | | | | |
