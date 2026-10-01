# Rendered QA (Step 4B M1)

Checks the page a visitor actually gets, which every Step 4 check skipped (they read the HTML text only, and a defective page was approved).

## What runs, in order

1. **Text gate** (`@wfact/verification` `QA_GATE_CHECKS`): the Phase 5 six plus the claims gate: `claims.after-html`,
   `claims.sample-label`, `claims.banned` (memory/context.md R-10) and `claims.unsourced-fact` (the approved brief is the only fact source).
2. **Rendered suite** (`src/rendered.ts`, headless Chromium via Playwright, served over loopback HTTP): screenshots at 1440 / 768 / 375,
   `render.load`, `render.console`, `render.links`, `render.a11y` (axe, WCAG 2.x A + AA), `render.layout` (overflow; text under 12px and tap
   targets under 24px at 375), `render.js-budget`, `render.reduced-motion`, `render.design-rules` (the rulebook's DOM detectors) and
   `render.perf` (Lighthouse mobile, LCP and CLS against the Track A budget: LCP < 2.0 s, CLS < 0.1, JS < 50 KB).
3. **Screenshot review** (`src/reviewer.ts`, `render.design-review`): OpenAI `gpt-5.4` answers every rulebook rule on the screenshots in a
   strict JSON schema. Only runs when 1 and 2 passed. The builder today is Agent 37 and the evaluator is Claude, so this is a third vendor;
   the reviewer refuses to run if the builder is OpenAI.
4. The existing Claude evaluator, last.

Any failure is returned with its check id and a specific line (`[claims.unsourced-fact] FACT-PHONE: phone number "(555) 014-7732" is not in
the brief's facts…`), which the workflow hands to `FrontendLoop.revise()`. A review that could not run (no key, no credits, invalid answer
twice) is **NOT RUN**: the run is "not verified", never approved, and the builder is not asked to fix it.

## Use

```bash
npm run qa -- <page.html> --brief ../../clients/<slug>/brief.json --expect-sha256 <checkpoint hash> [--review-always] [--no-lighthouse]
```

Run it under `doppler run --` for the reviewer key. Writes full-page screenshots and `report.json` to `--out`. Production wiring:
`src/production.ts`, used by `packages/jobs/src/run.ts` (Cockpit jobs) and `packages/workflow/src/cli.ts`.

## Limits

- The design detectors are heuristics (see `packages/frontend-loop/design/README.md`).
- Lighthouse uses simulated mobile throttling; numbers vary run to run by roughly ±10%.
- External links are not checked by default (`--external-links` turns it on).
- Reviewer model calls are cost-logged in the CLI output and `report.json`, but not yet written to `model_traces`.
- Single-page today (today's builder emits one file); `runRenderedQa` already takes a list of pages for M3.
