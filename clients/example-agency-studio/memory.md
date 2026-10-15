# Quillmere Studio — client memory (SYNTHETIC EXAMPLE)

**Status**: SYNTHETIC example client, written 2026-10-15 (Step 28 follow-up). Fictional studio, people, phone, email,
address and quotes. Not a real client; never counted toward Step 25's real-client acceptance or Blueprint goal 1. What it
is for and how to run it: `docs/EXAMPLE-CLIENTS.md`.

- Shape: an agency site like Bennett & Co's MVP (services, process, labelled sample case studies, trust signals, contact
  form). **Track B**, multi-page (Home, Services, Process, Work, About, Contact).
- Entity: `bennett-co` (only DreamSign and Bennett & Co are active entities, so rehearsal spend is booked there; see the
  PROGRESS "Gaps noticed" proposal for a test entity).
- Request: `raw-request.txt`, pasted into Cockpit New request unchanged. Brief as approved, with every owner input
  applied: `brief.json` (`source: synthetic-provisional-2026-09-30`). Owner inputs and uploads: `plan-inputs.json`.
- Brand (fixed): ink #1B1F2A, paper #F4F1EA, rust #A8431A (buttons and links); Fraunces-style serif headings with an IBM
  Plex Sans-style body. Logo `logo.svg` (synthetic). Live address https://quillmere.example.com.
- Complete intake: every Cockpit slot answered (opening date waived: an established studio has none). No open questions,
  no two answers on one topic, no "unclear" labels; `packages/workflow/test/exampleClients.test.ts` holds it to that.
- Fake on purpose: (415) 555-0147, example.com addresses, an invented street and town. Quotes are invented stand-ins and
  say so at the top of `raw-request.txt`. Case studies are illustrative samples and must be labelled as samples.
- Images (`images/`, abstract shapes in the brand colours, no people): `index.hero`, `work.case-studies.1`-`3`,
  `about.studio`. Slot ids come from the builder's content, so upload each to the slot the Cockpit shows that matches.

## Runs

| Date | Job | Track | Result | Cost |
|---|---|---|---|---|
| (none yet) | | | | |
