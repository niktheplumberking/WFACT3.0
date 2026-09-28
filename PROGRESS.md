# Sprint Progress — WFACT 3.0, 100-Hour Build

Source: `docs/wfact-3.0-operator-manual.html`, sequenced per `docs/WFACT-3.0-Fast-Track-Plan.md`. Work
top to bottom. Nothing gets checked as done until its **exit check** actually passed, not attempted.

Last synced: 2026-09-22, via `/progress-sync` — rebuilt from git history and direct repo verification,
not from self-report. See `git log` for the full commit trail this reflects. Re-synced same day to fold
in two commits made after the prior sync (`06babd6` confirming login end-to-end, `a57d977` a Cockpit
dark-theme restyle) — both verified directly against the repo, not taken on their commit messages alone.

**Status summary**: Phases 1–6 are functionally complete with real, independently-verified evidence —
including the Cockpit MVP, live at a real URL with real data and a genuinely tested RLS-gated write.
Only Phase 7 (the proof-run writeup and Nick's own review/decisions) remains, and those are largely
Nick-only steps this session can't close on its own. No hard blocker remains; the open Phase 1 items
(CI-automated deploys, a real secrets manager) have tracked workarounds, not open stops.

**2026-09-28 — work has moved to [`docs/WFACT-3.0-Continuation-Build-Plan.md`](docs/WFACT-3.0-Continuation-Build-Plan.md)**
(dependency-gated stages against the Blueprint, not sprint days). Its status lives in the
"Continuation Build Plan" section at the bottom of this file. Blueprint (`docs/wfact-3.0-blueprint.html`)
is the scope source of truth.

**Next up**:
1. Stage 1 (in progress): Huraira's account steps in `docs/SECRETS.md` (Doppler workspace + `DOPPLER_TOKEN` GitHub secret + Vercel production branch), and creating `main` as trunk — then the first real CI deploy closes the "zero manual steps" check.
2. Stage 2: generalize the agent runtime (`packages/agent-runtime`), refactoring frontend-loop + verification onto it with their test suites unchanged.
3. Still owed from the sprint: Phase 7 results report, and Nick's actual look at the Cockpit.

**Gaps noticed**:
- Phase 1's exit check ("zero manual steps") is not met even though every access item now is — the CI pipeline doesn't auto-deploy yet; this session's Vercel deploy was manual.
- Phase 6's Manual text describes a full unscoped dashboard; the Fast-Track Plan supersedes this with an explicit 3-room MVP (Pipeline/Approvals/Runs) — keep that scope, not the Manual's original wording, when Phase 6 starts.

**Unplanned work done**:
- Real usage/cost instrumentation added to both `packages/hermes` and `packages/frontend-loop`'s model clients (`totalUsage` tracking, real dollar cost computed from real Anthropic pricing) — not a plan checklist item, but structurally required by the Fast-Track Plan's routing rule, which the code previously couldn't satisfy at all.
- `Agent37ModelClient` added as a new model adapter, with a routing split (builder → Agent 37, evaluator → Claude) — not in the original Manual, driven by the Fast-Track Plan's later routing rule and a real vendor-independence gap CLAUDE.md §6 had flagged since Phase 4 started.
- The 3 SOP PDFs + Factory Book/Audit added to `docs/WFACT SOPS/`.
- Cockpit restyled to a real WFACT dark-theme brand system (`a57d977`) — sidebar-shell layout, a
  Supabase-backed stat strip (projects/active/correction rounds), and `apps/cockpit/src/theme.css`
  (verified present, 7.6K, amber/cyan/green accents, Space Grotesk + IBM Plex). Not a plan checklist
  item — pure presentation, no change to query logic, the RLS-gated approval write, or the magic-link
  auth flow. Commit message claims typecheck/build both verified clean — re-run independently this
  sync (`npm run build` in `apps/cockpit`): `tsc -b && vite build` passes, 76 modules transformed,
  clean production bundle.

---

## Phase 1: Foundation & Access (Days 1–2 · 8 hrs)

- [x] Set up repo skeleton, law file, memory scaffold, `BLOCKED-ON-NICK.md` tracker
- [ ] Base CI skeleton with zero-manual-step deploy — guardrail/typecheck/test jobs exist
      (`.github/workflows/ci.yml`), but no deploy automation; this session's Vercel deploy was a manual CLI call
- [ ] Secrets manager wired, nothing in plaintext — still `.env.local` (gitignored), no real secrets manager stood up
- [x] GitHub access confirmed — dedicated `niktheplumberking/WFACT3.0` repo, verified via `gh auth status`
- [x] Supabase project access confirmed — `mcaxxhgjptwowwrluhra`, migrated (`0001`–`0005`) and RLS-attack-tested for real, 2026-09-22
- [x] Vercel access confirmed — `vercel whoami` → `niktheplumberking`, verified in this environment
- [ ] Hostinger access — descoped for this sprint (Huraira's call, 2026-09-22); Vercel substitutes for "live," substitution logged in `BLOCKED-ON-NICK.md`
- [x] 3 SOPs + Operations Manual received — `docs/WFACT SOPS/`, added 2026-09-22
- [x] Motion Sites MCP + 21st.dev credentials confirmed real — both call-tested live, 2026-09-21/22
- [ ] Higgsfield MCP credentials — descoped for this sprint (Huraira's call, 2026-09-22)
- [x] Claude/Anthropic API billing confirmed — real key, real live call made 2026-09-22
- [ ] Which 2 entities confirmed — still Nick-only; placeholder in use (DreamSign + Bennett & Co)

**Exit check** (not yet met): *"A commit reaches a deployed preview through CI with zero manual steps,
and every access item is either confirmed or has a tracked workaround in place."* Every access item is
now confirmed or has a logged, disclosed workaround — the remaining gap is the CI-automated-deploy half,
which doesn't exist yet.

## Phase 2: State Layer & Second Brain v1 (Days 3–5 · 16 hrs)

- [x] Schema, entity-law trigger (schema-level constraint, not just convention), RLS policies designed and migrated — `packages/db/migrations/0001`–`0005`
- [x] RLS attack test passing for real, against the canonical project — Run 2, 2026-09-22 (`packages/db/RLS_ATTACK_TEST_RESULTS.md`); identical result to the original Run 1 against `wfact-3-sandbox`
- [ ] `memory/context.md` business rules — still placeholder, pending Nick's real business-rules session

**Exit check**: *"A test query ('what stage is client X is in') returns a correct answer from the
memory files, and the RLS attack test fails to cross entity boundaries."* RLS half: met and re-verified
against the canonical project. Memory-file half: trivially true only because `context.md` is still a
placeholder — re-verify once real business rules land.

## Phase 3: Hermes Controller Core (Days 6–8 · 14 hrs)

- [x] Hermes-lite built — memory/state tools, schema-validated tool allowlist, plain-language tone filter, bounded retry/escalation, 26/26 tests passing
- [x] Live smoke test with a real status question — **MET 2026-09-22**: `npm run ask -- "What is the status of DreamSign?"`, real `ANTHROPIC_API_KEY`, real Supabase state, answer independently checked against this session's own ground truth

**Exit check: MET 2026-09-22.** *"Hermes (or its stand-in) answers 'what's the status of X' correctly
and in plain language, sourced from real memory and state, not a canned response."* Real transcript,
verified — see `packages/hermes/README.md` and this repo's commit history for detail.

## Phase 4: Model Routing & Front-End Loop v1 (Days 9–12 · 22 hrs)

- [x] Motion Sites + 21st.dev wired for real — live-fetched content (Motion Sites prompt `agency-services`, a real 21st.dev component search) translated into this pipeline's inline-CSS/no-build-step constraint; both services return React output, a real and disclosed limitation, not a credentials gap
- [x] Front-end agent configured — builder: Agent 37 (default free-tier router), evaluator: Claude directly, for real vendor independence between the two roles (CLAUDE.md §6)
- [ ] Real pilot brief from Nick — still using the placeholder (`clients/dreamsign-pilot/brief.json`, `source: "placeholder-2.0-case"`)
- [x] Real loop run — 2 correction rounds, approved, beats DreamSign 2.0's 40+ baseline; round 1's flagged issue was substantive (an invented "500+ businesses served" stat and fabricated client names), genuinely fixed by round 2
- [x] Correction rounds logged honestly — `clients/dreamsign-pilot/memory.md`
- [x] Page live — deployed to Vercel (`https://dreamsign-deploy.vercel.app`), independently `curl`-verified (HTTP 200, correct title)

**Exit check: MET 2026-09-22.** *"One real page live, plus an honest correction-round count logged and
compared against DreamSign's 40+."* All three parts independently verified, not self-reported.

## Phase 5: Verification Loop (Days 13–15 · 14 hrs)

- [x] 6 deterministic checks built — the Manual's 5 named examples plus one backstop (required-sections), `packages/verification/src/checks/`
- [x] Independent evaluator wired — separate Claude instance, distinct from Phase 4's builder/evaluator instances
- [x] Deliberately broken build caught — proven via test fixture, 12/12 tests passing (re-confirmed 2026-09-22)
- [x] Verification CLI run against the real Phase 4 page — **MET 2026-09-22**: all 6 checks PASS
      against `clients/dreamsign-pilot/pages/clean-agency.html` (secrets-scan, responsive-check,
      no-console-errors, image-optimization, isolation-check, required-sections)
- [x] Live evaluator run (real model call, not mocked) — same run: live Claude evaluator approved,
      real cost logged ($0.0160, 7924 in / 13 out tokens)

**Exit check: MET (both halves) 2026-09-22.** *"A deliberately broken test build gets caught and
returned before being marked done."* Proven against a fixture (Run 1, pre-dating this session) and
now also run for real against Phase 4's actual live output — genuinely separate process, separate
invocation, real Anthropic call. The full 78-check/50-point registry is out of scope for this sprint
by the Manual's own explicit fallback ("5–8 well-chosen checks proving the loop works is the actual
goal this sprint, completeness is next sprint's job") — this is that trimmed set, run for real.

## Phase 6: Cockpit MVP (Days 16–18 · 16 hrs)

- [x] Built the 3-room MVP (Pipeline, Approvals, Runs) per the Fast-Track Plan's scope — Vite +
      React + TypeScript, `apps/cockpit/`, reading/writing Supabase directly with the anon key,
      access controlled entirely by Phase 2's real RLS policies (no service-role key in the
      browser bundle)
- [x] Connected to Supabase for live data — verified with real data, not a mock: Pipeline and Runs
      show the real DreamSign pilot project and its 2 real correction rounds (seeded from what
      Phase 4 actually produced); Approvals genuinely advances `projects.stage` through a real
      RLS-gated write (tested end-to-end: advanced then reverted via a real authenticated session,
      not just a client-side check)
- [x] Real login — Supabase magic-link auth (no password to manage), a real owner-role profile
      seeded for Huraira via the Auth Admin API, not a raw table insert
- [ ] Get Nick to actually look at it before day 20 — not yet done, this is explicitly his step

**Exit check** (build half met, Nick's review not yet done): *"Nick can open one link and understand
what's happening without asking a question first."* Live at
`https://wfact-cockpit-niktheplumberkings-projects.vercel.app` — verified reachable via `curl`
(HTTP 200). Vercel's default deployment-protection (SSO gate) was disabled for this project
specifically, since it would have blocked exactly the one-link access this exit check asks for; the
app's own Supabase auth + RLS is the real access control layer, not Vercel's. The review itself —
Nick actually looking at it — is a Nick-only step, still open.

**A second real issue, also caught by Huraira and fixed, not this session noticing on its own**:
Huraira's first real sign-in attempt hit a stale magic-link email (from this session's own earlier
dev-server testing on `localhost:5173`) that was also expired — real screenshot evidence
(`ERR_CONNECTION_REFUSED`, `otp_expired`). Investigating found the actual underlying blocker:
Supabase Auth's Site URL was still the project default (`http://localhost:3000`), so even a fresh
link from the real production URL would have failed — confirmed by explicitly requesting
`redirect_to` = the production URL via the Admin API and getting back a link that silently fell back
to `localhost:3000` anyway. No available tool in this session could change that setting (it's
dashboard/Management-API config, not reachable via the service-role key or SQL) — Huraira updated
Site URL + Redirect URLs in the Supabase dashboard directly. Re-verified after: a fresh generated
link now correctly resolves to the production URL, and the full verify step was completed end-to-end
(real access token issued) before telling Huraira to try again for real. **Closed out 2026-09-22**:
Huraira's real retry succeeded — login confirmed working end-to-end, logged in `BLOCKED-ON-NICK.md`.
Still open: his own actual review of Pipeline/Approvals/Runs content, separate from login working.

**A real regression happened and got fixed, logged honestly rather than smoothed over**: pushing this
phase's commit to GitHub triggered Vercel's Git integration to auto-build from the repo root (this
repo deliberately has no root `package.json`), which silently produced an empty output and overwrote
the working manual deploy on the shared alias — Huraira caught this from a real 404 in his own
browser, not something this session noticed on its own. Root cause confirmed via build logs (`Build
Completed in [151ms]`, nothing built). Fixed properly, not just patched around: set the Vercel
project's Root Directory to `apps/cockpit` and added real `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
project environment variables (the anon key deliberately as `--type config`, i.e. public — matches
`supabaseClient.ts`'s own design, RLS protects data, not this key), then verified a fresh git-shaped
deploy actually builds correctly (`✓ 75 modules transformed`, not another empty build) before
considering this closed. This also means future `git push`es now redeploy Cockpit automatically and
correctly, which is real progress on Phase 1's still-open "zero manual steps" gap — for the Cockpit
specifically, not the whole repo yet.

## Phase 7: Proof Run & Handoff (Days 19–20 · 10 hrs)

- [ ] Not started. Largely a documentation/presentation pass over what Phases 1–6 already proved
      for real, plus Nick attending the review and deciding next steps — both Nick-only.

---

# Continuation Build Plan (`docs/WFACT-3.0-Continuation-Build-Plan.md`)

## Stage 1 — Close the Phase 0/1 debt (IN PROGRESS, started 2026-09-28)

- [x] **Audit log — acceptance MET 2026-09-28.**
      - `packages/db/migrations/0006_audit_log.sql` applied to `mcaxxhgjptwowwrluhra` (listed by
        `list_migrations`). Append-only is enforced by trigger for every role, service_role included.
        Attack-tested live: UPDATE, DELETE and TRUNCATE were all refused, and malformed action names
        were rejected. RLS: `anon` insert was refused ("violates row-level security policy") and
        `anon` saw 0 rows. `get_advisors` (security) found nothing new; only the pre-existing
        `rls_auto_enable()` and leaked-password items remain.
      - New `packages/audit` (zero runtime deps, fail-closed, 7/7 tests). Wired into Hermes-lite's
        `ToolRegistry` (every call audited, including refused and failed ones; 33/33 tests, the 26
        originals unchanged) and into `VerificationLoop.run` (every decision audited; 16/16 tests, the
        12 originals unchanged). frontend-loop is untouched, 20/20.
      - Live evidence, queried back independently via SQL, not the CLIs' own output:
        - Hermes run `bbcefba8…` wrote 3 `tool.invoke` success rows (`memory.readContext`,
          `memory.readClient`, `state.projectStatus`) plus 1 `hermes.answer` row (cost $0.0093).
        - Verification run `c762b467…` against `clients/dreamsign-pilot/pages/clean-agency.html`
          wrote 1 `verification.decision` row: `approved`, all 6 checks recorded, evaluator cost
          $0.0159.
- [ ] **CI auto-deploy — code done, not yet proven.**
      - `.github/workflows/ci.yml` gains an `audit` job and a real Cockpit `build` job, replacing the
        Day-1 placeholder.
      - It also gains `deploy-cockpit`: push to `main` only, `needs` every check job, pulls
        `VERCEL_TOKEN` from Doppler, then `vercel build` → `deploy --prebuilt --prod` → curl
        smoke-check for 200.
      - `apps/cockpit/vercel.json` disables Git-triggered deploys on `main`, so CI is the sole
        production deployer.
      - Verified locally: the YAML parses, the Cockpit build passes, and a clean-checkout `npm ci` +
        typecheck + tests passes for audit, hermes and verification (simulating the CI jobs).
      - **Not yet run in real CI.** Blocked on:
        - (a) `main` doesn't exist on the remote; the only branch is `huraira-work`, which is also
          the default.
        - (b) the `DOPPLER_TOKEN` GitHub secret.
- [ ] **Secrets manager — Doppler stood up and proven 2026-09-28; plaintext not yet retired.**
      - Workspace "WFACT 3.0", project `wfact-3-0-codebase`. The 9 non-empty `.env.local` values are
        imported into `dev` and `prd`, hash-verified 9/9 identical in both.
      - Proven as the real source: `env -i … doppler run -- npm run ask` (no `.env.local` loaded)
        answered live from Claude + Supabase and wrote audit run `73e3cfc8…`.
      - Still open: `VERCEL_TOKEN` (was empty in `.env.local`), the `DOPPLER_TOKEN` GitHub secret,
        then deleting `.env.local` and `apps/cockpit/.env.local` plus rotating the keys that sat in
        plaintext.
      - **Incident**: this session printed the Doppler CLI token (`dp.ct…`) into its transcript
        through a bad output filter. Huraira should revoke it (`doppler logout`, then log in again).

**Acceptance status**: 1 of 3 criteria met (audit log). Deploy and secrets need their first real run.

**Update 2026-09-28 (later)**:
- Stage 1 committed (`78169e0`) and pushed. `main` now exists on the remote, created from
  `huraira-work` at `77680c7`.
- CI's first-ever run (`36421350704`) failed in `guardrails`. A real, pre-existing bug: the "no
  tracked .env" regex also matched the intentionally tracked `.env.example` files. It went unnoticed
  because CI had never run before; it only triggers on `main`.
- Fixed to exempt exactly `.env.example`. Tested locally: the current repo passes, a leaked
  `.env.local` or `.env` is blocked.
- The fix is not yet pushed, so no job past `guardrails` has run in real CI yet.

## Stage 2 — Generalize the agent runtime (BUILT 2026-09-28, pending CI + commit)

- [x] **`packages/agent-runtime`**
      - `Agent<I,O>` interface (typed input via `parseInput`, one `execute` per attempt, optional
        `escalationReason` and `summarize`).
      - `AgentTask` (UUID `taskId`, `role` = owner, `deadline`, `retryBudget`; Blueprint §3).
      - `runAgent()` runs spawn → validate → execute → report → terminate. Retry/escalation
        **imports Hermes-lite's `withBoundedRetry`/`EscalationError`** through a new
        `@wfact/hermes-lite/escalation` subpath export; nothing is re-implemented.
      - It never throws for agent outcomes (`completed` / `escalated` / `rejected`), and it
        re-throws audit write failures (fail closed).
      - Every lifecycle step writes `agent.spawn` / `agent.complete` / `agent.escalate` /
        `agent.reject` to `audit_log` under the task ID.
      - 11/11 tests.
- [x] **Agent registry** (`packages/agent-runtime/src/registry.ts`, Blueprint §14): seeded with
      exactly `front-end-builder` and `qa-evaluator`. An unregistered role is rejected, never
      executed. `permissionScope` is descriptive only (not enforced — policy engine is "do not build
      yet"), stated in the file header.
- [x] **frontend-loop and verification re-pointed**
      - `createFrontendBuilderAgent` wraps the unchanged `FrontendLoop`; hitting the round cap now
        comes back as an `escalated` run.
      - `createQaEvaluatorAgent` wraps the unchanged `VerificationLoop` and passes the run's audit
        context, so `verification.decision` lands on the same task.
      - Both CLIs now run via `runAgent` + `createSeedRegistry()`.

**Acceptance criteria**:
- *Existing suites pass unchanged*: **MET**. `git diff a57d977` shows no modification to any
  pre-existing test file. frontend-loop 25/25 (20 original + 5 agent) and verification 20/20
  (12 original + 4 audit + 4 agent). Hermes 33/33, audit 7/7.
- *A new agent can be added without touching agent-runtime*: **MET at test level**. `echo-test` is
  defined only in `test/runAgent.test.ts`: it implements `Agent`, registers a definition and runs
  through the full audited lifecycle. Stage 4's Intake/Planner are the real proof.
- *Live*: the verification CLI ran through the runtime against the real DreamSign page with the same
  verdict as before (APPROVED, $0.0159). Queried back via SQL, run `b564fde3…` shows
  `agent.spawn` → `verification.decision` → `agent.complete`, all on task `69e94fcf…`. The
  front-end CLI was **not** re-run live (a multi-round Agent 37 + Claude build); it's covered by
  unit tests against the unchanged `FrontendLoop`.
- *CI*: linked `file:` packages don't get their own deps from `npm ci`. Jobs now install
  audit → hermes → agent-runtime first, verified by a clean-checkout simulation. The new
  `agent-runtime` job was added, and `deploy-cockpit` now needs it.

## Stage 3 — Workflow engine v1: build → verify (BUILT + LIVE-PROVEN 2026-09-28, pending commit/CI)

- [x] **`packages/workflow`, `buildAndVerify(brief)`**
      - `front-end-builder` → a durable `workflow.checkpoint` row (stage `build`, artifact path +
        sha256) → `qa-evaluator` against the **checkpointed** file, re-hashed first.
      - On QA failure, the exact failed check IDs and evaluator issues go back to the builder via a
        new additive `FrontendLoop.revise()` (bounded, default 2 revisions), then it halts with those
        specifics.
      - On pass: a `verified` checkpoint, then `workflow.gate` (`launch`, `hard-gate`). **It never
        deploys.**
      - Versioned (`build-and-verify@1.0.0`) in every row.
- [x] **Checkpoint/rollback proven**, 7/7 tests:
      - `broken.html` as the stage-1 output is caught before any verified checkpoint or gate, and
        the builder's revision prompt contains every failed check ID.
      - Broken-then-fixed passes in 2 cycles.
      - A simulated crash right after the build checkpoint resumes via `resumeBuildAndVerify(runId)`
        with **zero** builder calls.
      - A tampered artifact is refused (`checkpoint_corrupt`).
      - A finished run isn't re-opened.
      - A malformed brief writes no rows.
- [x] **One entry point**: `npm run build-and-verify -- <brief.json>` (or `--resume <run-id>`).
      `packages/workflow/README.md`.
- **Stand-in disclosed** (rule 2) in the file header, the README, and here: this is a hand-rolled
  in-process workflow, NOT n8n/Temporal. No queue, no auto-restart; a human or CLI resumes a run.
  Durability means only "checkpoints survive in Postgres".

**Acceptance criteria**:
- *One command runs build → verify against a real brief*: **MET, live.** Run `cb59c6a4…`: DreamSign
  placeholder brief, Doppler as the only secrets source, Agent 37 builder (2 internal correction
  rounds), Claude QA → `awaiting_launch_approval` in 1 cycle.
  - Independently checked: the 9 audit rows were read back via SQL (start → builder → checkpoint
    `build` → QA decision `approved` → checkpoint `verified` → gate `hard-gate`, one run_id).
  - The file on disk re-hashes to the checkpoint's `6771ed270ff7…`.
  - A separate verification-CLI process re-ran all 6 checks: PASS, evaluator APPROVED ($0.0143).
- *Checkpoint is a real row, crash-recoverable*: **MET** (the rows above, plus the resume tests).
- Caveat: the "real brief" is still the placeholder (`source: placeholder-2.0-case`). That stays
  Nick-gated until Stage 7.

**CI**: the Stage 2 push's run (`36429819858`) failed in gitleaks. I investigated rather than
assumed; all 8 findings across the last 3 commits were in `graphify-out/cache/stat-index.json`.
Each flagged value is exactly graphify's `file_hash()` of a `.claude/hooks/*token*.sh` script: file
names containing "token", not secrets. A new `.gitleaks.toml` keeps every default rule and allowlists
only that one file. Verified locally with gitleaks 8.30.1: default rules give 8 findings, the repo
config gives 0, and a canary key placed elsewhere in `graphify-out/` is still caught. New `workflow`
CI job; `deploy-cockpit` now needs it.

**CI update (Stage 3 push, run `36433582813`)**: **every check job passed in real GitHub CI for the
first time**: guardrails incl. gitleaks, audit, hermes, agent-runtime, frontend-loop, verification,
workflow, and the Cockpit build. Only `deploy-cockpit` failed, and it got past the `DOPPLER_TOKEN`
check (so that secret now exists). It failed at `vercel pull`. Reproduced locally with Doppler `prd`
and the same IDs: Vercel rejects the stored `VERCEL_TOKEN` ("User not found (404)" / "token
rejected"). The workflow is right and the token value is bad; it needs a new token (Huraira).

**Stage 1 CI auto-deploy — acceptance MET 2026-09-28** (run `36436468792`, the Stage 4 push to
`main`): every check job green, then `deploy-cockpit` ran with secrets from Doppler only:
- `vercel build` (77 modules), then a production deploy to
  `wfact-cockpit-b8hwj3vo3-niktheplumberkings-projects.vercel.app`;
- the job's own smoke-check got **HTTP 200**, and the production alias also answers 200.

No manual step anywhere. This closes the "zero manual steps" exit check open since the sprint's
Phase 1. It needed Huraira to replace the rejected `VERCEL_TOKEN`, which is done.

Stage 1 remaining: the secrets criterion (`grep` finds no plaintext keys) is still NOT met while
`.env.local` and `apps/cockpit/.env.local` exist on disk. Deleting them plus rotating the keys is
Huraira's call.

## Stage 4 — Intake + Planner (BUILT + LIVE-PROVEN 2026-09-28, owner approval pending)

- [x] **Model routing as configuration** (Blueprint §6/§7):
      - `packages/hermes/config/model-routing.json`: `intake` → `claude-haiku-4-5` (fast tier,
        $1/$5 per MTok) and `planner` → `claude-sonnet-5` (mid tier, $2/$10). Prices re-checked
        against the current Claude pricing table.
      - `resolveModelRoute(slot)` reads the config, with a per-run override
        `WFACT_ROUTE_<SLOT>=anthropic:<model>`. It refuses an unknown slot rather than defaulting,
        and an override to an unpriced model reports cost as unknown, never a guess.
      - Only these two slots read from it. The Phase 4 builder/evaluator and Hermes-lite's own
        model are still chosen in their packages: a disclosed gap, written in the config's `_doc`.
      - Hermes 39/39 (+6 routing tests).
- [x] **Intake agent** (`packages/planning/src/intake.ts`):
      - Input is a raw request (a pasted email, a short form or loose JSON). The raw text is fenced
        as data in the prompt.
      - Output uses Claude structured outputs (`output_config.format`, SDK 0.128) and is
        re-validated with zod.
      - Entity assignment is cross-checked against Hermes-lite's own `detectEntitySlug`/
        `KNOWN_ENTITIES`, reused (now exported) rather than duplicated.
      - Ambiguity triggers one re-classification, then escalates to a human (Blueprint §5).
      - The client slug is derived deterministically.
- [x] **Planner agent** (`packages/planning/src/planner.ts`):
      - The model picks a template from the real hand-picked list, the sections, a sharpened goal,
        risks and open questions.
      - Code then enforces the structure:
        - the brief must pass frontend-loop's own `parseBrief`, with new provenance
          `source: "intake-planner"`;
        - sections the client asked for are always kept;
        - tasks must be exactly the stages `build-and-verify@1` runs, in order, with registered
          roles.
      - An unexecutable plan is retried once, then escalated.
- [x] **Registered without touching agent-runtime**: `registryWithPlanning()` adds `intake` and
      `planner` at composition time; the seed registry is unchanged (tested). This is Stage 2's
      "generalizes" criterion, proven with two real agents.
- [x] **Owner-approval gate** (`packages/db/migrations/0007_plan_approvals.sql`, applied):
      - Only the pipeline inserts plans (service role). Only an owner/admin decides, once,
        `pending` → `approved | rejected`, stamped from the session.
      - The plan body can never be edited. A rejection needs a note. There are no deletes.
      - Every decision writes `audit_log` (`plan.decision`).
      - **Attack-tested live (9/9, rolled back)**: anon insert refused; a stranger sees and updates
        0 rows; an owner editing the plan refused; reject-without-note refused; owner approve works
        and is stamped; re-decide changes 0 rows; delete refused even for the service role; exactly
        1 audit row.
      - Security advisors show nothing new.
- [x] **Cockpit Approvals room extended** (not rebuilt): `PlanApprovals.tsx` shows pending plans
      (template, sections, tasks, open questions, risks) with Approve / Reject-with-note.
      `npm run build` passes. **Not yet viewed in a browser**: it needs a magic-link login, which is
      Huraira's inbox.
- [x] **Re-plan once, then escalate**: `npm run intake -- --replan <rejected-id>` re-plans from the
      owner's note (revision 2, `supersedes`). A second rejection gives `replan_limit_reached`.
- [x] **Chain to Stage 3**: `npm run build-and-verify -- --plan <id>` builds only an **approved**
      plan. Live negative test: the pending plan was refused before any model call.
- Tests: planning 12/12. Clean-checkout CI simulation of all 7 packages: 121/121. New `planning` CI
  job.

**Acceptance criteria**:
- *Raw brief in → Planner task list out, no hand-written intermediate*: **MET (live).**
  `examples/sample-lead-email.txt` is a synthetic, clearly labelled pasted email ("Northlight Signs",
  fictional).
  - Run `d189d25c…`: Intake on `claude-haiku-4-5` gave `dreamsign` (certain), `new_website`,
    `northlight-signs` ($0.0017).
  - Planner on `claude-sonnet-5` gave template `clean-agency`, 5 sections, the 2 executable tasks
    and 9 open questions ($0.0094).
  - Stored as plan `8f03181f…`, **pending**. SQL confirms 4 lifecycle audit rows on the run and
    the pending row with source `intake-planner`.
- *"Planner-APPROVED"*: **awaiting the owner.** By design, no code path can approve a plan. Huraira
  approves in the Cockpit, then `build-and-verify --plan 8f03181f…` runs Stage 3 on it.
- *Routing split is configuration*: **MET** (config file + env override, tested; live run used
  `[fast, config]` / `[mid, config]`).

## Stage 5 — Observability seed (BUILT + LIVE-PROVEN 2026-09-28, uncommitted)

- [x] **`model_traces`** (`packages/db/migrations/0008_model_traces.sql`, applied):
      - One row per model call: run_id, task_id, agent role, provider/model, reported tokens,
        `cost_usd`, `price_basis` (metered | unpriced), pricing version, latency and outcome.
      - Append-only (same trigger as audit_log). The database refuses a metered row without a cost
        and an unpriced row with one.
      - **Owner-only read** (Blueprint §9: admins don't see raw cost).
      - The `model_usage_by_actor` roll-up view is `security_invoker`, so the same RLS applies.
      - Attack-tested live 8/8 (rolled back).
- [x] **Cost math centralised**:
      - One `models` price table in `packages/hermes/config/model-routing.json` (v1.1.0) and one
        function, `costForModel()`. Slot routes read their price from it too.
      - The four copied `PRICING` constants (hermes, verification, frontend-loop and workflow CLIs)
        are gone; `grep` finds none.
      - Agent 37's `hermes-agent` has no price on file, so it's recorded as `unpriced` with cost
        NULL, never $0 or a guess.
- [x] **Per-call tracing**:
      - `traceModelCalls` (`@wfact/audit`) is fail-closed like the audit writer.
      - `runAgent` publishes the task via an AsyncLocalStorage `runContext`, so every call inside an
        agent is tagged with that agent's task.
      - `traceModelClient` (`@wfact/hermes-lite/tracing`) wraps each existing client kind (Claude
        text, Agent 37, Claude JSON) with no client changes.
      - Wired into all five CLIs. Workflow and planning *require* the trace store, as they require
        the checkpoint store.
      - **A real bug was caught by the new tests before it shipped**: the first version held the
        client's live counter object, so every token delta, and so every cost, would have been 0.
        Fixed by snapshotting.
- [x] **Cockpit Models room**: totals (metered spend, labelled a lower bound when unpriced calls
      exist), cost per model per agent role, and the latest 25 calls. `npm run build` passes.
- Tests: audit 14, hermes 40, agent-runtime 12, frontend-loop 25, verification 20, planning 12,
  workflow 7. That's 130/130, all green in a clean-checkout CI simulation.

**Acceptance criteria**:
- *Every agent run produces a queryable trace row with a real, non-estimated dollar cost*: **MET
  (live).** Planning run `345cf9ae…` (synthetic Bennett & Co lead, correctly routed to
  `bennett-co`/`landing_page`) and one verification run gave three rows, read back via SQL:
  - `agent:intake`, haiku-4-5: 785/170 tokens, $0.001635;
  - `agent:planner`, sonnet-5: 1459/1301, $0.015928;
  - `agent:qa-evaluator`, sonnet-5: 7085/13, $0.014300.

  Each matches the CLI's own cost line, and each `task_id` joins to that agent's `agent.complete`
  audit row. The cost is "real" in the sense that matters: provider-reported tokens × the current
  list price. It is not an invoice reconciliation.
- *Models room shows real data from a real run*: **data half MET**. The view queried *as the owner*
  (RLS applied) returns exactly those three roles and costs. **Not yet viewed in a browser**: it
  needs Huraira's magic-link login.

**Gaps noticed**:
- The second synthetic run created a second pending plan (`ba93ddae…`, Harbor Street Bakery) in
  the Approvals room. It's fictional, so reject it there (a reject note is required) or leave it.
- Traces cover model calls, not tool calls. Hermes-lite's tool calls are in `audit_log` with
  latency, which is enough for now. Blueprint §3 names tool calls too; revisit if the simple tables
  prove insufficient (the Langfuse trigger per §13).
- Seven linked `file:` packages with a hand-ordered install per CI job. This now really is worth
  moving to npm workspaces, with the Vercel root-directory caveat from Phase 6.
- The Planner produced both `process` and `how-it-works` sections, a near-duplicate the model
  introduced. It's harmless, but a candidate for a section-normalisation rule later.
- The live run overwrote `clients/dreamsign-pilot/pages/clean-agency.html` (the file behind the
  earlier Vercel page) and appended 2 correction rows to its `memory.md`. That's the workflow's
  intended output, but the deployed `dreamsign-deploy.vercel.app` still serves the older version.
- Six linked `file:` packages now, installed in dependency order per CI job. The npm workspaces
  question from Stage 2 is now worth deciding before Stage 4 adds more.
- Lifecycle rows carry `entity_slug = null` when the caller doesn't set `task.entitySlug`. The QA CLI
  has a client slug but no entity slug, so it passes neither.
- Four packages now link each other via `file:` with a manual install order in CI. If more packages
  join (Stage 3's `packages/workflow`), switch to npm workspaces with a root `package.json`, but
  check first: the root has no `package.json` on purpose, because of the Vercel Root Directory
  incident logged in Phase 6.

**Gaps noticed**:
- `tool.invoke` rows carry `entity_slug = null`. The registry doesn't know the entity, only the tool
  input does, which is still logged. Pass entity context through when Stage 2's runtime owns the audit
  context.
- The `verification.decision` row doesn't carry evaluator cost; the CLI prints it separately. Stage 5's
  trace row is the planned home for cost, so it's not duplicated here.
- Knowledge graph built 2026-09-28 (`graphify-out/`, 612 nodes / 972 edges / 49 communities, plus
  wiki). 52 dangling edges were flagged by the health check (semantic edges to IDs the AST didn't
  produce), and PDF content wasn't extracted (no PDF tooling on this machine). The SOP PDFs are
  covered by their markdown twins; Factory Book and Factory Audit are title-only in the graph.
