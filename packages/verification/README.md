# Verification — Phase 5 check registry + evaluator loop

## What this is

Operator's Manual, Phase 5 ("Verification Loop", Days 13–15): *"A working, if trimmed, version of
'never trust done, only verified.'"* Unlike Phases 3–4, this phase's own Requirements table says
**"From Nick: None blocking this phase."** — nothing here waits on `BLOCKED-ON-NICK.md`.

The Manual's checklist:
- Pick 5–8 highest-value checks from 2.0's 78 (named examples: no console errors, responsive
  check, secrets scan, image optimization, isolation check)
- Wire an independent evaluator step, a different model than the builder
- Test with a deliberately broken build, confirm it's caught

This package is exactly that: 6 deterministic checks (the Manual's 5 named examples plus one
backstop) and an independent LLM evaluator step, wired together in `VerificationLoop`.

## What's actually wired here

```
src/
  checks/
    types.ts               Check / CheckResult / VerificationContext shapes
    secretsScan.ts          no credential-shaped strings in generated HTML
    responsive.ts           viewport meta + at least one @media rule
    noConsoleErrors.ts      every inline <script> parses; no external <script src>
    imageOptimization.ts    every <img> has alt; no oversized embedded base64 image
    isolation.ts            no other known client's slug appears in the page
    requiredSections.ts     deterministic backstop for Phase 4's LLM-only section check
  registry.ts               CHECK_REGISTRY + runChecks()
  evaluator.ts               RUBRIC + runEvaluator() + parseEvaluatorResponse()
  verificationLoop.ts        VerificationLoop — wires checks + evaluator, never fabricates a verdict
  modelClient.ts              same ModelClient/ClaudeModelClient/MockModelClient pattern as
                               packages/hermes and packages/frontend-loop (self-contained per
                               this repo's no-shared-tooling convention)
  paths.ts                    repoRoot() + knownClientSlugs() (reads clients/, excludes _template)
  cli.ts                      npm run verify -- <page.html> <clientSlug> <goal> <sections>
test/
  fixtures/broken.html        deliberately violates all 6 checks at once
  fixtures/clean.html         passes all 6 checks
  registry.test.ts            the Manual's Phase 5 exit check, as a real automated test
  verificationLoop.test.ts    status transitions: failed_checks / blocked_no_evaluator /
                               changes_requested / approved
  evaluator.test.ts           strict VERDICT-protocol parsing, same spirit as
                               packages/frontend-loop's parseReviewResponse tests
```

## The evaluator's own honest gap

CLAUDE.md §6: *"The evaluator is never the same instance, and ideally not the same model/vendor,
as the builder."* The Manual's own Phase 5 fallback for "no time for a truly separate model":
*"Use a strict written rubric plus a separate Claude session as a stand-in, flagged clearly as
temporary until Kimi K3 or GPT-5.6 access allows a real cross-model check."*

`modelClient.ts#evaluatorModelClientFromEnv` builds a fresh `Anthropic` client instance — always
structurally distinct from whatever instance Phase 4 used — but it's still Claude judging Claude's
own output family. This is the same open, tracked gap `packages/frontend-loop`'s README documents
for its own evaluator; not silently different here.

## Why checks-only is never "verified"

`VerificationLoop.run` returns one of four named statuses, never a single collapsed boolean:

| Status | Meaning |
|---|---|
| `failed_checks` | A deterministic check caught something — the evaluator is never even called. |
| `blocked_no_evaluator` | All 6 checks passed, but no `ANTHROPIC_API_KEY` was available to run the independent evaluator step. **Not the same as verified** — CLAUDE.md §1. |
| `changes_requested` | Checks passed, evaluator ran, evaluator asked for changes. |
| `approved` | Checks passed, evaluator ran, evaluator approved. |

This mirrors `packages/frontend-loop/src/modelClient.ts`'s `modelClientFromEnv` refusing to
fabricate a builder result without a real key — the same discipline applied to the verification
side.

## Verification status (per CLAUDE.md §1 — nothing here is "done" on its own report)

| Piece | Verified how | Result |
|---|---|---|
| All 6 checks, individually | `test/registry.test.ts` against `fixtures/clean.html` (must all pass) and `fixtures/broken.html` (must all fail, with a specific reason each) | **PASS**, re-run 2026-09-11 |
| The Manual's own Phase 5 exit check ("a deliberately broken test build gets caught and returned before being marked done") | Same test, run for real via `npm test` — not asserted, executed | **PASS** |
| `VerificationLoop` status transitions (all 4 states) | `test/verificationLoop.test.ts`, mocked evaluator, no network | **PASS** |
| Evaluator response parsing (strict VERDICT protocol, malformed input never silently approved) | `test/evaluator.test.ts` | **PASS** |
| Typecheck (`tsc --noEmit`, same strict config as `hermes`/`frontend-loop`) | `npm run typecheck` | **PASS** |
| A live evaluator run against a real page (`npm run verify -- ...` with `ANTHROPIC_API_KEY` set) | Not run | **BLOCKED** — same open `ANTHROPIC_API_KEY` item in `BLOCKED-ON-NICK.md` that blocks Phase 3's and Phase 4's live runs. The 6 deterministic checks do not need it and are fully proven above; only the evaluator step is blocked. |

**Exit check status: met for the deterministic half.** The Manual's own wording — "a deliberately
broken test build gets caught and returned before being marked done" — asks for exactly the check
registry proven above, not a live model call. The independent-evaluator half of Phase 5's checklist
is code-complete and unit-tested against a mock, same as Phase 3/4's pattern, but its live run
stays honestly marked BLOCKED until `ANTHROPIC_API_KEY` lands.

Two real bugs were caught and fixed while proving this out, in the spirit of CLAUDE.md §1: the
`required-sections` check initially matched an attribute value (`<img src="hero.png">` was
satisfying a "hero" required section with no actual hero content), and `fixtures/clean.html`'s own
documentation comment initially contained the literal string `bennett-co`, which correctly failed
its own isolation check. Both are logged so the fix doesn't get silently re-broken.
