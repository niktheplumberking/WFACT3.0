# WFACT 3.0 — Agency Scope Addendum (DRAFT)

**Status**: DRAFT for Huraira's review, written 2026-10-07. Not approved, not governing. Listed in `docs/INDEX.md` as a proposal (2026-10-07 alignment pass); open decisions are consolidated in `docs/HANDOFF.md` section 6.
Nothing in the Factory Completion Plan changes until Huraira (sequencing) and Nick (scope, money) approve it.

**Update 2026-10-07 (Nick's reply)**: Nick answered yes to both agency-pipeline questions (niche research and offer design; the
lead-gen content engine, which he says runs after delivery once the client agrees to marketing use). He also clarified that
"static" meant visually flat, not technically static: lead forms stay as they are, but every site, local business included, should
be motion-rich with 21st.dev components and still conversion-focused, and e-commerce clients (e.g. Shopify) need something different
from a local-business site. So **section 2 (dynamic tiers D0–D4) misread the request and is superseded**; sections 1, 3 (N4–N6) and 5
still stand. A revised direction is pending Huraira's confirmation.

**Update 2026-10-07 (Huraira)**: section 4's reorder is decided differently: the approved order is the "Execution order" table in the Factory Completion Plan (D2 approved: Steps 12 and 20 join Step 8 after the real-client run). D1 is decided (two tracks, Track A motion budget, conversion hard gate, e-commerce deferred). The agency pipeline and content engine are IN but sequenced after the first paid delivery (Plan Part F). Sections 2, 4 and 5 are historical; do not plan from them.

