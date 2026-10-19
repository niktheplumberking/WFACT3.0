# Progress — WFACT 3.0

Last synced: 2026-10-19 (late night, +05), via `/step-close 21` (round 2) — `32cfa80`..`fb6f922`: D migration 0027 (live, 12/12), H RLS runs in CI on a throwaway local database, J shared mock, K entity table (migration 0028 live, 10/10; KNOWN_ENTITIES removed), F left by decision, M5 launch files proven on live run `4c35703b`. Round 1 CI `39299701250` green. Step 21 PARTIAL until CI is green on round 2.
Previous sync: 2026-10-19 (late night, +05), via `/step-close 28` (Package 4 pre-v2 rebuild R2) — `80f1391`: decided proposals (changes asked for; approved before the kind of site existed) in the v2 proposal grammar; BeforeBuild, AfterDecision, PlanDetails, WhatTheClientWants deleted (python count 3/2/2/2 → 0). vitest 342/342 (7 new in `pages/decided.test.tsx`, 4 mutations caught), tsc and build clean (precache 42 entries, 1575.43 KiB, no dev code in `dist/`); axe 0 and Lighthouse a11y 100 in 3 rooms; fingerprints of the proposal review, needs and Home identical. CI recorded at the next update.
Previous sync: 2026-10-19 (late night, +05), via `/step-close 21` — housekeeping round `ac314ae`..`f490904` plus graphify `f1eb53d`, `3db3263` (local, not pushed; CI not run on it): I first half, C, L, G, H in part (CI `media`, `dispatch-job` 7 Deno tests, `check-trackers`), J move, B decision record, E (0 dangling edges), D runtime part. Local: frontend-loop 130, planning 45, verification 123, jobs 38, workflow 89, hermes 55, agent-runtime 39, media 8, dispatch-job 7, rendered-qa 89 (run before the D change); typechecks clean; check-trackers OK. Step 21 stays PARTIAL: D triggers, F, K and H's RLS runs wait on Huraira.
Older sync entries (2026-09-28 to 2026-10-15): `docs/archive/2026-10-15-cleanup/PROGRESS-sync-log-to-2026-10-15.md`. Keep at most two "Previous sync" lines here; move older ones there.

**Which document governs what**: the Continuation Build Plan section (bottom) tracks
[`docs/WFACT-3.0-Continuation-Build-Plan.md`](docs/WFACT-3.0-Continuation-Build-Plan.md), the plan in
force since 2026-09-28, with the Blueprint (`docs/wfact-3.0-blueprint.html`) as the scope source of
truth. The Phases 1–7 section (now archived, see the pointer below) was the historical record of the superseded 100-hour sprint
(`docs/archive/sprint-100-hour/wfact-3.0-operator-manual.html` / `docs/archive/sprint-100-hour/WFACT-3.0-Fast-Track-Plan.md`). Its checkboxes are not
restructured to fit the new plan. `docs/WFACT-3.0-Factory-Completion-Plan.md` (committed `4ecfe4a`,
revised `a913b0d`/`1ccae2b`) sits **on top of** the Continuation plan, not in place of it: it maps the remaining Blueprint
phases to numbered steps 1–27 (execution order re-set and approved 2026-10-07) and is the source for "Next up" below. Its Part E checklist tracks those
steps; this file tracks the Continuation Stages.

**Status summary (2026-10-15, 13:30 +05, `/progress-sync`)**:
- **Step 21 PARTIAL, CI only** (`/step-close 21`, 2026-10-19): every sub-item A–L done or decided; migrations 0027 and 0028 applied live and attack-tested (12/12, 10/10); M5 launch files proven on live run `4c35703b`. Round 1 CI `39299701250` green; DONE once CI is green on round 2 (`32cfa80`..`fb6f922`).
- **Step 3A DONE, closed** (`/step-close 3A`, 2026-10-15): the live sign-up is proven end to end (sign-up, owner approval as `pm` with audit row, password
  sign-in after approval in the Auth logs, role-limited view, attack test 32/32). Supabase email confirmation stays off (Huraira, 2026-10-15: the approval gate is enough).
- **Step 25 PARTIAL** (`/step-close 25`, 2026-10-15): MVP M4, the contact form that saves leads, is **met live on synthetic data** (migrations 0025/0026
  applied, attack test 43/43, `submit-lead` deployed, JS and no-JS submits on both tracks stored as rows, refusals proven with curl). Not pushed.
  The CRM target and lead notification wait on Nick; the real-client run waits on Nick's brief.
- **Step 28 IN PROGRESS** (the current step). Package 4, the Cockpit v2 rebuild, has phases 1–17 CI-green and deployed (phase 14 Activity:
  CI `38929657403`; phase 15 Costs: CI `38934744558`; phase 16 Team: CI `38942505031`; phase 17 Settings: CI `38947151902`); phase 18 Notifications: CI `39268206990`); phase 19 cleanup `55e0a8a`..`5589192` (2026-10-19; CI `39286692404` green, deployed); pre-v2 rebuild R1, the other work pages, `f9d4842` (2026-10-19; CI `39296573842` green, deployed); R2, decided proposals, `80f1391` (2026-10-19; CI `39301911101` green, deployed). Package 4 exit check PARTIALLY MET: R3–R5 of the pre-v2 rebuild left;
  then Package 5, the paid proof (own GO).
- **Build failures** (`docs/BUILD-FAILURE-DIAGNOSIS.md`): both known rule contradictions are fixed in code. Testimonials: `b8d240f`,
  pushed. Palette: `8e6e09d`, pushed (CI `38706155999` green), after Huraira's rule. Stuck runs now halt early, and a no-change continue is refused unpaid.
  None of this is proven on a live build yet.
- **Brief consistency check and example clients** (`/step-close 28`, 2026-10-15): built, local, not pushed (`fd67328`, `52f7088`).
  Owner answers that disagree now halt at preflight unpaid and the owner's pick clears them; `docs/EXAMPLE-CLIENTS.md`.
- **Biggest blockers**: (1) Huraira: push the 16 local commits, then the live continue on Harbor Street (`caa201f1` is cancelled; `e6a71046` failed on contradictory owner answers). (2) Nick:
  the Cockpit v2 decisions in `BLOCKED-ON-NICK.md`, and the real brief Step 25 needs (no `clients/bennett*` in the repo).

**Earlier (2026-10-14)**:
- **Why no build succeeded since 2026-10-01 (diagnosed 2026-10-13)**: 0 of 17 builds passed. The main blocker was the design review: Node's fetch cut every Agent 37 review at 300 s, so builds that passed every deterministic check (`b880a7d5`, `456368c5`, `63278e56`, `83f2841f`) halted there. Fixed in `67033f7` (reviewer on Anthropic, 32 s live). Other causes: QA failing after 2 revisions (4 builds), builder schema strictness (2, fixed), checkpoint/resume (4, fixed by 4D), Agent 37 credits or a dropped connection (2).
- **Step 25 rehearsal (D4)** on synthetic Lanternworks Studio: intake, owner rejection, re-plan, approval on Track B and build ran through the live Cockpit; log in `clients/lanternworks-studio/rehearsal-log.md`. Gaps found: intake takes no logo or live address; re-plan keeps the old `sections`; reject needs a second click to re-plan.

**Earlier (2026-10-13, later)**:
- **Live:** MVP M6 is pushed and live (CI `38433400406` green, Cockpit deployed).
- **Caps:** ON at $5 per build and $20 per week, approved by Nick.
- **Agent 37:** topped up and answering.
- **Step 12:** stays **PARTIAL** until one live build proves the new trace rows.

Earlier the same day: MVP M6 (cost control) built in `2223856`, which makes Step 12 **PARTIAL**.
- **Agent 37 priced:** priced as an estimate ($3/$15). The screenshot reviewer is now traced, and builder answers have a 32k output ceiling.
- **Spend caps:** the per-build and weekly caps are built, but switched OFF until Huraira and Nick agree the amounts.
- **Cockpit:** the Costs page shows the true total.
- **Audit (`docs/AI-COST-AUDIT.md`):** real AI spend to date is about **$14.70**, of which the Cockpit showed only $1.33. Agent 37 carries 87% of all tokens.
- **New blocker:** Agent 37 answers HTTP 402 "AI credits exhausted", so no build can run until it is topped up.

**Earlier (2026-10-12, evening)**: MVP M5 (launch files for both starters) is built in `9968019`, which makes Step 21 **PARTIAL** (verification pending: CI on push, one live launch-stage build with a real address). Everything else below still holds. **Earlier the same day**: Day 3 of the 5-day MVP window (D3, due Wed 2026-10-14). **No MVP item in `docs/MVP-CUTLINE.md` §2 had started**: Nick's Bennett & Co brief is not in the repo, the cost cap awaits Huraira's yes, and OpenAI has no credits. No code has changed since 2026-10-07. The one new live fact: Track A re-run `b880a7d5` passed every deterministic check but stopped because the Agent 37 design reviewer was unreachable (HTTP 502). Pressing "continue" on it would close the Track A half of 4B M4 and prove Step 4D live. The MVP date is at risk until the brief arrives. Earlier summary (2026-10-07) follows.

Step **4D (build recovery) is PARTIAL**: built, migration 0018 applied live (attack test 26/26), pushed and deployed (CI `37644039022` green); the live "continue" button has not been pressed on a real stopped build yet. (Corrected 2026-10-07 in the alignment pass; this line previously said "not applied, not pushed".) On the Factory Completion Plan, Steps 1, 2, 3, 3A, **5, 6 and 7 are DONE** (5 and 7 on 2026-10-07: 5 proven on live
Cockpit builds, 7 CI `37617845669` green); Step 4 is PARTIAL (preview superseded by 4B M6); **Step 4B is IN PROGRESS**, about 90% through M4:
Track B's live build `c775c396` passed every check except a simulated-LCP measurement that misses 2.5 s by 0.02-0.08 s for framework
scripts alone (real LCP 0.05-0.72 s), and Track A's last re-run `ad49df57` died on one dropped Agent 37 connection, now retried (`734ded5`);
M5 blocked on Higgsfield API credit; M6 not started. Step 4C BUILT AND DEPLOYED (signed-in check pending). Steps 8–27 not started (new: 25 real-client run, 26 quality calibration, 27 Track A motion budget).
Continuation Stages 1–5 MET; Stage 6 = Step 5 (MET except the Cognee write-up, Step 15); Stage 7 waits on Nick. **Biggest blocker**:
Huraira's own actions (M4 live re-runs, one live "continue", OpenAI and Higgsfield credits, rotating the Higgsfield key) gate Steps 26, 27 and 25; Nick's real brief gates Step 25 (fallback: the real 2.0 DreamSign case). `render.perf` gates on applied throttling (Huraira, option 1, 2026-10-07).

