# AI cost audit (2026-10-13)

Evidence: the live `model_traces` table (all rows, 2026-09-28 to 2026-10-12) and a read of every model call site in the repo.
It feeds MVP milestone M6 (`docs/MVP-CUTLINE.md` §4).

**Status (2026-10-13):**
- Built: section 3A items 1, 2, 3 (mechanism) and 4 (output ceiling only), and section 4.
- Caps: built but OFF. The amounts are pending Huraira and Nick.
- Deferred: the timeout retry in item 4, and item 5.
- Not built: section 3B (after the MVP).
- **Blocker found:** on 2026-10-13 the Agent 37 gateway answers "HTTP 402: AI credits exhausted", so no build can run until it is topped up.

## 1. What we actually spent

| Actor | Provider / model | Calls | Input tokens | Output tokens | Recorded USD |
|---|---|---|---|---|---|
| Builder | Agent 37 `hermes-agent` | 55 | 2,471,848 | 399,341 | **none (unpriced)** |
| Builder (fallback) | Claude Sonnet 5 | 39 | 203,928 | 42,629 | 0.83 |
| QA evaluator | Claude Sonnet 5 | 9 | 128,080 | 6,132 | 0.32 |
| Planner | Claude Sonnet 5 | 6 | 9,294 | 8,709 | 0.11 |
| Hermes-lite | Claude Sonnet 5 | 3 | 17,533 | 854 | 0.04 |
| Direction | Claude Sonnet 5 | 1 | 2,805 | 1,921 | 0.02 |
| Intake | Claude Haiku 4.5 | 4 | 4,183 | 877 | 0.01 |
| Screenshot reviewer | Agent 37 (vision) | ? | **not recorded** | **not recorded** | none |

- The Cockpit shows about **$1.33**. Agent 37 carries **87% of all recorded tokens**, and none of them has a price.
- At $3/$15 per million (Sonnet-class estimate) the Agent 37 builder alone is about **$13.4**. That matches the roughly $12 of the $15 top-up spent.
  **The Cockpit currently shows about 10% of real spend.**
- The screenshot reviewer's calls never reach `model_traces` (`rendered-qa/src/reviewer.ts:250` writes only to the in-memory `suite.calls`).
- Price check needed: `packages/hermes/config/model-routing.json` prices Sonnet 5 at $2/$10, while the cut-line uses $3/$15. Verify against the current Claude pricing page.

## 2. Where tokens leak, ranked

1. **Agent 37 builder: unpriced, uncapped, no output limit.**
   - `frontend-loop/src/modelClient.ts:147` sends no `max_tokens`, and nothing caches the ~15.8k-character system prompt (rulebook plus full JSON schema), which is resent on every call.
   - Each fix also resends the whole content JSON.
   - Within one run, input grows about 32k → 65k → 108k tokens per call.
   - One DreamSign call (2026-09-28, run 9bb96676) used **629k input tokens**. The fixed prompt cannot account for that. It suggests `hermes-agent` loops internally and bills every internal turn: a hypothesis to check on the Agent 37 dashboard.
   - A timed-out call (6-minute limit) is retried, which can bill twice.
2. **Screenshot review: up to 35 images per call, up to 5 resends, invisible.**
   - A 5-page site sends 11 home-page slices plus 2 per viewport for each other page, at high detail on desktop and tablet (`rendered-qa/src/reviewer.ts:195-260`).
   - This repeats on every QA cycle and every auto-heal, even when the content has not changed.
3. **QA evaluator sends the whole site's HTML** (about 27k tokens for 5 pages) with a 16k output and thinking allowance (`verification/src/evaluator.ts:82`).
   - Track A HTML is rendered by code from content JSON the builder-loop reviewer has already approved.
4. **Two Claude reviews of the same facts and tone per cycle.** The builder-loop reviewer runs up to 3 rounds on the JSON (`trackA/loop.ts:236`), and the QA evaluator then runs on the HTML.
5. **Loops stack and reset.**
   - Per cycle: about 9 Agent 37 calls plus 3 reviews.
   - Rebuild rounds: up to 2 QA revisions, so the cycle runs up to 3 times.
   - On top of that: 2 auto-heal QA re-runs (`jobs/src/handlers.ts:189`).
   - Reopening a run resets the revision budget (`workflow/src/buildAndVerify.ts:871`), so total spend per build is unbounded.
6. **No prompt caching anywhere** (`cache_control` appears nowhere). All the fixed system prompts are cache candidates.
7. **Hermes-lite pastes the whole client memory file** (`hermes/src/controller.ts:131`). Summit-line is 98k characters, about 25k tokens, per question, and that file grows forever.
8. **Caps are blind.** The per-role ceilings in `agent-runtime/src/permissions.ts:404` only count priced calls, so none of them sees Agent 37. There is no per-build total and no weekly cap.

## 3. Plan: cut cost without touching quality or motion

Motion and layout come from code templates (Track A, the Step 27 motion budget), not from model tokens. The cuts below change what is *sent*, not the builder's model tier.
Every cut is measured against the Step 26 calibration set before and after. A cut that lowers the quality score is reverted.

**A. Make spend visible and capped (MVP M6, do first)**
1. Price Agent 37 in `model-routing.json`. Use its real rate from the dashboard, or $3/$15 flagged as an estimate.
2. Trace the screenshot reviewer into `model_traces`.
3. Enforce a per-build cap across all attempts and reopens ($5 proposed) and a weekly cap ($20 proposed).
   - An over-cap run is refused, with a message in the Cockpit.
   - Nick owns these numbers (D5).
4. Set `max_tokens` on Agent 37 calls, and stop retrying a call that timed out after the model may already have billed it.
5. Allow at most 2 rebuild rounds per track; after that a person decides. Reopening keeps the spent budget.

**B. Cut tokens (after the MVP, each measured)**

| Change | Expected saving |
|---|---|
| Prompt caching on fixed system prompts (Claude `cache_control`; ask Agent 37 whether it supports it) | Large on the builder and reviewers. Cached reads cost a fraction of normal input. |
| Builder fixes send only the failing sections plus the issues, not the whole JSON. Move the JSON schema out of the prompt into structured output. | About half of builder input per fix |
| Screenshot review: only pages that changed, and skip a re-review when the content hash is unchanged (auto-heal) | Most of the QA cost on retries |
| QA evaluator: send the content JSON plus the changed pages' text, not all HTML; cap thinking | About 60% of evaluator input |
| Merge the overlapping fact and tone checks into one review | One review per cycle |
| Hermes-lite: a summary or the relevant sections of client memory, not the whole file | About 90% on client questions |
| Route cheap jobs to cheap models (intake is already on Haiku; the content-review first pass could be too) | Small, but free |

## 4. Cost transparency in the Cockpit (built, MVP M6)

Extend the existing owner-only Costs page (`apps/cockpit/src/pages/Misc.tsx`) instead of starting a new room:
- **True total**: metered spend plus estimated spend, with estimates labelled. No more "at least".
- **Cap gauges**: this build against $5, and this week against $20.
- **Per client**: by `entity_slug`. **Per build/run**: a stage breakdown (planning, build, review, QA, retries).
- **By day**: a trend. **Top 10 costliest calls**: with the run, so outliers like the 629k call are visible.
- A cost chip on each Run page (owners only, per blueprint §9: admins never see raw cost).
- Backed by a new view `model_cost_by_run` (security-invoker, owner RLS unchanged).