**Why this exists**: Nick shared that the original factory idea came from
[deanwhitex/AIW2.0STACK](https://github.com/deanwhitex/AIW2.0STACK). That stack reaches a one-shot local-business site, but the
site content is almost static. WFACT 3.0 is meant to scale that up and to cover everything an AI web agency needs, not only a
site builder. A comparison on 2026-10-07 found that our plans cover the factory core and the client surface, but never decided
how dynamic a delivered site should be, and never scoped the agency pipeline around the site builder.

**Limits of this draft**: the AIW2.0STACK repo holds the onboarding layer and the content engine; the website-factory shell is
not in it, so how static its output is rests on Nick's description, not on code I read. The step order below is a proposal.

---

## 1. What the source stack does, and where we stand

AIW2.0STACK is a student onboarding pipeline (16 agents, about 20 commands, hard gates between modules). The deliverable sold
to clients is the website. The content engine is the agency's own lead generator and is never shown to a client.

| AIW stage | What it does | WFACT 3.0 today | Status |
|---|---|---|---|
| Setup and credentials (`/setup`, `/setup-agency`) | Collects keys; stores agency profile (founder, reviews, pricing, palette) used in every proposal | Secrets manager (Step 3 done); `clients/<name>/memory.md`; entity law | Covered in spirit; no agency-profile object |
| Discovery interview | Self-interview to find what the agency is good at | Cockpit intake for a client, not for the agency | Not covered; likely N/A for an internal team |
| Niche scoring and research (Apify) | Scores candidate niches, deep research on finalists | 4B direction step detects the client's niche only | **Missing** |
| Offer architect | Productized offer and cold-DM copy | Nothing | **Missing — scope decision** |
| Website factory brief and tailoring | Brief compiled from research, factory tailored to the niche | Intake → plan → brief → build (Steps 1–4B); two tracks | Covered, stronger |
| Per-niche template builder | Captures best-of-niche sites, scores them, scaffolds a niche template | Two fixed starters (Track A, Track B) | Partial: no per-niche templates |
| Content engine | Ingests content, finds niche ideas (radar), generates scripts, posts for the agency's own lead-gen | Nothing; Cockpit "Content" room is carried over from 2.0 | **Missing — scope decision** |
| Factory feedback and template refinement | Captures what worked, applies lessons to the niche template | Lessons ledger (proposals only, human approves) | Partial: ledger exists, no write-back to starters |
| Gated, human-approved publishing | Nothing publishes without approval | Launch and Money hard gates | Covered, stronger |

What we add beyond AIW already: independent verification and the check registry, security gates, cost traces, permissions,
durable memory, the Cockpit.

## 2. The dynamic-site gap

Both tracks currently emit plain static files with content baked in at build time. Static output is a deliberate 4B choice
(`docs/FRONTEND-UPGRADE-DESIGN.md`), not a rule of the Blueprint. Dynamic capability is named in the Blueprint only as the Owner's
Key, closing reports and care plans (Phase 10, our Step 23, last in the plan).

Proposed capability tiers. Each tier adds something a client would pay for, and each must pass the same registry checks and
attack tests before it ships.

| Tier | Capability | Examples | Needs |
|---|---|---|---|
| D0 | Static (today) | Multi-page conversion site | Done |
| D1 | Captured leads | Quote/booking/contact forms that store a lead and notify the client; spam and abuse limits | Back-end agent, per-client Supabase table with RLS, email notify, attack tests |
| D2 | Client-editable content | Owner's Key edits text, photos, hours, services, blog posts; edit triggers a rebuild | Owner's Key port, content-as-data (already shared by both tracks), rebuild-on-edit job, upload gates |
| D3 | Live data | Reviews feed, availability/booking widget, service-area or pricing tables, Google Business sync | Integrations with watched, allow-listed external services; cached at build or fetched client-side |
| D4 | Reporting loop | Monthly closing report and care-plan status from real analytics and uptime data | Monitoring agent, report workflow (Blueprint Phase 10) |

**Hosting constraint to resolve first**: hosting law says live sites go on Hostinger, previews on Vercel. A static export runs on
Hostinger as is. D1 and D3 need a back end that is not the host, so the likely shape is: site stays static, a small set of runtime
calls goes to a WFACT-owned Supabase edge function per client, and D2 works by rebuilding and redeploying the static files.
This keeps the hosting law intact but must be confirmed (decision 3).

## 3. Proposed new steps

IDs avoid collisions with Steps 1–24. All are proposals; sizes are not estimated.

| ID | Step | Output | Depends on |
|---|---|---|---|
| N1 | Dynamic-site architecture note | One page deciding runtime shape (host vs edge function vs rebuild-on-edit), tenant isolation, abuse limits; approved by Huraira | Decision 3 |
| N2 | D1 captured leads | Form back end on both tracks, per-client leads table with RLS, notification, attack-tested | N1, Step 20, Step 8 |
| N3 | D2 Owner's Key and rebuild-on-edit | Owner's Key ported (replaces Step 23 first half), edit → rebuild → verified redeploy, isolation and upload attacks re-run | N1, N2 |
| N4 | Niche research and offer agents | Niche scoring, research (cost-capped external data), offer pack, per-niche brief inputs for the direction step | Step 12, Step 13 (Research), scope decision |
| N5 | Per-niche template capture and feedback write-back | Capture best-of-niche sites, score, scaffold niche starters beyond A and B; lessons applied back to starters after approval | N4, Step 7 |
| N6 | Lead-gen content engine (optional) | Agency-side idea radar and script generation for the agency's own channels | Nick decides yes or no; Steps 12, 13 |
| N7 | D3 live data integrations | Reviews feed and booking widget first, each allow-listed and schema-validated | N2, N3 |
| N8 | D4 closing reports and care plans | Monthly report from real data (Step 23 second half) | Monitoring agent, N3 |

## 4. Proposed order for what remains

Unchanged and first: **Step 4B M4 close** (Huraira re-runs Track A `b5a45a8e` and Track B `4acbde1f` once CI is green), then M5
(blocked on Higgsfield credit) and M6. Steps 1–3A, 5, 6, 7 stay DONE.

| New order | Item | Change from current plan | Reason |
|---|---|---|---|
| 1 | Step 4B M4–M6 | none | Almost done; proves both tracks |
| 2 | Step 20 Vercel serverless ceiling | **Pulled up from P2** | N2 and N3 add endpoints; the 12-function limit already caused one silent outage |
| 3 | Step 8 task/event queue | none | Rebuild-on-edit, lead notifications and research runs all need restart-safe jobs |
| 4 | Step 12 cost governance per client | **Pulled up from P2** | N4 and N6 call paid external data and models; ceilings must exist before those agents run |
| 5 | N1 architecture note | new | Decides runtime shape before any dynamic code |
| 6 | N2 D1 captured leads | new | Smallest dynamic step with clear client value |
| 7 | N3 D2 Owner's Key | **Pulled up from Step 23** | The direct answer to static content; Blueprint rates it KEEP and High |
| 8 | Step 13 agents: Research, Back-end, Content/SEO first; Monitoring, Deploy, Recovery, Lessons, Memory later | **Split** | N2–N4 need the first three; the rest follow |
| 9 | N4 niche research and offer agents | new | Only after scope decision |
| 10 | Step 9 "is everything OK" and Step 10 Agents room | none | Needed once more agents run |
| 11 | Step 11 second model and routing | none | Cost and quality log feeds N4 |
| 12 | N5 per-niche templates and feedback write-back | new | Needs N4 output and the lessons ledger |
| 13 | N7 live data integrations | new | After D1 and D2 are proven |
| 14 | Steps 14, 15, 16, 17 | none | Memory/Human Control rooms, Cognee write-up, tool tracing, alerts |
| 15 | N8 closing reports and care plans | **Pulled out of Step 23** | Needs monitoring data |
| 16 | Step 18 three-concurrent-clients test | none, but now includes a D1/D2 client | Proves goal 2 with dynamic sites |
| 17 | Step 19 disaster-recovery drill, Step 21 housekeeping | none | Housekeeping must also fix `CLAUDE.md` §0 and `docs/INDEX.md` for this addendum |
| 18 | N6 content engine | optional, per Nick | Do not start without a yes |
| 19 | Step 22 Nick's items, Step 24 autonomy | none | Depend on real inputs and measured data |

Step 23 becomes: "Product features beyond N3 and N8", to be re-scoped after N3.

Hard gates do not move: Launch, Money and external sends stay human-gated. Every new agent gets a bounded scope under the
Step 6 permission model, and no D1–D4 feature is marked done until a separate check or attack script passes.

## 5. Decisions needed

| # | Decision | Owner |
|---|---|---|
| 1 | Is the agency pipeline (niche research, offer design) in scope for WFACT 3.0, or does Nick handle that by hand? | Nick |
| 2 | Is a lead-gen content engine in scope? AIW treats it as the agency's own tool, never a client deliverable. | Nick |
| 3 | Dynamic runtime shape: static site plus per-client edge functions plus rebuild-on-edit, or something else, within the Hostinger/Vercel law | Huraira |
| 4 | Which dynamic tiers are required for the first paying client: D1 only, D1+D2, or more | Nick (scope), Huraira (sequence) |
| 5 | Ask Nick for the website-factory shell and what "mostly static" means in practice, so we can compare real output | Huraira |
| 6 | Approve the reorder in section 4, or keep the current Step 8–24 order | Huraira |

## 6. If approved, edits to make

1. Add N1–N8 to `docs/WFACT-3.0-Factory-Completion-Plan.md` (Part B table, Part D prompts, Part E checklist) and renumber the
   "Next up" list in `PROGRESS.md`, using `/step-close` so `node scripts/check-trackers.mjs` stays green.
2. Move Owner's Key, closing reports and care plans out of Step 23 in the Plan and note the change in the Blueprint's Phase 10.
3. Add this file to `docs/INDEX.md` and fix `CLAUDE.md` §0.
4. Record the scope decisions in `BLOCKED-ON-NICK.md` where Nick owns them.