**MVP override (Decision D3, recorded 2026-10-10, docs only, no code changed)**: Nick wants the Website Build Module proven on Bennett & Co (colors and logo fixed, fonts free, agency-style site, websites only) by Wed 2026-10-14. Until then only items 1 to 4 below run, trimmed to that proof; scope fence, schedule and cost evidence are in `docs/MVP-CUTLINE.md`. Cost evidence from live `model_traces` (113 rows): Claude spend is about $1.32 in total; the 53 Agent 37 builder calls (2.41M input / 0.39M output tokens) are unpriced and, at an assumed Sonnet-class rate, would be about $13, matching the credits spent. Proposed cap (awaiting Huraira's yes): price Agent 37, $5 per build across retries, $20 per week. Nick's brief had not arrived at the time of writing.

**Next up** (2026-10-19, `/step-close 28` R2):
1. **Huraira**: review the R2 report and answer R3's question (the design has no Decisions room or stage-moves screen: retire `/decisions` and `/decisions/stages`, keep and restyle them, or other).
2. **Huraira**: continue Harbor Street `e6a71046` (live proof of the brief consistency check and the brand-colour rule).
3. **Nick**: the Cockpit v2 decisions in BLOCKED-ON-NICK (including the work-page actions); the CRM target and lead notification.

**Gaps noticed**:
- **Owner answers that contradict each other reach the builder as two facts** (2026-10-15, Harbor Street continue `e6a71046`, GitHub run
  `38711602641`, $1.22, 12 calls). The brief's `ownerFacts` hold both q2 "15 December 2026" and q7 "20 December 2026" (opening date),
  and both q3 "Main primary service at 20% off" and q8 "Our second flagship offer" (the offer); q3's label still reads "...is unclear".
  Round 1 hedged ("still finalizing") and failed; round 2 combined them ("20% off") and failed; halted after 2 revisions. The
  deterministic checks passed both rounds (the supplied-quote fix held), and the stuck breaker correctly stayed off (the issue changed).
  **Built 2026-10-15 (`fd67328`, local, not pushed; not yet proven live)**: the readiness check halts such a brief before any
  paid call and asks the owner which value is right (`resolve.<topic>`, no schema or Cockpit change); the pick replaces the
  losing answers (`packages/workflow/src/briefConsistency.ts`, eval E6, mutation-checked). Root cause measured: plan 4acbde1f's
  12 questions were the intake's ambiguities plus the Planner's own questions on the same topics (`planner.ts:266`); the
  Planner now asks each known topic once. NOT COVERED: topics are matched by keywords, so a conflict phrased without them is missed;
  topics outside the table (brand colours, audience) can still be asked twice.
- **Proposal, example clients (2026-10-15, waiting on the lead-form work and Huraira's GO)**: (1) a "Start from example" Cockpit
  button that loads `clients/example-*` (`docs/EXAMPLE-CLIENTS.md`); (2) an `is_test` flag with its own test entity, so
  rehearsal spend stops landing on `bennett-co`; (3) a `lead_sites` row per example so its contact form is connected.
- **A "realistically messy" example client should follow the two clean ones** (2026-10-15): a perfect brief flatters the factory.
- **A `synthetic-example` brief source** would separate the 2026-10-15 examples from the 2026-09-30 synthetic pilots; adding it
  touches `packages/frontend-loop/src/brief.ts` (off limits during the lead-form session), so the examples reuse
  `synthetic-provisional-2026-09-30`.
- **Palette contradiction**: **resolved in code 2026-10-15** (`8e6e09d`, pushed in `2a64471`). Huraira's rule: tints and shades are on-brief, and CTAs use the true accent at 4.5:1. The engines already complied; the evaluator and the screenshot reviewer now quote one `BRAND_COLOUR_RULE` (eval E5). The general fix is still open: a contract test that every content fixture the builder's validator accepts also passes the deterministic gate (`docs/BUILD-FAILURE-DIAGNOSIS.md` §5.3).
- **A Cockpit continue can stay `queued` for ever** (2026-10-15): job `caa201f1` never reached `dispatch-job` (no `dispatched_at`; cause: an unlisted Cockpit alias, fixed in v6). Nothing is spent, but nothing tells the owner. A queued job with no dispatch after a few minutes should say "never reached GitHub" and offer to press again.
- **Only `render.perf` and `render.design-review` count as variable** for the stuck breaker and the same-stop refusal (2026-10-15). If another rendered check proves flaky, add it to `VARIABLE_CHECK` in `buildAndVerify.ts`.
- Cockpit v2 (Step 28 P4): the design's "Test client" badge has no data source (no test flag on clients or projects); not shown until one exists.
- Cockpit v2 (Step 28 P4): no table or column records a site approval, so "Approved, waiting for launch" cannot be reached; logged for Nick, then Huraira. Phase 13 shows "Approve the site" switched off with the reason until it exists.
- Cockpit v2 (Step 28 P4, phase 13): "Ask for changes" on the finished site has no runner input that reaches the builder; not offered (BLOCKED-ON-NICK).
- Cockpit v2 (Step 28 P4, phase 13): "launch with placeholders" is owner-only in the UI but any owner or admin can insert it in the database; fix written as migration 0024 (`562c5ae`), not applied, and only on the unmerged worktree branch `claude/objective-engelbart-d65df7` (2 commits ahead of `huraira-work`, checked 2026-10-15 night).
- Cockpit v2 (Step 28 P4): three role rules in the design are wider than RLS allows (PM Activity, admin Costs, PM cost so far on project pages); the UI follows RLS; logged for Nick, then Huraira (policies plus attack tests).
- Cockpit v2 (Step 28 P4): the design's caps ($2.00 per build, $20 a month, monthly cap stops new builds only) disagree with the live caps ($5 per build, $20 per rolling 7 days, checked before every call); logged for Nick. Until he decides the Cockpit reads `spend-caps.json`.
- Cockpit v2: pre-v2 rules still render through a temporary alias block in `tokens.css`; the old breathing lamp in the build timeline still loops and the app icon is still the signal-lamp tile; all go in phases 3–7.
- **Request text now supports prices on the site** (Step 28 review, 2026-10-14): the request is a fact source, so a price or phone the client mentions (even about a competitor) counts as sourced for `claims.unsourced-fact`. Banned claims are unaffected (that check ignores fact sources).
- **`public.rls_auto_enable()` is executable by anon** (security advisor, seen 2026-10-14; pre-existing, not from 0022).
- **Lanternworks owner facts are test values** (a phone number, "Testing Address"): correct them before Package 5 (redacted from the committed fixture).
- **A brief that names a logo cannot pass QA yet** (2026-10-13, `e2a204fb`): intake takes no logo file, so the builder writes a text wordmark. The evaluator then fails the build twice ("no page references any logo asset"). That costs a full revision budget (about $1.50 on run `4c35703b`) for a defect the factory cannot fix on its own. Bennett & Co has a fixed logo, so this blocks Step 25.
- **Synthetic rehearsal spend is booked to `bennett-co`**: every trace row of the Summit Line resume (run `2dcaacfa`) and the Lanternworks build (run `4c35703b`) carries `entity_slug = 'bennett-co'`, because only DreamSign and Bennett & Co are active entities. Bennett's cost per client (Step 12) therefore includes rehearsal spend. Filter by run, or give synthetic clients their own entity.
- **Agent 37 adds ~21k hidden input tokens to every call** (probe 2026-10-13: 21,182 tokens for a 5-word message). That is about $0.06 per call before our own prompt. See `docs/AI-COST-AUDIT.md` 1b.
- **Token savings not yet built** (`docs/AI-COST-AUDIT.md` §3B, after the MVP). Each one is measured against the Step 26 calibration set before it ships:
  - prompt caching;
  - builder fixes that send only the failing sections;
  - screenshot review of changed pages only;
  - a QA evaluator that does not resend the whole HTML;
  - a Hermes-lite memory summary instead of the full file.
- **Timeouts still re-billed:** an Agent 37 call that times out after 6 minutes is still retried (the Step 4D reliability fix), so it can be billed twice. Revisit after the MVP.
- **Thin output headroom:** the Agent 37 output ceiling (32k, accepted live 2026-10-13) is only 6% above the largest real answer, 29,969 tokens.
- **Standalone QA job not covered by the per-build cap:** it runs with no run id (`handlers.ts:288`), so only the weekly cap applies to it.
- **The live address must be supplied for launch**: without the brief's `siteUrl` (or an owner fact `site_url`) the launch-stage checks tells.canonical, tells.og-image and tells.sitemap fail by design; there is no Cockpit field for it yet. Add it to the Bennett intake.
- **The share card is a plain colour card** (brand deep colour, accent rule, no text or logo). Replace it with a designed card from the client's own assets when supplied.
- **No favicon in either starter** (tells.favicon, advisory). Small; could ride with the Bennett logo.
- **Live migration name differs from the repo file**: applied as `build_recovery` (20261007144150), repo file is `0018_build_recovery.sql`; `0016` is absent in both. Recorded 2026-10-19 (Step 21 K): no `0016` file was ever committed (`git log --all` finds none); the numbering skipped it when `0017` was added in `681b9a8`, and the live list goes 0015 (20261002173129) to 0017 (20261007114354), so nothing is missing.
- **Doc-only commits trigger the full CI and a production deploy of the Cockpit** (three runs queued for three doc commits). Consider a paths filter (Step 21 H). Those three deploy jobs then failed without starting (0 steps, no runner; CI `37653665566`, `37653814793`, `37653952730`). The cause is not visible (logs show nothing; possibly the queued runs colliding or an Actions limit). The app code is unaffected, but the next real code push must confirm the deploy job runs.
- **The MVP schedule has slipped**: `docs/MVP-CUTLINE.md` §5 planned the brief for Sat 10-10, the cap and launch files for Sun 10-11, and the first build for Mon 10-12. None of these is in the repo as of 2026-10-12. The cut-line asks for slippage to be reported on Monday evening.
- **(Review part fixed 2026-10-14, `67033f7`: the screenshot reviewer is now Anthropic.)** **The Agent 37 gateway is a single point of failure for review**: it has caused design-review NOT RUN halts on 2026-10-03 (`5c85914b`) and 2026-10-07 (`b880a7d5`). Until a second vendor works (Step 26 item 1, OpenAI credits), any gateway outage stops verification.
- **Nick has not confirmed decision D1**; he confirms by blind-rating sample builds in Step 27.
- **Stale path in the Continuation plan**: it names `packages/agent-runtime/registry.ts`; the file is `packages/agent-runtime/src/registry.ts`
  (the only dead path found in a link check of the 7 main docs this sync).
- **Track A writes the brief's open questions into the home page as HTML comments**: readable by anyone viewing the page source (Step 7 report).
  Should live in `content.json` only. Awaiting Huraira's yes.
- **Second-vendor evaluator has never made a successful live call**: OpenAI returns HTTP 429 "no credits remaining" (checked 2026-10-07). Only
  matters when the builder falls back to Claude; with Agent 37 as builder, Claude stays the evaluator.
- **Hermes-lite reads `clients/<entitySlug>/memory.md`** (an entity slug used as a client folder name), found in Step 6.
- **Agent 37 builder calls are unpriced** (`model_traces.cost_usd` null; ~168k input + 25k output tokens per builder run, the biggest
  token user), so no USD ceiling sees them. Needs a price basis or a token ceiling for unpriced providers (Step 12, cost governance).
- **`packages/media` is not in CI yet**: its 8 tests run locally only; add it to the CI job list when M5 wires it into the pipeline.
- **Track B "work" items can still be invented clients labelled SAMPLE**; quotes no longer can (2026-10-06). The design reviewer may
  read invented project panels as fake social proof too; watch the next live Track B build.
- **Track B output is reproducible per platform, not across platforms**: the same content gives output hash `a19eed34…` on macOS (two
  runs) and `0209e11b…` on the Linux CI runner. A checkpoint is always re-hashed against its own build, so nothing breaks, but "same
  content = same bytes" holds per platform only.
- **On GitHub's runner, unprivileged user namespaces are refused**, so the Track B build isolates with `sudo unshare --net` and drops back
  to the runner user (`linux-sudo-unshare`); a host without passwordless sudo or unprivileged namespaces refuses to build, by design.
- **Stage 7 prerequisites aren't flagged yet.** The plan says to flag them in `BLOCKED-ON-NICK.md` "the
  moment Stage 6 finishes". The rows exist ("One real pilot project brief", "business rules session")
  but are still framed as sprint Day 3–9 items.
- **Model routing covers only Intake and Planner.** The Phase 4 builder/evaluator and Hermes-lite's
  own model are still chosen inside their packages. Disclosed in the config's `_doc`.
- **Traces cover model calls, not tool calls.** Hermes-lite tool calls are in `audit_log` with
  latency. Blueprint §3 names tool calls too; revisit under the Langfuse trigger (§13).
- **Audit rows from before 2026-10-19 18:25 UTC keep `entity_slug = null`** where it was knowable (Step 21 D fixed new rows in
  `0027`; `audit_log` is append-only, so old rows are not backfilled). Reports that group by entity should read older rows through
  their job's plan.
- **The deployed DreamSign page is stale (left as is, Huraira 2026-10-19, Step 21 F).** The Stage 3 live run overwrote
  `clients/dreamsign-pilot/pages/clean-agency.html` and appended 2 rows to its `memory.md`, but
  `dreamsign-deploy.vercel.app` (HTTP 200 today) still serves the older build, since the workflow
  never deploys by design.
- **The knowledge graph's PDFs are title-only** (2026-10-19, Step 21 E): `graphify update .` gives 5048 nodes, 9793 edges and
  0 dangling edges (was 52). All 6 PDFs are file nodes only; semantic extraction needs `/graphify --update` with a model key.
  The SOPs are covered by their markdown copies.
- **Two Nick disclosures are still owed in person**: Hermes-lite as a stand-in and Vercel substituting
  for Hostinger. Both are logged in `BLOCKED-ON-NICK.md` as "TELL NICK, DON'T JUST LOG IT", and
  neither conversation has happened.
- **Step 4C leftovers** (from its own evidence, `docs/step-4c/after/`): Projects on a phone shifts slightly while it loads (Lighthouse CLS
  0.118, target < 0.1); "Decide on launching …" items stay on Home and in Decisions until a Launch record exists (Human Control, Step 14),
  so today Northlight Signs and Summit Line show permanently; the `verify` job can only re-check single pages, not Track A sites (D4: Step 7);
  phone performance is 76–86 under Lighthouse's simulated slow 4G (desktop 100), mostly the Supabase + React bundle.
- **Cockpit v2 leftovers after phase 19** (2026-10-19): the locked design's segmented control is 38 px tall inside a 46 px track; its hit
  area reaches 44 px through the track padding (built as designed; no design ruling to change it). On phones the nine Settings group
  buttons come before the group content (left as is). The pre-v2 screens listed under Step 28 are cleaned, not rebuilt.
- **Security advisor, pre-existing**: `public.rls_auto_enable()` is callable by `anon` as SECURITY DEFINER; leaked-password protection is
  off in Supabase Auth. Both predate Step 4C and are not fixed by it.

**Unplanned work done**:
- **Alignment pass 2026-10-07** (`ec71c89`…`113276a`, docs only): `docs/HANDOFF.md`, `docs/archive/MANIFEST.md`, sprint Phases 1–7 checklist archived to `docs/archive/2026-10-07-alignment/`, Factory Completion Plan recreated (closed-step prompts archived, Steps 25–27 added, Execution order table, Part F proposals), decisions D1 and D2 recorded, `.env.example` and `.claude/*` rewritten, two stale agent worktrees removed. `check-trackers` OK (31 steps).
- **Cockpit-driven actions** (`4653c67`): a `jobs` queue (migration `0009`), the `dispatch-job` Edge
  Function, `.github/workflows/cockpit-job.yml`, a `packages/jobs` runner, and a Cockpit Actions room.
  This is Huraira's direction (every pipeline action runs from the Cockpit, with GitHub Actions as the
  worker). The plan doesn't ask for it, and it arguably edges into the plan's "do not build yet: a task
  queue" item. It's disclosed here rather than folded into a stage. Design is in
  `docs/COCKPIT-JOBS.md`.
- **Email + password sign-in with approval-gated sign-up** (Huraira's request, 2026-09-30; migration
  `0010`, applied; Cockpit code deployed on `main`, CI `36698432470`). New sign-ups create a pending `account_requests`
  row and no profile, so they see nothing until an owner approves them (an admin may approve `pm` only).
  Files: `packages/db/migrations/0010_account_requests.sql`, `apps/cockpit/src/{Login,AccessPending,AccessRequests}.tsx`
  plus edits to `App.tsx`, `Approvals.tsx`, `theme.css`. Attack test `scripts/rls_attack_test_accounts.sql`:
  32/32 (`RLS_ATTACK_TEST_RESULTS.md`, Run 3). Cockpit typecheck and build pass and the bundle has no
  `service_role`; the login and sign-up screens were checked in the browser pane (locally served) and
  client-side validation blocks a short password with zero auth requests. Live bundle `index-BhS0QsT3.js`
  contains the new screens. **Follow-up `856e483`** (Huraira couldn't reset a password because no reset flow
  existed): a **Forgot password?** link (`resetPasswordForEmail`) and a "choose a new password" screen on the
  `PASSWORD_RECOVERY` event, deployed in CI `36699308136`. **Not yet proven:** a real reset email and
  password set, a real sign-up, email confirmation, approval and first sign-in end to end. All need real
  accounts or emails (Huraira's actions); the Redirect URL allow-list for reset links is also unchecked.
- **`parseBrief` allows a new provenance value** (`2c188d0`): `synthetic-provisional-2026-09-30` was added
  to the allowed brief `source` values in `packages/frontend-loop/src/brief.ts`, with a test, so the
  Step 2 synthetic brief can be labelled honestly instead of posing as `placeholder-2.0-case`.
- **Found in git 2026-10-15 night, cited in neither tracker before** (each now also noted under its step in the Completion Plan):
  - `a6f64cd` (2026-10-14, pushed): the Cockpit's "What was built" previews the built site itself (pages, styles, fonts, logo via
    signed links, page switcher, links caught in a sandboxed frame) instead of a file list; advisory findings show as non-blocking notes.
    Step 28 territory.
  - `dde68a5` (2026-10-15, local): `dispatch-job` v6, the CORS alias fix in "Incidents & regressions"; deployed and proven by `e6a71046`.
  - `e11c1ea` (2026-10-15, pushed): repo cleanup round 3 (archive moves with MANIFEST rows, PROGRESS slimmed 1,198 -> 789 lines,
    `.claude/rules/`, `AGENTS.md`); recorded under Step 21.
  - `3c79212` (2026-10-13, pushed): MVP M6 caps switched on ($5 per build, $20 per 7 days; Nick approved); Step 12.
  - `892c468` (2026-10-07): per-run cost ceilings from live `model_traces` (worst case per pipeline $10 -> $2.05); Step 12.
  - `7286b54` (2026-10-07): builders' open-question cap 10x300 -> 25x800 after Cockpit job `4d6e1abb` failed on it.
  - `ece5995` (2026-10-07): Track B starter 1.1.0 contact form variants (enquiry | signup), from Cockpit job `6f68adbd`.
  - Unmerged worktree branch `worktree-agent-a8907207a63a55715` (`84bd4e6`, Cockpit build timeline): same change set size as `8b3caed`,
    which landed; superseded, not merged. Safe to remove once Huraira confirms.
- **Knowledge graph** (`77680c7`): `graphify-out/` plus a `.gitleaks.toml` allowlisting only its cache
  file.
- **From the sprint era**:
  - Real usage and cost instrumentation in the `hermes` and `frontend-loop` model clients, now
    centralised under Stage 5.
  - The `Agent37ModelClient` adapter and the builder/evaluator vendor split.
  - The SOP PDFs.
  - The Cockpit dark-theme restyle (`a57d977`).

**Incidents & regressions**:
- **CI red on the push of `4abf890`, deploy skipped (2026-10-15).** CI `38724162336` failed the gitleaks secrets scan with 6
  "generic-api-key" hits, all one made-up UUID used as a lead-form site key in Step 25 M4 test fixtures (`60061b7`, `b1cd762`,
  `f8b1bf7`). False positive: site keys are public by design (migration 0025) and the value matches no live `lead_sites` row (SQL, 0).
  Fixed by an exact-value allowlist entry in `.gitleaks.toml`. Local gitleaks 8.30.1 over `2a64471..4abf890`: 6 findings before,
  0 after; a different key-shaped value is still caught. Pushed as `6d88f79`: CI `38725434775` passed the scan and the
  `submit-lead` Deno job (its first CI run), then failed Rendered QA's "Fixtures are up to date" step, so the deploy was skipped again.
  Cause: `f8b1bf7` edited the generated registry fixtures by hand (connected forms on every site page, the new
  `fail/launch.form-connected` site) without changing their generator, so `npm run fixtures` in CI undid it (16 files). Fixed in
  `packages/rendered-qa/scripts/make-fixtures.ts` (`connectForm`, the new variant). Locally: regeneration now leaves the committed
  fixtures unchanged byte for byte (before the fix it changed 16 files); rendered-qa typecheck clean (it does not cover `scripts/`).
- **Cockpit presses from a new address never reached GitHub (2026-10-14 18:12 to 2026-10-15 09:08 UTC, fixed).** The Cockpit gained a
  production alias, `wfact-3-cockpit.vercel.app` (same bundle `index-Dtf_dbEO.js` as the old alias), that `dispatch-job`'s CORS allow-list
  did not know. Its log named it ("CORS refused origin"), the browser dropped the POST, and Harbor Street continues `caa201f1` and
  `e6a71046` stayed `queued` with no `dispatched_at`; nothing was spent. Fixed by listing the alias: `dispatch-job` v6 (2026-10-15,
  `verify_jwt` on). Checked with curl after deploy: new and old aliases get the CORS header, `evil.example.com` does not, an unsigned
  POST gets 401. Proven by a real press: `e6a71046` dispatched and ran (GitHub run `38711602641`). The fix commit `dde68a5` is still local.
- **Builds paid again for failures no revision could fix (2026-10-01 to 2026-10-14).** Two factory rules contradicted the builder.
  The claims gate demanded SAMPLE labels on real quotes the rulebook forbids labelling (Harbor Street `d3c45995`). A judge read
  "only the three brand colours" against a palette engine that derives tints for contrast (Lanternworks `e2a204fb`). Every
  revision and every continue re-paid for the same failure. It was found by diagnosing all 25 build jobs
  (`docs/BUILD-FAILURE-DIAGNOSIS.md`) and fixed in `b8d240f` (quotes, stuck breaker, no-change continue refused) and `8e6e09d`
  (colour rule). Live proof pending.
- **CI red on the pushed head, deploy skipped (2026-10-14).** `d5129e0` (CI `38452956084`) failed Rendered QA: on Node 22 the hung-fetch mock in `test/reviewer.test.ts` left the event loop empty, so tests 35-40 were cancelled. Node 24 (local) did not show it. The test is the problem, not the reviewer. The Cockpit job runner builds from `main`, so live builds already use `67033f7`. Fixed in `a9b271f` (local 18/18, not pushed at this sync).
- **Step 4D's first CI run failed and skipped the Cockpit deploy (2026-10-07).** `9730d99` (CI `37638990031`): the Frontend loop job failed on my new test of the Agent 37 request timeout ("Promise resolution is still pending but the event loop has already resolved"): `AbortSignal.timeout`'s timer does not keep Node alive, so on the runner the test process ended first; locally other handles hid it. Product code was fine. Fixed in `a643d2d` (test holds the loop open); CI `37644039022` green and the Cockpit deployed. Nothing live was affected: migration 0018 was already applied and the old Cockpit simply did not use it.
- **A push made a live QA crash possible (2026-10-07).** `8cb26e9` (render.perf on applied throttling) added a second Lighthouse Chrome per
  page; `5c3ae67`'s CI (`37627375120`) then failed Rendered QA with an uncaught `ECONNRESET` from the QA server's error-less CONNECT sockets.
  `main` (which the Cockpit runner builds from) carried the risk from `8cb26e9` until the fix; live jobs on it: Track B `c7fba41a` and
  Track A `9c853a49`, neither hit it (both reached a verdict). Found by CI, fixed the same hour (socket error listeners, one Chrome per page).
- **A live Higgsfield API key was pasted into the chat (2026-10-06).** Huraira posted `HIGGSFIELD_API_KEY` in the session so it could be stored;
  the agent stored it in Doppler (`HF_CREDENTIALS`, value never printed, logged or committed; staged diffs scanned before each commit, 0
  matches). The key is still exposed in the chat transcript: **rotation pending (Huraira)**. No use beyond two refused calls ("Not enough credits").
- **Step 4B M1 reached `main` and redeployed the Cockpit without a planned push (2026-10-01).** This checkout pushed `huraira-work`
  (17:02:01 +05) and `main` (17:02:03 +05) right after another session's commit `03138d9`; the coding agent's docs commit `eaea97b` landed in
  the gap and went to `main` with it, so `c1345de`, `47cef2c`, `eaea97b` deployed through CI run `36859122425` (all jobs green,
  `deploy-cockpit` success, live HTTP 200). Found by the agent (`git reflog show origin/main`: "update by push"; no hook or push config).
  Impact: none observed; M1 does not touch `apps/cockpit` and deploys no client site. `03138d9` also committed the agent's uncommitted M1
  entry in this file, and its message ("mark the 0fbdfce rename incident resolved") does not match its diff. Huraira has since authorised
  pushing and merging to `main` (2026-10-01). Prevention: one session per checkout, or push named commits (`git push origin <sha>:main`).
- **False CI-hang claim in a commit message (2026-10-01, corrected).** `5641f45` says the first `rendered-qa` run "sat 20+ minutes"; it
  passed in 2m03s (run `36859122425`, tests 12:02:50 to 12:04:53 UTC). The agent misread a watch command that returned early. Amending was
  blocked by the GateGuard hook, so the correction lives here. The commit's timeouts stay as a safeguard.
- **Unrelated staged changes swept into an agent commit (2026-10-01, resolved).** `0fbdfce` contained 12 renames into `docs/archive/`
  staged by another editor. Resolved by `289ec00` (link fixes), now on `main`; a link check of the 7 main docs this sync found no stale
  archive paths. Prevention: commit only named paths and check `git diff --cached` first.
- **Verification approved a defective page (2026-09-30, open; input to Step 7).** The Step 4 artifact passed all 6 deterministic checks, the
  in-loop evaluator (round 3) and the QA evaluator, and re-verified clean in a separate CLI run (`4a73fa57`). A human read of the file and
  the rendered page then found: agent-tool text after `</html>` ("File-mutation verifier: 2 file edit(s) FAILED…") shown under the footer;
  testimonials with 5-star ratings and no SAMPLE label although the approved plan required it; an invented phone number, opening hours,
  six neighbourhoods and response-time promises. Found by the Step 4 human review, not by any check. Nothing shipped (the workflow stops at the
  launch hard-gate). **Fix landed 2026-10-01 in Step 4B M1** (`c1345de`): the same file now fails `claims.after-html`, `claims.sample-label`,
  `claims.unsourced-fact` and `claims.banned` (test `packages/verification/test/claims.test.ts`, sha256-pinned). Still open: the live
  screenshot review, which would also judge the visual defects.
- **Builder provider out of credits (2026-09-30, resolved: credits restored, build re-run succeeded).** The Step 4 build (job `31c965ff`) failed when Agent 37
  returned HTTP 402 "AI credits exhausted" after the first draft was produced and the Claude evaluator had
  requested changes. The workflow escalated to a human and stopped after 1 attempt, as designed (`agent.escalate`
  and `workflow.halt` rows in `audit_log`, run `353b9945`); the Cockpit showed the real reason. The draft was lost
  (no checkpoint, `lastCheckpoint` null). Fix owed by Huraira: top up Agent 37 billing (money, human only).
- **Doppler CLI token exposed (2026-09-28, remediated 2026-09-30; revocation of the old token not independently verified).**
  - What happened: a bad output filter printed the Doppler CLI token (`dp.ct…`) into a session
    transcript.
  - Found by: the same session.
  - Fix: Huraira reports revoking it and logging in again on 2026-09-30. Evidence: `doppler me` shows a
    CLI token created 2026-09-30T09:26Z (after the exposure), and `doppler run` works with it.
  - **Not verified:** that the old token is dead. Its value isn't available to test, so no rejected-call
    proof exists. Huraira can confirm in the Doppler dashboard (Access → CLI tokens) that only the
    09-30 token is listed.
- **Admins could write any profile, including promoting themselves to owner (found and fixed 2026-09-30).**
  - What: since migration `0005`, policy `profiles_owner_manage` allowed `owner` or `admin` to insert,
    update or delete any `profiles` row.
  - Found by: reading the migration while designing account approval, not by an attack test or an incident.
  - Fix: migration `0010` replaces it with owner-only write policies. After the fix, the attack check
    "admin promotes self to owner" affects 0 rows. The old behaviour was reasoned from the policy text and
    never exploited or demonstrated. Only one profile (yours, owner) exists, so there was no admin to abuse it.
- **CI guardrails false positive (2026-09-28, fixed).** CI's first-ever run (`36421350704`) failed
  because the "no tracked .env" regex matched the intentionally tracked `.env.example` files. The bug
  was latent since Day 1 because CI had never run on `main`. It was fixed to exempt exactly
  `.env.example`.
- **gitleaks false positives (2026-09-28, fixed).**
  - Run `36429819858` flagged 8 findings, all hashes of `.claude/hooks/*token*.sh` filenames in
    `graphify-out/cache/stat-index.json`.
  - Fix: `.gitleaks.toml` allowlists that one file. A canary key elsewhere is still caught.
- **Rejected `VERCEL_TOKEN` (2026-09-28, fixed).**
  - Run `36433582813`'s deploy failed at `vercel pull` with "User not found (404)".
  - Huraira replaced the token.
  - The next run, `36436468792`, deployed with HTTP 200.
- **`dispatch-job` CORS preflight returned 500 (2026-09-28, fixed).**
  - Cause: a 204 response carried a JSON body, which Deno refuses ("Response with null body status
    cannot have body").
  - Seen in function logs at 15:01:44–15:01:53 UTC. It would have broken every Cockpit click.
  - Fixed and redeployed (function version 2). Preflights return 204 from 15:02:37 on.
- **Cockpit jobs never dispatched (2026-09-28, fixed; end-to-end proven by run `36455639903`).**
  - The owner created `build_plan` jobs `a2a41d2d` (15:34 UTC) and `cbf8bf7b` (15:39 UTC) from the
    Cockpit. Both are still `queued`, with `dispatched_at` null.
  - Function logs show an `OPTIONS | 204` preflight for each and **no `POST`**, so the browser never
    sent the request.
  - **Cause confirmed:** `allowedOrigin()` didn't accept the Cockpit's Git branch-preview host,
    `wfact-cockpit-git-huraira-work-…`.
    - The logged responses carried only `vary: Accept-Encoding`, with no `Vary: Origin` or
      `Access-Control-Allow-Origin`, so no allowed origin was seen.
    - Reproduced with curl: production got the CORS header; the branch preview didn't.
    - Both hosts serve the same bundle (`index-CA9VfGbA.js`).
    - Headers were ruled out: supabase-js 2.117's `invoke` sends only allow-listed headers, and
      tracing is off.
  - **Fix:**
    - `dispatch-job` v3 also accepts `wfact-cockpit-git-<branch>-…`. Checked with curl after deploy:
      the branch origin now gets the CORS header, `evil.example.com` doesn't, and a POST without a
      token gets 401.
    - The Cockpit also gets a **Start** button on `queued` jobs, so a dispatch that never landed can
      be retried instead of stranded. Polling stops for jobs left `queued` over 2 minutes.
  - **v3 wasn't enough.** Huraira's Start click at 16:49 UTC failed the same way ("Failed to send a
    request to the Edge Function"; 3 preflights on v3, none with CORS headers).
    - `vercel inspect` shows the production deployment has a second alias,
      `dist-rho-lime-95.vercel.app`, left over from the 09-22 manual `dist` deploy.
    - It serves the same current bundle and doesn't fit the pattern. By elimination, that's the origin
      in use.
    - `dispatch-job` v4 allows it by exact match, and now logs any refused origin by name. The edge
      logs don't record `Origin`, which is why this took two rounds.
    - Checked after deploy: all four Cockpit hosts plus `localhost:5173` are allowed, a foreign origin
      is refused and logged, and an unsigned POST gets 401.
  - **Resolved (2026-09-30 check):** `GITHUB_DISPATCH_TOKEN` is set (job `e5d29358` failed visibly
  with "not set" at 16:52 on 09-28; job `b952aaba` then dispatched successfully at 17:05, GitHub
  returned 204). `dispatch-job` is now v5 and its deployed source matches the repo. Failure path
  proven live by `e5d29358`. The original "still unknown" note follows.
- (Superseded) Still unknown: whether `GITHUB_DISPATCH_TOKEN` is set. If it isn't, the next click will now fail
    the job visibly rather than silently.
- **Magic-link redirect fell back to `localhost:3000` (2026-09-22, fixed).** Huraira's first sign-in
  used an expired link pointing at `localhost`. Supabase Auth's Site URL was never set for production,
  and Huraira fixed it in the dashboard. Details are in Phase 6.
- **Git-triggered Vercel build deployed an empty app over the working Cockpit (2026-09-22, fixed).**
  Caught by Huraira as a 404. Root Directory and env vars were set. As of Stage 1, `vercel.json`
  disables Git deploys on `main` and CI is the only deployer. Details are in Phase 6.
- **Zero-cost trace bug (2026-09-28, caught before shipping).** The first version of the Stage 5 trace
  wrapper held the client's live counter object, so every recorded cost would have been $0. The new
  tests caught it, and a snapshot fixed it. Listed here because it would have silently produced false
  cost data.

---

# 100-Hour Sprint (superseded 2026-09-28 — archived 2026-10-07)

The Phases 1–7 checklist of the superseded sprint moved, unedited, to
`docs/archive/2026-10-07-alignment/PROGRESS-sprint-phases-1-7.md` (see `docs/archive/MANIFEST.md`). History only; do not work from it.


# Continuation Build Plan (`docs/WFACT-3.0-Continuation-Build-Plan.md`)

Stages 1–5 are **MET** and the unplanned Cockpit jobs work is dispatch-proven (2026-09-28 to 2026-09-30). Their checklists, the
September CI history table and the evidence moved verbatim to `docs/archive/2026-10-15-cleanup/PROGRESS-continuation-stages-1-5.md`.

## Stage 6 — Real second brain v1.5: episodic memory tied to task IDs (PARTIALLY MET 2026-10-07 — delivered as Factory Completion Plan Step 5)

- [x] Documentation agent writes a structured entry to `clients/<name>/memory.md` at the end of every workflow stage, tied to the
      `audit_log` task ID — `791d67a`, `bba3093`, `e2c7a12`; live backfill 26 entries = 26 `documentation.entry` rows over 8 runs, 0 without a
      task id (SQL, 2026-10-07); CI `documentation` job green in `37614606732`. Not yet seen on a live Cockpit build (see Step 5 below).
- [ ] Cognee trial: at most one session, then a write-up that states adopt or don't adopt. Not done; it is Factory Completion Plan Step 15.

**Acceptance**: *"A test query ('what happened on client X's build') returns a correct answer sourced from the structured memory file,
written by the Documentation agent, not by a human"*, plus the Cognee write-up exists. — **PARTIALLY MET**: the Step 5 agent's live
`npm run ask` on Summit Line answered from the agent-written entries and every fact matched SQL ($0.0278; the agent's evidence, not re-run at
this sync); the Cognee write-up does not exist.

## Stage 7 — A real pilot, not a placeholder one (NOT STARTED — waiting on Nick; provisional stand-ins in use since 2026-09-30)

- [ ] Real pilot brief: **Nick** (`BLOCKED-ON-NICK.md` "One real pilot project brief", OPEN, marked
      "PROVISIONAL DRAFT IN USE"). Stand-in: `clients/summit-line-roofing/brief.json` (fictional, entity
      `bennett-co`), loads through `parseBrief` (`2c188d0`). It does not close this item.
- [ ] Business-rules session for `memory/context.md`: **Nick** (`BLOCKED-ON-NICK.md`, OPEN, marked
      provisional). The file now holds concrete provisional rules with a 13-row register (R-01…R-13),
      no `[PLACEHOLDER]` tags left (`2c188d0`); Nick still has to keep or change each.
- [ ] Run Intake → Planner → build → verify on the real brief, and log the correction-batch count. **Synthetic
      pilot attempt 2026-09-30 (Factory Completion Plan Step 4): Intake + Plan + owner approval worked through the
      Cockpit (jobs `1dd90f25`, `c62e24a4`; plan `825cfff6` approved 10:13:11 UTC); Build + verify (job `31c965ff`,
      run `36701102701`) FAILED: Agent 37 returned HTTP 402 "AI credits exhausted" on the builder's second call.
      Waiting on Huraira to top up Agent 37 credits. No page, no correction count.** **Update (attempt 2, job `81c8607b`,
      run `36743601290`): Agent 37 credits were restored and the build completed: 3 rounds (2 changes requested), QA approved,
      artifact sha256 `960b61ba…` re-verified independently (6/6 deterministic checks + evaluator). A human review then found
      defects all checks missed (leaked tool text after `</html>`, unlabelled SAMPLE testimonials, invented facts). Not deployed.** A live
      Intake run on the synthetic raw email (claude-haiku-4-5, $0.0029, no DB writes) classified entity
      `bennett-co` and flagged both planted ambiguities; that is a check of Intake alone, not the pipeline.

**Acceptance** (not met): Blueprint §16K item 1: one real client, the full pipeline, a measured
correction count below 40+, independently verified against the deployed output. A synthetic run (Step 4)
demonstrates the factory but does not count against DreamSign's 40+.

---

# Factory Completion Plan (`docs/WFACT-3.0-Factory-Completion-Plan.md`) — steps tracked here from Step 4B on

Steps 1–4 and 3A are summarised at the top and in the plan's Part E; from Step 4B on, each milestone gets its checklist here.

## Step 4B — Front-end upgrade: two build tracks (IN PROGRESS — M0 6 of 7 inputs, M1 DONE with a recorded deviation, M2 DONE, M3 DONE 2026-10-01, M4 PARTIAL 2026-10-02)

**M0 — inputs** (`docs/FRONTEND-UPGRADE-DESIGN.md` §10)
- [x] Reference sites per track, niche taxonomy, labelled-AI-images policy, $5 per-build ceiling — `0fbdfce`, `0bfb19c`
- [x] Builder model: **Huraira 2026-10-01, "builder stays on Agent 37"** (`BLOCKED-ON-NICK.md` closed)
- [ ] Image tool and budget: **Huraira**, needed before M5

**M1 — rendered QA + claims gate on today's builder**
- [x] Claims gate: `claims.after-html`, `claims.sample-label`, `claims.banned` (R-10), `claims.unsourced-fact` (approved brief = only fact
      source), rules `packages/verification/config/claims-rules.json` v1.0.0 — `c1345de`; verification tests 35/35
- [x] Design rulebook `packages/frontend-loop/design/rulebook.json` v1.0.0 (12 banned, 4 required, one failing fixture each) in the
      builder's system prompt — `c1345de`, `47cef2c`; frontend-loop tests 29/29 (incl. "every rule id in the builder prompt")
- [x] Headless Chromium screenshots at 1440/768/375, axe, Lighthouse, link/asset crawl, console errors, layout, JS budget, reduced motion,
      rulebook DOM detectors (`packages/rendered-qa`) — `47cef2c`; rendered-qa tests 18/18 real Chromium, locally and on GitHub
      (run `36859122425`, tests 2m03s)
- [x] Step 4 artifact (sha256 `960b61ba…`, re-downloaded from the private bucket) FAILS on the leaked tool text, the unlabelled
      testimonials and the invented phone/hours — `claims.test.ts` (hash-pinned) and an independent `npm run qa` run: also fails
      `render.design-rules`, `render.layout`, `render.perf` (LCP 2.87 s vs 2.0 s)
- [x] Clean fixtures pass; each planted defect (leaked text, missing SAMPLE, invented fact, banned claim, broken link, console error,
      over-budget JS, reduced motion, 11 DOM-detectable rules) fails only its own check — `claims.test.ts`, `rendered.test.ts`
- [x] Results are exact check ids `FrontendLoop.revise()` acts on — `packages/workflow/test/claimsGate.test.ts` (revision prompt carries
      `[claims.*]` lines; clean revision reaches the launch gate); workflow 8/8, jobs 8/8
- [x] Wired into production QA (Cockpit jobs runner, workflow CLI), no off switch; CI `rendered-qa` job gates the Cockpit deploy —
      `47cef2c`, run `36859122425` green
- [x] **Live screenshot review** — Agent 37 `hermes-agent`, per Huraira 2026-10-01 ("Use Agent37 Models, and finish M1") after OpenAI
      returned HTTP 429 (no credits). **Deviation**: same vendor and model as the builder, not "a different vendor"; recorded in
      `packages/rendered-qa/config/reviewer.json` (the guard refuses a same-vendor review without it; every report flags
      `sameVendorAsBuilder`). Vision checked first (it read a random number and colour from an image). Live results: clean fixture PASS
      (whole gate, 134 s); Step 4 artifact FAIL on 6 rules (avatars, eyebrows, repeated rhythm, three-card row, thin text, centring);
      DR-REPEATED-RHYTHM, DQ-ART-DIRECTION, DQ-TYPE-HIERARCHY, DQ-CONTENT-HIERARCHY fixtures each FAIL their rule. **Missed**
      DQ-MOBILE-READABLE (also at full image detail); that fixture is caught by `render.layout` (42 texts under 12px, 4 tap targets 16px
      tall). About 34k input tokens and 127-157 s per review, UNPRICED. Reviewer tests 16/16 (10 original + 6 Agent 37).
- [x] Clean fixture is clean by the rulebook, not only by the detectors: the first live review failed it on DR-THREE-CARD-ROW and
      DR-REPEATED-RHYTHM (fair: three white cards; three list sections in a row); the generator's base was redesigned (featured pull-quote,
      split services, numbered timeline) and all fixtures regenerated; it then passed. rendered-qa 24/24, verification 35/35.
- [ ] Chromium step in `.github/workflows/cockpit-job.yml` exercised by a real Cockpit job: the 2026-10-01 jobs `21350a42` and `5ed238ac` ran
      QA on the runner but failed on the text gate (`claims.banned`) before any rendered result is recorded; not yet proven (`audit_log` checked)
- [ ] Reviewer cost written to `model_traces` (today only in CLI output and `report.json`)

**Exit check**: *"re-checking the Step 4 artifact (sha256 960b61ba...) FAILS on the leaked tool text, the unlabelled testimonials and the
invented phone/hours; clean fixtures pass. Results are exact check IDs that FrontendLoop.revise() can act on."* — **MET** (evidence above).
The milestone also asks for *"a screenshot review by a model from a different vendor than the builder"*: a live screenshot review runs and
works, but on the builder's own vendor by Huraira's recorded decision, so this part is **MET WITH A DEVIATION**, not met as written.

**M2 — direction step + track choice** (DONE 2026-10-01)
- [x] Direction agent `packages/planning/src/direction.ts`, registered at composition (`registryWithPlanningAndDirection`), agent-runtime
      untouched; fixed taxonomy `packages/planning/config/direction-taxonomy.json` v1.0.0; model slot `direction` (claude-sonnet-5,
      routing v1.3.0). Every point must quote the request verbatim or it is dropped; no recommendation below 0.6 confidence, for "other",
      without a niche quote, or on conflicting signals below 0.8. Planning tests 25/25 (12 original unchanged + 13 new).
- [x] Runs after Intake on the original request; stored with the plan; reused on re-plan; a failed step still yields a plan with the reason.
      Live: `npm run intake` on the Summit Line request wrote pending plan `b5a45a8e` (local-trade, goal booking, Track A at 0.88, 3 brand
      points, 0 dropped; 2 `agent:direction` audit rows), $0.0406 total ($0.0248 direction), 41 s.
- [x] 14 labelled SYNTHETIC cases across all 7 niches (`packages/planning/test/fixtures/direction/cases.json`, labels written before the
      run), live `npm run eval-direction`: **track 14/14 strict, niche 13/14** (design agency classified creative-portfolio, label said
      professional-services), both no-recommendation cases withheld, the prompt-injection case ignored, $0.2821. Per-case table:
      `packages/planning/test/fixtures/direction/RESULTS.md`. Caveat: one run on cases written by the same agent; not a production accuracy claim.
- [x] Migration `0011_plan_build_track.sql` (append-only, applied): `build_track` decision column, approval requires a track,
      `track_overridden` computed by the trigger, audited in `plan.decision`; jobs trigger refuses `build_plan` without a track.
      Attack test `scripts/rls_attack_test_tracks.sql` 19/19 (Run 4 in `RLS_ATTACK_TEST_RESULTS.md`); `get_advisors`: nothing new.
- [x] Cockpit: plan card shows the direction summary (with the client's words) and the recommendation with reasons; recommended track
      pre-selected, overridable; approve disabled until a track is chosen; Actions builds Track A only (Track B waits for M4). Checked in the
      browser with the real component and stubbed data (desktop + 375 px: no overflow, 76 px options, approve sends `build_track`).
- [x] Jobs handler refuses no-track and Track B builds (jobs 10/10; 2 existing tests now approve with Track A, as M2 requires).
- [x] Live owner choice: plan `b5a45a8e` approved as **Track A** by a signed-in owner (actor `baf92ea7…`) at 2026-10-01 18:23:35 UTC,
      recommended A, not overridden, written to `audit_log` as `plan.decision` (queried at sync). Deployed vs local Cockpit is not
      distinguishable from the rows.
- Known effects: the 2 plans approved before 0011 cannot be built (no track); all 14 eval requests were entity-ambiguous at Intake (they
  name no WFACT entity), which in the live pipeline stops before Direction until a human assigns the entity.

**Exit check**: *"Fixture set run with per-case results; owner can choose/override a track; choice stored and audited; no build without a
track"* — **MET** for the fixture run, storage, audit and the build gate (attack test + jobs tests); the owner's choice is proven in the
browser against stubbed data and in the database by the attack test; a live click in the deployed Cockpit is still owed (Huraira).

**M3 — Track A starter + multi-page build** (DONE 2026-10-01)
- [x] Committed Track A starter `packages/frontend-loop/starters/track-a/` (CSS design system + 1.7 KB of JS, no framework, no web fonts,
      no third-party requests) and a deterministic renderer `src/trackA/render.ts` (same content → same bytes). Design skills loaded first
      (impeccable, design-taste-frontend, high-end-visual-design, ecc:frontend-design-direction, ecc:frontend-a11y, ecc:motion-foundations);
      art direction from the brand: pitched-roofline edge with a drawn copper ridge, system type pairings (serif + humanist sans), computed
      AA palette. `d190e4d`, `10ef870`
- [x] Content as data `src/trackA/content.ts` (schema `track-a/1`): every business fact is `source: brief` (checked against the brief) or
      `sample` (rendered with a visible SAMPLE label, never in JSON-LD); required section ids, reserved ids, page structure (home ≤ 6
      sections, others ≥ 2, one cta, no three list-like sections in a row) and WCAG contrast are validated before rendering
- [x] Builder loop `src/trackA/loop.ts` + agent: Agent 37 writes content JSON only; exact validation errors go back (bounded); Claude
      reviews the content against the brief (bounded rounds); QA failures come back as page + check id and the builder edits the content
- [x] Multi-page through the pipeline: text gate on every page, required sections site-wide, JSON-LD parsed as JSON; rendered QA serves the
      whole site; workflow checkpoints a manifest pinning every file's sha256 and re-hashes all files before QA; revisions edit
      `content.json`; resume refuses a different builder; jobs build Track A plans with the Track A builder; CLI `--track A`. `6234f87`
- [x] Migration `0012_artifacts_site_json.sql` (applied): the private `artifacts` bucket also accepts `application/json`; still private,
      2 MB, owner/admin read only. No table or RLS change. `get_advisors`: nothing new (the 3 known items)
- [x] **Acceptance fixtures** (real Chromium, `packages/rendered-qa/test/trackA.test.ts`, 5/5): the SYNTHETIC 4-page Summit Line site passes
      the text gate on every page, every rendered check and the Track A budget on every page (LCP 0.90 s vs 2.0 s, CLS 0, 1.7 KB JS);
      **broken-link fixture** (a page removed) fails only `render.links` (HTTP 404 on 3 pages); **over-budget fixture** (60 KB script + a
      hero image over 2 MB) fails only `render.js-budget` and `render.perf` (LCP over 2.0 s)
- [x] **Live build through the pipeline** (workflow CLI, same library code as the Cockpit job; Agent 37 builder, Claude content reviewer,
      text gate + rendered QA + Agent 37 screenshot review + Claude evaluator): run `2bfca49e` → `awaiting_launch_approval` after 3 build→QA
      cycles, 16 min; verified checkpoint `clients/summit-line-roofing/sites/track-a/site.manifest.json` sha256 `12a6cd7a…`, 3 pages.
      **Independent re-check** (separate process): every file re-hashes to the manifest; text gate 10/10 and rendered 9/9 pass on all 3
      pages; LCP 0.90 s, CLS 0, perf score 1.0. Not deployed (launch gate)
- [x] Cost: Claude $0.36 across all three live runs ($0.11 + $0.09 + $0.17); 12 Agent 37 builder calls (~474k input tokens) UNPRICED;
      Agent 37 screenshot-review calls still not in `model_traces` (M1 gap)
- Live runs, honestly: `470ea1b9` failed_verification (claims gate caught "licensed and insured?"/"warranty" FAQ copy; then the reviewer
  failed rhythm and contrast → found a real starter bug: the tinted section background silently fell back to the paper); `b2cd975e`
  build_failed (claude-sonnet-5 spent all 4096 output tokens thinking: `max_tokens` raised to 16000 in both Claude clients, `74b59a0`);
  `2bfca49e` passed
- [x] Fixed on the way: rendered-qa design detectors crashed on any inline SVG (`innerText` undefined), so no Track A page could be checked
- **Defects the checks missed** (human look at the verified build): invented service scope not in the brief ("Shingle, metal or tile
  options", "Attic check for leaks and ventilation"; the claims gate only covers factual patterns); the packages table's "Includes"
  column wraps heavily; the home page ends without a closing call to action; one generic line ("Three things, done well.")
- **Reviewer noise** (Agent 37, same vendor): DR-SINGLE-DEFAULT-FONT failed twice on pages whose fonts (Iowan Old Style + Avenir Next)
  were proven loaded in the QA browser; DR-THIN-LOW-CONTRAST once although axe colour-contrast passed. Claims-gate false positive:
  BC-SUPERLATIVE matches "the best time to reach you"
- [ ] Track A built by a real Cockpit job (GitHub Actions): run twice (jobs `21350a42`, `5ed238ac`, 2026-10-01): build checkpointed, QA
      cycle 0 failed `claims.banned` (BC-SUPERLATIVE false positive), cycle 1 halted `checkpoint_corrupt` (Supabase CDN served the old
      manifest). CDN fix `c857150`; a fresh live build is still owed (Huraira).
      On the Linux runner the starter's system fonts are not installed, so screenshots there show fallback faces
- [ ] "Human-reviewed starter": waiting on Huraira's look

**Exit check**: *"a 3+ page local-business site builds, passes rendered QA, the rulebook and its budgets; a broken-link fixture and an
over-budget fixture fail."* — **MET**: live run `2bfca49e` (3 pages) passed the text gate, rendered QA, the rulebook (DOM detectors and the
screenshot review) and the Track A budgets, re-verified independently; both fixtures fail on the named checks only.

**M4 — Track B starter (Next.js static export) + multi-page build** (PARTIAL 2026-10-02 — CI green; screenshot review and live pipeline build pending)
- [x] Committed Track B starter `packages/frontend-loop/starters/track-b/` (starter 1.0.0): Next.js 16.3.8 App Router, `output: 'export'`,
      Tailwind 4.3, GSAP 3.15 + ScrollTrigger and Lenis 1.3 loaded after first paint, Lucide, self-hosted font pairings (studio:
      Bricolage Grotesque + Geist; editorial: Newsreader + Hanken Grotesk; technical: Unbounded + Geist), every dependency pinned.
      Design skills loaded first (impeccable, design-taste-frontend, high-end-visual-design, ecc:frontend-design-direction,
      ecc:motion-foundations, ecc:motion-patterns, ecc:frontend-a11y). One motion idea per section type; content visible without
      scripts; reduced motion = still. `3987b59`, `13ec854`
- [x] Content as data `src/trackB/content.ts` (schema `track-b/1`): brief-sourced facts checked, SAMPLE work/quotes/facts labelled,
      one h1 opener per page, no repeated layouts, required sections site-wide; palette with a contrast-safe `dim` colour. Builder loop and
      agent: Agent 37 writes content only, a separate reviewer approves, the build runs once after approval; build failures escalate.
- [x] **Isolated build** `src/trackB/isolate.ts` + `build.ts`: macOS `sandbox-exec` / Linux network namespace, allow-listed environment,
      a probe before every build (3 outbound attempts fail with EPERM, raw TCP fails, a canary variable never reaches the build),
      `npm ci --offline --ignore-scripts` (2.1 s) + `next build --webpack` (10.4 s); output byte-identical across builds (hash `a19eed34…`
      in two separate runs); the built source is kept. CLI `npm run build-track-b`.
- [x] **Artifact in the private bucket**: migration `0014_artifacts_track_b_types` (applied, version `20261002130540`; bucket still
      private, 2 MB, 1 owner/admin read policy; `get_advisors`: nothing new). The real build was checkpointed through the production
      `SupabaseArtifactStore`: 85 objects (55 output, 29 source, content.json) + manifest sha256 `31a29f7f…`, fonts stored as bytes, read
      back hash-verified and identical; unauthenticated and anon-key reads refused (HTTP 400). SYNTHETIC objects under
      `clients/northfold-studio/sites/track-b/` in the bucket. `e8b2eb7`
- [x] Workflow, jobs, CLI: nested and binary site files, source under `_source/`, build record in the manifest; `--track B`; Track B
      plans build with the Track B builder and `TRACK_B_BUDGET`; a runner without it refuses. One existing jobs test was reworded (it
      asserted the M2 placeholder refusal). Workflow 15/15, jobs 12/12. `e8b2eb7`
- [x] **Rendered QA for Track B** `5a1711d`: `TRACK_B_BUDGET` (proposal: LCP < 2.5 s, CLS < 0.1, JS < 700 KB decoded/page) and
      `render.motion-budget` (no layout property animated while scrolling, no time-based animation over 1.5 s, <= 250 ms of
      long-animation-frame blocking per scroll-through); `render.reduced-motion` now catches script-driven animation and smooth-scroll
      hijacking. Shared fixes: gzip in the QA server, JS bytes from resource timing (the response hook undercounted ~4x),
      `net::ERR_ABORTED` not an error, `no-console-errors` allows a site's own scripts and parses them (`a9f4dcf`).
- [x] **Acceptance fixtures** (real Chromium, `packages/rendered-qa/test/trackB.test.ts` 8/8): the SYNTHETIC Northfold 3-page site
      (real isolated build) passes the text gate on every page and every rendered check, the Track B budget and the motion budget
      (LCP 1.80–2.32 s, CLS 0, ~625 KB JS, 0 ms scroll blocking, 11 animations on the home page); **broken link** fails `render.links`
      (plus the matching 404 in the console from Next's prefetch); **over-budget JS** fails only `render.js-budget`; **over-budget
      animation** (layout animated on scroll, 60 ms per frame) fails only `render.motion-budget`; **reduced motion ignored** (a script
      animation, and forced smooth scroll) each fail only `render.reduced-motion`. All three pairings measured inside budget.
- [x] Suites: verification 38/38, frontend-loop 55/55, rendered-qa 37/37 (full run), workflow 15/15, jobs 12/12; typechecks clean.
- [x] CI wired (`a917cc3`): required job `track-b-build` (no secrets referenced; canary variable; fails unless the network was blocked;
      uploads the export), cache warming in frontend-loop, rendered-qa and `cockpit-job.yml`; deploy needs the new job.
- [x] **CI run** `37016971442` on `2d96962` (pushed on Huraira's word): all 13 jobs green, including **Track B — isolated static build**:
      isolation `linux-sudo-unshare`, network blocked (registry EAI_AGAIN, 1.1.1.1 ENETUNREACH, IPv6 EADDRNOTAVAIL), `unexpectedEnv: []`,
      canary absent, install 7.8 s, build 21.3 s, output hash `0209e11b…`; the frontend-loop and rendered-qa jobs ran the real Track B
      build and the 8 acceptance fixtures on Linux; the Cockpit deploy also succeeded.
- [ ] **Live pipeline build** (Agent 37 builder, Claude reviewer, Cockpit job or CLI): not run. A synthetic Track B client would be a
      third client on an existing entity (entity law); needs Huraira's decision.
- [ ] **Screenshot review** (Agent 37, same vendor): FAILED DR-SINGLE-DEFAULT-FONT (and DQ-TYPE-HIERARCHY once) on studio and on technical
      pairings, although the web fonts are loaded and render (headline 1012 px in Bricolage vs 1030 px in the fallback). Same false
      positive as M3; needs the different-vendor reviewer or Huraira's call.
- Decisions recorded for Huraira (`docs/FRONTEND-UPGRADE-DESIGN.md` §11): Motion and Radix allow-listed but not used (LCP budget; native
  `<dialog>` menu); webpack not Turbopack (sandbox, smaller JS); fonts `display: optional`; Track B stills in the resting layout.
- Found on the way: Turbopack needs a loopback port (refused by the sandbox); a random temp folder made webpack output differ; dimming
  text by opacity failed axe; Archivo's width file pushed LCP to 2.55 s; Lighthouse charged uncompressed JS before the gzip fix.

**Exit check**: *"Track B starter (Next.js static export) + multi-page build. The build runs in CI with no secrets in the build step and
no network beyond the package cache; artifact = static output + source in the private artifacts bucket with a checkpoint hash.
Acceptance as M3, plus reduced-motion respected and an over-budget animation fixture fails."* — **PARTIALLY MET**. Met: the starter,
the multi-page build, the isolated build (proven locally on macOS), the artifact in the private bucket with its checkpoint hash, rendered
QA and budgets, reduced motion, and every fixture, and (since this sync) the isolated build in CI `37016971442` on Linux. Not met yet:
the screenshot review did not pass (likely reviewer noise, unproven), and no live pipeline build.

**Fix 2026-10-02 — live Cockpit site builds refused their own checkpoint** (FIXED locally and against the live bucket; live Cockpit build
not yet re-run). Cockpit jobs `21350a42` and `5ed238ac` (Summit Line, Track A) both halted `checkpoint_corrupt` on cycle 1: the
correction round overwrote `site.manifest.json` and the read-back was served from Supabase's CDN (`cf-cache-status: HIT`, the
previous cycle's bytes) despite `cacheControl: no-cache`. Live probe: plain GETs stale 6/6 after overwrite; authenticated endpoint and a
one-off query string fresh 6/6. `SupabaseArtifactStore` now reads via `/object/authenticated/artifacts/…?fresh=<uuid>`; the hash check
is unchanged. New `packages/workflow/test/supabaseArtifacts.test.ts` fails on the old code, passes now; workflow tests 17/17;
live overwrite-then-verify 8/8 with the real store. Job `8e577598` ("already ended with workflow.halt") was a resume of a halted run,
correctly refused. Next: start a fresh build from the Cockpit (do not resume the halted runs).
The fresh Track A build (job `6dec53e7`, run `24d8fc72`) got past the checkpoint read (CDN fix holds live) and halted
`not_verified_no_evaluator`: `render.design-review` NOT RUN, Agent 37 HTTP 502 `upstream_unreachable` on two back-to-back attempts
(Agent 37 answered normally minutes later).

**Fix 2026-10-02 — reviewer outage retry and Cockpit Track B builds** (`8318c57`, `7d6367d`; live builds not yet re-run).
The design reviewer now waits 15 s / 45 s / 120 s on a gateway or network failure (5xx, 429, no response), 4 calls at most, then NOT RUN;
an unusable answer keeps one immediate retry. The Cockpit still said "the Track B builder arrives in Step 4B M4" and offered no build
button, although the runner (`trackBWorkflow`) and the jobs trigger already accept Track B: Decisions now offers Start build for either
track, Track B plans show under "Ready to build". Tests: rendered-qa 40/40, Cockpit 24/24 (new tests fail on the old code), jobs 12/12.
Next: a fresh Track A build and the first live Track B build from the Cockpit.

**Cockpit cleanup 2026-10-02 — archive finished runs (migration 0015, applied live)**. `jobs` stays undeletable (0009); a run is
hidden, never erased. `archive_job(job, archived)` is owner/admin only, finished runs only, audited (`job.archived`/`job.unarchived`);
the progress guard lets a finished job change only `archived_at`/`archived_by`. Attack check in a rolled-back transaction, 8/8 as
intended (archive+edit, edit/delete of a finished run, archiving a queued run, and a non-owner caller all refused). Live cleanup as the
owner through the same functions: the 2 queued 09-28 builds cancelled, 8 failed/cancelled runs archived (audit rows 2 + 8; all 14 runs
still in `jobs`). Cockpit: Activity hides archived runs (Archived filter), finished runs get Archive/Unarchive, Home ignores archived
runs; Cockpit tests 27/27.

**Fix 2026-10-03 — "no evaluator model was configured" on a Track B build that was fine** (`bad6d57`; not pushed, not deployed).
First live Track B build from the Cockpit, job `5c85914b` (Harbor Street Bakery plan, GitHub run `37113126761`): cycle 0 failed only
`render.perf` (mobile LCP 2.63 s), the builder revised, and cycle 1 passed **every** deterministic check (text gate, all rendered checks,
LCP, motion budget). The design review then returned NOT RUN ("HTTP 502: upstream_unreachable", 4 attempts, `audit_log`
`verification.decision` 2026-10-03 09:56:22 UTC), so the run was rightly **not verified**, but the halt reason claimed no evaluator was
configured (the evaluator was `claude`). `notVerifiedReason()` now names the review that did not run and its error; the Cockpit explains
both the new and the older wording. Tests: workflow 19/19 (+2), Cockpit 28/28 (+1), verification 38/38, jobs 12/12. The Agent 37 gateway
answered `GET /models` with HTTP 200 at 2026-10-03 (gateway up; a full review call not tested).
- [ ] Re-run the Track B build of that plan from the Cockpit (Huraira; after this fix is deployed, or as is: the outcome is the same, only
      the message changes).

**Fix 2026-10-06 — Cockpit job `f696ba43` (Track B, Harbor Street Bakery) failed on two factory contradictions** (`c64bd0e`, `8dae180`;
local only, not pushed). The 2026-10-03 re-run of plan `4acbde1f` ended `failed_verification` after 5 correction rounds: the builder's
reviewer rejected twice that a "single landing page" brief was built as 4 and then 3 pages (both content schemas forced 3+ pages), and the
design review failed DR-FAKE-SOCIAL-PROOF on testimonials labelled "SAMPLE - replace with real client feedback" (the builder prompts asked
for exactly those). Fixes: the brief carries `pageScope` (single|multi), set by the Planner from the `landing_page` lead type and, for plans
approved earlier, by `briefForBuild()` from the stored lead type; both tracks validate, prompt and review by it (a one-page site keeps the
primary action on the page; Track A drops the footer page list). Quotes now come only from the brief; an invented one is refused before the
build; rulebook 1.1.0 says so in DR-FAKE-SOCIAL-PROOF. The synthetic Summit Line brief no longer asks for SAMPLE testimonials (its `proof`
section is removed; real feedback is open question 3), flagged to Huraira. Claims rules 1.1.0: BC-SUPERLATIVE no longer flags "the best
time to reach you" / "what time of day works best" (jobs `21350a42`, `5ed238ac`); "the best roofer in town" still fails. Tests: frontend-loop
59/59 (incl. both real isolated Track B builds), verification 39/39, planning 26/26, workflow 19/19, jobs 13/13, rendered-qa 40/40.
- [x] Pushed (both branches, `4e30947`, CI green) and re-run live from the Cockpit 2026-10-07: Track B job `6f68adbd`, Track A job `4d6e1abb`.
- [ ] Track B job `6f68adbd` (single page, 14 min, 3 cycles): both 2026-10-06 fixes held (builder review approved first time every round;
      no fake social proof). Failed only on the evaluator: the starter's contact form is a fixed studio-enquiry form (organisation, "what
      are you planning", start date), wrong for an email signup, and the builder cannot change form fields, so revisions could not fix it.
      Fixed 2026-10-07: the contact section takes `form: "enquiry" | "signup"` (default enquiry; signup = email required, first name
      optional, no project-brief fields); the builder prompt says when to use which; starter 1.1.0 (also "Studio" -> "Location"). Real
      isolated build test of both variants; frontend-loop 67/67, workflow 27/27, rendered-qa 40/40. Re-run of Track B needed (Huraira).
- [ ] Second re-run 2026-10-07 (both on `026fd29`, CI `37616985541` green): Track A job `ad49df57` failed in 3.5 min, "builder escalated after 1
      attempt: fetch failed": one dropped connection to Agent 37 (25 ms, `model_traces` 12:02:03Z) ended the build because the builder client
      had no retry. Fixed: `Agent37ModelClient` retries no-response / HTTP 5xx / 429 after 5, 15, 45 s (4 attempts), then escalates; 4xx and
      unusable answers are not retried; 3 tests, frontend-loop 70/70. Step 5 proven live on the same run: the Documentation agent wrote entry
      `ep-7fc49965fcf0d73c` for the halted build stage (`documentation.entry`, 12:02:04Z).
- [ ] Track B job `c775c396` (single page, signup form chosen, 3 cycles, 7.5 min): every check passed in every cycle (claims gate, rendered
      checks, a11y, layout, design rules; builder review approved first time) except `render.perf`: mobile LCP 2.58 / 2.58 / 2.52 s vs the
      2.5 s budget. Diagnosed 2026-10-07 on the exact built site with the factory's own gzip server: Lighthouse simulated LCP 2.46 s, 1.20 s
      with the scripts removed, unchanged with GSAP removed (the floor is the React + Next runtime, ~140 KB gzipped); real Chrome records LCP
      at 48 ms (one entry, no re-render); Lighthouse with applied (devtools) throttling: 0.72 s with or without the scripts. The simulated
      (lantern) model charges parallel framework scripts to LCP. Not a content defect: revisions could not fix it.
- [ ] Third re-run 2026-10-07 on `8cb26e9`: Track A job `9c853a49` failed in 3 min, "content still invalid after 3 attempts: the brief requires a
      section with id testimonials": the plan requires a testimonials section, the brief has no quotes and the builder may not invent them.
      Fixed: a required customer-words section (testimonials, reviews, social proof) may be left out only with an open question asking the
      client for real feedback; any other required section still must exist; both tracks, builder prompts updated; frontend-loop 72/72.
- [ ] Third re-run, Track B job `c7fba41a` (15 min, 3 cycles): all 44 registry checks passed in the final cycle, the new `render.perf`
      included (only advisory warnings `seo.open-graph`, `tells.favicon`); failed only at the evaluator on three points that contradict the
      factory's own rules: the honestly disclosed unconnected form, and the missing opening date and address, which the brief never gave.
      Fixed: the evaluator rubric states the honesty rules (no invented facts, forms unconnected before launch, no quotes without the brief)
      and now sees the brief's facts; a goal that needs facts the brief lacks is approved with a recorded "NEEDS CLIENT INPUT" note;
      verification 99/99.
- [x] Offline dry run of the Track A content stage with the real models on plan `b5a45a8e`'s exact brief (before spending another live
      build): the builder's own content reviewer still demanded the waived testimonials section (3 rejections, would have failed live).
      Fixed in the brief summary both models read and in both reviewer prompts; re-run: approved first round, 5 pages, 125 s.
- [x] CI `37627375120` (`5c3ae67`) failed Rendered QA with an uncaught `ECONNRESET` (test 45, clean Track B site): the QA server's refused
      CONNECT sockets had no error listener, and the second Lighthouse Chrome per page (advisory run) was killed with sockets open. Fixed:
      socket error listeners on the QA server, both Lighthouse runs on one Chrome, the advisory run can fail without touching the gate;
      rendered-qa 52/52 locally. The Cockpit runner on `5c3ae67` carried the crash risk until this push.
- [x] `render.perf` measurement changed (Huraira chose option 1, 2026-10-07): the gate uses Lighthouse with applied (devtools) throttling,
      same budgets (Track A 2.0 s, Track B 2.5 s); the simulated LCP is recorded on the home page as advisory only; eval registry 1.1.0.
      The over-budget fixture (60 KB script, heavy hero) still fails LCP under the new method; rendered-qa 52/52, verification 98/98.
- [ ] Track A job `4d6e1abb` failed before building: "content still invalid after 3 attempts: openQuestions.0 over 300 chars". The plan
      carries 11 open questions, the content schema allowed 10 x 300, the builder merged two. Caps raised to 25 x 800 in both tracks (never
      shown as copy; Track A keeps them as escaped HTML comments), test added, frontend-loop 66/66. Re-run of Track A needed (Huraira).
- [ ] Fourth re-run, Track A job `b880a7d5` (plan `b5a45a8e`, run `15ad4086`, GitHub run `37657523407` on `072b391`, 2026-10-07 17:14–17:40 UTC;
      found by the 2026-10-12 sync, it was not in the trackers): the builder made 1 Agent 37 call (27,862 in / 10,334 out, unpriced) plus 1 Sonnet
      review ($0.0153). The site was checkpointed (`workflow.checkpoint` 17:17:21) and passed every deterministic check. It then halted:
      `render.design-review` NOT RUN, "the agent37 reviewer gave no valid answer after 4 attempts (HTTP 502: upstream_unreachable)"
      (`verification.decision` failure 17:40:37, `workflow.halt` 17:40:37). The waived-testimonials fix held (no content rejection). This is an outage,
      not a site defect: continue it from the Cockpit once Agent 37 answers (also the Step 4D live proof). Track B `4acbde1f`: no re-run since `c7fba41a`.
- [ ] Screenshot review of the passing live builds at desktop and phone, then `/step-close 4B M4` as DONE.

**M5 groundwork 2026-10-06** (`4bbd4bc`): Huraira chose Higgsfield. `packages/media` wraps Seedance 2.5 text-to-video with the official
SDK (`@higgsfield/client` 0.2.6); `HF_CREDENTIALS` is in Doppler `wfact-3-0-codebase/dev` (never in a file); success only on `completed`
with a video URL, every other status an error naming the request id; polling capped at 15 min; 8 tests with a fake client. **Live run
NOT verified**: the API accepted the key and refused the request with "Not enough credits" (no video, nothing billed).

**M5–M6**: M5 not started beyond the groundwork above: it needs Higgsfield credits and a spending cap (`BLOCKED-ON-NICK.md`). M6 not started.

## Step 4C — Cockpit UI/UX redesign: the control room (BUILT AND DEPLOYED 2026-10-01 — live signed-in check pending)

Governed by `docs/WFACT-3.0-Factory-Completion-Plan.md` Step 4C. Phase 1 proposal: `docs/step-4c/PHASE-1-PROPOSAL.md`; build evidence:
`docs/step-4c/after/` (screens, `audit.json`, `lighthouse.json`, `walkthrough.json`). All browser evidence below comes from the unchanged
Cockpit code run against rows copied read-only from the live database (one account request synthetic and labelled), because the agent
can't sign in; it is not a live signed-in check.

**Phase 1 — audit and plan**
- [x] Capability inventory: rooms and actions, the 6 job kinds, CLI commands, SQL-only operations, future rooms (Steps 9, 10, 12, 14, 17, 23) — `70cd7d1`, proposal §1
- [x] Heuristic review with screenshots at 1440/375 — `docs/step-4c/before/` (axe colour-contrast failures on every old room, 5 to 20 nodes each)
- [x] Information architecture, design system ("signal-box panel") and copy guide — proposal §3–§4
- [x] 5 mockups, axe 0 violations at 1440/375 in dark and light — `docs/step-4c/mockups/`
- [x] Huraira approved the IA and direction and accepted D1–D8 (2026-10-01, in session)

**Phase 2 — build**
- [x] New shell and design system; every old room migrated (Pipeline → Projects, Approvals → Decisions, Actions → New request and Activity,
      Runs → Activity › Fix rounds, Models → Costs); one URL per screen with redirects from the old names — `d838efc`
- [x] Every capability reachable or deliberately CLI-only with a reason — proposal §1c/§1d; Add client/project (D5) and Close a stuck job (D7) added
- [x] D3: the Cockpit never moves a project into Launch — `stageMoveBlock` in `apps/cockpit/src/stages.ts`, covered by tests
- [x] D7: migration `0013_jobs_cancel` applied (live version `20261001171227`; `cancel_job` present; status constraint includes `cancelled`);
      attack test `scripts/rls_attack_test_jobs_cancel.sql` 17/17, rolled back, nothing persisted — `e633112`, `RLS_ATTACK_TEST_RESULTS.md` Run 5
- [x] Tests: 23 (pure logic, plus navigation and flow tests that count clicks) — re-run 2026-10-01 at sync: 23/23 pass, typecheck clean
- [x] CI runs the Cockpit tests and fails the build if `service_role` is in the bundle — `cb2ffd5`; green on `main` in CI `36905237284`
- [x] Installable PWA (manifest, service worker that caches only the app shell, icons), self-hosted fonts, lazy-loaded rooms
- [x] Deployed: `main` fast-forwarded to `e76cff2` on Huraira's word; CI `36905237284` all 12 jobs success, deploy smoke check HTTP 200.
      Checked directly at sync: `/`, `/decisions`, `/activity/<id>` return the app (Vercel rewrite works), `manifest.webmanifest`, `sw.js`
      and icons are served, the live bundle contains the new screens and 0 `service_role`
- [ ] Live check with a real signed-in session — waiting on Huraira (the agent can't type a password)
- [ ] Projects on a phone: layout shift 0.118 (target < 0.1) — open

**Verification**
- [x] Walkthrough, 7 tasks × 1440/375, each ≤ 3 clicks from Home, 14/14 pass (automated timings 70–220 ms, which say nothing about human
      speed) — `walkthrough.json`; the main flow (Home → plan → Approve as Track A → Start build) also done by hand in the browser pane
- [x] axe 0 violations, no horizontal scroll at 375, no console errors: 21 screens × 2 widths — `audit.json`
- [x] Lighthouse accessibility 100 on all 17 routes, desktop and mobile — `lighthouse.json`
- [x] Design-quality rule: impeccable detector 0 findings on `apps/cockpit/src`; banned-pattern checklist in the proposal §4

**Exit check**: *"Huraira approved the IA and design direction before build; every capability is reachable or deliberately excluded with a
reason; the walkthrough passes; accessibility and responsiveness proven with evidence; CI green; no production client deploy path added."*
— **PARTIALLY MET**. All parts are met with the evidence above (CI `36905237284`; no deploy button: Launch shows as a decision made outside
the Cockpit and is blocked as a stage move), except that every room has only been checked with copied data, not with a live signed-in
session. The phone layout shift on Projects (0.118, measured on the copied-data build) is also still open.

## Step 21 — Housekeeping (PARTIAL 2026-10-19 — every sub-item done or decided; round 2 `32cfa80`..`fb6f922` waits only on CI)

- [ ] **Intake logo and live address (D4 Tier 2 slice, 2026-10-14)**: built in `8b3caed` and `a444a3d` (local, not pushed). Evidence: brandAsset tests 10, workflow readiness/continue tests 8, jobs 4, planning 1, Cockpit logo checks 9; a real isolated Track B build with the logo passes; migration 0021 dry run 28/28 on the live database, rolled back, nothing persisted (SQL-checked). Independent review: 1 HIGH (SVG `<x:script>` bypass) and 5 MEDIUM, fixed in `9597103`. Migration 0021 applied live 2026-10-14 (20261014110708, Huraira's GO); attack script on the applied migration 28/28. QA reliability fixes merged (`8857819`, `380bfd2`, `e921c6d`). Full suite green (rendered-qa 79, verification 113, frontend-loop 98, workflow 42, jobs 28, planning 34, documentation 18, hermes 55, agent-runtime 39, audit 14, media 8, Cockpit 116). CI `38554457540` green incl. deploy. **Live 2026-10-14**: Lanternworks "Fix and continue" with the uploaded logo (job `55ddba7c`) passed the readiness check, revised first, and reached the launch gate in 14 min for ~$0.68, the first passing build since 2026-10-01 (SYNTHETIC; Step 25 still needs a real client). Open: a human screenshot review; the Track B starter's 23 px contact links (cost one round). Found by Huraira on the live run: the Cockpit previewed the site's file list (site.manifest.json) instead of the site, and showed an advisory finding as a warning; both fixed (site preview with page switcher; notes marked not blocking). The preview shows pages as built; motion plays only on a real preview link (Step 4B M6).

Governed by the Factory Completion Plan Step 21 sub-item I (second half), pulled forward as MVP item M5 by Decision D3
(`docs/MVP-CUTLINE.md` §2). The other sub-items stay deferred until the MVP ships; A and G were done in the 2026-10-07 alignment pass.

- [x] Shared launch-file module `packages/frontend-loop/src/launch.ts`: robots.txt, llms.txt and a 1200x630 share card always; sitemap.xml,
      canonical, og:url and og:image only with the owner's live address (brief `siteUrl` or owner fact `site_url`, https origin only, a
      `vercel.app` preview refused). Evidence: `9968019`, `frontend-loop/test/brief.test.ts`, `verification/test/launchFiles.test.ts`.
- [x] Track A: 404.html (root-relative links, noindex), og:title/description on every page; starter 1.1.0. Evidence: `launchFiles.test.ts`,
      `rendered-qa/test/trackA.test.ts` (the old "fails the launch tells it lacks" assertion updated: preview advisories now only tells.favicon).
- [x] Track B: launch.json + public/ files written before the isolated build, Next metadata for canonical and share tags; starter 1.2.0.
      Evidence: a real isolated build in `frontend-loop/test/trackB.test.ts` passes every launch-stage check with an address.
- [x] Artifact store accepts the PNG: `ARTIFACT_PATH_RE` and content types in `packages/workflow`, migration `0019_artifacts_png` applied
      live and confirmed by SQL.
**Housekeeping round 1, 2026-10-19** (`ac314ae`..`f490904`; pushed with Step 28 by the other session; CI `39299701250` on `06bfa71` green, every job incl. the new `media`, `dispatch-job` and the guardrails tracker check, and the Cockpit deploy):
- [x] **I (first half)**: Track A keeps open questions in `content.json` only; no HTML comment in any page (track-a-starter 1.5.1). `ac314ae`; `frontend-loop/test/trackA.test.ts` fails with the comment put back (mutation-checked); frontend-loop 130/130.
- [x] **C**: the alias rule was already built in `3e493f6` (`canonicalSections`, `planning/src/planner.ts`); `0e13089` pins "process" and "how-it-works" to one section, and removing the alias fails it; parseBrief unchanged; planning 45/45.
- [x] **L**: dead path `packages/agent-runtime/registry.ts` corrected to `src/registry.ts` (`3bf8df4`); the 12 unregistered hooks were archived in `e11c1ea`, only `stop-tracker-guard.sh` remains.
- [x] **G**: `docs/INDEX.md` names the Cockpit v2 build prompts, step-4c mockups and SOP markdown copies (`d5c8c12`); new decision record indexed (`2bc9c4e`).
- [x] **H (in part)**: CI gains a `media` job, a `dispatch-job` job (7 Deno tests that run the deployed `index.ts` unchanged with Supabase and GitHub stubbed; letting a `pm` dispatch fails them) and `check-trackers` in guardrails; the deploy waits on both new jobs (`0145064`). Local: media 8/8 from a clean `npm ci`, dispatch-job 7/7. **Not done**: the `scripts/rls_attack_test*.sql` runs in CI need a scratch Supabase project and its secret (cost, Huraira).
- [x] **J (in part)**: `jobs/src/permissionsAttack.ts` moved to `jobs/scripts/` (manual live attack runner, not runtime code; `npm run attack:permissions` unchanged; jobs 38/38) in `e55e430`. **Deferred**: one shared mock model client. The four are 10–15 lines each with three different contracts (text, text with model family, JSON with usage). Sharing them adds a sibling dependency to each package's hand-ordered CI install (the B trade-off) for little gain.
- [x] **B**: decision record `docs/NPM-WORKSPACES-DECISION.md` (`2bc9c4e`): keep `file:` links. The Cockpit uses no `@wfact/*` package; a root workspace changes the deploy root (the 2026-09-22 empty-deploy class), a `packages/` workspace drops 11 lockfiles and changes all 29 CI installs. Not implemented, so no Vercel proof was needed. Huraira to confirm.
- [x] **E**: `graphify update .` (`f1eb53d`, `3db3263`): 5048 nodes, 9793 edges, **0 dangling edges** (was 52); all 6 PDFs present as file nodes only (semantic extraction needs a model key).
- [x] **D (runtime part)**: the QA CLI puts the client's owner entity on its task (`qaCliTask`, `f802994`); `job.run` rows carry the plan's entity (`f490904`). Each has a test that fails when the row is written without it (mutation-checked); verification 123/123, jobs 38/38. Live before: 30-day null rows by writer, SQL 2026-10-19: Cockpit triggers 108/116, intake 18/25, hermes-lite 14/18, qa-evaluator 8/130, job-runner 4/4. **Not done**: the database triggers (`job.requested`, `job.cancelled`, `job.archived`, `plan.input`) and `dispatch-job`'s `job.dispatched` row need a migration and an Edge Function redeploy (Huraira's GO).
**Round 2, 2026-10-19** (after Huraira's answers: K add the `bennett-co` row; F leave; H throwaway local Postgres; GO for the live migrations, push and the M5 check):
- [x] **D (database part)**: migration `0027_audit_entity_fill` (`32cfa80`): one BEFORE INSERT trigger on `audit_log` fills a null `entity_slug` from the job's plan (`params.planId`), a verify job's client, the `job.requested` payload, or the plan itself; a named entity is never changed; null stays where none is knowable. **Applied live** (20261019182532). Attack test `scripts/rls_attack_test_audit_entity.sql` **12/12 live** (rolled back; SQL check: 0 users, plans or audit rows left) and 12/12 on a fresh local stack; **without 0027 it fails 5/12** (mutation). Live proof on a real job not started by me: Cockpit job `ffcce674` (18:26 UTC) wrote `job.requested`, `job.dispatched` and `job.run` all with `bennett-co`. `dispatch-job` needed **no change and no redeploy**: the trigger fills its row. Old rows are not backfilled (append-only by design).
- [x] **H (RLS runs)**: `scripts/rls-attack-local.sh` replays every migration on a throwaway local Supabase database and runs every machine-checked attack script (refuses any non-local URL); CI job `rls-attack` runs it, and the deploy waits on it (`de855a6`). Local: 26 migrations applied; 10 scripts pass; 2 checks that need live-only rows (a pre-0011 plan; the dreamsign row) are printed NOT COVERED, never as passed. The Phase 2 hand-read `rls_attack_test.sql` is not machine-checked and is not run.
- [x] **J (shared double)**: `@wfact/hermes-lite/testing/mockModel` (`ScriptedModel`, `MockTextModel`, `MockJsonModel`); the four package mocks are thin subclasses with unchanged names (`73b82bd`); hermes 59, planning 46, verification 123, frontend-loop 130, jobs 38, workflow 89. This replaces round 1's deferral: every package already installs hermes in CI, so no install order changed.
- [x] **K**: migration `0028_entity_aliases` (`fb6f922`): `entities.aliases` (lower case, at most 20) and the `bennett-co` row (Huraira's GO). **Applied live** (20261019183408); attack test `scripts/rls_attack_test_entities.sql` **10/10 live**. `KNOWN_ENTITIES` removed; `@wfact/hermes-lite/entities` reads the table (`loadEntities`, no fallback list) and intake, the planning CLI, the job runner and Hermes-lite take the rows. Live read: bennett-co, dreamsign, synthetic-test; "Bennett & Co" resolves to `bennett-co`. Hermes-lite no longer reads `clients/<entity>/` as a client folder; removing that fix fails its test (mutation). The `0016` gap is recorded (never committed; numbering skipped in `681b9a8`).
- [x] **F**: decided by Huraira 2026-10-19: **leave** `dreamsign-deploy.vercel.app` as a frozen preview of the 2.0-era build; nothing deployed.
- [x] **I (M5 live check)**: launch-stage checks on the stored output of live build run `4c35703b` (job `55ddba7c`, Lanternworks, **SYNTHETIC client**; `site_url` detail `https://lanternworks.com` set 11:13:06, before the job started at 11:14:17). All 81 files were re-hashed against the launch-gate checkpoint `4e4434db…`. Results: 404, sitemap, robots, llms, canonical (`https://lanternworks.com/`) and og-image **PASS**; `content.placeholders-launch` PASS. `launch.form-connected` **FAIL**, because this client has no lead site. That is Step 25's contact-form requirement (M4), built after this run, not a launch file. No new paid build was needed (one-off read-only script; no model call).

**Verification**: pushed 2026-10-12; CI `38292111323` on `423c7c1` FAILED in the Frontend loop and Verification jobs (my new tests imported
across packages, and each CI job installs only its own dependencies), so the Cockpit deploy was skipped. Fixed 2026-10-13 in `b107de4` by moving
those tests into `packages/rendered-qa/test/launchFiles.test.ts` (that job installs both). Local after the fix: frontend-loop 76, verification 100,
rendered-qa launch + Track A 10, typecheck clean. CI `38427074538` on `368dd80`: every job green, including Rendered QA and **Deploy Cockpit to Vercel** (it ran this time); Cockpit HTTP 200.
Not yet: a live build with a real address at stage `launch`.

**Exit check** (MVP M5): "Step 7 launch-stage checks pass on the output". **MET for the launch files** (2026-10-19): every M5 check
passes on a live build's checkpoint-verified output (run `4c35703b`). The separate contact-form check (Step 25 M4) fails there, because that
synthetic client has no lead site.

**Step exit check** ("Each sub-item done or explicitly deferred with a reason; CI green; no regressions"): **PARTIALLY MET** (2026-10-19):
every sub-item A–L is done or decided (F: leave, by Huraira). Round 1 is CI-green (`39299701250`). Round 2 is green locally: hermes 59,
planning 46, jobs 38, verification 123, frontend-loop 130, workflow 89, documentation 18; typechecks clean; the RLS runner passes on a
fresh database. CI on round 2 is the only check left; DONE when it is green.

## Step 12 — Cost governance per client (PARTIAL 2026-10-14 — MVP M6 slice live; live trace rows proven on run `4c35703b`; Run page and live cap refusal pending)

Governed by `docs/WFACT-3.0-Factory-Completion-Plan.md` Step 12, narrowed by D3 to the MVP M6 slice (`docs/MVP-CUTLINE.md` §2 M6, §4). Audit and plan: `docs/AI-COST-AUDIT.md`. Huraira 2026-10-13: Agent 37 priced at the $3/$15 estimate; cap amounts to be agreed with Nick; build M6 plus the Cockpit costs page now.

- [x] **Agent 37 priced:** priced as an estimate, recorded as `price_basis 'estimated'` (`model-routing.json` 1.4.0; migration `0020_model_cost_m6`, applied live and confirmed by SQL). Evidence: `hermes/test/routing.test.ts`.
- [x] **Per-role ceilings count Agent 37:** the builder ceiling went from $1 to $3, because the worst real builder task was $2.75 at the estimate (`agent-runtime/src/registry.ts`).
- [x] **Screenshot reviewer traced:** every reviewer call writes a `model_traces` row, errors included. Evidence: `rendered-qa/test/reviewerAgent37.test.ts`.
- [x] **Agent 37 output ceiling:** 32,000 tokens; a cut-off answer throws, and its tokens are still counted. Evidence: `frontend-loop/test/agent37Retry.test.ts`.
- [x] **Spend caps:** per-build and weekly caps, checked before every model call in a Cockpit job, failing closed. Evidence: `hermes/test/spendCaps.test.ts`, which refuses a seeded over-cap build with no model call.
- [x] **Cap amounts set:** $5 per build and $20 per 7 days, approved by Nick on 2026-10-13 (`spend-caps.json` 1.1.0). A read-only check against live spend allowed the real caps and refused a seeded $0.10 cap.
- [x] **Cockpit Costs page:** shows the true total with estimates labelled, the caps, spend by day, client, model and build, and the biggest calls. The Run page shows each build's spend; owners only. Evidence: `apps/cockpit/src/costs.test.tsx`, 8 tests.
- [x] **Pushed and deployed:** CI `38433400406` green, Cockpit smoke check HTTP 200, both branches synced.
- [x] **Live trace rows** (SQL, 2026-10-14): the Lanternworks build (run `4c35703b`) and the Summit resume (run `2dcaacfa`) wrote:
      - Agent 37 builder rows with `price_basis 'estimated'`: 4 rows, $1.021.
      - Reviewer rows of its own: 5 Anthropic `metered` rows, $0.438.
      - The only `unpriced` rows are 2 from 2026-10-12, under pricing 1.3.0, before M6.
- [ ] **Run page spend in the signed-in Cockpit**: not checked (no signed-in session this sync).
- [ ] **Live cap refusal** (verification prompt item 4: a job with a cap below the run's spend fails with "Spend cap reached" and writes no new row): not run.

**Verification**:
- Local typecheck is clean, and every package suite passes (counts in the sync line).
- The Cockpit build works.
- A separate review agent found no defects in the wrapping order, reviewer recording, basis handling, cost arithmetic or SQL. Its one latent issue (a blank env var read as "cap off") is fixed.

**Exit check** (`docs/MVP-CUTLINE.md` M6: "A seeded over-cap run is refused; the cost per build is recorded"): **PARTIALLY MET**.
- Met in tests: the seeded refusal.
- Met in the live views: cost per build is recorded (`model_cost_by_run`).
- Met live: CI, the deploy, and the cap amounts (checked against real spend).
- Met live 2026-10-14: a build wrote estimated rows and reviewer rows (run `4c35703b`).
- Not yet proven live: the Run page and a live cap refusal.

## Step 28 — Build quality and Cockpit plain-language UX (IN PROGRESS 2026-10-19 — Packages 1–3 of 5 built and verified; Package 4 phases 1–19 CI-green and deployed, pre-v2 rebuild R1–R2 built, exit check PARTIALLY MET; build-failure guards and brand-colour rule pushed; live proof pending)

Governed by `docs/BUILD-QUALITY-AND-COCKPIT-UX-PROMPTS.md` (five packages, one at a time, GO between) and Part D Step 28 of the plan.

- [x] P1.1 Request carried into the build: `requestText` stored by code at intake, `requested` checked by code; planner, re-plan, `briefForBuild` (old plans: intake job text, else "summary only" note). `packages/frontend-loop/src/request.ts`, `packages/planning/src/{intake,planner,pipeline}.ts`, `packages/jobs/src/{handlers,requestLookup}.ts`; tests `frontend-loop/test/request.test.ts`, `planning/test/request.test.ts`, `jobs/test/handlers.test.ts`.
- [x] P1.2 Builder prompts (both tracks): request and requested list fenced as data; meta copy banned. Test: request.test.ts "reaches the builder and the reviewer fenced as data".
- [x] P1.3 Coverage check before any build (both tracks): services, steps in order, CTA label, pages, form fields (unholdable field -> openQuestions). HEAD `cf2f04b` passes the stored Lanternworks content with 0 errors; `3e493f6` gives 19 incl. the three named in the package.
- [x] P1.4 Content floors 4/180 home, 3/120 other pages, measured and documented in `request.ts`. Summit and Northfold fixtures extended to meet them.
- [x] P1.5 Reviewers get the request and check coverage and site-talk; "do not invent requirements" kept.
- [x] P1.6 Section synonyms collapse; build task named for the whole site; direction re-run alone (job kind `direction`, migration 0022 applied live 2026-10-14, `scripts/rls_attack_test_direction.sql` 11/11 after, 9 wrong before; Cockpit button and test).
- [x] P2.1 Logo explicit size, SVG sized from its viewBox when served (Track B 1.4.0, Track A 1.3.0). `render.logo-visible` on 1.3.0: "the header logo is 0x0 px" at 1440 and 375; on 1.4.0 passes on 6 pages (`d112f62`).
- [x] P2.2 Accent: buttons filled with #F26B38 (ink text 5.28:1), no accent panels, no decorative accent when reserved for actions. `render.accent-usage` on 1.3.0: "article.reel-panel.tone-accent #A34826" and "filled with #A34826, not the brand accent"; passes on 1.4.0.
- [x] P2.3 Phones: action bar, no hero gap, swipeable reel. `render.mobile-action-visible` on 1.3.0: no visible action at the middle/bottom; passes on 1.4.0.
- [x] P2.4 Motion per section type, reduced motion respected, inside the motion and JS budgets (Northfold clean test with Lighthouse passes). `render.motion-coverage` on 1.3.0: e.g. "4 of 4 section(s) show no motion" on services; passes on 1.4.0.
- [x] P2.5 Registry 1.2.0 entries with planted fixtures (each fails only its own check); screenshots at 1280 and 375, before and after.
- [x] P3.1 Schema track-b/2 and track-a/2 (v1 upgraded on read) with media slots and a team section; builder never sets a source (media.test.ts 7/7).
- [x] P3.2 Starter MediaFrame (Track B 1.5.0) and Track A 1.4.0: supplied image sized and lazy, or an "Image to come" card with data-placeholder; never an external service (rendered-qa media.test.ts: every rendered check passes on all six pages).
- [x] P3.3 Supplied images via Cockpit upload, verified like the logo: migration 0023 live, `scripts/rls_attack_test_images.sql` 19/19 (7 wrong before), 0021 suite 29/29.
- [x] P3.4 Placeholders listed at the gate and in the Cockpit; `content.placeholders-launch` refuses them unless the owner ticks "launch with placeholders" (registry 1.3.0; Cockpit flow test).
- [x] P3.5 GeneratedImageProvider seam, interface only.
- [x] P4 phase 1, tokens (`4a50b22`): locked v2 values light/dark, accents, density, type scale, motion, reduced motion, text-size zoom; `lib/appearance.ts`; Newsreader. `src/styles/tokens.test.ts`: exact values and 4.5:1 for every text/status/accent pair; browser: 125% zoom and no horizontal scroll at 375, in-app reduced motion stops all animations.
- [x] P4 phase 2, components (`a8fa3cf`): `kit.tsx`, `flow.tsx`, `CommandPalette.tsx`, v2 ConfirmDialog and SitePreview, 9 s toast with Undo, `lib/detail.tsx`. `src/components/v2.test.tsx` 26 tests; dev gallery axe 0 light/dark at 1440 and 375 (also with confirm and palette open); money lines from `spend-caps.json`.
- [x] P4 phases 1–2 shipped: CI `38588413325` (`3b5e668`) green on every job incl. the Cockpit deploy; live Cockpit HTTP 200 with `theme-color #F4F2ED` (v2).
- [x] P4 phase 3, shell (`8532f4e`): rail with typeset wordmark, top bar, phone header and tab bar, More, palette with "Ask the factory a question" (`requestJob("ask")`), keys ⌘K / G H P A C / N / D / ? / Esc, Notifications inbox, `/team`. `src/shell/shell.test.tsx` 11 tests, Cockpit 175/175; axe 0 via the `cockpit-fake` dev server (owner and PM, light and dark, 1440 and 375); `scrollWidth` 375; no target under 44 px. Roles follow RLS where the design disagrees (BLOCKED-ON-NICK.md).
- [x] P4 phase 4, the six-step path (`fd020a5`): `src/lib/path.ts` (`derivePath`, `stripSteps`, `fixLabel`, `latestBuild`, `knownNeeds`); `src/lib/path.test.ts` 22 tests; Cockpit 197/197.
- [x] P4 phase 5, Home (`00ec210`): `pages/Home.tsx`, `lib/clients.ts`, `lib/attention.ts` rebuilt on the client paths (Home and Notifications share it); `home.test.tsx` 8 tests, Cockpit 205/205; axe 0 owner (light/dark, 1440/375), admin, PM; `scrollWidth` 375; no banned word outside Technical details.
- [x] P4 phases 3–4 shipped: `38591851925` on `a87e6db` failed (sign-out test race, fixed `1278a29`); `38593657465` on `b3a3707` green on every job incl. the deploy.
- [x] P4 phase 6, Projects (`2cd7f6b`): `pages/Work.tsx` Projects; `projects.test.tsx` 7 tests, Cockpit 212/212; axe 0 grid/list, light/dark, 1440/375; `scrollWidth` 375. Deviation kept with reason: the hand-add client/project form (needed before "Record that it is live").
- [x] P4 phases 5–6 shipped: CI `38595375699` (`c02d125`) and `38596185659` (`32d1e91`) green incl. the deploy.
- [x] P4 phase 7, New request (`9513166`): `newrequest.test.tsx` 5; intake flow test confirms the cost; 217/217; axe 0 light/dark 1440/375 and with the confirm open; keyboard run. Money confirm added (hard rule). Deviation kept: "Re-check a built page". Fixed: button class `page` collided with the main wrapper.
- [x] P4 phase 8, the client's page (`fd7a08a`): `client.test.tsx` 7; 224/224; axe 0 light/dark 1440/375; decisions timeline from the audit trail via `lib/phrases.ts`. Not shown: "Test client" badge (no data source).
- [x] P4 phase 9, Proposal review (`74e1384`): owner-only approve with confirm, Ask for changes with money confirm, direction re-run kept; 225/225; axe 0 light/dark 1440/375.
- [x] P4 phase 10, What the site still needs (`5a96bb2`): 227/227; axe 0 light/dark 1440/375; logo gate, money confirm, owner-only launch tick.
- [x] P4 phase 11, Live build (`99ba999`): 227/227; axe 0 at 1440 and 375. Not done here: Spent so far, phone toggle.
- [x] P4 phase 12, Stopped build, 8 cases (`a94eb6f`): 243/243; axe 0 at 1440 and 375. Not done here: see BLOCKED-ON-NICK (stop-view actions).
- [x] P4 phases 7–12 shipped: CI green on every job incl. the deploy for each push: `38599509988` (`d65c5b9`), `38600629357` (`2d53fbe`), `38601154434` (`49e6843`), `38602080530` (`f45c83d`, phase 11), `38604205509` (`56e545f`, phase 12; deploy smoke check HTTP 200). Live URL not probed directly this sync (it is held in Doppler).
- [x] P4 phase 13, Finished site review (`a01dbbf`): 248/248; axe 0 at 1440 and 375. Approve is off (no record); Ask for changes not offered. Re-run at the 2026-10-15 05:30 sync: 248/248, typecheck clean. CI `38605626110` (`47a2da4`) green incl. Deploy Cockpit to Vercel (re-checked 2026-10-15), so phase 13 is deployed.
- [x] P4 phase 14, Activity (`35a869d`, 2026-10-16): 265/265 (14 new in `pages/activity.test.tsx`; type-filter mutation fails 3, restore passes); typecheck and build clean, `dist/` has no dev-only code; axe 0 at 1440 and 375, light and dark; 375 scrollWidth 375; no target under 44 px; no banned words in the room. Saved view kept on this device only (logged). Pushed in `cf0b891`; CI `38929657403` green incl. Deploy Cockpit to Vercel.
- [x] P4 phase 15, Costs (`1af12c7`, 2026-10-16): 274/274 (13 new in `pages/costs.test.tsx`, old page tests moved; widening the cap window fails the headline test, restore passes); typecheck and build clean, `dist/` has no dev-only code; axe 0 at 1440 and 375, light and dark; 375 scrollWidth 375; no target under 44 px in the room; no banned words outside Technical details. Live cap period only; "Change the caps" left out (logged). Pushed in `4e6c072`; CI `38934744558` green incl. Deploy Cockpit to Vercel.
- [x] P4 phase 16, Team and access (`e5c6333`, 2026-10-16): 287/287 (13 new in `pages/team.test.tsx`; letting admins choose any role fails the admin test, restore passes); typecheck and build clean, `dist/` has no dev-only code; axe 0 at 1440 and 375, light and dark, and with the decline dialog open; keyboard path through the decline dialog; 375 scrollWidth 375; no target under 44 px; no banned words. Approve/decline through the existing rpc; invite and Change left out (logged). Pushed in `f9e9a74`; CI `38942505031` green incl. Deploy Cockpit to Vercel.
- [x] P4 phase 17, Settings (`dc4b05b`, 2026-10-16): 303/303 (16 new in `pages/settings.test.tsx`; applying the draft at once fails the preview test, restore passes); typecheck and build clean, `dist/` has no dev-only code; axe 0 for all nine groups at 1440 and 375, light and dark, and with a dirty draft; draft preview checked dark-in-light and light-in-dark; "Open the Cockpit on" checked in the browser (once per tab); 375 scrollWidth 375; no target under 44 px. Everything kept on this device and said so (logged). Pushed in `0e78b28`; CI `38947151902` green incl. Deploy Cockpit to Vercel (re-checked at the 2026-10-16 night sync).
- [x] P4 phase 18, Notifications (`b6a6e39`, 2026-10-19): 314/314 (11 new in `pages/notifications.test.tsx`; tab role → radio and the PM table gate removed fail 4 tests, restore passes); typecheck and build clean, `dist/` has no dev-only code; axe 0 in Inbox and Preferences at 1440 and 375, light and dark, and as PM; 375 scrollWidth 375; Mark all as read clears every dot and the bell in the browser; real Tab key shows the focus ring. Tabs are 38 px visible with a 44 px hit area (design). Preferences: only "In the app", always on; no dead controls; one wording with Settings. Spend notice left out (logged). Pushed in `0da4c79`; CI `39268206990` green incl. Deploy Cockpit to Vercel.
- [x] P4 phase 19, cleanup (`55e0a8a`, `f76a1f6`, `8bd6de1`, `5589192`, 2026-10-19): (1) the 185 alias uses renamed to v2 tokens and the `tokens.css` alias block deleted; 0 old names left (python count); computed-style fingerprint (colours, borders, radii, fonts, sizes, spacing, shadows, motion, box size) of every element in 21 rooms identical before and after at 1440 light, 375 light and 1440 dark, only load-time timestamps differ; guard test in `tokens.test.ts` (it first passed vacuously because vitest returned app.css empty; `css.include` widened, then an injected old name fails it). `--t-*` sizes map to the equal px tokens at the default 16 px root (`--t-2xl` became `2rem`; no v2 token). (2) Overpass sans removed (package, imports): precache 45 → 42 entries, 1634.86 → 1582.33 KiB; dist 1936 → 1804 KB; Overpass Mono stays. (3) Unused pre-v2 Costs styles deleted. (4) Toast kept above the Settings save bar (1440: toast 730–802, bar 828–900); found and fixed: on phones the sticky save bar scrolled under the tab bar, hiding Save/Discard. (5) Banned-word DOM sweep: plan/track/job/run/entity words on the Decisions list and the build page header (and shared strings) fixed by copy-only changes; clean for owner, admin and PM, every fake switch, stop cases 2/5/6 and a live build; no deploy or publish control anywhere. (6) Lighthouse accessibility 100 in all 16 rooms (chrome-devtools `lighthouse_audit`, navigation mode on the fake; More on the mobile profile); its zero-weight label-in-name flag fixed for the wordmark, left for the search button's `aria-hidden` ⌘K hint (an experimental rule counts hidden text). (7) Keyboard-only main flow on the fake, real key presses: new request → approve the proposal → logo (file handed to the input; the system picker can't be automated) → build → a picture → stop and fix → ready ("Ready to launch once you approve."; "Approve the site" off with its reason in `aria-describedby`, logged). Found and fixed: focus lost to `<body>` after Approve (ConfirmDialog; 2 tests fail without the fix) and after Upload/Answer (shell focus rescue; browser: focus held on Upload across 3 uploads; shell test fails without the fix); a thrown upload failed silently (`brandUpload`; test fails without the fix). Dialogs trap focus and return it; no unreachable control. 319/319 (3 full runs; one earlier run had a one-off timeout flake in projects/stopped that passed alone and in the next two full runs); tsc and build clean; no dev code in `dist/`; axe 0 in 21 rooms at 1440/375 light and dark. Dev only: `?fake-live=1`, `?fake-logo=1`, storage upload in the dev fake. Pushed in `2657fef`; CI `39286692404` green incl. Deploy Cockpit to Vercel.
- [x] P4 R1, the other work pages (`f9d4842`, 2026-10-19): RunPage's fallback (never started, cancelled, running intake/ask, older and archived passing builds, a stop a later build fixed, the live build) in the stop/review grammar: StatusChip + Newsreader title + plain lead; StepRow steps from the record only ("Not recorded" when it has no time); checks via `checkLabel`/`issueLabel`; rounds of fixes as step rows; Technical details as the kit `<details>` (ids with Copy, raw reason, check notes). Placeholder pictures moved out of SiteReview into `usePlaceholderPictures` + `PlaceholderPicturesSection` (same `plan_inputs` keys) and reused on older passing builds; RunPage no longer uses PlaceholdersPanel. Start again / Close it (ConfirmDialog kept) / Archive / Unarchive kept working as quiet buttons; design gap logged in BLOCKED-ON-NICK; at most one primary per view (none on never-started, cancelled, running and archived pages). Found and fixed: RunPage rendered the fallback before the job list loaded, so the wrong view flashed before the review (2 existing tests failed until fixed); "This run does not record…", "this run" in timeline copy, and the builder's vendor name in the out-of-credits copy (on the stop view too). Tests: `pages/runpage.test.tsx` 16 (SYNTHETIC: chip, title, primaries and banned words in 7 states; Start again → dispatch-job; Close it → confirm → cancel_job; Archive/Unarchive → archive_job; Technical details closed in Simple, open in Detailed); vitest 335/335 in 25 files; mutations caught: Unarchive always archiving, the newest-build link not primary, cancel without the reason, the vendor name restored. tsc and build clean (precache 42 entries, 1579.84 KiB; no dev code in `dist/`). Browser on the fake: axe 0 in 8 rooms at 1440x900 and 375x812, light and dark (32 runs); 375 scrollWidth 375; no target under 44 px; banned-word sweep clean for owner, admin and PM; Lighthouse accessibility 100 in all 8 rooms (its zero-weight label-in-name flag is the shell search button, as in phase 19); keyboard: Start again → Close it → Open the proposal → Technical details → Copy, Close it dialog traps focus and Escape returns it, the newest-build link opens by Enter, focus never on `<body>`. Computed-style fingerprint of the finished site review, stop case 5 and Home identical before (HEAD) and after. Dev: `?fake-job=intake|ask|cancelled|archived|old`. Pushed in `b88d308` (with the Step 21 commits, on Huraira's OK); CI `39296573842` green incl. Deploy Cockpit to Vercel.
- [x] P4 R2, decided proposals (`80f1391`, 2026-10-19): a proposal where changes were asked for, or one approved before the kind of site existed, shows the proposal review's page read-only (eyebrow, "A site for …", the goal, the client's own words, pages, open questions; ProposalHead/ProposalColumns shared with ProposalReview, whose DOM is unchanged) with the design's decided line (`role="status"`) in place of the decision bar. Changes asked for: the note, then "Revise from my note" for owners and admins (the same `requestJob("replan")`, now behind a cost confirm with `buildStopLine()`); after two revisions it is refused with "Start a new request"; a revision already running or done is opened ("See proposal N being written"), never asked twice; PMs see the decision and who can act. Approved without a kind: "It can't be built", one primary "Start a new request", no build button. Removed, nothing else used them (python count before/after): BeforeBuild 3→0 (`components/Recovery.tsx`), AfterDecision 2→0 (with its unreachable build branch), PlanDetails 2→0, WhatTheClientWants 2→0. Tests: `pages/decided.test.tsx` 7 (SYNTHETIC); vitest 342/342 in 26 files; mutations caught: a third revision allowed, PMs given the button, revise without the cost confirm, an existing revision ignored. tsc and build clean (precache 42 entries, 1575.43 KiB; no dev code in `dist/`). Browser on the fake: axe 0 in 3 rooms (changes asked for at revision 1 and 2; approved without a kind) at 1440x900 and 375x812, light and dark (12 runs); 375 scrollWidth 375; no target under 44 px; banned-word sweep clean for owner, admin and PM; Lighthouse accessibility 100 in all 3 (first two runs failed NO_FCP with the audit window in the background; brought to the front, then 100); keyboard: Revise from my note → dialog traps focus → Escape returns it, focus never on `<body>`. Computed-style fingerprint of the proposal review, the needs screen and Home identical before (HEAD) and after. Dev: `?fake-plan=rejected|rejected2|nokind`. Pushed in `dc54c3d`; CI `39301911101` green incl. Deploy Cockpit to Vercel.
- [x] Build-failure guards (`b8d240f`, 2026-10-15; `docs/BUILD-FAILURE-DIAGNOSIS.md`): claims gate accepts word-for-word supplied quotes (invented ones still need SAMPLE); stuck breaker in `verifyLoop`; `wouldRepeat` refuses a no-change continue (`repeat_refused`, `workflow.reopen_refused`, `force` overrides); halts record fingerprint, brief digest and `GITHUB_SHA`; Cockpit leads stuck stops with the report. `packages/workflow/test/failureEvals.test.ts` 18/18; each guard switched off turns its evals red. Pushed (`origin/main` at `626667a`; CI `38695633253` running at the 13:30 sync); live proof pending (continue on Harbor Street after deploy).
- [x] Brand-colour rule (`8e6e09d`, 2026-10-15, pushed; CI `38706155999` green): Huraira's decision. Tints and shades of brief colours are on-brief; CTAs use the true accent at 4.5:1, else a shade of it. `packages/verification/src/brandColours.ts` `BRAND_COLOUR_RULE` is quoted by the evaluator RUBRIC and the screenshot reviewer prompt. Eval E5 (4 cases) passes; 5 mutants each turn it red (rule removed from either judge, CTAs darkened, blended hue with or without the refusal, loosened `dim` contrast). Suites: verification 116, workflow 66, frontend-loop 125, rendered-qa 88, jobs 34; typecheck clean. Live proof pending (a Lanternworks continue).
- [x] Brief consistency check (`fd67328`, 2026-10-15, local, not pushed): `packages/workflow/src/briefConsistency.ts` and `packages/planning/src/factTopics.ts`; preflight halts `needs_input` with one `resolve.<topic>` need per conflict, nothing spent; `ownerFactsFrom` applies the pick and neutral labels; `planner.ts` asks each known topic once. Evals E6 (3), each red with its mutation (guard off; date normalisation off; pick ignored). Dry run on stored `e6a71046` facts: 2 conflicts, 0 builder calls.
- [x] Example clients (`52f7088`): `clients/example-agency-studio` (Track B), `clients/example-local-trade` (Track A); `exampleClients.test.ts` 10/10; `docs/EXAMPLE-CLIENTS.md`. Not run live.
- [ ] P4 pre-v2 screens still to rebuild (R3–R5, one per GO): Decisions list and stage moves (R3, question first), `/activity/fixes` (R4, question first), `components/Recovery.tsx` RecoveryPanel, PlaceholdersPanel, Home's unused helpers, NotFound (R5); the build page fallback (R1) and decided proposals (R2) are done; the old app icon (logged). Rebuilt to the design: Home, Projects, New request, the client's page, Proposal review, Needs, Live build, Stopped build, Finished site review, Activity, Costs, Team and access, Settings, Notifications (phases 5–18 above).
- [ ] DB owner check on `launch.placeholders_ok` (locked decision 3): migration `0024_placeholders_owner_only.sql` + `scripts/rls_attack_test_placeholders.sql` written on branch `claude/objective-engelbart-d65df7` (`562c5ae`, side session), **not merged, not applied, attack test not run**. Waits on Huraira to review, merge, apply live and run the attack test.
- [ ] Package 5 (paid Lanternworks proof).

**Verification**: suites green locally (frontend-loop 115, planning 42, jobs 33, workflow 42, verification 113, agent-runtime 39, hermes 55, rendered-qa 79, Cockpit 123); typecheck clean. Independent agent review: 6 defects in the new checks, all fixed with tests that failed first. Not pushed, so no CI run; no live build (Package 1 forbids one).

**Exit check** (Package 4, quoted from the plan): "every room rebuilt to the locked design, axe 0 and Lighthouse a11y >= 95 per room, keyboard-only main flow (new request, approve proposal, logo and a picture, build, stop and fix, ready, approve), PROGRESS.md updated with evidence." **PARTIALLY MET**: every room rebuilt — PARTIALLY MET (14 rooms rebuilt in phases 5–18 the other work pages in R1 and decided proposals in R2; R3–R5 left); axe 0 per room — MET (21 rooms, 1440/375, light and dark); Lighthouse a11y ≥ 95 per room — MET (100 in all 16); keyboard-only main flow — MET on the synthetic fake up to "ready", with "approve" shown switched off (no site-approval record, logged) and the file picker handed a synthetic file; PROGRESS.md updated with evidence — MET (this section).

**Exit check** (Package 1): "validating the stored Lanternworks content now FAILS with 'missing: Ongoing care', 'missing step: discovery call, proposal, care', 'primary action should be 'Book a discovery call'' and the meta-copy errors". **MET** (locally). Step exit (Package 5 proof): **NOT MET**.

## Step 25 — Real-client proof run (PARTIAL 2026-10-15 — MVP M4 contact form met live on synthetic data; real-client run waits on Nick)

Governed by `docs/WFACT-3.0-Factory-Completion-Plan.md` Step 25 and `docs/MVP-CUTLINE.md` §2 M4. Only M4 (the contact form that saves leads) was
worked on; the real-client run waits on Nick's brief.

- [x] Migration `0025_leads.sql` (`1da9a5a`) applied live (20261015102916). The attack test on it found every insert failing (`{0,299}` is over
  Postgres' regex limit); fixed by `0026_leads_page_path_fix.sql` (`2154fda`, applied 20261015103026). `scripts/rls_attack_test_leads.sql` 43/43 live,
  nothing persisted. Advisors: security lints identical to before; performance: no new WARN (2 INFO unused-index on the new empty table).
- [x] `submit-lead` (`60061b7`) deployed v1, verify_jwt false; LEAD_IP_SALT set by Huraira. 19/19 tests under Node; the Deno CI job has not run yet (not pushed).
- [x] Starters wired by the runner (`b1cd762`); `launch.form-connected` (`f8b1bf7`), mutation-checked. Browser check at 1440 and 375: axe 0, console clean.
- [x] Live proof, SYNTHETIC (entity `synthetic-test`, client "Lanternworks Studio (SYNTHETIC)", lead site `d208427b`, is_test; the Track B site is
  the Northfold fixture served on 127.0.0.1): Track A JS, Track A no-JS, Track B JS, Track B no-JS each stored exactly one row (SQL); curl:
  wrong origin 403, unknown key 404, honeypot and 500 ms fill dropped and counted, 6th post 429 (form post 303 to `?error=rate_limited`),
  wrong-origin form post 403 with no redirect. 0 non-test rows; no IP text stored; logs name refusals without visitor content.

**Verification**: verification 122/122, frontend-loop 130/130, jobs 38/38, workflow 89/89, rendered-qa 89/89, submit-lead 19/19; typecheck clean;
live SQL and curl as above. Independent review (separate instance, same vendor): 0 critical; the HIGH and the clear MEDIUM items fixed.

**Exit check** (M4): "Form submission lands in the CRM capture in a live test". MET for capture in our own database (live, synthetic); the hand-off to a
CRM is NOT MET because Nick has not named one (BLOCKED-ON-NICK).

## Closed steps (DONE, evidence archived)

Steps 6 (2026-10-06), 5 (2026-10-07), 7 (2026-10-07) and 4D (2026-10-14) are DONE; their checklists, verification and exit-check
evidence moved verbatim to `docs/archive/2026-10-15-cleanup/PROGRESS-closed-steps-6-5-7-4D.md`. Status lives in the plan's Part E.
