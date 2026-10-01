# Step 4C, Phase 1: Cockpit audit, information architecture and design system

**Status**: proposal, waiting for Huraira's GO. No Cockpit code was changed.
**Date**: 2026-10-01. **Branch**: `huraira-work`.
**Huraira's answers this session**: future rooms appear as honest "Coming in Step N" entries; the current look is
**replaced** with a new visual world; phone and laptop are **both** primary.

Files in this folder:

| Path | What it is |
|---|---|
| `before/*.png`, `before/audit.json` | The current Cockpit, every room plus login and pending screens, at 1440 and 375 px, with axe results |
| `mockups/*.html`, `mockups/cockpit.css` | 5 proposal screens (Home, Plan decision, Failed run, New request, Design system), dark and light |
| `mockups/shots/*.png` | The mockups at 1440 (dark and light) and 375 (first screen and full page) |
| `../../PRODUCT.md` | Product record for the design work (users, purpose, constraints), written from repo facts and your answers |

**How the "before" screenshots were made.** I can't sign in to the real Cockpit, because typing a password into a
sign-in that goes to Supabase is off-limits for me. So the **unchanged** Cockpit code ran locally behind a scratchpad
harness that replaced `supabaseClient` with a stub serving rows copied read-only from the live database on
2026-10-01 (1 project, 9 jobs, 5 plans, 2 correction rounds, 7 usage rows, 25 traces). One account request is
**synthetic** and labelled "(synthetic)", because no real request exists. Nothing in the repo was changed for this.
One harness artefact to ignore: in "Plan 825cfff6 () is waiting" the template name is missing because I dropped the
bulky `plan` field from job results in the query. That is not a Cockpit bug.

---

## 1. Capability inventory

Who: **O** owner, **A** admin, **P** pm. Access follows RLS: jobs, plans, artifacts and the stage update are owner or
admin only; models and cost are owner only; account approval is owner (an admin may approve `pm` only); PMs can read
only their assigned clients' projects.

### 1a. Rooms and actions that exist today

| # | Capability | Who | Where it lives today | Where it should live |
|---|---|---|---|---|
| 1 | See every project, its client, entity, stage, status | O A P | Pipeline room (table, raw slug `6_full_build_owners_key`) | **Projects** list with a route line per project; summary on **Home** |
| 2 | Move a project to its next stage | O A | Approvals, "Stage gates": one click, no confirmation, raw slugs | **Project page**, "Move to QA" with a confirm dialog (see decision D3 on the Launch stage) |
| 3 | Approve or reject a plan, choose Track A or B | O A | Approvals, plan card (long, everything expanded) | **Decisions → plan page**: what the client wants on the left, a sticky decision panel on the right |
| 4 | Approve or reject an account request, pick role | O, A (pm only) | Approvals, top section | **Decisions → Accounts**; history under **Settings → Team** |
| 5 | Start intake + plan from a pasted request | O A | Actions, first card | **New request** (top-bar button on every screen, and on Home) |
| 6 | Build an approved Track A plan | O A | Actions, "Plans ready for the next step" | **Plan page / Project page** "Start build"; also a Home "waiting for you" item |
| 7 | Re-plan a rejected plan from the note | O A | Actions, same list | **Plan page** of the rejected plan, "Re-plan from my note" |
| 8 | Resume a failed build from its last checkpoint | O A | Actions, button on a failed job card | **Run page**, next to the plain-language reason |
| 9 | Start a job that never reached GitHub | O A | Actions, "Start" on a queued job | **Run page**; stale ones surface on Home as "needs tidying" |
| 10 | Ask Hermes a question | O A | Actions card | **"Ask the factory"** box in the top bar (phone: More) |
| 11 | Re-check a single built page (path + goal) | O A | Actions, raw path typed by hand | **New request page → "Re-check a built page"** with a page picker |
| 12 | Preview a built page safely (sandboxed) | O A | Inside a build job result | **Run page** and **Project page** |
| 13 | Job list, status, GitHub run log link | O A | Actions, "Jobs" (all 25 cards expanded) | **Activity** (list) → **Run page** (one job) |
| 14 | Correction rounds log | O A P | Runs room | **Activity → Fix rounds**, and per project on its page |
| 15 | Model usage, cost, latency, latest calls | O | Models room (non-owners see a notice) | **Costs**, owner only, hidden from the nav for other roles |
| 16 | Sign in, sign up, magic link, forgot password, set new password, "waiting for approval" | everyone | Login screens | Same flows, restyled; no logic change |
| 17 | Sign out | everyone | Top-right button showing the email | **Account menu** (rail foot on desktop, More on phone) |
| 18 | Counts strip (projects, active, correction rounds) on every room | everyone | Every room | **Removed**; Home's status line replaces it |

