# Blocked on Nick

Live tracker, consolidated from `docs/wfact-3.0-nick-requirements.html`. Per the Operator's Manual's
own rule: fire off every access request on Day 0, don't sit idle waiting — keep this list visible
instead of quietly absorbing the delay. Update the Status column as items close; don't delete resolved
rows, mark them done so there's a record of when they closed.

## Access & credentials (blocks Phase 1 / Phase 4)

| Item | Needed by | Status |
|---|---|---|
| GitHub access (existing WFact2.0 repo + new 3.0 repo/org) | Day 1 — blocking | **CLOSED 2026-09-21** — verified: `origin` remote is `https://github.com/niktheplumberking/WFACT3.0.git`, a dedicated 3.0 repo separate from 2.0; `gh auth status` confirms an authenticated session (AbuHuraira2129, `repo` scope). |
| Supabase access (current 2.0 project, to design schema against the real one) | Day 1 — blocking | **CLOSED 2026-09-21.** `mcaxxhgjptwowwrluhra` (`WFACT 3.0 Project`, org `xwdydbzmucvupwmqdhwg`) is now canonical. Connector reconnected under the right account, migrations `0001`–`0005` applied fresh via `apply_migration` (all succeeded), and the RLS attack test re-run for real via `execute_sql` — full PASS, identical to the original `wfact-3-sandbox` run (see `packages/db/RLS_ATTACK_TEST_RESULTS.md` Run 2). Synthetic test data cleaned up afterward; all 7 tables confirmed back to 0 rows. New carry-forward item found: `get_advisors` flags a Supabase-platform function `rls_auto_enable()`, not part of this schema, logged in the results file — does not block this phase. |
| Vercel access | Day 1 — blocking | **CLOSED 2026-09-22** — verified: `vercel` CLI is installed and authenticated in this exact environment (`vercel whoami` → `niktheplumberking`, matching the GitHub org). |
| Hostinger access | Day 1 — blocking | **DESCOPED for this sprint, per Huraira 2026-09-22** — not needed right now. Flagging a real tension this creates, not blocking on it: the hosting law (`CLAUDE.md` §5, "Hostinger for live sites, Vercel for previews only") and Step 5's exit check ("a site is actually live") both assume Hostinger exists by the time of the proof run. Worth deciding before Step 5 whether that still holds, or whether the proof run's "live" bar changes for this sprint. |
| Higgsfield MCP credentials | Day 9 | **DESCOPED for this sprint, per Huraira 2026-09-22** — not needed right now. No tension flagged: nothing in Steps 1–5 of the Fast-Track Plan requires imagery/video generation. |
| The 3 SOPs + Operations Manual (Google Drive) | Day 1 — blocking | **CLOSED 2026-09-22** — verified: `docs/WFACT SOPS/` now holds all 3 SOP PDFs (`WFact SOP 1 — Sales & Onboarding`, `SOP 2 — Production Pipeline`, `SOP 3 — Post-Launch, Automation & Team Operations`), plus `WFACT-Factory-Book.pdf` and `WFact Factory Audit.pdf`, plus markdown versions of each SOP under `Claude outputs/`. The Operations Manual (`docs/wfact-3.0-operator-manual.html`) was already present from Phase 1. |
| Motion Sites MCP credentials | Day 9 | **CLOSED 2026-09-21** — verified: `claude mcp list` shows `Motionsites AI: https://xgdzyqfalbibzelpdpvr.supabase.co/functions/v1/mcp — ✔ Connected` (the exact OAuth endpoint from motionsites.ai/mcp's own setup docs), and this session can actually call its tools (`search_prompts`, `list_prompts`, `get_prompt`, `get_related_prompts`). |
| 21st.dev premium account credentials | Day 9 | **CLOSED 2026-09-21** — a real key (`21st_sk_...`) was provided and written to `.env.local` under both `TWENTYFIRST_DEV_TOKEN` and `API_KEY_21ST` (21st.dev's own docs name it `API_KEY_21ST` for CI/script use; neither name is read by any code yet — `packages/frontend-loop` still needs to be wired to actually use one, see Phase 4 in `PROGRESS.md`). Key itself not yet call-tested against 21st.dev's API from this environment. |
| Claude / Anthropic API billing confirmation (existing WFACT billing, or standing one up) | Day 1 — blocking | **CLOSED 2026-09-21** — a real `ANTHROPIC_API_KEY` is now in `.env.local`. Not yet exercised by an actual live call (Phase 3's smoke test is blocked behind the Supabase schema row below, so the key's validity itself is still unconfirmed by a real request — first real call should be the Phase 3 smoke test itself, not a throwaway check, to avoid spending budget twice). |
| OpenAI API key | Day 1-ish (bake-off) | **CLOSED 2026-09-21** — a real `OPENAI_API_KEY` is now in `.env.local`. Same caveat as above: not yet exercised by an actual call. Per the routing rule, this only gets used when a step genuinely needs it over Agent 37's free tier — the bake-off itself needs an OpenAI balance top-up per the Fast-Track Plan §3, unconfirmed whether that's done. |
| `SUPABASE_SERVICE_ROLE_KEY` for `wfact-3-sandbox` | Day 6 — blocking Phase 3's live smoke test | **CLOSED 2026-09-22 — decision made, project not switched.** Huraira sent a real service-role JWT for `wfact-3-sandbox` (decoded and confirmed genuine: `ref: xwljilyjirmcryakbirk`, `role: service_role`). Asked whether to switch canonical projects; decision: **keep `mcaxxhgjptwowwrluhra` as canonical** — it already has Phase 2's migrations and a passing RLS re-test. The `wfact-3-sandbox` key is on file (this row) but not written to `.env.local` and not in active use. |
| **"Agent 37"** — a self-hosted "Hermes Agent" gateway by Nous Research (a local dashboard, `~/.hermes/.env`, OpenAI-compatible API on port 8642), tunneled to a public URL. | Fast-Track Step 1 onward | **CLOSED 2026-09-22.** Connectivity + completions genuinely working, verified from this environment (`"pong"`, `finish_reason: "stop"`). Routing decision made (Huraira): Hermes-lite (`packages/hermes`) keeps calling Claude/OpenAI directly, per the routing rule's own "when a step genuinely needs it" clause — it must answer strictly from the memory/state context `controller.ts` provides, and Agent 37's `hermes-agent` model carries ~19,800 prompt tokens of its own bundled agent context per call (toolset/skills/memory), not a raw completion, which is the wrong fit for that specific job. Agent 37 is the default everywhere else (Phase 4 front-end loop, Phase 5 evaluator). |

## Decisions (only Nick can make these)

| Item | Blocks | Status |
|---|---|---|
| Which 2 entities (DreamSign + Bennett & Co, Rizm separate?) | Phase 2 schema | **OPEN** — using placeholder in `memory/context.md` §2 per fallback |
| Fresh repo vs. carrying 2.0's structure forward | Phase 1 | **PROCEEDING** as fresh repo per Ecosystem Blueprint §15 recommendation; needs Nick's explicit sign-off |
| Confirm the governance split (table in `CLAUDE.md` §3) | Day 1 | **OPEN** |
| Phase 3 used the Operator's Manual's own named fallback — "Hermes-lite" (`packages/hermes/`) instead of self-hosting the real Hermes Agent, because the infra/budget item above is still open at Day 6 | Nothing blocked — the Manual pre-authorizes this fallback | **TELL NICK, DON'T JUST LOG IT** — the Manual says "tell Nick if you do this, don't substitute silently." Not yet actually communicated to Nick; this row is that disclosure in writing, real conversation still owed. |
| Hostinger descoped for this sprint (2026-09-22, Huraira's call) breaks Step 5's exit check as written ("a site is actually live" assumes Hostinger, per the hosting law in `CLAUDE.md` §5) | Blocks Step 5's proof run unless substituted | **SUBSTITUTED, TELL NICK, DON'T JUST LOG IT** — for this sprint's proof run only, "live" means deployed and reachable at a real URL; a Vercel deployment stands in for Hostinger. Same disclosure pattern as the Hermes-lite row above: logged here in writing, real conversation with Nick still owed before Step 5 closes on this basis. The hosting law itself (Hostinger for live sites, long-term) is not changed — this is a sprint-scoped substitution only, not a standing decision. |

## Carry-forward for the real project (not blocking this sprint)

| Item | Notes |
|---|---|
| Enable "leaked password protection" in Supabase Auth settings | Flagged by `get_advisors` on the sandbox; a project-level Auth toggle (dashboard, not SQL), not a schema issue. Apply when the real production Supabase project is configured. |

## Budget & spend approval

| Item | Needed by | Status |
|---|---|---|
| API spend ceiling for the sprint (Claude, Kimi K3, GPT-5.6 calls) | Day 1 — blocking | **OPEN** |
| Vercel plan upgrade (fixes the 12-function serverless ceiling) | Day 16 | **OPEN** |
| Where the self-hosted second brain + Hermes run (infra, budget) | Day 3 | **OPEN** |

## Nick's time

| Item | When | Status |
|---|---|---|
| 30–60 min session on business rules (pricing bands, entity specifics, standing rules) | Day 3–5 | **OPEN** |
| One real pilot project brief | Day 9 | **OPEN** |
| Same-day answers during the front-end build | Day 9–12 | not yet due |
| 10–15 min looking at the cockpit MVP | Day 16–18 | **READY 2026-09-22** — live at `https://wfact-cockpit-niktheplumberkings-projects.vercel.app`, sign in with `abuhuraira2129@gmail.com` via magic link. Shows the real DreamSign pilot project and its 2 real correction rounds. |
| Attend the proof-run review | Day 19–20 | not yet due |

## The one that matters most

**Comp and scope, closed in writing.** Every document in this process (Roadmap §2 and §7 especially)
flags this as a Phase 0 dependency, not a side conversation for later. Every architecture and build-
sequencing call in this repo is provisional until this closes.

---

*This file exists so the sprint doesn't quietly wait on things it can't control. Where a fallback
exists (Operator's Manual), we use it and note that below in `PROGRESS.md` rather than blocking.*
