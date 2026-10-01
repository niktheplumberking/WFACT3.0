# Design rulebook (anti AI-slop)

`rulebook.json` is versioned data: the design-quality rule from the Factory Completion Plan Part C (Huraira, 2026-10-01) written as
rules a machine can check. It was distilled in our own words from that rule and the installed design skills (`impeccable`,
`design-taste-frontend`, `high-end-visual-design`, `ecc:frontend-design-direction`, `ecc:frontend-a11y`); no third-party prompt text
is copied.

Each rule has:

| Field | Meaning |
|---|---|
| `id` | `DR-*` = banned pattern, `DQ-*` = required quality. This id is what comes back to the builder when a page breaks it. |
| `rule` | The rule in one or two plain sentences. This exact text goes into the builder's system prompt (`src/rulebook.ts`). |
| `detect.dom` | Name of a deterministic detector in `packages/rendered-qa/src/browserScripts.ts`, run on the rendered page at 1440px (check id `render.design-rules`). |
| `detect.review` | The question the cross-vendor screenshot reviewer answers for this rule (check id `render.design-review`). |
| `briefCanAllow` | Whether a brief that explicitly asks for the pattern (e.g. a purple brand) overrides the ban. |
| `fixture` | A page that breaks only this rule. Generated from one clean base by `packages/rendered-qa/scripts/make-fixtures.ts`. |

Where it is used:

- **Builder**: every system prompt carries the whole rulebook (`FrontendLoop.buildSystemPrompt`), because the factory's builder cannot load
  Claude skills at run time.
- **Rendered QA**: `render.design-rules` runs every `dom` detector; a hit fails the page before any model is paid for.
- **Screenshot review**: a vision model from a different vendor than the builder answers every rule on the screenshots.

Limits, stated plainly: the DOM detectors are heuristics with fixed thresholds, tuned so `fixtures/clean.html` passes and each planted
fixture fails; they will miss real cases and may flag a deliberate design. `DR-REPEATED-RHYTHM` and the four `DQ-*` qualities have no
detector and are judged only by the reviewer. Changing a rule means bumping `version` and regenerating the fixtures (`npm run fixtures`
in `packages/rendered-qa`); CI fails if the committed fixtures drift from the generator.
