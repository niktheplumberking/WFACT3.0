# Progress — WFACT 3.0

Last synced: 2026-09-30, via `/progress-sync` — re-synced to fold in `2c188d0` (Factory Completion Plan
Step 2) on top of the earlier `6e72020` sync, against git, GitHub Actions, live Supabase (row counts,
`jobs`) and a local re-run of the frontend-loop suite (26/26).

**Which document governs what**: the Continuation Build Plan section (bottom) tracks
[`docs/WFACT-3.0-Continuation-Build-Plan.md`](docs/WFACT-3.0-Continuation-Build-Plan.md), the plan in
force since 2026-09-28, with the Blueprint (`docs/wfact-3.0-blueprint.html`) as the scope source of
truth. The Phases 1–7 section above it is the historical record of the superseded 100-hour sprint
(`docs/wfact-3.0-operator-manual.html` / `docs/WFACT-3.0-Fast-Track-Plan.md`). Its checkboxes are not
restructured to fit the new plan. `docs/WFACT-3.0-Factory-Completion-Plan.md` (untracked as of this
sync) sits **on top of** the Continuation plan, not in place of it: it maps the remaining Blueprint
phases to numbered steps 1–24 and is the source for "Next up" below. Its Part E checklist tracks those
steps; this file tracks the Continuation Stages.

**Status summary**: Continuation Stages 2–5 are built, committed, and green in real CI, the Cockpit →
GitHub dispatch leg is proven live (run `36455639903`), and Factory Completion Plan Steps 1 and 2 are done.
Step 2 added provisional business rules and a synthetic pilot client, so Stage 7's prerequisites now exist
in stand-in form only. The latest `main` CI run is `36458405540` on `6e72020` (11 of 11 jobs); the 3 newer
commits (`4dfd07b`, `2368252`, `2c188d0`) are local, unpushed and docs/test-level, so they have no CI run.
Stage 1 is still 2 of 3 (both `.env.local` files are still on disk, checked 2026-09-30); across Stages 1–5
that's roughly 92%. **Biggest blockers**: Stage 1's secrets clean-up (Huraira's account actions) and
Nick's real brief and business-rules session, which the provisional drafts only stand in for.

**Next up** (from the Factory Completion Plan):
1. Step 4: run the full pipeline on `clients/summit-line-roofing/` through the Cockpit. First it must
   register the `bennett-co` entity and client in Supabase (today `entities` has 1 row, `clients` 1). Needs
   Huraira's plan approval, and a yes before any preview deploy.
2. Step 3, in parallel: retire plaintext secrets. Huraira deletes both `.env.local` files, rotates the
   keys that sat in plaintext, and revokes the leaked Doppler CLI token (see Incidents).
3. Step 5 / Continuation Stage 6: the Documentation agent writing structured episodic memory per task
   ID. Also close the two orphaned `queued` jobs (`a2a41d2d`, `cbf8bf7b`), which needs Huraira's OK.

**Gaps noticed**:
- **Stage 7 prerequisites aren't flagged yet.** The plan says to flag them in `BLOCKED-ON-NICK.md` "the
  moment Stage 6 finishes". The rows exist ("One real pilot project brief", "business rules session")
  but are still framed as sprint Day 3–9 items.
- **Linked `file:` packages need a decision.** There are 9 packages under `packages/`, linked with a
  hand-ordered install per CI job. It's worth deciding on npm workspaces now. Check first: the repo
  root has no `package.json` on purpose, because of the Phase 6 Vercel Root Directory incident. (Three
  near-identical copies of this gap were in the file; merged here.)
- **Model routing covers only Intake and Planner.** The Phase 4 builder/evaluator and Hermes-lite's
  own model are still chosen inside their packages. Disclosed in the config's `_doc`.
- **Traces cover model calls, not tool calls.** Hermes-lite tool calls are in `audit_log` with
  latency. Blueprint §3 names tool calls too; revisit under the Langfuse trigger (§13).
- **Some audit rows carry `entity_slug = null`.** This covers lifecycle and `tool.invoke` rows when the
  caller doesn't set `task.entitySlug` (e.g. the QA CLI has a client slug but no entity slug). Pass
  entity context through from the runtime.
- **The Planner emitted near-duplicate sections** (`process` and `how-it-works`), a candidate for a
  section-normalisation rule.
- **The deployed DreamSign page is stale.** The Stage 3 live run overwrote
  `clients/dreamsign-pilot/pages/clean-agency.html` and appended 2 rows to its `memory.md`, but
  `dreamsign-deploy.vercel.app` (HTTP 200 today) still serves the older build, since the workflow
  never deploys by design.
- **The knowledge graph has holes.** `graphify-out/` (612 nodes / 972 edges) has 52 dangling edges, and
  the PDFs weren't extracted. SOPs are covered by their markdown twins; Factory Book/Audit are
  title-only.
- **Two Nick disclosures are still owed in person**: Hermes-lite as a stand-in and Vercel substituting
  for Hostinger. Both are logged in `BLOCKED-ON-NICK.md` as "TELL NICK, DON'T JUST LOG IT", and
  neither conversation has happened.
- **`CLAUDE.md` §0 is stale.** It still says "Current phase: Phase 1 — Foundation & Access" and
  describes the 100-hour sprint. It predates the Continuation plan.

**Unplanned work done**:
- **Cockpit-driven actions** (`4653c67`): a `jobs` queue (migration `0009`), the `dispatch-job` Edge
  Function, `.github/workflows/cockpit-job.yml`, a `packages/jobs` runner, and a Cockpit Actions room.
  This is Huraira's direction (every pipeline action runs from the Cockpit, with GitHub Actions as the
  worker). The plan doesn't ask for it, and it arguably edges into the plan's "do not build yet: a task
  queue" item. It's disclosed here rather than folded into a stage. Design is in
  `docs/COCKPIT-JOBS.md`.