### 1b. Job kinds in `packages/jobs`

All six (`intake`, `replan`, `build_plan`, `resume`, `verify`, `ask`) already have a Cockpit entry point (rows 5 to 11).
Two gaps found while reading `handlers.ts`:
- `verify` accepts only `clients/<slug>/pages/<name>.html`. A Track A **site** (`clients/<slug>/sites/...`) can't be
  re-checked from the Cockpit. Fixing it means changing `packages/jobs`, which is outside 4C (decision D4).
- A build result carries every fix round (`builderRounds` with the reviewer's issues) and every check's `details`.
  The Cockpit shows neither today; the Run page should (4C can do that, the data is already there).

### 1c. CLI commands with no Cockpit equivalent

| Command | Package | Proposal | Reason |
|---|---|---|---|
| `npm run qa` (full rendered suite on a page: screenshots, axe, Lighthouse, screenshot review) | rendered-qa | **CLI-only for now** (decision D4) | Build jobs already run this gate; adding it as its own Cockpit action needs a new job kind in `packages/jobs` |
| `npm run eval-direction` | planning | **CLI-only** | Developer evaluation on synthetic cases; spends model money; no founder use |
| `npm run fixtures` | rendered-qa | **CLI-only** | Test fixture generator |
| `npm run build-and-verify -- <brief.json>` / `--track` (build without an approved plan) | workflow | **Deliberately excluded** | The Cockpit only builds from an owner-approved plan; a brief-only build would skip the plan gate |
| `npm run verify` (old six-check CLI) | verification | **CLI-only, candidate to retire** | Superseded by the `verify` job and the rendered gate |
| `npm run build-page` (Phase 4 smoke test) | frontend-loop | **CLI-only, candidate to retire** | Superseded by `build_plan` |
| `npm run verify:supabase` | hermes | **CLI-only** | Connectivity check; the Step 9 System room will show database health properly |
| `npm run ask`, `npm run intake`, `--replan`, `--resume` | hermes, planning, workflow | Already covered | Same library code as the job kinds |
| `npm run run-job` | jobs | Not a user action | It is the GitHub Actions worker itself |
| `scripts/rls_attack_test*.sql`, tests, typecheck | repo | **CLI/CI-only** | Security and build verification |

### 1d. Things only possible in SQL today (no CLI, no Cockpit)

| Capability | Who | Proposal |
|---|---|---|
| Register a client or entity, create a project | O A | **Projects → Add client** is possible in 4C: RLS already lets owner/admin insert `clients`/`projects`. Decision D5 |
| Change someone's role, remove access, assign a PM to clients (`profile_clients`) | O | **Settings → Team**. RLS allows owner writes, but this is access control; decision D6 |
| Close an orphaned `queued` job (you asked about `a2a41d2d`, `cbf8bf7b`) | O A | Needs a "cancelled" status in the `jobs` trigger (a migration). Decision D7 |
| Read the audit log | O | Drill-down from any run to its audit rows: **Step 16**. Not in 4C |
| Launch to production, move money | Nick | **Deliberately excluded, forever** (CLAUDE.md §3). The Cockpit shows "ready for your launch decision" and never deploys |

### 1e. Rooms planned by later steps, and where they slot in

| Step | Room | Slot in the new IA |
|---|---|---|
| 9 | "Is everything OK" + System (health, queue depth, error rate, backups) | Home's status line gains health; **System** nav entry (shown now as "Coming, Step 9") |
| 10 | Agents room; Workflows drill-down (failed check, trace) | **Agents** nav entry; Run page gains the trace link and per-check drill-down |
| 12 | Cost per client, budget ceilings | **Costs → By client** tab |
| 14 | Memory room; Human Control (escalations, blocked tasks, intervention history) | **Memory** nav entry; Human Control becomes tabs inside **Decisions** (Escalations, Blocked, History) rather than a separate room |
| 17 | Alerts (push/Telegram), role-based views | **Settings → Alerts**; the nav filters itself by role |
| 23 | Business/Product (Owner's Key, closing reports, care plans) | **Business** nav entry |

---

## 2. Heuristic review of the current Cockpit

Evidence: `before/*.png` and `before/audit.json` (axe, run on the harness).

| Area | Finding | Evidence |
|---|---|---|
| Navigation | 5 rooms named after internal mechanics ("Actions", "Runs"). "Runs" holds correction rounds, not runs; actual runs are in "Actions". Nothing is URL-addressable: reload always returns to Pipeline, and no screen can be linked or bookmarked | `App.tsx` keeps the room in `useState` |
| Navigation, phone | The sidebar becomes a horizontal strip that cuts off ("eline" at 375 px); 3 rooms are off-screen with no cue | `pipeline-375.png`, `models-375.png` |
| Hierarchy | No screen answers "is everything OK, what needs me?". The same 3 counters top every room and push content below the fold on phone (3 stacked tiles, about 330 px) | every `*-375.png` |
| Hierarchy | Approvals stacks three unrelated queues (accounts, plans, stage gates) on one long page; a plan card shows everything expanded (16 open questions, all risks) at equal weight | `approvals-1440.png` |
| Clutter | Actions mixes 4 forms with a 25-card job history; succeeded, failed and queued jobs look alike apart from a thin left border | `actions-1440.png` |
| Copy | Internal ids and slugs as main labels (`6_full_build_owners_key`, `clean-agency`, `awaiting_launch_approval`, "build→QA cycle(s)"); raw provider JSON as the error ("HTTP 402: {"error":…}"); "Verify a page" pre-filled with a repo path | `actions-1440.png` |
| Errors | Errors show the raw message and never say what to do. If the projects query fails in Approvals, the screen shows "Loading…" forever: the error is stored but the loading guard returns first | `Approvals.tsx:60` |
| Empty and loading | Plain text only ("Loading…", "No jobs yet."); no skeletons, no next step | all rooms |
| Contrast | axe `color-contrast` (serious) on **every room**: 10, 11, 5, 7, 20 nodes (Pipeline, Approvals, Actions, Runs, Models) | `before/audit.json` |
| Structure | Login and pending screens have no `main` landmark; a heading level is skipped in Actions; an empty table header in Stage gates | `before/audit.json` |
| Focus | Focus styles only on login inputs, note fields and track options; nav items, buttons and job actions rely on the browser default on a dark ground | `theme.css` |
| Tap targets | Most buttons are about 32 px tall, below the 44 px comfort size; 2 controls in Approvals and 5 in Actions are under 24 px in one dimension | `before/audit.json` |
| Motion | No `prefers-reduced-motion` handling (only CSS hovers today, so low risk) | `theme.css` |
| PWA | Described as a PWA but has no manifest, icons or service worker; not installable | `apps/cockpit/index.html` |
| Speed | Every room is in one bundle; fonts load from Google Fonts at run time | `index.html` |
| Design-quality rule | Trips several banned patterns: one default "dev tool" look (Space Grotesk + IBM Plex, both on the over-used list), monospace as a costume on every button, uppercase labels above every section, a coloured left border on every card, the hero-metric counter strip, low-contrast grey text | screenshots |

What is already good and must be kept: the safety design. RLS is the only gate, there's no deploy button, the iframe
preview is sandboxed without same-origin, no service key is in the bundle, login avoids revealing which emails have
accounts, and decisions are re-checked by the database. The direction summary with the client's own words is
excellent content.

---

## 3. Proposed information architecture

**Five working areas, one action button, one question box.**

| Area | Answers | Primary action | Contents |
|---|---|---|---|
| **Home** | "Is everything OK, and what needs me?" | Open the top item | Status line ("3 decisions are waiting for you."); **Waiting for you** (plan decisions, account requests, builds ready for a launch decision, failed or stuck jobs, oldest first); **Running now**; **Recently finished**; **Where every client is** (route lines) |
| **Decisions** | "What am I being asked to approve?" | Approve / Reject | Plans, Accounts, Stage moves. Later: Escalations, Blocked, History (Step 14). The nav badge counts open decisions |
| **Projects** | "Where is each client?" | New request | Project list with route lines → Project page (plan, builds, fix rounds, preview, stage move). New request lives here |
| **Activity** | "What did the factory do, and why did it fail?" | Resume / Start | Every job as a list → **Run page**: plain-language reason, what to do, steps, checks, fix rounds, technical details, GitHub log |
| **Costs** (owner only) | "What is this costing?" | none | Today's Models room; Step 12 adds per-client cost |
| *Coming next* | | | System (Step 9), Agents (10), Memory (14), Business (23), each an honest "Coming in Step N" page with one sentence on what it will show. No fake data |

- **New request** is a primary button in the top bar on every screen, so starting work is always one click.
- **Ask the factory** is a search-style box in the top bar (keyboard `/`), not a room.
- **Account menu** (rail foot on desktop, More on phone): name, role, Settings (Team, and later Alerts), Sign out.
- **Phone**: a bottom tab bar with Home, Decisions (with badge), Projects, More. Everything else is under More.
- **Every screen gets a URL** (`/`, `/decisions/plans/:id`, `/projects/:id`, `/activity/:jobId`, ...), so Home items,
  alerts (Step 17) and Nick's messages can link straight to the thing. Rooms load lazily.

### Click budget for the acceptance walkthrough (from Home)

| Task | Path | Clicks |
|---|---|---|
| Start intake from a pasted request | New request → paste → Read request and plan | 2 |
| Approve a plan (recommended track) | Waiting item → Approve as Track A | 2 |
| Approve a plan on the other track / reject it | Waiting item → pick Track B → Approve (reject: type note → Reject with note) | 3 / 2 |
| Start a build | Waiting item "ready to build" → Start build | 2 |
| Open a run and see why it failed | Waiting or Recent item → the reason is the page title | 1 |
| Approve an account request | Waiting item → role → Approve | 3 |
| Sign out | Account menu → Sign out | 2 |

---

## 4. Proposed design system: "the signal-box panel"

**Idea.** In a railway signal box, a route only lights up when every signal along it is proven clear, and some levers
are locked so only a person can pull them. That is WFACT's law ("never trust done, only verified"; Launch and Money
stay human) turned into an interface. The world's grammar: dark enamel panels, hairline seams instead of shadows,
lit track lines for proven progress, signal lamps that mean **state only**, and engraved-plate labels.

(The design skill's roll assigned this direction from my 7 candidates. The others were a mission-control GO/NO-GO
board, an andon factory board, air-traffic flight strips, QC inspection tags, print job tickets and a lab notebook. A
"dark developer console" came up as a challenger and was set aside as the category default; the "airport
wayfinding" challenger's idea of always showing the single next decision was kept for the phone layouts.)

**Signature element: the route line.** Each client is a line through the 11 stages. Proven stages are lit, the
current stage is a white lamp, and human gates are signal heads: yellow when waiting for you, green when cleared.
Launch is a dashed, locked signal because it only ever moves by hand. It is real data, not decoration.

### Tokens (in `mockups/cockpit.css`, to move to `apps/cockpit/src/tokens.css` in Phase 2)

- **Colour strategy: restrained.** Neutrals plus four signal aspects, used for state only.
  - Dark (default): ground `#121816`, plate `#19211e`, sunk `#0e1312`, seam `#3d4b45`, ink `#e8ede9` / `#b3beb8` / `#8f9c95`.
  - Aspects: **caution yellow `#f0c84b` = needs a human** (the Cockpit's own colour), clear `#5cc994` = verified,
    stop `#f2706a` = failed, lamp `#f4f6f2` = current position.
  - Light ("daylight panel"): ground `#e4e9e6`, plate `#f6f8f7`, ink `#141c19`; aspects darkened to keep AA
    (clear `#15663f`, caution `#8a6400`, stop `#b3302b`).
- **Type pairing**: **Overpass** (from US highway signage) for headings, plates and nav; **Atkinson Hyperlegible
  Next** (Braille Institute, built for low vision; keeps 1/l/I and 0/O apart) for everything you read; **Overpass
  Mono** for ids, money, counts and times only. Scale 13/14/16/19/24/32/42; body 16 px. Self-hosted in Phase 2 (no
  Google Fonts link), 2 or 3 weights each.
- **Space**: 4 px base (4, 8, 12, 16, 20, 24, 32, 40, 48, 64). **Radius lock**: plates 6 px, controls 4 px, lamps round.
- **Elevation**: seams first; one shadow only, for things that float (dialog, toast).
- **Motion**: ease-out `cubic-bezier(.22,1,.36,1)`, 140 ms for state changes, 220 ms for panels. One authored moment:
  a route segment lights when a stage is proven (600 ms). Everything is instant under reduced motion.
- **Icons**: Phosphor (regular), one family, no emoji.

### Core components

Rail nav (with "Coming next" group and counts), top bar (breadcrumb, Ask box, New request), phone tab bar, page
header, plate (panel), waiting-for-you queue row, route line, status aspect (lamp + word, never colour alone),
buttons (primary, approve, danger outline, secondary, ghost, disabled; 44 px tall), field (label above, hint, inline
error linked with `aria-describedby`), select, textarea, track choice (radio cards), table, notice (stop, caution,
info), empty state (says what will appear and how to make it appear), loading skeleton (shaped like the result),
toast (transient success only), dialog (only for moves that can't be undone), step timeline, key-value list,
collapsible raw technical details.

### Copy guide

1. **Say what it is in Nick's words.** "Build and check", not `build_plan`; "Full build", not `6_full_build_owners_key`;
   "Waiting to start" / "Running" / "Verified" / "Failed", not `queued` / `succeeded`. Ids go in "Technical details".
2. **Buttons are verbs that name the result**: "Read request and plan", "Approve as Track A", "Reject with note",
   "Resume build", "Move to QA". Never "Submit", "OK", "Go".
3. **Every error says what happened, whether anything changed, and what to do.** Example: "Build stopped: the site
   builder is out of credits. Nothing was built and nothing was published. Topping up Agent 37 is a money decision;
   once credits are added, press Resume build." The raw message stays one click away.
4. **Gates say their consequence**: "Approving doesn't build or publish anything: you start the build next." Launch
   always reads "Nothing is published until you launch it outside the Cockpit."
5. **Empty is honest**: "Nothing is running." plus what will appear here. Future rooms: "Coming in Step 9: ...".
6. **Label stand-ins**: synthetic clients and sample rows say so on screen.
7. Sentence case, no exclamation marks, no em dashes, no filler ("seamless", "unlock", "powerful").

### Design-quality rule check on the mockups

| Banned pattern | Result |
|---|---|
| Purple/blue gradient hero | None. No gradients at all except the loading shimmer |
| Generic three-card feature row | None. Home is a queue list + two side panels + full-width route lines |
| Emoji as icons | None. Phosphor only |
| Centred-everything layout | None. Left-aligned, asymmetric grids |
| One default font, no pairing | Overpass + Atkinson Hyperlegible Next + Overpass Mono, each with a stated job |
| Fake "trusted by" logos, initials avatars | None |
| Filler copy | None; copy is from live rows (synthetic ones labelled) |
| Glassmorphism | None |
| Same section rhythm repeated | Each screen has its own structure (queue / two-column decision / timeline + details / form + side tools) |
| Gratuitous animation | One motion: the route line lighting; off under reduced motion |
| Thin low-contrast grey text | axe colour-contrast passes on all 20 page/width/theme combinations |

Mechanical checks on the mockups (final round): **axe 0 violations** on all 5 screens × 1440/375 × dark/light;
**no horizontal scroll at 375 px**; all 3 fonts confirmed loaded. Impeccable's detector found 3 issues; 2 were fixed
(cramped Ask box padding; border plus wide shadow on the dialog) and 1 is a false positive ("10 em-dashes", while
`grep` finds 0 em or en dashes in the files). The plan screen's radio inputs are 18 px, but each sits inside a
full-width label card that is the real target, so WCAG 2.5.8 is met.

---

## 5. Mockups

| Screen | File | Shows |
|---|---|---|
| Home | `mockups/home.html` | Status line, Waiting for you (4 real items, one labelled sample), Running now (empty state), Recently finished, route lines for DreamSign and Summit Line |
| Plan decision | `mockups/plan.html` | The real Summit Line plan: the client's words, questions to settle, the sticky decision panel with Track A recommended (88%), Track B's honest "builder isn't ready" note |
| Failed run | `mockups/run.html` | The real Agent 37 out-of-credits failure in plain language, what to do, "a later build passed" notice, step timeline, technical details |
| New request | `mockups/new-request.html` | Paste-and-plan form, Ask the factory, Re-check a built page with an inline error example |
| Design system | `mockups/system.html` | Tokens, type, buttons, aspects, route line, loading/empty/error/toast states, dialog; light/dark switch |

---

## 6. Decisions needed from Huraira before Phase 2

| # | Decision | My recommendation |
|---|---|---|
| D1 | Approve the IA (Home, Decisions, Projects, Activity, Costs, Coming next) | Yes |
| D2 | Approve the design direction (signal-box panel, the palette, Overpass + Atkinson Hyperlegible Next) | Yes. Final design call is Nick's (CLAUDE.md §3); suggest showing him the mockups |
| D3 | The stage move into **Launch** (today one click in Stage gates). Keep it as a recorded stage move with a strong confirm, or block it in the UI until a proper Launch gate exists? | Block the move into Launch in the UI ("Launch is recorded by Nick outside the Cockpit"); keep the other moves with a confirm. It never deployed anything, but the button invites the wrong belief |
| D4 | Re-checking a Track A **site**, and the full `qa` suite, from the Cockpit need `packages/jobs` changes (outside 4C) | Leave CLI-only in 4C; fold into Step 7 |
| D5 | Add "Add client / project" in the Cockpit (RLS already allows owner/admin) | Yes, small and inside `apps/cockpit` |
| D6 | Add Team management (change role, remove access, assign PM to clients) | Defer to Step 17 (roles), SQL until then |
| D7 | Closing stale `queued` jobs from the Cockpit needs a migration (a `cancelled` status) | Small migration in 4C, attack-tested; or I close the 2 rows by SQL once you say OK |
| D8 | Phase 2 adds `react-router` (URLs per screen), `@fontsource` fonts, `@phosphor-icons/react`, `vite-plugin-pwa`, Vitest + Testing Library | Yes; all free, no accounts |
