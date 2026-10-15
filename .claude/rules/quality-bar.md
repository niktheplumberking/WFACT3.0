# Quality bar: what "done" means here

"Never trust done, only verified." A result is done when an independent check passed, not when the builder says so.

## Verification ladder (use the highest rung the change allows, and name the rung in the report)
1. Typecheck and the full test suite of every package you touched (and the Cockpit if it imports it). Numbers, not "green".
2. A test that **fails without your change**: revert the fix locally, watch it fail, restore it (mutation check).
   Failure modes get an eval in the registry, not just a unit test.
3. UI changes: build, then a browser check at 1440 and 375 px (screenshot, console clean, axe 0 violations, keyboard path).
4. Database changes: the migration applied, its RLS attack test run for real (`scripts/rls_attack_test*.sql`), `get_advisors` clean.
5. Pipeline behaviour: a live run (job id, CI run id, `model_traces` rows checked with SQL).
6. Review by a different instance, ideally a different vendor. Same-vendor review is labelled as such.

## Output standard for client sites (the factory's product)
- Faithful to the brief: no invented facts, quotes, prices or credentials; every stand-in labelled; supplied quotes word for word.
- Brand: tints and shades of the brief colours are on-brief; CTAs use the true accent at 4.5:1 contrast, else a shade.
- Accessibility WCAG 2.2 AA; performance within the rulebook budgets (LCP 2.5 s); no AI-slop patterns (Part C design rule).
- Launch files present (sitemap, robots, canonical, og:image). No deploy control; launch and money stay human.

## Output standard for the Cockpit
- Matches the locked design in `docs/design/cockpit-v2/` and its plain-language vocabulary; engineering terms only in Technical details.
- Real data only, no mocks; every state handled (loading, empty, error, stopped); 44 px targets; one primary action per view.

## Output standard for code
- Errors surface with a plain cause; nothing swallowed, no silent fallback. No TODO/FIXME in shipped source.
- Typed, validated boundaries; secrets by name only; no new serverless function without checking the Vercel 12-function ceiling.

## Before you report
- Re-read your own diff against the request: every requirement met, nothing extra, nothing unrelated changed.
- Report what was not run, what is NOT COVERED and what is synthetic, in plain words. Status words: DONE, BUILT AND DEPLOYED,
  IN PROGRESS, PARTIAL, BLOCKED, NOT STARTED ("verification pending" when the independent check has not happened yet).