- **`parseBrief` allows a new provenance value** (`2c188d0`): `synthetic-provisional-2026-09-30` was added
  to the allowed brief `source` values in `packages/frontend-loop/src/brief.ts`, with a test, so the
  Step 2 synthetic brief can be labelled honestly instead of posing as `placeholder-2.0-case`.
- **Knowledge graph** (`77680c7`): `graphify-out/` plus a `.gitleaks.toml` allowlisting only its cache
  file.
- **From the sprint era**:
  - Real usage and cost instrumentation in the `hermes` and `frontend-loop` model clients, now
    centralised under Stage 5.
  - The `Agent37ModelClient` adapter and the builder/evaluator vendor split.
  - The SOP PDFs.
  - The Cockpit dark-theme restyle (`a57d977`).

**Incidents & regressions**:
- **Doppler CLI token exposed (2026-09-28, open).**
  - What happened: a bad output filter printed the Doppler CLI token (`dp.ct…`) into a session
    transcript.
  - Found by: the same session.
  - Fix owed by Huraira: `doppler logout`, then log in again, which revokes it.
  - Not verified revoked by this sync.
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

# 100-Hour Sprint (superseded 2026-09-28 — historical record)

Source: `docs/wfact-3.0-operator-manual.html`, sequenced per `docs/WFACT-3.0-Fast-Track-Plan.md`. Kept as
written at the sprint's close; later changes appear only as dated inline notes.

## Phase 1: Foundation & Access (Days 1–2 · 8 hrs)

- [x] Set up repo skeleton, law file, memory scaffold, `BLOCKED-ON-NICK.md` tracker
- [x] Base CI skeleton with zero-manual-step deploy — *closed 2026-09-28 under Continuation Stage 1*:
      `deploy-cockpit` in `.github/workflows/ci.yml`, first green on run `36436468792`. (At sprint
      close, no deploy automation existed and the Vercel deploy was a manual CLI call.)
