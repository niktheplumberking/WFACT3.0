# Blocked on Nick

Live tracker, consolidated from `docs/wfact-3.0-nick-requirements.html`. Per the Operator's Manual's
own rule: fire off every access request on Day 0, don't sit idle waiting — keep this list visible
instead of quietly absorbing the delay. Update the Status column as items close; don't delete resolved
rows, mark them done so there's a record of when they closed.

## Access & credentials (blocks Phase 1 / Phase 4)

| Item | Needed by | Status |
|---|---|---|
| GitHub access (existing WFact2.0 repo + new 3.0 repo/org) | Day 1 — blocking | **OPEN** |
| Supabase access (current 2.0 project, to design schema against the real one) | Day 1 — blocking | **OPEN** — working around it with a fresh sandbox project (`wfact-3-sandbox`, ref `xwljilyjirmcryakbirk`, under Huraira's own Designtive org, $0/mo) so Phase 2 could proceed and be attack-tested for real; still needed to sanity-check the new schema against what 2.0 actually shipped, not just the docs' description of it |
| Vercel + Hostinger access | Day 1 — blocking | **OPEN** |
| The 3 SOPs + Operations Manual (Google Drive) | Day 1 — blocking | **OPEN** |
| Motion Sites MCP credentials | Day 9 | **OPEN** |
| 21st.dev premium account credentials | Day 9 | **OPEN** |
| Higgsfield MCP credentials | Day 9 | **OPEN** |
| Claude / Anthropic API billing confirmation (existing WFACT billing, or standing one up) | Day 1 — blocking | **OPEN** |

## Decisions (only Nick can make these)

| Item | Blocks | Status |
|---|---|---|
| Which 2 entities (DreamSign + Bennett & Co, Rizm separate?) | Phase 2 schema | **OPEN** — using placeholder in `memory/context.md` §2 per fallback |
| Fresh repo vs. carrying 2.0's structure forward | Phase 1 | **PROCEEDING** as fresh repo per Ecosystem Blueprint §15 recommendation; needs Nick's explicit sign-off |
| Confirm the governance split (table in `CLAUDE.md` §3) | Day 1 | **OPEN** |

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
| 10–15 min looking at the cockpit MVP | Day 16–18 | not yet due |
| Attend the proof-run review | Day 19–20 | not yet due |

## The one that matters most

**Comp and scope, closed in writing.** Every document in this process (Roadmap §2 and §7 especially)
flags this as a Phase 0 dependency, not a side conversation for later. Every architecture and build-
sequencing call in this repo is provisional until this closes.

---

*This file exists so the sprint doesn't quietly wait on things it can't control. Where a fallback
exists (Operator's Manual), we use it and note that below in `PROGRESS.md` rather than blocking.*
