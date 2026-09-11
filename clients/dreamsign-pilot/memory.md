# Client: dreamsign-pilot

Copied from `clients/_template/memory.md`. **This is the Phase 4 placeholder pilot, not a real
client** — per the Operator's Manual's Phase 4 fallback ("No pilot brief from Nick by day 9 → use
a placeholder brief from an existing 2.0 case ... swap to Nick's real brief the moment it
arrives"). See `clients/dreamsign-pilot/brief.json` (`source: "placeholder-2.0-case"`) and
`BLOCKED-ON-NICK.md` for the disclosure. Do not treat this folder as a real client record — DreamSign
itself is a real, [PLACEHOLDER]-confirmed entity (`memory/context.md` §2); this pilot folder exists
only to give the front-end loop something real to run against.

## Entity

`dreamsign` — see `memory/context.md` §2. Entity confirmation itself is still [PLACEHOLDER],
per `BLOCKED-ON-NICK.md`.

## Stage

`4 Homepage build` (per the 11-stage pipeline, Playbook §7) — this pilot exists specifically to
exercise that stage's loop.

- Current stage: **4 Homepage build**
- Entered this stage on: 2026-09-10
- Waiting on (human or agent): Nick's real pilot brief, to replace this placeholder (`BLOCKED-ON-NICK.md`)

## What's been decided

- Template: `clean-agency` (see `packages/frontend-loop/src/templates.ts`) — matches the brief's
  `templatePreference`.
- Builder + evaluator model: Claude only, two separate client instances — Kimi K3 not yet
  available (`BLOCKED-ON-NICK.md`).

## What's waiting on a human

- Nick's real pilot brief (Operator's Manual, Phase 4 requirement "From Nick").
- `ANTHROPIC_API_KEY` — without it, `packages/frontend-loop`'s loop cannot actually run; see its
  README.md for the current verification status.

## Correction-round log

_(per Operator's Manual Phase 4/7: every round of "built → reviewed → sent back" gets logged here,
honestly, for the correction-batch metric — this is the actual test of whether 3.0 improved on
2.0's 40+ batch DreamSign baseline. Appended automatically by
`packages/frontend-loop/src/correctionLog.ts` after each real run of `npm run build-page`.)_

| Round | Stage | What was flagged | Fixed by | Date |
|---|---|---|---|---|

## Notes

No real run has happened yet — blocked on `ANTHROPIC_API_KEY` (see
`packages/frontend-loop/README.md`). This file's correction-round table will fill in the moment a
real run completes.
