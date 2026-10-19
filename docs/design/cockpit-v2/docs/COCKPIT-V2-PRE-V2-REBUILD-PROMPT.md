# Cockpit v2: rebuild the remaining pre-v2 screens (agent prompt)

Written 2026-10-19, after Step 28 Package 4 phase 19 (`55e0a8a`..`5589192`, CI `39286692404` green and deployed; trackers
synced in `b695c26`). Package 4's exit check is PARTIALLY MET only because the screens below were cleaned up (tokens,
words, focus), not rebuilt to the locked design. This prompt closes that gap. Paste the block below into a fresh session.

```
You are a senior front-end engineer in the WFACT 3.0 monorepo (wfact-3.0-build/, branch huraira-work). Cockpit v2
(Step 28, Package 4) is built and deployed through phase 19. What is left is rebuilding the screens that still use the
pre-v2 components, then re-running the Package 4 exit check. Work in phases R1–R5 below, ONE PHASE PER GO. After each
phase: commit, update the trackers, push, check CI, report, then STOP and wait for "GO for R<n>". Package 5 (the paid
Lanternworks proof) is NOT part of this prompt; never start it.

READ FIRST, in this order
1. CLAUDE.md ("never trust done, only verified"), .claude/COMMON_MISTAKES.md, .claude/rules/*.md.
2. docs/design/cockpit-v2/docs/COCKPIT-V2-BUILD-PROMPT.md: §1 hard rules and locked decisions, §3 components, §6 screens
   (7 Live build, 8 Stopped build, 9 Finished site review, 5 Proposal review, 10 Activity), §8 verification.
3. docs/design/cockpit-v2/Cockpit.dc.html (the LOCKED design; source of truth): the sc-if blocks is.build (~char 58400),
   is.stopped (~64800), is.review, is.proposal, is.project (~33300), is.activity (~79300), and renderVals() for copy.
   Also "Cockpit Screens*.dc.html" frames and the CLAUDE.md in that folder.
4. BLOCKED-ON-NICK.md, Cockpit v2 rows. Logged decisions are not yours to re-decide; do not log them twice.
5. PROGRESS.md (top 60 lines, then `grep -n '^## Step 28' PROGRESS.md`) and the Step 28 entry in
   docs/WFACT-3.0-Factory-Completion-Plan.md (status line, Next action, continuation prompt, LEFT list).

STATE AT THE START (measured 2026-10-19; cite, do not re-derive)
- Rebuilt to the design (phases 5–18): Home, Projects, New request, the client's page, Proposal review (pending), Needs
  (approved with a kind of site), Live build, Stopped build (8 cases), Finished site review, Activity, Costs, Team and
  access, Settings, Notifications. Shell, tokens, kit (components/kit.tsx, flow.tsx), ConfirmDialog are v2.
- Phase 19: the tokens.css alias block is gone (guard test in src/styles/tokens.test.ts); Overpass sans removed; plain
  words on every screen (DOM sweep clean); shell focus rescue in shell/Shell.tsx and ConfirmDialog (focus is never left on
  <body>); lib/brandUpload.ts never throws. Tests: apps/cockpit `npx vitest run` 319/319 in 24 files; tsc clean.
- Measured quality at the start: axe 0 in 21 rooms at 1440/375 light and dark; Lighthouse accessibility 100 in 16 rooms.
  Do not let either drop.
- Dev switches in src/dev/fakeSupabase.ts (dev server "cockpit-fake", port 5175; never in a build): ?fake-role=pm|admin,
  ?fake-stop=2|5|6, ?fake-ph=1, ?fake-live=1 (a running build), ?fake-logo=1 (logo on file for the approved proposal),
  ?fake-activity=1, ?fake-costs=1, ?fake-team=1. The fake does NOT keep inserted rows; add a dev switch when a state is
  missing.
- Synthetic ids (src/test/fake.ts): PLAN_PENDING 11111111-…, PLAN_APPROVED 22222222-…, JOB_FAILED 33333333-…,
  JOB_VERIFIED 44444444-…, JOB_STUCK 55555555-… (queued, never started).

WHAT IS STILL PRE-V2 (measured 2026-10-19, paths under apps/cockpit/src)
A. The build page fallback, pages/Activity.tsx RunPage lines ~589–757. Reached when the job is not under the v2
   SiteReview (line ~556) and not a v2 StoppedBuild (~566): never-started and cancelled requests, running non-build work
   (intake, direction, ask, verify), older or non-latest passing builds. Pre-v2 parts: PageHead header (591–636) with an
   Aspect kicker and the actions "Start again" (queued: functions.invoke dispatch-job), "Close it" (stale queued:
   ConfirmDialog then rpc cancel_job), "Archive"/"Unarchive" (finished: rpc archive_job), "Open the proposal";
   Notices (639–662); ClientNeedsPanel and PlaceholdersPanel (644–645); the "What the factory did" Plate with the pre-v2
   Steps list (318–375) or v2 LiveBuild (663–686); Results (383–469: Answer, The proposal, What was built, Checks that
   failed, Checks, Fix rounds during this build); a "Technical details" Plate with a dl.kv (689–734) that is a titled
   panel, not a <details>.
B. Old and rejected proposals, pages/Decisions.tsx PlanPage (881–906): rejected proposals, and approved ones with no kind
   of site, get PageHead + PlanDetails (272–337) + AfterDecision (339–433). AfterDecision writes requestJob("replan")
   ("Revise from my note", rejected, revision < 2). Its build_plan branch (~379) and BeforeBuild (~386) are unreachable
   (PlanPage line ~891 sends approved-with-a-kind to NeedsScreen).
C. The Decisions room, pages/Decisions.tsx: Tabs (34–49), PlansTab at /decisions (62–150: proposals waiting, builds ready
   for a launch decision, recently decided; no writes), StagesTab at /decisions/stages (951–980) with StageMove (910–949:
   projects.update stage after a ConfirmDialog; StageMove is also used by pages/Work.tsx:25). Links in: Decisions.tsx:42,
   :46, :887; Shell.tsx breadcrumb :44; /approvals redirects here (App.tsx ~94). The locked design has NO Decisions room
   and NO stage-moves screen (nav in brief §4: Home, Projects, Activity, Costs, Team, Notifications, Settings).
D. Fix rounds, pages/Activity.tsx ActivityTabs (229–238) and FixRounds at /activity/fixes (250–281): reads
   correction_rounds (limit 100), no writes. Links in: Activity.tsx:235, Shell.tsx breadcrumb :45; /runs redirects here
   (App.tsx ~96). The locked design has NO fix-rounds room; rounds of fixes appear inside a build (Live build row 9).
E. Leftovers: components/Recovery.tsx RecoveryPanel (no page renders it; only dev/TimelineHarness.tsx:97,103);
   BeforeBuild (only the unreachable AfterDecision branch); components/Placeholders.tsx PlaceholdersPanel (only the
   pre-v2 RunPage, Activity.tsx:645; keep placeholdersOf, used by NeedsScreen); Home.tsx pre-v2 helpers subjectOf,
   JobLine, ClientLines (304–378, nothing imports them); Misc.tsx NotFound (PageHead).
F. Test coverage today: src/flows.test.tsx covers Archive, Close it, the superseded notice, StagesTab/StageMove, /approvals.
   NOT covered: FixRounds, /activity/fixes, /runs, Start again, Unarchive, Technical details kv, Steps/Results,
   AfterDecision "Revise from my note", PlaceholdersPanel, the PlansTab lists.

HARD RULES (breaking any one fails the phase)
- Build the design faithfully. Do not restyle, rename, simplify or "improve". Where the design has no frame for a screen
  (C and D above, and the actions Start again / Close it / Archive in A), STOP on that item: write it into
  BLOCKED-ON-NICK.md (what exists, what the design shows, the options, who decides: design calls are Nick's, routing and
  code are Huraira's), and ask Huraira before removing or moving any working feature. Never delete a write path without a
  yes.
- UI only. Do NOT touch RLS, migrations, job runners or packages/*. Every write goes through the existing calls
  (requestJob, dispatchJob, cancelJob, archiveJob, savePlanInputs, the projects stage update).
- Honest data only. Never ship mock data. A figure you cannot read says so in words. Nothing shown as done unless a check
  proved it.
- Vocabulary: never on screen outside Technical details (<details>): plan, job, run, track A/B, entity, needs_input,
  tokens, model names, run ids, SHAs, GitHub run numbers. Audit actions only through lib/phrases.ts.
- One primary button per view. Money confirms open ConfirmDialog with costLine()/buildStopLine() (caps from
  spend-caps.json). No deploy or publish control anywhere.
- Roles follow RLS: PMs do not see Activity, Costs or Team; admins do not see Costs; only owners approve.
- Accessibility: WCAG 2.2 AA, 44 px targets, axe 0 per room, keyboard-only use, focus visible, focus never on <body>.
- Smallest diff that meets the phase. Delete code only when nothing uses it (search first; list callers in the commit).
  Reuse v2 pieces: StatusChip, TechDetails, Button/ButtonLink, EmptyState, StepRow, FixCard, ProgressStrip, LiveBuild,
  StoppedBuild, SiteReview, LoadError.

PHASES (one per GO)

R1. The build page fallback (A). Rebuild RunPage's fallback with the v2 grammar of design is.build / is.stopped /
    is.review: v2 header (StatusChip + Newsreader title + plain lead), body in the v2 layout, Technical details as the
    kit TechDetails <details> (Job, run, proposal ids, cycles, status, raw error, worker log, each with copy). States to
    cover, each with a fixture: never started (JOB_STUCK), cancelled, running non-build work (add ?fake-job=intake|ask
    if missing), older passing build (not the latest; add a switch), archived. Replace the pre-v2 Steps list with StepRow
    rows (never invent a step the record lacks: "Not recorded"). Results: answer, what was built (reuse SitePreview /
    PagePreview), checks with per-check words via checkLabel, rounds of fixes for this build. PlaceholdersPanel on an
    older passing build: reuse SiteReview's placeholder rows rather than the pre-v2 panel, or keep the panel's writes
    behind the v2 rows (same plan_inputs keys). Start again / Close it / Archive / Unarchive: the design has none. Keep
    them working as quiet v2 buttons (Close it keeps its ConfirmDialog), log the design gap in BLOCKED-ON-NICK.md, and
    say so in the report. Tests (pages/runpage.test.tsx, SYNTHETIC): every state above renders its chip, title and one
    primary; Start again calls dispatch-job; Close it confirms then rpc cancel_job; Archive and Unarchive call
    rpc archive_job; Technical details closed in Simple and open in Detailed; no banned words outside <details>.
R2. Old and rejected proposals (B). Show them in the v2 Proposal review grammar (design is.proposal) in a read-only
    decided state: the client's own words, the pages, the decision and its note, then for a rejected proposal "Ask for
    changes" → "Revise from my note" (owner/admin, revision < 2, same requestJob("replan")), and for an approved one with
    no kind of site the honest sentence that it cannot be built and the one way forward (start a new request). Delete
    the unreachable build_plan branch and BeforeBuild only after confirming nothing else uses them. Tests: rejected →
    revise (owner yes, PM no, third revision refused); approved without a kind → no build button; no banned words.
R3. The Decisions room and stage moves (C). STOP FIRST: the design has no such room. Present Huraira the options and
    wait: (a) retire /decisions and /decisions/stages: /decisions and /approvals redirect to Home (its "What needs you"
    already lists proposals waiting and builds ready for approval, one source), "Recently decided" is already in
    Activity, and StageMove stays reachable on the client's page (Work.tsx:25; verify it renders there for owner/admin);
    (b) keep them and restyle in the v2 grammar of Projects (title + summary sentence, rows with StatusChip); (c) other.
    Log the choice in BLOCKED-ON-NICK.md. Only after a yes: build it, update the shell breadcrumbs (Shell.tsx:44), the
    redirects in App.tsx, every link in (Decisions.tsx:887 "Back to Decisions"), and flows.test.tsx (StageMove,
    /approvals). Keep the D3 rule: a stage move never offers Launch.
R4. Fix rounds (D). STOP FIRST, same as R3: options (a) retire /activity/fixes and redirect it and /runs to /activity,
    with each build's own rounds already on its page; (b) keep it as an Activity filter in the v2 Activity grammar (the
    rows in lib/activity.ts, phrases via lib/phrases.ts); (c) other. Build only after a yes. Tests for whichever: the
    route lands where it should; rounds read in plain words; PM cannot reach it (RLS: correction_rounds).
R5. Leftovers and the exit check (E). Delete RecoveryPanel (move the dev harness to StoppedBuild or delete it with it),
    the unused Home helpers, and any pre-v2 component (PageHead, Plate, Aspect, Empty, Loading, RouteLine, Notice,
    .rows/.queue/.lamp CSS in styles/app.css) that nothing uses any more; NotFound in the v2 grammar of the "soon" page
    (Newsreader title, plain lead, one ButtonLink to Home). Prove each deletion: a python count of uses before and after
    (grep --include does not work in this shell), and the computed-style fingerprint (below) unchanged on rooms that did
    not change. Then re-run the Package 4 exit check, quoted from the plan: "every room rebuilt to the locked design, axe 0
    and Lighthouse a11y >= 95 per room, keyboard-only main flow (new request, approve proposal, logo and a picture, build,
    stop and fix, ready, approve), PROGRESS.md updated with evidence." Mark it MET / PARTIALLY MET / NOT MET item by item.
    "Approve the site" stays switched off (no approval record, logged): the flow ends at the readiness line.

HOW TO VERIFY (every phase; "it should work" is not evidence)
- cd apps/cockpit: `npx vitest run` all green with the phase's NEW tests (SYNTHETIC rows only). Mutation check: break the
  phase's core rule, watch a test fail, restore it. If a test passes without your change, it proves nothing: fix the test
  (phase 19 found vitest reading app.css as empty until vite.config.ts css.include named it). `npx tsc --noEmit -p .`
  clean. `npm run build` clean; `grep -rl 'fakeSupabase\|createFake\|fake-' dist/` prints nothing; say the precache size.
- Browser: preview_start "cockpit-fake". At 1440x900 and 375x812, light and dark (dark: localStorage 'cockpit-appearance'
  {theme:'dark',accent:'ink',density:'comfortable',textSize:100,reduceMotion:false}, reload; set light again after):
  inject /node_modules/axe-core/axe.min.js and run axe.run() per room → 0; scrollWidth === innerWidth at 375; no target
  under 44 px (inline links excepted); compare with the design frame and fix drift. Banned-word DOM sweep outside
  <details> for owner, admin and PM. Lighthouse accessibility per changed room with the chrome-devtools MCP
  lighthouse_audit (navigation mode on the fake) → record the score (must stay >= 95; it was 100).
- Keyboard: real key presses (computer key with repeat; batches cap at 25 actions; log focus with a focusin listener).
  Every new action reachable, dialogs trap focus and return it, focus never left on <body>.
- For deletions and restyles that must not change other rooms, the phase 19 computed-style fingerprint: per room, hash
  getComputedStyle (colours, borders, radii, font, size, spacing, shadow, opacity, transition/animation duration, fill,
  stroke, gap) plus offsetWidth x offsetHeight of every element, before and after; only load-time timestamps may differ.
- Read real data shapes READ-ONLY when needed (Supabase project mcaxxhgjptwowwrluhra, SELECT only). Never write to it.

PROCESS AND HOUSEKEEPING
- Before touching anything: `git status --short`, `git log --oneline -5`, `git reflog show origin/main | head -3`,
  `node scripts/check-trackers.mjs` (must print OK). Another session may share this checkout: commit named paths only,
  never `git add -A`, never revert or stash work you did not make.
- GateGuard (repo hook) blocks the first Bash call of a session and the first Write/Edit of each file: state the request,
  the file's importers, the API affected, any data shape and the instruction verbatim, then retry the same call.
- Two failed attempts at the same fix: stop, instrument (event log with timings), find the root cause, then fix.
- After each phase: `/step-close 28` (completion note .claude/completions/YYYY-MM-DD-step-28-pre-v2-R<n>.md; PROGRESS.md
  "Last synced" rotated, at most two "Previous sync", oldest appended to
  docs/archive/2026-10-15-cleanup/PROGRESS-sync-log-to-2026-10-15.md; the Step 28 heading, an "- [x] P4 R<n>" line with
  SHAs, test count, mutation check, axe and Lighthouse; the "P4 pre-v2 screens still to rebuild" line; Next up replaced
  not stacked; the plan's Step 28 heading, phase bullet, Next action, continuation prompt, Part E row and the "Status as
  of" line, replaced not stacked); `node scripts/check-trackers.mjs` OK; `graphify update .`; commit graphify-out and the
  completion note tagged [no-tracker].
- Push: `git push origin huraira-work`, then `git push origin huraira-work:main` (deploys the Cockpit). Find the run
  (`gh run list --branch main --limit 1`) and poll `gh run view <id> --json status,conclusion` in the background until
  completed (Rendered QA takes ~20 min). Never say "deployed" before "Deploy Cockpit to Vercel (trunk only)" is green.
  If trackers were written first, record the CI id at the next tracker update.

KNOWN OPEN ITEMS (already in BLOCKED-ON-NICK.md; do not re-log; do not work around)
Caps conflict; role conflicts (PM Activity, admin Costs, PM cost); no site-approval record ("Approve the site" off);
logo-before-build; stop-view actions with nothing behind them; "Ask for changes" has no runner input on the finished
site; migration 0024 (launch.placeholders_ok owner-only) unmerged and unapplied (Huraira's); phases 14–18 gaps (device-
only settings, Activity/Costs/Team/Settings gaps, notification channels, spend notice); the pre-v2 app icon (Nick).

REPORT (end of each phase, then STOP)
What the screen shows now; what was checked (tests and the mutation check, axe per size and theme, Lighthouse, the
keyboard path, CI run id and its Deploy job); bugs found and fixed; deviations from the design and why; anything logged
in BLOCKED-ON-NICK.md; what you are waiting on Huraira for (R3 and R4 start with a question); "Noticed but not done";
the next phase and "say GO for R<n>".

Start with R1. Before writing code, restate the hard rules in five lines and list the files you will change.
```
