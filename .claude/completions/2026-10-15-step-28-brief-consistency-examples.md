# 2026-10-15 — Step 28 follow-up: brief consistency check + example clients

- `fd67328`: `packages/workflow/src/briefConsistency.ts` (checkBriefConsistency, conflictNeed, resolveOwnerFacts),
  `packages/planning/src/factTopics.ts` (topic table, mergeOpenQuestions), preflight wiring, `ownerFactsFrom` via
  resolveOwnerFacts, planner asks each known topic once. Evals E6 (3), mutation-checked (guard off, date normalisation off,
  pick ignored).
- `52f7088`: `clients/example-agency-studio` (Track B), `clients/example-local-trade` (Track A), `exampleClients.test.ts`,
  `docs/EXAMPLE-CLIENTS.md`, INDEX row.
- `da93eea`: trackers (Step 28 stays IN PROGRESS).
- Tests: workflow 89/89, jobs 38/38, planning 45/45; typecheck clean. Dry run on stored e6a71046 facts: 2 conflicts,
  5 unresolved labels, 0 builder calls; examples pass preflight.
- Not done: push, live run. Real lesson candidate: duplicate questions came from planner.ts concatenating intake
  ambiguities with planner questions, not from a re-plan.