- [ ] Secrets manager wired, nothing in plaintext — *2026-09-28*: Doppler now stood up and used by CI,
      but `.env.local` still holds plaintext keys, so still unchecked. See Continuation Stage 1.
- [x] GitHub access confirmed — dedicated `niktheplumberking/WFACT3.0` repo, verified via `gh auth status`
- [x] Supabase project access confirmed — `mcaxxhgjptwowwrluhra`, migrated (`0001`–`0005`) and RLS-attack-tested for real, 2026-09-22
- [x] Vercel access confirmed — `vercel whoami` → `niktheplumberking`, verified in this environment
- [ ] Hostinger access — descoped for this sprint (Huraira's call, 2026-09-22); Vercel substitutes for "live," substitution logged in `BLOCKED-ON-NICK.md`
- [x] 3 SOPs + Operations Manual received — `docs/WFACT SOPS/`, added 2026-09-22
- [x] Motion Sites MCP + 21st.dev credentials confirmed real — both call-tested live, 2026-09-21/22
- [ ] Higgsfield MCP credentials — descoped for this sprint (Huraira's call, 2026-09-22)
- [x] Claude/Anthropic API billing confirmed — real key, real live call made 2026-09-22
- [ ] Which 2 entities confirmed — still Nick-only; placeholder in use (DreamSign + Bennett & Co)

**Exit check** (MET 2026-09-28, after the sprint closed): *"A commit reaches a deployed preview through
CI with zero manual steps, and every access item is either confirmed or has a tracked workaround in
place."* At sprint close, every access item was confirmed or had a logged, disclosed workaround, but
the CI-automated-deploy half didn't exist. That half was met by Continuation Stage 1 on run
`36436468792` (a production deploy with no manual step and an HTTP 200 smoke-check).

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

Everything below is committed. CI's latest `main` run is on `6e72020`; local `huraira-work` is 4 commits ahead of
`origin/huraira-work` (`4dfd07b`, `2368252`, `2c188d0`, `c803c47`; unpushed) and has one untracked file (the Factory Completion Plan). CI history on `main`:

| Run | Commit | Result |
|---|---|---|
| `36421350704` | `77680c7` | failure: guardrails false positive |
| `36429819858` | `f1055a8` | failure: gitleaks false positives |
| `36433582813` | `b57eead` | failure: deploy, bad `VERCEL_TOKEN` |
| `36436468792` | `1bcf671` | success |
| `36439020452` | `123970f` | success |
| `36443734844` | `4653c67` | success, all 11 jobs incl. `Deploy Cockpit to Vercel` |
| `36453515469` | `a2ada14` | success |
| `36455388336` | `2e4a911` | success |
| `36458405540` | `6e72020` | success, 11 of 11 jobs |
| `36455639903` | `2e4a911` | success (`Cockpit job` workflow, `build_plan` `b952aaba`; not CI) |

All 9 migrations (`0001`–`0009`) are listed as applied on `mcaxxhgjptwowwrluhra`, checked via
`list_migrations`.

## Stage 1 — Close the Phase 0/1 debt (2 of 3 criteria MET)

- [x] **Audit log — acceptance MET 2026-09-28** (`78169e0`).
      - `packages/db/migrations/0006_audit_log.sql` is applied. It's append-only by trigger for every
        role, service_role included.
      - Attack-tested live: UPDATE, DELETE and TRUNCATE were refused, malformed action names were
        rejected, `anon` insert was refused, and `anon` sees 0 rows. `get_advisors` shows nothing new.
      - New `packages/audit` (fail-closed). It's wired into Hermes-lite's `ToolRegistry` and
        `VerificationLoop.run`.
      - Queried back via SQL:
        - Hermes run `bbcefba8…` wrote 3 `tool.invoke` rows and 1 `hermes.answer` row.
        - Verification run `c762b467…` wrote 1 `verification.decision` (`approved`, 6 checks).
      - This sync: `audit_log` holds 43 rows across 10 action types, from 12:10 to 15:39 UTC today.
- [x] **CI auto-deploy — acceptance MET 2026-09-28.**
      - `.github/workflows/ci.yml` `deploy-cockpit` runs on push to `main` only and `needs` every
        check job. It takes secrets from Doppler only.
      - Steps: `vercel build` → `deploy --prebuilt --prod` → curl smoke-check.
      - `apps/cockpit/vercel.json` disables Git-triggered deploys on `main`, so CI is the only
        production deployer.
      - First success: run `36436468792` (a production deploy, and the job's own smoke-check got HTTP
        200). Re-confirmed on `36443734844`.
      - Production alias `wfact-cockpit-niktheplumberkings-projects.vercel.app`: HTTP 200 via curl,
        this sync.
      - Closes the sprint's Phase 1 "zero manual steps" exit check.
- [ ] **Secrets manager — Doppler is the real source; plaintext not retired (NOT MET).** Waiting on
      Huraira.
      - Doppler workspace "WFACT 3.0", project `wfact-3-0-codebase`. The 9 `.env.local` values are in
        `dev`/`prd`, hash-verified identical.
      - Proven live: `env -i … doppler run -- npm run ask` wrote audit run `73e3cfc8…`. CI and deploy
        run from Doppler only, and the `DOPPLER_TOKEN` GitHub secret exists (the deploy job passed its
        check).
      - **Still failing the plan's `grep` criterion (checked this sync):**
        - `.env.local` (modified 2026-09-28 18:30) still holds non-empty `SUPABASE_SERVICE_ROLE_KEY`,
          `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AGENT37_API_KEY`, `VERCEL_TOKEN` and others.
        - `apps/cockpit/.env.local` still exists.
        - Both are gitignored and untracked (`git ls-files` confirms). The only tracked `grep` hit,
          `docs/SECRETS.md`, is the documented grep command itself, not a value.
      - Remaining steps (Huraira): delete both files, rotate the keys that sat in plaintext, and
        revoke the leaked Doppler CLI token (see Incidents).

**Stand-in disclosed**: the plan asks for "a cloud provider's secrets manager, or HashiCorp Vault";
Doppler is a hosted third option. Setup is in `docs/SECRETS.md`.

## Stage 2 — Generalize the agent runtime (MET — committed `f1055a8`, CI green from `36436468792`)

- [x] **`packages/agent-runtime`**
      - The `Agent<I,O>` interface and `AgentTask` (UUID `taskId`, role, deadline, retry budget).
      - `runAgent()` runs spawn → validate → execute → report → terminate. Retry/escalation is
        imported from Hermes-lite (`@wfact/hermes-lite/escalation`), not re-implemented.
      - Every lifecycle step is audited (`agent.spawn` / `complete` / `escalate` / `reject`).
- [x] **Agent registry** (`src/registry.ts`), seeded with exactly `front-end-builder` and
      `qa-evaluator`. An unregistered role is rejected. `permissionScope` is descriptive only (the
      policy engine is on the "do not build yet" list), stated in the file header.
- [x] **frontend-loop and verification re-pointed**: `createFrontendBuilderAgent` and
      `createQaEvaluatorAgent` wrap the unchanged loops, and both CLIs run through `runAgent`.

**Acceptance**:
- *Existing suites pass unchanged*: **MET**. `git diff a57d977` shows no edits to pre-existing test
  files, and the frontend-loop and verification CI jobs are green on `36443734844`.
- *A new agent can be added without touching agent-runtime*: **MET**. Proven by `echo-test` in the
  tests, and for real by Stage 4's `intake`/`planner` via `registryWithPlanning()`.
- *Live*:
  - The verification CLI ran through the runtime: run `b564fde3…`, `agent.spawn` →
    `verification.decision` → `agent.complete` on task `69e94fcf…`, APPROVED.
  - The front-end CLI was not re-run live standalone. It is exercised live inside Stage 3's workflow
    run.

## Stage 3 — Workflow engine v1: build → verify (MET — committed `b57eead`, CI green from `36436468792`)

- [x] **`packages/workflow`, `buildAndVerify(brief)`**
      - Order: `front-end-builder` → `workflow.checkpoint` (`build`, artifact sha256) → `qa-evaluator`
        on the re-hashed checkpointed file.
      - On QA failure, the exact failed check IDs go back via `FrontendLoop.revise()`, with bounded
        revisions.
      - On pass: a `verified` checkpoint → `workflow.gate` (`launch`, `hard-gate`). **It never
        deploys.**
      - Versioned `build-and-verify@1.0.0`.
- [x] **Checkpoint/rollback proven**, 7 tests:
      - a broken first build is caught before any verified checkpoint;
      - broken-then-fixed passes;
      - a crash resume makes zero builder calls;
      - a tampered artifact is refused;
      - a finished run isn't re-opened;
      - a malformed brief writes no rows.
- [x] **One entry point**: `npm run build-and-verify -- <brief.json>` (or `--resume <run-id>` or
      `--plan <id>`).

**Stand-in disclosed**: this is a hand-rolled in-process workflow, not n8n/Temporal. There's no queue
and no auto-restart. It's disclosed in the file header, the README and here.

**Acceptance**:
- *One command, build → verify, real brief*: **MET, live.** Run `cb59c6a4…` →
  `awaiting_launch_approval`.
  - The audit rows were read back via SQL. This sync confirms `workflow.start` ×1,
    `workflow.checkpoint` ×2 and `workflow.gate` ×1, all at 13:47–13:49 UTC.
  - The file re-hashes to `6771ed270ff7…`.
  - A separate verification-CLI process gave PASS and APPROVED.
- *Checkpoint is a real, crash-recoverable row*: **MET.**
- Caveat: the "real brief" is still the placeholder (`source: placeholder-2.0-case`). That's gated on
  Nick until Stage 7.

## Stage 4 — Intake + Planner (MET — committed `1bcf671`, CI green on `36436468792`)

- [x] **Model routing as configuration**: `packages/hermes/config/model-routing.json` sends `intake`
      → `claude-haiku-4-5` (fast) and `planner` → `claude-sonnet-5` (mid). There's a per-run
      `WFACT_ROUTE_<SLOT>` override, and an unknown slot is refused.
- [x] **Intake agent** (`packages/planning/src/intake.ts`):
      - It uses structured outputs, re-validated with zod.
      - Entity assignment is cross-checked against Hermes-lite's `detectEntitySlug`.
      - It re-classifies once, then escalates.
- [x] **Planner agent** (`packages/planning/src/planner.ts`):
      - The brief must pass frontend-loop's `parseBrief`.
      - Tasks must be exactly the `build-and-verify@1` stages, with registered roles.
      - It retries once, then escalates.
- [x] **Registered without touching agent-runtime** (`registryWithPlanning()`).
- [x] **Owner-approval gate** (migration `0007`, applied):
      - Only owners/admins decide, and only once. The plan body is immutable, a rejection needs a
        note, and there are no deletes.
      - Each decision is audited as `plan.decision`.
      - Attack-tested live 9/9.
- [x] **Cockpit Approvals room extended** (`PlanApprovals.tsx`), with re-plan once then escalate, and
      a chain into Stage 3 via `--plan <id>` (only approved plans build; a pending plan was refused
      live).

**Acceptance**:
- *Raw brief in → Planner task list out, no hand-written intermediate*: **MET (live).**
  - Run `d189d25c…`, from synthetic `examples/sample-lead-email.txt` ("Northlight Signs").
  - Intake on haiku-4-5 gave `dreamsign`, `new_website`.
  - Planner on sonnet-5 gave `clean-agency`, 5 sections, 2 tasks, 9 open questions.
  - Stored as plan `8f03181f…`.
- *"Planner-APPROVED"*: **MET 2026-09-28** (new this sync). Plan `8f03181f` has `status = approved`,
  `decided_at` 14:33:35 UTC, and a matching `plan.decision` audit row. The second synthetic plan
  `ba93ddae` (Harbor Street Bakery) was rejected at 15:39:26 UTC, with a second `plan.decision` row.
  This closes the earlier gap about cleaning it up.
- *Routing split is configuration*: **MET.**
- Not yet done: building the approved plan (`build-and-verify --plan 8f03181f`). The two Cockpit
  attempts are stuck. See Cockpit jobs below.

## Stage 5 — Observability seed (MET — committed `123970f`, CI green on `36439020452`)

- [x] **`model_traces`** (migration `0008`, applied):
      - Append-only, one row per model call, with `price_basis` metered or unpriced. A metered row
        needs a cost; an unpriced row must have none.
      - Owner-only read, and the `model_usage_by_actor` view is `security_invoker`.
      - Attack-tested live 8/8.
- [x] **Cost math centralised**: one `models` price table and `costForModel()`. The four copied
      `PRICING` constants are gone. Agent 37 is recorded as `unpriced` (cost NULL, never $0).
- [x] **Per-call tracing** (`traceModelCalls`, `traceModelClient`, `runContext`), wired into all five
      CLIs.
- [x] **Cockpit Models room**: totals, cost per model per role, and the latest 25 calls.

**Acceptance**:
- *Every agent run produces a queryable trace row with a real cost*: **MET (live).**
  - Planning run `345cf9ae…` plus one verification run gave:
    - `intake`: $0.001635
    - `planner`: $0.015928
    - `qa-evaluator`: $0.014300
  - Each joins to its `agent.complete` row.
  - This sync: `model_traces` has 4 rows (those 3 plus the Cockpit `ask` job).
  - "Real" means provider-reported tokens × list price, not invoice reconciliation.
- *Models room shows real data from a real run*: **data half MET.** The view queried as the owner
  returns those rows. Browser rendering has **not been independently verified by this sync**, even
  though the owner was demonstrably signed into the Cockpit today (plan decisions and job requests).

## Cockpit jobs — every pipeline action from the Cockpit (unplanned; committed `4653c67`, CI green on `36443734844`) — DISPATCH PROVEN LIVE 2026-09-28; browser check pending

Huraira's direction; see "Unplanned work done". Design and runbook are in `docs/COCKPIT-JOBS.md`.

- [x] **`public.jobs` queue + private `artifacts` bucket** (migration `0009`, applied).
      - Per-kind param validation; `build_plan` only for an approved plan and `replan` only for a
        rejected one.
      - Status is forward-only, the request is immutable, there are no deletes, and requests are
        audited.
      - Attack-tested live (spoofing, path traversal, injection strings, a stranger reading, backwards
        status, edits, deletes all refused).
- [x] **`dispatch-job` Edge Function**: `ACTIVE`, **version 5**, `verify_jwt: true` (`list_edge_functions`
      2026-09-30). Deployed source is identical to the repo copy at `aac412b` (v4 source); v5 has no commit
      of its own. Live negative tests pass (no token gives 401; the anon key gives "not signed in").
- [x] **`packages/jobs` runner** and **`.github/workflows/cockpit-job.yml`**: UUID-validated
      `job_id` via `env`, secrets from Doppler `prd`, and a `--mark-failed` safety net.
- [x] **Local live proof**: `ask` job `1141b711` went queued → running → succeeded (15:04 UTC) with
      the runner run locally on Doppler `prd`. It was not dispatched through GitHub (`dispatched_at`
      null).
- [x] **GitHub dispatch leg — MET 2026-09-28.** Job `b952aaba` (`build_plan`, plan `8f03181f`): requested
      17:05:06 UTC, `dispatched_at` 17:05:15, run `36455639903` on `2e4a911` (success, 6m38s, all steps
      green, `--mark-failed` skipped), finished 17:11:49 with `awaiting_launch_approval` and `qaIssues: []`.
      `audit_log` shows `job.requested`, `job.dispatched`, `workflow.start`, two `workflow.checkpoint`
      rows and the `workflow.gate` (launch, hard-gate; "this workflow never deploys"), all read back by SQL.
- [x] **Failure path proven**: `e5d29358` failed visibly (16:52 UTC, 09-28) with "Dispatcher not
      configured: GITHUB_DISPATCH_TOKEN is not set", so a broken dispatcher never leaves a job looking
      queued. Token is set now (the next dispatch got GitHub's 204). Its presence by name could not be
      listed (`supabase secrets list` errored), so this is inferred from behaviour.
- [ ] **Two orphaned jobs**: `a2a41d2d` and `cbf8bf7b` (15:34 and 15:39 UTC, 09-28) are still `queued`
      with `dispatched_at` null, left from before the CORS fixes. Waiting on: Huraira's OK to mark them
      failed/cancelled (a DB write), or to click **Start** on one.
- [x] **Cockpit Actions room built**: new request → intake + plan, Build + verify (approved plans),
      Re-plan (rejected), Resume, Verify a page, Ask Hermes, and a live job list. There's **no deploy
      button**; Launch stays human. Built-page previews render in a sandboxed iframe (`6e72020`). The
      Cockpit build job is green on `36458405540`; the live URL returns HTTP 200 (2026-09-30).
- [ ] **Actions room checked in a browser with live data**: the `job.requested` → `job.dispatched` pair
      10 s apart shows the user's JWT reached the function, but no function-log POST was captured (logs
      cover 24 h only) and nobody has verified the live status display. Waiting on: Huraira signing in.

## Stage 6 — Real second brain v1.5: episodic memory tied to task IDs (NOT STARTED)

- [ ] Documentation agent writes a structured entry to `clients/<name>/memory.md` at the end of every
      workflow stage, tied to the `audit_log` task ID. No `documentation` agent exists in any
      registry.
- [ ] Cognee trial: at most one session, then a write-up that states adopt or don't adopt.

**Acceptance** (not met): *"A test query ('what happened on client X's build') returns a correct
answer sourced from the structured memory file, written by the Documentation agent, not by a human"*,
plus the Cognee write-up exists.

## Stage 7 — A real pilot, not a placeholder one (NOT STARTED — waiting on Nick; provisional stand-ins in use since 2026-09-30)

- [ ] Real pilot brief: **Nick** (`BLOCKED-ON-NICK.md` "One real pilot project brief", OPEN, marked
      "PROVISIONAL DRAFT IN USE"). Stand-in: `clients/summit-line-roofing/brief.json` (fictional, entity
      `bennett-co`), loads through `parseBrief` (`2c188d0`). It does not close this item.
- [ ] Business-rules session for `memory/context.md`: **Nick** (`BLOCKED-ON-NICK.md`, OPEN, marked
      provisional). The file now holds concrete provisional rules with a 13-row register (R-01…R-13),
      no `[PLACEHOLDER]` tags left (`2c188d0`); Nick still has to keep or change each.
- [ ] Run Intake → Planner → build → verify on the real brief, and log the correction-batch count. A live
      Intake run on the synthetic raw email (claude-haiku-4-5, $0.0029, no DB writes) classified entity
      `bennett-co` and flagged both planted ambiguities; that is a check of Intake alone, not the pipeline.

**Acceptance** (not met): Blueprint §16K item 1: one real client, the full pipeline, a measured
correction count below 40+, independently verified against the deployed output. A synthetic run (Step 4)
demonstrates the factory but does not count against DreamSign's 40+.
