# Front-end upgrade (Option B) — design for approval

**Status**: DRAFT, awaiting Huraira's GO. Decision "Option B" recorded 2026-09-30 (Huraira). Nothing below is built.
**Where it sits**: a new **Step 4B**, inserted after Step 4 and before Step 5 of `docs/WFACT-3.0-Factory-Completion-Plan.md`
(Huraira's call, 2026-09-30). Launch and Money stay human hard-gates; no step here deploys to production.

## 1. Why

Step 4 (synthetic pilot) proved the machinery but the output is a single text-only HTML file. Cause, in code: the builder prompt
(`packages/frontend-loop/src/loop.ts:140`) says "single … HTML5 document, inline style, no external assets, no build step", the Planner plans
"a single page" (`planner.ts:93`), and templates translate Motion Sites/21st.dev designs into inline CSS (`templates.ts` header). The
Playbook's decided direction was Motion Sites + GSAP with Higgsfield imagery; that was descoped for the sprint. Also, every check reads the
HTML as **text**; nothing renders the page, which is why Step 4's human review found defects all checks missed.

## 2. Target

A client site is a real **built project**: multiple pages, real images, modern motion, compiled in CI to a static `dist/`, checked on rendered
screenshots at desktop and phone widths, previewed on Vercel only after a human yes.

## 3. Architecture (template-first, content-as-data)

1. **Site starter** (committed, versioned, human-reviewed): Vite + React + Tailwind + a router + GSAP, design tokens, a small component library
   (nav, hero, section, cards, forms, FAQ, footer), image slots with required alt text. The builder **fills the starter**, it does not invent a
   stack. Dependencies are pinned and allow-listed; the builder cannot add packages (supply-chain rule, Blueprint §3/§12).
2. **Planner** emits a site map (page list), a design direction, and an asset list, from the brief plus `memory/context.md` (banned claims, tone).
3. **Content as data**: each page is JSON (copy, sections, image refs). Every factual claim (phone, hours, areas, counts, ratings, names) must
   cite a field from the brief/intake; anything else is forced to a labelled placeholder. This makes "invented facts" checkable.
4. **Builder** writes page content and any bespoke section components inside the starter's constraints; output is a file set, not one blob.
5. **Build in CI** (GitHub Actions runner, no secrets in the build step, no network beyond the package cache): `npm ci && npm run build`.
   Artifact = `dist/` + source, stored in the private `artifacts` bucket with a checkpoint hash.
6. **Assets**: generated or supplied imagery, always labelled; never presented as the client's own work; alt text required; size/format budgets.
7. **Rendered QA** (new, runs on the built site): headless Chromium screenshots at 1440 / 768 / 375; accessibility (axe); Lighthouse performance
   (LCP, CLS, weights); link/asset crawl; console errors; text checks for content after the closing tag, required SAMPLE labels, forbidden
   claims and claims with no source field; a **vision-model review of the screenshots by a different vendor than the builder**.
8. **Cockpit**: screenshots and per-check results shown in Runs/Approvals so the owner sees the page, not just a verdict.
9. **Preview deploy**: Vercel preview only, human-approved, curl-verified. No production path.

## 4. Milestones (each verified independently before the next)

| # | Milestone | Acceptance |
|---|---|---|
| M0 | Inputs settled (section 6) | Reference sites, image policy, builder model and budget decided in writing |
| M1 | Starter + one rendered page | Starter builds in CI; 1 page renders; screenshot QA runs on it and catches a planted defect (leaked text, missing alt) |
| M2 | Multi-page from the Planner | Planner emits a page list; 3+ pages build; link crawl and nav consistency pass; fails on a broken link fixture |
| M3 | Assets | Images placed with alt text and labels; size budget enforced; unlabelled generated image is caught |
| M4 | Claims-as-data gate | Unsupported fact, missing SAMPLE label and banned claim each fail the gate (fixtures), and pass on clean content |
| M5 | Full run | Summit Line Roofing rebuilt through the Cockpit; screenshots reviewed by a human at desktop and phone; defects listed honestly |

## 5. Risks and honest unknowns

- **Builder capability**: Agent 37 (`hermes-agent`) writes one file in 100-200 s; a multi-file project may need a different builder model. Keeping
  builder and evaluator on different vendors (`CLAUDE.md` §6) means a second builder or evaluator vendor (overlaps Step 11).
- **Cost and time per build** will rise (more output tokens, image generation, vision review). Not measured; first numbers come from M1/M5.
- **Effort**: my rough estimate is 1-2 weeks of work across M1-M5, not measured. M1 gives the first real number.
- **Build sandbox**: model-written code runs in CI; it must have no secrets and no write access beyond its workspace.
- **Headless browser in CI** adds setup time and minutes per run.
- **Quality bar** depends on the reference sites (M0); without them "modern" is unmeasurable.

## 6. Inputs needed before M1 (Huraira / Nick)

1. 2-3 reference sites that show the bar.
2. Image policy: AI-generated images allowed if labelled? Higgsfield access and budget (descoped in `BLOCKED-ON-NICK.md`), or another source.
3. Builder model: stay on Agent 37 for now, or approve a second provider (Step 11 overlap).
4. A spend ceiling for this work (proposal: ask before any single build above $5, since builds will cost more than today's $0.17).

## 7. What this does not change

Launch and Money remain hard-gated to Nick. The verification culture stands: nothing is "done" on the builder's report. Synthetic inputs stay
labelled. The 3.0-vs-2.0 correction comparison is only meaningful once output is comparable to DreamSign's modern site, which is a reason to do this first.
