# Step 28 Package 4 — Cockpit v2, phase 4: the six-step path (2026-10-14)

- `fd020a5`: src/lib/path.ts — derivePath() (step, state, tone, waitingOn, sentence, nextLine, nextAction, clientNext,
  chipWord, missing, supplied/skipped, build, diagnosis), stripSteps(), fixLabel() (design's 8-case fix labels),
  latestBuild()/buildsOf(), knownNeeds(), missingWords(). 22 tests in path.test.ts.
- Rules: Live only from projects.stage >= 8_launch; Ready from result.status awaiting_launch_approval; Details needed when
  never built or the readiness check stopped for unanswered needs; credit/setup wait on Huraira, spend limit on the owner;
  PMs and admins wait on the owner where RLS or the rules say so; "usual" minutes only from past runs.
- Logged for Nick: no place records a site approval (phase 9 needs it).
- `1278a29`: test race fix — CI 38591851925 (phase 3 push) failed on the sign-out test; phase 3 not deployed yet.
- Next: phase 5 (Home) on GO; confirm the re-push CI.
