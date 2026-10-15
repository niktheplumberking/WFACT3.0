# Why builds keep failing, and failing again on continue (2026-10-15)

Evidence: every `build_plan` and `resume` job in the live `jobs` table (2026-09-28 to 2026-10-14), their `result.qaIssues`, the
`model_cost_by_day` view, and the code paths named below. Companion to `BUILD-RECOVERY-DESIGN.md` (Step 4D) and `AI-COST-AUDIT.md`.

## 1. The record

25 build jobs: **3 passed**, 21 failed, 2 cancelled before reaching GitHub, 1 still `queued` (never dispatched, see §5).

| Class | Jobs | Cause | Status today |
|---|---|---|---|
| **Rule contradiction** (no revision can pass) | d3c45995, f696ba43, 9c853a49, e2a204fb | Two checks demand opposite things, or a requirement names an input the builder never gets | 3 fixed earlier; **d3c45995 fixed here**; palette half of e2a204fb **open** |
| Provider / infrastructure | b880a7d5, 456368c5, 63278e56, 83f2841f, ad49df57, 31c965ff, e5d29358, 5c85914b, 6dec53e7 | Reviewer 300 s header timeout, Agent 37 402 / dropped connections, missing dispatcher token or evaluator | Fixed earlier (undici limits, Anthropic reviewer, readiness probes, bounded auto-retry) |
| Measurement flake | c775c396 | LCP 2.52 s against a 2.5 s budget | Fixed earlier (median of 3 on a near miss) |
| Builder schema too strict | 4d6e1abb | `openQuestions` capped at 300 characters | Fixed earlier (800) |
| Real quality defects | 6f68adbd, c7fba41a | Sign-up form semantics | Working as intended: the gate caught them |
| Continue could not reopen | 699d6ddb, 8e577598 | Pre-4D: a halted run could not be continued | Fixed by Step 4D |
| Saved site changed | 5ed238ac, 21350a42 | Checkpoint hash mismatch | Refused by design; a fresh build is offered |

## 2. Why "continue" failed the same way

The expensive pattern is not one failure. It is a failure that **cannot** be fixed by the builder, followed by paid retries:

1. **Rule contradictions.** Latest case, Harbor Street `d3c45995`: the owner supplied five real customer quotes. The builder's rulebook
   (`DR-FAKE-SOCIAL-PROOF`, rulebook 1.1.0) says quotes appear *only* when supplied and never as SAMPLE. The older claims gate
   (`claims.sample-label`) said *every* testimonial needs a SAMPLE label and never looked at the run's fact sources. The builder used
   the real quotes, the gate failed them, the builder had no move that satisfies both, and every revision and every continue failed
   identically.
2. **No "is this converging?" check.** The QA loop spent its whole revision budget even when a revision left every deterministic
   failure exactly as it was.
3. **Continue had no memory of why it stopped.** "Fix and continue" gave a fresh revision budget with the same brief, the same code
   and the same findings, so a stop that only a code fix or a new detail could change was paid for again (e2a204fb: $1.34, 20 minutes).

## 3. What changed (2026-10-15)

| Guard | Where | Effect |
|---|---|---|
| Claims gate accepts supplied quotes | `verification/src/checks/claims.ts` | A testimonial whose quote is word for word in the fact sources (6+ words, the bulk of the card) needs no SAMPLE label. Invented ones still do. Ends the d3c45995 contradiction. |
| Stuck breaker | `workflow/src/buildAndVerify.ts` `verifyLoop` | If the deterministic failures after a revision are identical to before it, the run halts as `STUCK:` instead of paying for the next revision. Measured or model-judged checks (`render.perf`, `render.design-review`, evaluator) never count. |
| Same-stop refusal | `resumeBuildAndVerify` + `wouldRepeat` | Each halt records a fingerprint of its deterministic failures, a digest of the brief and the factory commit (`GITHUB_SHA`). A person's continue is refused, with nothing spent (`repeat_refused`, audit row `workflow.reopen_refused`), when brief and code are unchanged and the result is already known: a plain re-check, or a stuck run. New details, a deployed fix, a rebuild or `force: true` always go through. Halts from before this change are never refused. |
| Cockpit wording | `apps/cockpit/src/lib/recovery.ts`, `timeline.ts` | Stuck and refused stops show as "with the technical team". The continue button stays but is not the main action, unless the owner can add a missing detail, in which case the details form leads. |

Quality is untouched: no budget, threshold or rule was loosened. R-10 still fails every invented testimonial, the motion and
performance budgets are unchanged, and the stuck breaker only fires when the builder demonstrably cannot move a check.

Saving per avoided cycle: one builder call plus a QA pass, about $0.40 to $0.70 and 5 to 7 minutes (runs e2a204fb, 55ddba7c). A
refused continue saves the whole continue, about $1 to $2 and 15 to 20 minutes.

## 4. Evals

`packages/workflow/test/failureEvals.test.ts`: 18 cases, each a real past failure (job ids in the file). Mutation-tested: switching
off any one guard turns its evals red. Cockpit cases are in `recovery.test.ts` and `timeline.test.ts`. An independent review (separate
agent) found five weaknesses in the first version: number blanking hid progress, a section-level loophole, substring matching, a
breaker blind across a continue, and a missing Cockpit stage label. All five were fixed and each is now pinned by an eval. Not changed:
only `render.perf` and `render.design-review` are treated as variable; if another rendered check proves flaky, add it to `VARIABLE_CHECK`.

## 5. Still open (not changed here)

1. **Palette contradiction (e2a204fb b).** The Track B palette engine (`frontend-loop/src/trackB/palette.ts`) derives surface, muted
   and darkened-accent colours for contrast; a brief that says "only the three brand colours" fails on them. Needs a decision: are
   tints and shades of the brand colours allowed (the client's own words were "nothing else except tints of those")? Then align the
   engine and the evaluator to that one rule.
2. **A continue that never reached GitHub.** Job `caa201f1` (Harbor Street continue, 2026-10-14 18:12) is still `queued` with no
   `dispatched_at`: the browser's call to `dispatch-job` never landed. Nothing was spent. It should be cancelled and pressed again
   *after* this change is deployed. The old code would fail it the same way.
3. **Rule-consistency eval.** E1 checks one pair of rules (builder rulebook vs claims gate). The general fix is a contract test: every
   content fixture the builder's validator accepts must also pass the deterministic gate.
4. Token cuts from `AI-COST-AUDIT.md` §3B (prompt caching, sending only failing sections on a fix) remain after-MVP work.
