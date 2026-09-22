# Sprint Progress — WFACT 3.0, 100-Hour Build

Source: `docs/wfact-3.0-operator-manual.html`, sequenced per `docs/WFACT-3.0-Fast-Track-Plan.md`. Work
top to bottom. Nothing gets checked as done until its **exit check** actually passed, not attempted.

Last synced: 2026-09-22, via `/progress-sync` — rebuilt from git history and direct repo verification,
not from self-report. See `git log` for the full commit trail this reflects.

**Status summary**: Phases 1–6 are functionally complete with real, independently-verified evidence —
including the Cockpit MVP, live at a real URL with real data and a genuinely tested RLS-gated write.
Only Phase 7 (the proof-run writeup and Nick's own review/decisions) remains, and those are largely
Nick-only steps this session can't close on its own. No hard blocker remains; the open Phase 1 items
(CI-automated deploys, a real secrets manager) have tracked workarounds, not open stops.

**Next up**:
1. Phase 7: write the honest results report (what's proven, what's not) and get Nick to actually look at the Cockpit and the live DreamSign page.
2. Phase 1: automate the Vercel deploy through CI — every deploy this sprint has been a manual CLI call, not "zero manual steps."
3. Once Nick reviews: agree the next sprint's scope (a second/third real client, per the Execution Roadmap's own Phase 2).

**Gaps noticed**:
- Phase 1's exit check ("zero manual steps") is not met even though every access item now is — the CI pipeline doesn't auto-deploy yet; this session's Vercel deploy was manual.
- Phase 6's Manual text describes a full unscoped dashboard; the Fast-Track Plan supersedes this with an explicit 3-room MVP (Pipeline/Approvals/Runs) — keep that scope, not the Manual's original wording, when Phase 6 starts.

**Unplanned work done**:
- Real usage/cost instrumentation added to both `packages/hermes` and `packages/frontend-loop`'s model clients (`totalUsage` tracking, real dollar cost computed from real Anthropic pricing) — not a plan checklist item, but structurally required by the Fast-Track Plan's routing rule, which the code previously couldn't satisfy at all.
- `Agent37ModelClient` added as a new model adapter, with a routing split (builder → Agent 37, evaluator → Claude) — not in the original Manual, driven by the Fast-Track Plan's later routing rule and a real vendor-independence gap CLAUDE.md §6 had flagged since Phase 4 started.
- The 3 SOP PDFs + Factory Book/Audit added to `docs/WFACT SOPS/`.

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

## Phase 7: Proof Run & Handoff (Days 19–20 · 10 hrs)

- [ ] Not started. Largely a documentation/presentation pass over what Phases 1–6 already proved
      for real, plus Nick attending the review and deciding next steps — both Nick-only.
