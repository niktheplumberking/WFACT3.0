# Cockpit v2 — agent prompt for phase 14 onward

Written 2026-10-15, after phase 13 (`a01dbbf`) and the progress sync (`42f353d`). Paste everything inside the fence into
a fresh coding-agent session in `wfact-3.0-build/`. It continues Step 28 Package 4; it does not restart it.

```
You are a senior front-end engineer in the WFACT 3.0 monorepo (wfact-3.0-build/, branch huraira-work). You are
continuing the Cockpit v2 rebuild (Step 28, Package 4). Phases 1–13 are built; you build phases 14–19, ONE PHASE PER
GO. After each phase: commit, update trackers, push, report, then STOP and wait for "GO for phase N".

READ FIRST, in this order
1. CLAUDE.md (repo law: "never trust done, only verified"), then .claude/COMMON_MISTAKES.md.
2. docs/design/cockpit-v2/docs/COCKPIT-V2-BUILD-PROMPT.md — the full brief. §6 screens 10–14, §7 Simple/Detailed,
   §8 verification. This is the spec.
3. docs/design/cockpit-v2/ — the LOCKED design. Cockpit.dc.html is the source of truth (search it for the screen's
   `is.<screen>` block and its data, e.g. `is.activity`, `acts`, `actTypes`); also Cockpit Screens*.dc.html frames,
   Cockpit Design System.dc.html, CLAUDE.md in that folder.
4. BLOCKED-ON-NICK.md — the Cockpit v2 rows. Decisions already logged there are NOT yours to re-decide.
5. docs/WFACT-3.0-Factory-Completion-Plan.md, Step 28 (status, continuation prompt) and PROGRESS.md, Step 28 section.

HARD RULES (from the brief; violating any one fails the phase)
- Build the design faithfully. Do not restyle, rename, simplify or "improve". If the design conflicts with the code or
  the database, STOP on that item, write the conflict into BLOCKED-ON-NICK.md (what the design wants, what exists, the
  options, who decides), build the honest version, and say so in your report. Never guess.
- UI only. Do NOT touch RLS, migrations, job runners or packages/*. Every write goes through the existing calls
  (requestJob, savePlanInputs, the existing rpc/Supabase calls). Where the UI needs data the database does not hold,
  that is a BLOCKED-ON-NICK item, not a migration you write.
- No deploy or publish control anywhere.
- Honest data only. Never ship mock data. Nothing shown as done unless a check proved it. The factory never invents.
  A figure you cannot read (role, missing table) says so in words; it is never estimated or hard-coded.
- Vocabulary: never on screen outside Technical details: plan, job, run, track A/B, entity, needs_input, tokens, model
  names, run ids, SHAs, GitHub run numbers. Audit actions go through ONE phrase table (src/lib/phrases.ts); an action
  it does not know is left out, never shown as a slug.
- One primary button per view. Money confirms: anything that starts paid work opens ConfirmDialog with `cost`
  (costLine()/buildStopLine() from lib/costs.ts — caps come from spend-caps.json, never a typed figure).
- Roles follow RLS where the design disagrees (logged): PMs do not see Activity, Costs or Team; admins do not see
  Costs (model_traces is owner-only); only owners approve or tick "launch with placeholders".
- Accessibility: WCAG 2.2 AA, 44 px targets, zero axe violations per room, keyboard-only use works.

WHAT ALREADY EXISTS (reuse; do not rebuild)
- Tokens and theming: src/styles/tokens.css (v2 + a transitional alias block you delete in phase 19), lib/appearance.ts.
- Components: components/kit.tsx (Button with size="page" -> class btn-page, never "page"; ButtonLink, StatusChip,
  StatusGlyph, PathSegments, Segmented, EmptyState, ComingLater, TechDetails, Wordmark), components/flow.tsx (StepRow,
  StopFacts, FixCard, WhyDisclosure, NeedRow), components/ui.tsx (ConfirmDialog with `cost`, Notice, SitePreview,
  PagePreview), components/CommandPalette.tsx, lib/detail.tsx (useDetail: Simple/Detailed).
- Shell: shell/Shell.tsx (rail, top bar, phone header and tab bar, palette, shortcuts). Routes in src/App.tsx
  (/activity, /costs, /team, /notifications, /settings exist; Settings is lazily loaded).
- Data: lib/state.tsx (useFactory: clients, projects, jobs, plans, inputs, attention; useLoad; useMe; useToast;
  useNotifications), lib/clients.ts (clientsOf), lib/path.ts (derivePath — read step/sentence/next action from it, never
  re-derive), lib/attention.ts (Home + Notifications share it), lib/phrases.ts (fetchPersonEvents, fetchPeople,
  phrase, eventsFor), lib/costs.ts (fetchRunSpend, money, total, CAPS, costLine, buildStopLine, the Costs page data).
- Screens done: Home (pages/Home.tsx), Projects / New request / client's page (pages/Work.tsx), Proposal review and
  Needs (pages/Decisions.tsx), Live build (components/LiveBuild.tsx), Stopped build (components/StoppedBuild.tsx +
  lib/stopCases.ts), Finished site review (components/SiteReview.tsx) — all on RunPage in pages/Activity.tsx.
- The pre-v2 Activity list (Activity() in pages/Activity.tsx), Costs (pages/Costs.tsx), AccountsTab (pages/Decisions.tsx,
  routed at /team), Settings and the Notifications inbox (pages/Misc.tsx) still carry pre-v2 layout: phases 14–18
  rebuild them. Keep every working write they do today.

THE PHASES (brief §6; one per GO)
14. Activity (brief §6.10). Filters: client, person, type pills (Everything, Decisions, Builds, Stops, Details, Team);
    "save view"; grouped by day (Today, Yesterday, date); each row: time, glyph, who, plain sentence, client. Person
    events from lib/phrases.ts; factory events (build finished, stopped, started round) from jobs/derivePath — say only
    what the rows record. Owners and admins only (PMs: RLS). Check before building: is there anywhere to persist a
    saved view per person? If not, log it and build the filters without "save view" (or URL-only, stated honestly).
15. Costs (owner; admins are blocked by RLS — keep the role rule). Sentence headline from the real cap period in
    spend-caps.json (it is "per 7 days" today, the design says "this month": logged caps conflict — use the live period
    words), last build cost, trend with a dashed cap line AND a full text alternative, cost per client, "How the caps
    protect you" with the stacked spend bar, per-model table only inside Technical details with estimates labelled.
16. Team and access: account requests (approve as role / decline via the existing decide_account_request rpc), people
    list with assigned clients, roles in plain words. "Invite": check whether any invite path exists; if not, log it.
17. Settings: searchable group nav (Appearance, Detail level, Home, Notifications, Saved views, Keyboard, Budget,
    Language and region, Team defaults). Appearance edits a DRAFT with a live preview and a sticky "N unsaved changes /
    Save / Discard" bar, Undo after saving. The brief says persist per person with owner-set team defaults: first check
    which profile columns exist (read-only). If the database cannot hold it, log it and say plainly on screen where the
    setting is kept (this device) — never pretend it follows the person.
18. Notifications: Inbox (unread dot, chip, title, line, opens the target, "Mark all as read") on the same source as
    Home attention, and Preferences (event × channel table, quiet hours, digest). No email/push channel or preferences
    table exists today as far as is known: verify, log, and show only channels that really deliver.
19. Final cleanup: delete the tokens.css alias block once nothing uses the old names (grep), remove the old Overpass
    font files and the old icon if unused, run Lighthouse a11y on every room (>= 95), banned-word DOM grep in every room,
    keyboard-only run of the main flow (brief §8).

KNOWN OPEN ITEMS (do not re-log; do not work around)
- Caps conflict (design $2.00/build, $20/month vs live $5/build, $20 per rolling 7 days).
- Role conflicts: PM Activity, admin Costs, PM cost so far.
- No site-approval record ("Approve the site" is shown off).
- Logo-before-build rule; stop-view actions with nothing behind them; "Ask for changes" has no runner input.
- launch.placeholders_ok owner-only in the database: migration 0024 on branch claude/objective-engelbart-d65df7
  (562c5ae), not merged or applied — leave it alone; it is Huraira's.

HOW TO VERIFY (every phase, before you report; "it should work" is not evidence)
- cd apps/cockpit: `npx vitest run` all green (248 at the start of phase 14) with NEW tests for the phase in
  src/pages/<screen>.test.tsx (SYNTHETIC rows only, src/test/fake.ts): roles and names, role gates (owner/admin/PM),
  money confirms, empty/loading/failed states, no raw slugs. `npx tsc --noEmit -p .` clean. `npm run build` clean, and
  grep dist/ to prove no dev-only code shipped.
- Browser: dev server via the "cockpit-fake" launch config (port 5175; COCKPIT_FAKE_DB=1 serves src/dev/fakeSupabase.ts;
  ?fake-role=pm|admin switches role; add a dev-only ?fake-... switch there if you need a state the fixtures lack —
  never in a build). At 1440x900 and 375x812, light and dark: inject /node_modules/axe-core/axe.min.js (pinned 4.13.0)
  and run axe.run() -> 0 violations; document.documentElement.scrollWidth === innerWidth; no target under 44 px;
  compare against the matching frame in Cockpit Screens*.dc.html and fix drift (heading sizes use the design's clamp).
- Read real data shapes READ-ONLY when needed (Supabase project mcaxxhgjptwowwrluhra, SELECT only). Never write to it.

PROCESS AND HOUSEKEEPING
- Commit by named paths only (another session may share this checkout): git add <files>; never `git add -A`.
- After each phase: create .claude/completions/YYYY-MM-DD-step-28-package-4-phase-N.md; update PROGRESS.md (Step 28
  checklist line with SHA, test count, axe result; sync line; status summary and next up — replace, never stack a second
  copy) and the plan's Step 28 (status line, Next action, continuation prompt "after phase N"); run
  `node scripts/check-trackers.mjs` (must print OK); `graphify update .` and commit it tagged [no-tracker].
- Push: `git push origin huraira-work` then fast-forward main (`git push origin huraira-work:main`); the main push
  deploys the Cockpit through CI. Then check the CI run (`gh run list`) and report its id and result; never claim
  "deployed" before the Deploy Cockpit to Vercel job is green.
- A repo hook (GateGuard) blocks the first Write of a new file and the first Bash call: state the file's callers, the
  data it touches and the instruction, then retry.

REPORT (end of each phase, then STOP)
What the screen shows now; what was checked (test counts, axe per size/theme, CI run id); bugs found while testing and
fixed; deviations from the design and why; anything logged in BLOCKED-ON-NICK.md; the next phase and "say GO for
phase N".

Start with phase 14 (Activity). Before writing code, restate the hard rules in five lines and list the files you will
change.
```
