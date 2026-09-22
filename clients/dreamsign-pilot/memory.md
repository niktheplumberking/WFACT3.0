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
  `templatePreference`. Its styleGuidance is genuinely sourced from Motion Sites prompt
  `agency-services` and a real 21st.dev component search, translated into this pipeline's
  inline-CSS/no-build-step constraint (see the file's own header comment).
- Builder + evaluator model, decided 2026-09-22: builder = Agent 37 (default free-tier router),
  evaluator = Claude directly, for real vendor independence between the two roles — not the same
  model reviewing its own output. See `packages/frontend-loop/src/modelClient.ts`'s header comment
  and `BLOCKED-ON-NICK.md`. Kimi K3 still not available.

## What's waiting on a human

- Nick's real pilot brief (Operator's Manual, Phase 4 requirement "From Nick") — this run still
  used the `placeholder-2.0-case` brief.

## Correction-round log

_(per Operator's Manual Phase 4/7: every round of "built → reviewed → sent back" gets logged here,
honestly, for the correction-batch metric — this is the actual test of whether 3.0 improved on
2.0's 40+ batch DreamSign baseline. Appended automatically by
`packages/frontend-loop/src/correctionLog.ts` after each real run of `npm run build-page`.)_

**First real live run: 2026-09-22.** 2 rounds, approved, vs. DreamSign 2.0's 40+ baseline — beats
it on this run. Round 1's flagged issues were substantive, not cosmetic: the builder's first draft
included an invented "500+ businesses served since 2011" stat and fabricated client names
(Northgate Retail, Pine & Co., Harbor Hotels) presented as real past work — exactly the kind of
unverifiable claim the brand notes ("credible and specific, not hype-driven") warned against. The
evaluator caught it and the fix removed it entirely; round 2 approved clean. Real page:
`clients/dreamsign-pilot/pages/clean-agency.html`. Real cost: builder (Agent 37) 573,600 prompt /
35,863 completion tokens on its own free-tier terms; evaluator (Claude claude-sonnet-5) 17,576 in /
842 out tokens, $0.0436.

*(The table below was mislabeled "Fixed by: frontend-loop (Claude, self-reviewed)" at write time —
that string was stale even before this run, left over from when both roles were Claude; corrected
here since it doesn't match what actually happened. `cli.ts` now logs the real builder/evaluator
names for every future run.)*

| Round | Stage | What was flagged | Fixed by | Date |
|---|---|---|---|---|
| 1 | 4_homepage_build | Hero includes an infinite-scrolling client-logo marquee, a glowing radial gradient blur, and fake avatar initials with an invented "500+ businesses served since 2011" stat — this reads as hype-driven flash, not the "clean, high-trust, restrained" tone the brand notes call for.; Fabricated client names (Northgate Retail, Pine & Co., Harbor Hotels, etc.) presented as past work/social proof are unverifiable claims for a services business — this undercuts the "credible and specific, not hype-driven" instruction rather than supporting it.; The oversized (up to 160px) animated "Services" heading and scroll-triggered fade-ins on every row/card add motion-heavy flourish that leans flashy rather than restrained, inconsistent with brand notes. | frontend-loop (builder: agent37, evaluator: claude) | 2026-09-22 |
| 2 | 4_homepage_build | (approved, no issues) | frontend-loop (builder: agent37, evaluator: claude) | 2026-09-22 |

## Notes

First real run completed 2026-09-22 — see the correction-round log above. Next real run should use
Nick's actual pilot brief once it lands, not the placeholder.
