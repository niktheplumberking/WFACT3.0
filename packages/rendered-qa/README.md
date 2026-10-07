# Rendered QA (Step 4B M1)

Checks the page a visitor actually gets, which every Step 4 check skipped (they read the HTML text only, and a defective page was approved).

## What runs, in order

1. **Text gate** (`@wfact/verification` `QA_GATE_CHECKS`): the Phase 5 six plus the claims gate: `claims.after-html`,
   `claims.sample-label`, `claims.banned` (memory/context.md R-10) and `claims.unsourced-fact` (the approved brief is the only fact source).
2. **Rendered suite** (`src/rendered.ts`, headless Chromium via Playwright, served over loopback HTTP): screenshots at 1440 / 768 / 375,
   `render.load`, `render.console`, `render.links`, `render.a11y` (axe, WCAG 2.x A + AA), `render.layout` (overflow; text under 12px and tap
   targets under 24px at 375), `render.js-budget`, `render.reduced-motion`, `render.design-rules` (the rulebook's DOM detectors) and
   `render.perf` (Lighthouse mobile, LCP and CLS against the Track A budget: LCP < 2.0 s, CLS < 0.1, JS < 50 KB).
3. **Screenshot review** (`src/reviewer.ts`, `render.design-review`): a vision model answers every rulebook rule on the screenshots,
   with one JSON finding per rule, validated strictly. Only runs when steps 1 and 2 passed. **Which model is a versioned decision in
   `config/reviewer.json`**: since 2026-10-01 it is Agent 37 `hermes-agent` (Huraira; OpenAI has no credits). That is the **same vendor
   and model as today's builder**, which the Step 4B prompt and CLAUDE.md §6 advise against: the reviewer refuses a same-vendor review
   unless that file names who approved it, and every report flags it `sameVendorAsBuilder`. OpenAI `gpt-5.4` is wired as the alternative.
4. The existing Claude evaluator, last.

Any failure is returned with its check id and a specific line (`[claims.unsourced-fact] FACT-PHONE: phone number "(555) 014-7732" is not in
the brief's facts…`), which the workflow hands to `FrontendLoop.revise()`. A review that could not run (no key, no credits, invalid answer
twice) is **NOT RUN**: the run is "not verified", never approved, and the builder is not asked to fix it.

## Use

```bash
npm run qa -- <page.html> --brief ../../clients/<slug>/brief.json --expect-sha256 <checkpoint hash> [--review-always] [--no-lighthouse]
```

Run it under `doppler run --` for the reviewer key (`AGENT37_API_KEY` + `AGENT37_BASE_URL`, or `OPENAI_API_KEY`). Writes full-page screenshots and `report.json` to `--out`. Production wiring:
`src/production.ts`, used by `packages/jobs/src/run.ts` (Cockpit jobs) and `packages/workflow/src/cli.ts`.

## Limits

- The design detectors are heuristics (see `packages/frontend-loop/design/README.md`).
- Lighthouse uses simulated mobile throttling; numbers vary run to run by roughly ±10%.
- External links are not checked by default (`--external-links` turns it on). Since Step 7 only public addresses are contacted
  (`src/egress.ts`: DNS checked, connection pinned, every redirect re-checked, 8 s per request), and the browser and Lighthouse are
  confined to the site's own server: anything a page tries to load from elsewhere is refused and reported under `render.links`.
- Since Step 7 the text gate is the evaluation registry's (`packages/verification/config/eval-registry.json`), shared with the jobs
  runner, the workflow CLI and `npm run verify`; `--stage launch` adds the launch-candidate checks.
- **Measured reviewer results (2026-10-01, live, Agent 37)**: the clean fixture passes; the Step 4 artifact fails on 6 rules; the
  review-only fixtures for DR-REPEATED-RHYTHM, DQ-ART-DIRECTION, DQ-TYPE-HIERARCHY and DQ-CONTENT-HIERARCHY each fail their rule.
  **Missed**: DQ-MOBILE-READABLE (10-11px text at 375px), even with phone shots at full detail; that fixture is caught by `render.layout`
  instead. The reviewer also adds some noise (e.g. it called the SAMPLE labels "eyebrows" once). About 34k input tokens and 130 s per
  review; Agent 37 calls are UNPRICED (no price on file).
- Reviewer model calls are cost-logged in the CLI output and `report.json`, but not yet written to `model_traces`.
- Single-page today (today's builder emits one file); `runRenderedQa` already takes a list of pages for M3.
