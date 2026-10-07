# Progress — WFACT 3.0

Last synced: 2026-10-06 (+05), via `/step-close 4B M4` — `8dae180`…`4bbd4bc` (claims gate 1.1.0, single-page and no-invented-testimonial
builder fixes from Cockpit job `f696ba43`, `packages/media` Seedance groundwork); local tests green, **not pushed, no CI run yet**.
Step 6 (parallel worktree, approved by Huraira 2026-10-06) merged locally: `58bf776`…`ee08f9d`; merged tree re-tested here.
Both branches pushed and synced at `8b05a46` 2026-10-07 (Huraira: "push to both branches, keep both synced"); CI `37609559746` green, all
13 jobs incl. the Cockpit deploy. Step 6 cost ceilings re-set from live `model_traces` 2026-10-07. Steps 5 and 7 running in parallel
worktrees (GO 2026-10-07), not merged.
Previous sync: 2026-10-02 (20:05 +05), via `/progress-sync` — folds in the push of `a9f4dcf`…`2d96962` to both branches (Huraira's word),
CI `37016971442` green on `2d96962` (all 13 jobs incl. the new isolated Track B build and the Cockpit deploy), the other session's
`c857150`…`0f00cde` (artifact-store CDN fix; CI `37019326469` still running at sync), and the live `jobs`/`plan_approvals`/`audit_log`
rows. `main`, `origin/huraira-work` and local `huraira-work` are all at `0f00cde`.
Previous syncs: 2026-10-02 (18:55 +05) via `/step-close 4B M4` (`a9f4dcf`…`7267575`); 2026-10-01 (23:30 +05) via `/progress-sync` (`70cd7d1`…`e76cff2`, Step 4C, CI `36905237284`); 2026-10-01 (19:20 +05)
after Step 4B M2 (CI `36871379578`); earlier `289ec00`…`c0f3d29`.

**Which document governs what**: the Continuation Build Plan section (bottom) tracks
[`docs/WFACT-3.0-Continuation-Build-Plan.md`](docs/WFACT-3.0-Continuation-Build-Plan.md), the plan in
force since 2026-09-28, with the Blueprint (`docs/wfact-3.0-blueprint.html`) as the scope source of
truth. The Phases 1–7 section above it is the historical record of the superseded 100-hour sprint
(`docs/archive/sprint-100-hour/wfact-3.0-operator-manual.html` / `docs/archive/sprint-100-hour/WFACT-3.0-Fast-Track-Plan.md`). Its checkboxes are not
restructured to fit the new plan. `docs/WFACT-3.0-Factory-Completion-Plan.md` (committed `4ecfe4a`,
revised `a913b0d`/`1ccae2b`) sits **on top of** the Continuation plan, not in place of it: it maps the remaining Blueprint
phases to numbered steps 1–24 and is the source for "Next up" below. Its Part E checklist tracks those
steps; this file tracks the Continuation Stages.

**Status summary**: Continuation Stages 1–5 are built and green in CI. On the Factory Completion Plan, Steps **1, 2, 3 and 3A are done**,
Step 4 is **partial** (its preview is superseded by Step 4B M6), **Step 4B is IN PROGRESS** (M0 6 of 7 inputs, M1, M2, M3 done; **M4 PARTIAL**
2026-10-02: built, verified locally and in CI `37016971442`; the live Track B build `f696ba43` failed on two factory contradictions,
fixed 2026-10-06 in `c64bd0e` (not yet re-run live); M5–M6 not started), and
**Step 6 is DONE** 2026-10-06 (enforced default-deny permissions, live attack verified; CI `37609559746` green). **Step 4C is built and deployed** (redeployed from `2d96962` by CI `37016971442`; live URL HTTP 200 at sync). The live database shows real
signed-in use on 2026-10-01: plan `b5a45a8e` approved as Track A (audited) and two Track A builds started from the Cockpit; both halted
on a CDN bug that is now fixed but not yet re-run live. A full room-by-room signed-in check is still Huraira's to confirm.
**Biggest open items**: push today's fixes and re-run Track A (`b5a45a8e`) and Track B (`4acbde1f`) live, Higgsfield credits and a
spending cap (M5), a different-vendor screenshot reviewer, Nick's real brief, a real Step 3A sign-up.

**Next up**:
1. **Huraira**: say "push" for `8dae180`…`4bbd4bc`; once CI is green and the runner has the fixes, start a fresh Track B build of plan
   `4acbde1f` (Harbor Street Bakery, now single-page) and a fresh Track A build of `b5a45a8e` from the Cockpit, and click through Home, a
   plan, a run and Settings (closes Step 4C's live check). M4 decisions were given 2026-10-06: Harbor Street is the synthetic Track B
   client, the Track B budgets stand, Motion/Radix stay out of the starter.
2. **Huraira**: add Higgsfield credits (the live Seedance run returned "Not enough credits"), rotate the key (it was posted in chat), put
   it in the GitHub secrets, and set a per-build and per-month spending cap; then GO for M5.
3. **Huraira**: the screenshot reviewer (deferred to after M6, 2026-10-06); Supabase Auth settings and one real sign-up for Step 3A; the
   old Doppler CLI token check.

**Gaps noticed**:
- **Stale path in the Continuation plan**: it names `packages/agent-runtime/registry.ts`; the file is `packages/agent-runtime/src/registry.ts`
  (the only dead path found in a link check of the 7 main docs this sync).
- **Two ways in to QA still differ**: `packages/verification`'s old `npm run verify` CLI runs only the original six checks; the M1 gate is
  in `npm run qa` (rendered-qa), the jobs runner and the workflow CLI.
- **QA link checker egress is open** (found in Step 6): it fetches any link on a built page, a possible SSRF on the job runner. Candidate
  for Step 7 or 21.
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
- **Linked `file:` packages need a decision.** There are 10 packages under `packages/` (`rendered-qa` added in M1), linked with a
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
- **Step 4C leftovers** (from its own evidence, `docs/step-4c/after/`): Projects on a phone shifts slightly while it loads (Lighthouse CLS
  0.118, target < 0.1); "Decide on launching …" items stay on Home and in Decisions until a Launch record exists (Human Control, Step 14),
  so today Northlight Signs and Summit Line show permanently; the `verify` job can only re-check single pages, not Track A sites (D4: Step 7);
  phone performance is 76–86 under Lighthouse's simulated slow 4G (desktop 100), mostly the Supabase + React bundle.
- **Security advisor, pre-existing**: `public.rls_auto_enable()` is callable by `anon` as SECURITY DEFINER; leaked-password protection is
  off in Supabase Auth. Both predate Step 4C and are not fixed by it.

**Unplanned work done**:
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
- **Knowledge graph** (`77680c7`): `graphify-out/` plus a `.gitleaks.toml` allowlisting only its cache
  file.
- **From the sprint era**:
  - Real usage and cost instrumentation in the `hermes` and `frontend-loop` model clients, now
    centralised under Stage 5.
  - The `Agent37ModelClient` adapter and the builder/evaluator vendor split.
  - The SOP PDFs.
  - The Cockpit dark-theme restyle (`a57d977`).

**Incidents & regressions**:
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

# 100-Hour Sprint (superseded 2026-09-28 — historical record)

Source: `docs/archive/sprint-100-hour/wfact-3.0-operator-manual.html`, sequenced per `docs/archive/sprint-100-hour/WFACT-3.0-Fast-Track-Plan.md`. Kept as
written at the sprint's close; later changes appear only as dated inline notes.

## Phase 1: Foundation & Access (Days 1–2 · 8 hrs)

- [x] Set up repo skeleton, law file, memory scaffold, `BLOCKED-ON-NICK.md` tracker
- [x] Base CI skeleton with zero-manual-step deploy — *closed 2026-09-28 under Continuation Stage 1*:
      `deploy-cockpit` in `.github/workflows/ci.yml`, first green on run `36436468792`. (At sprint
      close, no deploy automation existed and the Vercel deploy was a manual CLI call.)
- [x] Secrets manager wired, nothing in plaintext — *closed 2026-09-30 under Continuation Stage 1*:
      `.env.local` files deleted, grep criterion passes, everything runs from Doppler. See Stage 1.
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

Everything below is committed. `main` = `huraira-work`'s `4ecfe4a` (CI `36750897743`); `huraira-work` is 5 docs-only commits
ahead and unpushed (`4cba33b`…`1ccae2b`); other editors' archive-path fixes are uncommitted in the working tree. CI history on `main`:

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
| `36698432470` | `2223344` | success, all 11 jobs incl. deploy (account sign-up, rotated keys in CI) |
| `36699308136` | `856e483` | success, all 11 jobs incl. deploy (forgot-password flow) |
| `36699803027` | `856e483` | success (`Cockpit job`, Step 4 `intake` `1dd90f25`; not CI) |
| `36700769803` | `856e483` | success (`Cockpit job`, Step 4 `replan` `c62e24a4`; not CI) |
| `36750858892` | `79a0c67` | success (docs push) |
| `36750897743` | `4ecfe4a` | success (Factory Completion Plan added) |
| `36743601290` | `856e483` | success (`Cockpit job`, Step 4 `build_plan` `81c8607b` retry: built and QA-approved; not CI) |
| `36701102701` | `856e483` | workflow run succeeded, job **failed** (`Cockpit job`, Step 4 `build_plan` `31c965ff`, Agent 37 HTTP 402) |
| `36455639903` | `2e4a911` | success (`Cockpit job` workflow, `build_plan` `b952aaba`; not CI) |

All 10 migrations (`0001`–`0010`) are listed as applied on `mcaxxhgjptwowwrluhra`, checked via
`list_migrations`.

## Stage 1 — Close the Phase 0/1 debt (3 of 3 criteria MET as of 2026-09-30; CI path proven on `main`)

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
- [x] **Secrets manager — plaintext retired, MET 2026-09-30** (Factory Completion Plan Step 3; Huraira
      did the account actions, the agent verified).
      - Doppler workspace "WFACT 3.0", project `wfact-3-0-codebase`, configs `dev`/`prd`.
      - Both `.env.local` files are gone (`ls` errors, `find . -name ".env*"` finds only the tracked
        `.env.example` files, which hold 0 non-empty assignments).
      - The plan's grep criterion passes: the plan's grep for non-empty service-role and Anthropic key assignments (exact command in
        `docs/SECRETS.md`; run with the real `/usr/bin/grep`, excluding `node_modules`, `.git` and `SECRETS.md`)
        returns nothing (exit 1). This file is worded so it doesn't match its own pattern. A wider
        secret-shape scan hits only `packages/verification/test/fixtures/broken.html`, a deliberate fake key
        (`sk-ant-fakekey…`).
      - Runs from Doppler only: `doppler run -- npm run ask` wrote audit run `8baee338-88cf-4be5-8f46-5c2e33c17300`
        (3 `tool.invoke` + 1 `hermes.answer` rows, read back by SQL) with no env file present; the Cockpit
        builds from Doppler values (`index-DypAz2VC.js`, same hash as the live bundle), and the built bundle has
        no `service_role` string.
      - Rotated keys authenticate by HTTP status: Anthropic 200, OpenAI 200, Agent 37 200, Supabase service
        key 200 via REST, `VERCEL_TOKEN` resolves to `niktheplumberking`. Live Cockpit's baked anon key
        equals Doppler's and returns 200.
      - **Not independently proven:** (1) that each key actually changed (the old values weren't saved to
        compare; rotation is Huraira's report); (2) that the old Doppler CLI token is revoked (see
        Incidents); (3) ~~the CI path with the new keys~~ now PROVEN: `main` CI runs `36698432470` and `36699308136` passed the
        deploy job, which reads `VERCEL_TOKEN` from Doppler via the `DOPPLER_TOKEN` GitHub secret (still dated
        2026-09-28, i.e. never re-set, and it works); (4) the `dispatch-job`
        Edge Function's own `SUPABASE_SERVICE_ROLE_KEY` after rotation (an anon call still returns 401,
        but the service-key path needs a signed-in call).
      - Local hygiene: the two tracked `.env.example` files had also been deleted from disk and were
        recreated from `HEAD` (git status clean).

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
- [x] **Actions room checked in a browser with live data (2026-09-30)**: on the `dist-rho-lime-95` alias, signed in as
      the owner, a paste of the raw request created job `1dd90f25` and it was dispatched 8 s later (10:01:13,
      run `36699803027`, success). The room showed each job's true status with its real reason, including
      the failed build `31c965ff` ("builder escalated: … HTTP 402 …") and the approved-plan list. Two rough
      edges: it offers "Resume from last checkpoint" on a failed build that has no checkpoint, and reports
      "0 builder correction rounds" though the evaluator had requested one.

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
- [ ] Track A job `4d6e1abb` failed before building: "content still invalid after 3 attempts: openQuestions.0 over 300 chars". The plan
      carries 11 open questions, the content schema allowed 10 x 300, the builder merged two. Caps raised to 25 x 800 in both tracks (never
      shown as copy; Track A keeps them as escaped HTML comments), test added, frontend-loop 66/66. Re-run of Track A needed (Huraira).
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

## Step 6 — Enforce agent permissions (DONE 2026-10-06 — CI green 2026-10-07)

Governed by `docs/WFACT-3.0-Factory-Completion-Plan.md` Step 6 and Blueprint §3/§12/§16I. Built by a coding agent in a separate worktree
(Huraira approved the parallel lane 2026-10-06), merged into `huraira-work` and re-verified in the main checkout. Full write-up, capability
inventory and NOT COVERED list: `docs/AGENT-PERMISSIONS.md`.

- [x] Capability inventory, role x capability — `docs/AGENT-PERMISSIONS.md`
- [x] `permissionScope` is a typed, versioned (policy 1.0.0), default-deny allowlist (model slots, tables/ops, read/write paths, tools,
      max cost per run); the registry refuses a malformed scope — `58bf776`, `packages/agent-runtime/src/permissions.ts`
- [x] One enforcement point: `decide()` + the per-run `PermissionGate` from `runAgent`; model clients, artifact reads/writes, `plan_approvals`,
      the Track B build, the QA browser and reviewer, Hermes-lite tools and the verify job all go through it — `b8dbe95`, `a319a59`, `89e80be`,
      `a10c225`, `5c82f0b`
- [x] Entity isolation in code: `clients/<slug>/` paths must be the run's client; a client owned by another entity is refused before start
- [x] Every denial audited as `agent.deny` (role, capability, reason, task id), never retried by the runtime, never reported completed
- [x] Injection: client text is data; instruction-like text is flagged `agent.injection_suspected`; tests for "ignore previous", "email the
      API key", "write to another client's folder" — `planning/test/injection.test.ts`
- [x] Live attack run 2026-10-06 13:02 UTC through the real runtime and live `audit_log` (`npm run attack:permissions -- --real-model`, `128cd0a`):
      A1 `050c3329`, A2 `ed07cfaf`, A3 `cb7739a2`, A4 `7197fa12` all denied (1, 1, 1, 4 denials); A5 `9a692a2d` real models did not obey
- [x] Registry header and docs updated ("descriptive only" removed) — `ee08f9d`
- [x] CI on the merged tree: `8b05a46` pushed to both branches 2026-10-07, CI `37609559746` all 13 jobs success (incl. Cockpit deploy)
- [x] Per-run cost ceilings: Huraira delegated the choice 2026-10-07 ("reduce cost, keep quality high"). Set from live `model_traces`
      worst real run per role, with 5-18x headroom: builder $1 (worst $0.137), QA $0.50 ($0.066), Planner $0.25 ($0.041), Direction
      $0.15 ($0.025), Hermes-lite $0.10 ($0.016), Intake $0.05 ($0.003, Haiku). Worst case per full pipeline drops from $10 to $2.05.

**Verification** (independent of the building agent)
- [x] Merged tree, main checkout: typecheck clean and tests pass in all packages — audit 14, agent-runtime 39, hermes 43, planning 32,
      verification 44, workflow 24, jobs 17, frontend-loop 64, media 8, rendered-qa 40 (real Chromium)
- [x] Supabase SQL, run separately from the attack script: 26 audit rows from the attack runs, 7 `agent.deny` all with a task id, all for
      `dreamsign`, no row forged for `bennett-co`
- [x] Code read of `decide()`: no scope, wrong policy version or unknown capability kind all deny; paths normalised before matching

**NOT COVERED** (stated plainly): network egress outside the Track B build sandbox (the QA link checker can fetch any URL: possible SSRF on
the runner); one service-role key per runner (the gate is an in-process boundary, not a credential boundary); local CLIs (workflow CLI's
correction-log append, rendered-QA CLI, Hermes-lite CLI) are not gated; the screenshot reviewer's and unpriced Agent 37 calls don't count
toward the cost ceiling (it can be exceeded by one call); Hermes-lite retries a denied model call up to 3 times (up to 3 `agent.deny` rows).

**Exit check**: *"Default-deny works; each role can do exactly its scope, proven by tests and a live attack run. Cross-entity access and the
injection cases are denied and audited. Existing suites pass unchanged (or minimal, justified changes listed)."* — **MET**. Justified
changes: `runAgent.test.ts` echo role uses a typed scope; one `trackA.test.ts` test supplies the role's gate; `verification.decision` rows
inside an agent run now carry the run's entity in `entity_slug` (client slug moved to the payload). CI green: `37609559746`.

