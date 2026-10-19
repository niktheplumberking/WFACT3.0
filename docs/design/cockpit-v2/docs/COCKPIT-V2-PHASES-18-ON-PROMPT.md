# Cockpit v2: agent prompt for phase 18 onward (Step 28, Package 4 phases 18–19, then Package 5)

Written 2026-10-19 from the repo at `2810f50` (huraira-work; `origin/main` = `origin/huraira-work` = `0e78b28`, plus the
local sync commit `2810f50`, not pushed). Supersedes `COCKPIT-V2-PHASES-14-ON-PROMPT.md` for everything after phase 17.
Paste the block below into a fresh agent session as-is. One phase per GO; the agent stops after each one.

Facts below were measured on 2026-10-16 to 2026-10-19 (commands and queries named next to them). Re-measure before relying
on any of them: another session may have committed since.

---

```
You are a senior front-end engineer in the WFACT 3.0 monorepo (wfact-3.0-build/, branch huraira-work). You continue the
Cockpit v2 rebuild (Step 28, Package 4). Phases 1–17 are built, CI-green and deployed. You build phase 18, then phase 19,
ONE PHASE PER GO. After each phase: commit, update the trackers, push, check CI, report, then STOP and wait for
"GO for phase N". After phase 19 Package 4 is finished; Package 5 (a paid build) is a separate GO with its own rules
(bottom of this prompt) and you do NOT start it on your own.

READ FIRST, in this order
1. CLAUDE.md (repo law: "never trust done, only verified"), then .claude/COMMON_MISTAKES.md and .claude/rules/*.md.
2. docs/design/cockpit-v2/docs/COCKPIT-V2-BUILD-PROMPT.md: the full brief. §1 hard rules, §6 screen 14 (Notifications),
   §8 verification. This is the spec.
3. docs/design/cockpit-v2/: the LOCKED design. Cockpit.dc.html is the source of truth. For phase 18 search it for
   `is.notifications` (markup) and `const inbox =` / `const events =` (data). Also Cockpit Screens*.dc.html frames and
   the CLAUDE.md in that folder.
4. BLOCKED-ON-NICK.md: the Cockpit v2 rows. Decisions logged there are NOT yours to re-decide; do not log them twice.
5. PROGRESS.md (top 60 lines, then `grep -n '^## Step 28' PROGRESS.md`) and docs/WFACT-3.0-Factory-Completion-Plan.md
   Step 28 (status line, Next action, continuation prompt).

STATE AT THE START (do not redo; cite these, do not re-derive them)
- Phases 1–13: see the plan's Step 28 continuation prompt (tokens, components, shell, path.ts, Home, Projects, New
  request, client's page, Proposal review, Needs, Live build, Stopped build, Finished site review).
- Phase 14 Activity, 35a869d (CI 38929657403): lib/activity.ts; Activity() in pages/Activity.tsx; lib/phrases.ts
  personLines() is the ONE phrase table (phrase() wraps it). Dev switch ?fake-activity=1.
- Phase 15 Costs, 1af12c7 (CI 38934744558): pages/Costs.tsx on fetchCostRoom(); room helpers in lib/costs.ts (capWeek,
  weekBlocks, usualRange, runsOfJobs, sumCalls, usd, stepOf). Dev switch ?fake-costs=1.
- Phase 16 Team and access, e5c6333 (CI 38942505031): pages/Team.tsx at /team (decide_account_request rpc only).
  Dev switch ?fake-team=1.
- Phase 17 Settings, dc4b05b (CI 38947151902): pages/Settings.tsx; lib/prefs.ts (Home layout, where the Cockpit opens,
  saved-view keys; everything on this device); OpenOn in App.tsx; SHORTCUTS exported from shell/Shell.tsx.
  Its Notifications group says only the Cockpit delivers and links to /notifications.
- Tests at the start: apps/cockpit `npx vitest run` 303/303 in 23 files; `npx tsc --noEmit -p .` clean.

HARD RULES (from the brief; breaking any one fails the phase)
- Build the design faithfully. Do not restyle, rename, simplify or "improve". If the design conflicts with the code or
  the database, STOP on that item, write the conflict into BLOCKED-ON-NICK.md (what the design wants, what exists, the
  options, who decides), build the honest version, and say so in your report. Never guess.
- UI only. Do NOT touch RLS, migrations, job runners or packages/*. Every write goes through the existing calls. Where
  the UI needs data the database does not hold, that is a BLOCKED-ON-NICK item, not a migration you write.
- No deploy or publish control anywhere.
- Honest data only. Never ship mock data. Nothing shown as done unless a check proved it. A figure you cannot read says
  so in words; it is never estimated or hard-coded. A setting that only lives on this device says so on screen.
- Vocabulary: never on screen outside Technical details: plan, job, run, track A/B, entity, needs_input, tokens, model
  names, run ids, SHAs, GitHub run numbers. Audit actions only through lib/phrases.ts; an unknown action is left out.
- One primary button per view. Money confirms: anything that starts paid work opens ConfirmDialog with `cost`
  (costLine()/buildStopLine() from lib/costs.ts; caps come from spend-caps.json, never a typed figure).
- Roles follow RLS where the design disagrees (logged): PMs do not see Activity, Costs or Team; admins do not see Costs;
  only owners approve or tick "launch with placeholders".
- Accessibility: WCAG 2.2 AA, 44 px targets, zero axe violations per room, keyboard-only use works, focus visible.

=== PHASE 18: Notifications (brief §6 screen 14) ===
What exists (pages/Misc.tsx `Notifications()`, built in phase 3; lib/state.tsx `useNotifications()`):
- Inbox from the SAME source as Home attention (useFactory().attention): unread dot, chip ("Stopped" / "Needs you"),
  time, title, line; each row is a button that opens n.href; "Mark all as read" stores a seen time in localStorage
  (key per person) and every bell hears it through the "cockpit-notifications-seen" event. Empty state exists.
- Preferences is a ComingLater card.
Build to the design:
1. The Inbox / Preferences switch is a `role="tablist"` with two `role="tab"` buttons (aria-selected) in the design;
   today it is the Segmented radiogroup. Build the tablist (arrow keys move between the two tabs, each tab controls a
   `role="tabpanel"`), keep the design's look. Header: h1 at clamp(34px,4cqi,52px) on the left, tabs on the right;
   page max-width 860px.
2. Inbox rows as the design: dot (need-dot when unread, else transparent, with "Unread." for screen readers), chip,
   time, title (600, 17px), line (15px, ink-2). "Mark all as read" is a quiet underlined button above the list, right.
   Keep the existing source, seen-time key and event; do not invent rows. The design's fourth row ("Spend is at 71% of
   this month's cap", chip "For your information") is a spend notice: the shared attention source has no such item.
   Either derive it honestly (owner only, from lib/costs.ts capWeek() against CAPS.weeklyUsd at 80% or more, words from
   the live 7-day period, opens /costs, same item on Home so the two stay one source) or leave it out and log it. Decide
   by whether Home attention can carry it without touching packages/*; say which you did.
3. Preferences: the design's event × channel table (In the app / Email / Phone), quiet hours and digest. Measured
   2026-10-16: no email or push channel exists (only two Edge Functions, dispatch-job and submit-lead; no notification
   or preference table; profiles has id, role, full_name, created_at). Show only channels that really deliver: the
   Cockpit itself (the bell and Home), always on for every event, said in words. Do not show Email or Phone checkboxes
   that do nothing, and no quiet hours or digest controls (nothing to hold back). One honest sentence for each missing
   piece. Log in BLOCKED-ON-NICK.md: email and phone channels, quiet hours, digest (external sends are hard-gated, so
   this is Nick then Huraira). Settings → Notifications (pages/Settings.tsx NotifyGroup) must say the same thing; keep
   one wording.
4. Tests: src/pages/notifications.test.tsx (SYNTHETIC rows only): tab roles and keyboard; unread dots and "Unread."
   text; a row opens its target; Mark all as read clears every dot and the shell bell count; empty state; loading and
   failed load (f.error) states; PM sees only what attention gives a PM (canDecide false gives no items); Preferences
   shows no dead controls; no banned words.

=== PHASE 19: Final cleanup and the Package 4 exit check (brief §8) ===
Measured 2026-10-19 (python count over apps/cockpit/src; note that grep and cat are wrapped by a hook in this shell, so
`grep --include` does not work: use python, or `find … | xargs grep`):
1. tokens.css lines 85–110: the transitional alias block, 26 old names (--ground, --plate, --plate-2, --plate-sunk,
   --seam, --seam-strong, --ink-inverse, --lamp, --clear, --clear-wash, --caution, --caution-wash, --stop-wash,
   --track-proven, --track-idle, --face-plate, --r-plate, --r-control, --t-xs, --t-sm, --t-md, --t-lg, --t-2xl,
   --t-3xl, --d-route, …). They are STILL USED 185 times outside the block: styles/app.css (most), rules later in
   tokens.css, pages/Decisions.tsx (1, --t-sm), components/Recovery.tsx (1, --t-md). So the block cannot just be
   deleted. Replace every use with the v2 token the alias points at (a mechanical rename; the rendered values must not
   change), then delete the block, then prove zero uses remain (count again) and that screenshots of the rooms that
   still use pre-v2 rules look the same before and after.
2. Pre-v2 screens that still use those rules (PageHead / Plate / Aspect / Empty / .rows): pages/Decisions.tsx
   (PlansTab, StagesTab, PlanPage's AfterDecision for rejected and pre-track proposals), pages/Activity.tsx (FixRounds at
   /activity/fixes and parts of RunPage), pages/Misc.tsx (ComingSoon, More), components/Recovery.tsx,
   components/Placeholders.tsx, Home's Aspect/Empty. Phase 19 is cleanup, not new screens: rename their tokens, do not
   redesign them. List any that still read as pre-v2 under "Noticed but not done".
3. Fonts: main.tsx imports @fontsource/overpass 600/700/800 (the old sans). Overpass MONO stays (it is the locked figure
   face). Remove the Overpass sans imports and the package only when nothing uses it (--face-plate maps to --face-text
   today; check every font-family in app.css). Say the bundle size change (`npm run build` output).
4. The old icon: public/icon.svg, icon-192/512, icon-maskable-512 and apple-touch-icon are the pre-v2 lamp mark, still
   used by index.html and the PWA manifest in vite.config.ts. The design has no replacement mark ("WFACT is a typeset
   wordmark until a real mark exists"). It is NOT unused: do not delete it. Log it (a v2 icon is a design ask for Nick or
   the designer) unless a design asset exists in docs/design/cockpit-v2/.
5. Leftovers already found (PROGRESS.md "Gaps noticed", 2026-10-16): the old Costs styles (.cost-grid, .caps, .cap-bar,
   .tag-over) are unused, delete them; the design's segmented control is 38 px inside a 46 px track (built as designed,
   say so against the 44 px rule, do not change it without a design ruling); the Settings save bar and the toast overlap
   at 1440 for 9 s (fix by keeping the toast clear of the sticky bar, smallest change); on phones the Settings group list
   comes before the content (leave unless the design frame shows otherwise).
6. Lighthouse accessibility >= 95 on every room. Lighthouse is not installed in apps/cockpit (checked 2026-10-19). Use
   the chrome-devtools MCP `lighthouse_audit` if it is connected; otherwise ask Huraira before `npx lighthouse` (it
   downloads a package). Run it against the cockpit-fake dev server or a `vite preview` of the build. Rooms: Home,
   Projects, New request, a client's page, Proposal review, Needs, Live build, Stopped build, Finished site review,
   Activity, Costs, Team and access, Settings, Notifications, More, Not found. Record each score.
7. Banned-word DOM grep in every room (outside <details>): plan|job|run id|track [AB]|entity|needs_input|token|sha|
   claude-|gpt-|gemini|hermes. Also: no element anywhere labelled deploy or publish. Note: the pre-v2 /activity/fixes tab
   is now labelled "Activity" (not "Runs"); check the rest of that page.
8. Keyboard-only run of the main flow on the fake (brief §8): new request → approve the proposal → add the logo and a
   picture → build → stop and fix → ready for approval → approve. "Approve the site" is shown switched off (no
   approval record, logged); say that step ends at the readiness line. Record every focus trap, lost focus or
   unreachable control, and fix the ones in UI code.
9. Then the Package 4 exit check, quoted from the plan: "every room rebuilt to the locked design, axe 0 and Lighthouse
   a11y >= 95 per room, keyboard-only main flow (new request, approve proposal, logo and a picture, build, stop and fix,
   ready, approve), PROGRESS.md updated with evidence." Mark it MET / PARTIALLY MET / NOT MET with evidence per item.
   The pre-v2 screens in point 2 mean "every room rebuilt" is PARTIALLY MET unless they were rebuilt: say so.

HOW TO VERIFY (every phase, before you report; "it should work" is not evidence)
- cd apps/cockpit: `npx vitest run` all green with the NEW tests for the phase (SYNTHETIC rows only, src/test/fake.ts):
  roles and names, role gates (owner/admin/PM), empty/loading/failed states, no raw slugs or banned words. Do a mutation
  check: break the core rule of the phase, watch a test fail, restore it. `npx tsc --noEmit -p .` clean. `npm run build`
  clean, and prove no dev-only code shipped: `grep -rl 'fakeSupabase\|createFake\|fake-activity\|fake-costs\|fake-team' dist/`
  prints nothing.
- Browser: preview_start "cockpit-fake" (port 5175; COCKPIT_FAKE_DB=1 serves src/dev/fakeSupabase.ts; ?fake-role=pm|admin;
  add a dev-only ?fake-... switch in src/dev/fakeSupabase.ts if the fixtures lack a state; never in a build). At 1440x900
  and 375x812, light and dark: inject /node_modules/axe-core/axe.min.js (4.13.0) and run axe.run() → 0 violations;
  document.documentElement.scrollWidth === innerWidth at 375; no target under 44 px (inline text links excepted);
  compare with the Cockpit Screens*.dc.html frame and fix drift.
  Dark mode: the app's own appearance setting overrides the OS scheme. Set it with
  localStorage.setItem('cockpit-appearance', JSON.stringify({theme:'dark',accent:'ink',density:'comfortable',textSize:100,reduceMotion:false}))
  then reload; set it back to light when done. Console errors can be stale hot-reload leftovers: confirm in a fresh tab.
- Read real data shapes READ-ONLY when needed (Supabase project mcaxxhgjptwowwrluhra, SELECT only). Never write to it.

PROCESS AND HOUSEKEEPING
- Before touching anything: `git status --short`, `git log --oneline -5`, `git reflog show origin/main | head -3`,
  `node scripts/check-trackers.mjs` (must print OK). Another session may share this checkout.
- Commit by named paths only: git add <files>; never `git add -A` or `git add .`.
- After each phase: `/step-close 28` (skill .claude/skills/step-close): create
  .claude/completions/YYYY-MM-DD-step-28-package-4-phase-N.md; update PROGRESS.md (rotate "Last synced" into "Previous
  sync", keep at most two, append the oldest to docs/archive/2026-10-15-cleanup/PROGRESS-sync-log-to-2026-10-15.md; the
  Step 28 heading; a "- [x] P4 phase N" line with SHA, test count, mutation check, axe result; the "P4 remaining screens"
  line; status summary; Next up, replaced not stacked) and the plan's Step 28 (heading, a phase bullet, Next action,
  continuation prompt "after phase N", the Part E row, and the "Status as of" line at the top, replaced not stacked);
  run `node scripts/check-trackers.mjs` (must print OK); then `graphify update .` and commit graphify-out plus the
  completion note tagged [no-tracker].
- Run each step on its own: a hook may block a Write and abort a chained `&& git commit && git push`; check
  `git log --oneline -3` before pushing.
- Push: `git push origin huraira-work`, then fast-forward main with `git push origin huraira-work:main` (the main push
  deploys the Cockpit through CI). Then find the run (`gh run list --branch main --limit 1`) and wait for it to complete:
  the Rendered QA job takes about 20 minutes, and `gh run watch` can return before the run ends, so poll
  `gh run view <id> --json status,conclusion` until status is completed. Never say "deployed" before the
  "Deploy Cockpit to Vercel (trunk only)" job is green. If the trackers were written before CI finished, record the CI id
  in the next phase's tracker update.
- GateGuard (repo hook) blocks the first Bash call of a session and the first Write of each new file: state the
  request, the file's callers, the data it touches and the instruction verbatim, then retry the same call.

KNOWN OPEN ITEMS (already in BLOCKED-ON-NICK.md; do not re-log; do not work around)
- Caps conflict (design $2.00/build, $20/month vs live $5/build, $20 per rolling 7 days).
- Role conflicts: PM Activity, admin Costs, PM cost so far.
- No site-approval record ("Approve the site" shown off). Logo-before-build rule. Stop-view actions with nothing behind
  them. "Ask for changes" has no runner input.
- launch.placeholders_ok owner-only in the database: migration 0024 on branch claude/objective-engelbart-d65df7
  (562c5ae, 27e278a), not merged or applied: Huraira's.
- Phases 14–17 gaps: saved views and all settings on this device only; Activity gaps (no archived list, no cost in
  rows, no round numbers, unaudited assignments); Costs gaps ("Change the caps", the stop rule, 7-day periods, no
  cap-stopped build yet); Team gaps (no invite path, no role or assignment write, PM role words); Settings gaps
  (formats, team defaults, notification channels, "Request a change", view names).

REPORT (end of each phase, then STOP)
What the screen shows now; what was checked (test counts, the mutation check, axe per size and theme, Lighthouse scores
in phase 19, CI run id and its Deploy job); bugs found while testing and fixed; deviations from the design and why;
anything logged in BLOCKED-ON-NICK.md; "Noticed but not done"; the next phase and "say GO for phase N".

Start with phase 18 (Notifications). Before writing code, restate the hard rules in five lines and list the files you
will change.

=== PACKAGE 5 (separate GO; paid; do not start without Huraira's explicit GO naming the spend) ===
Source: docs/BUILD-QUALITY-AND-COCKPIT-UX-PROMPTS.md, "PACKAGE 5: prove it on Lanternworks". Re-plan Lanternworks, re-run
direction, build Track B, and verify independently: every requested service, step and the CTA label present; logo
visible at 1280 and 375; brand orange on buttons; at least 4 home sections; placeholders labelled and listed at the gate;
motion on every section; all registry checks green. Record cost and wall time, append to
clients/lanternworks-studio/rehearsal-log.md with ids, and hand it to Huraira for the visual sign-off.
Measured 2026-10-19 (read-only SQL), before you start:
- Lanternworks' approved proposal is 403305ec (revision 2, Track B, 8 details). Its contact details are test values: a
  phone number that looks like a real person's, email test@lanternworks.com, address "Testing Address", and site_url
  https://lanternworks.com (a real domain). The request says the live address is https://lanternworks.example
  (clients/lanternworks-studio/raw-request.txt, memory.md). The brief says correct them first. Do not copy the phone
  number into any file, log or report.
- Its last run 4c35703b (jobs 83f2841f, e2a204fb, 55ddba7c) cost $2.30 recorded ($1.48 of it estimated) over 25 calls and
  ended awaiting launch approval.
- The package cap is $3, but the live per-build cap is $5 (spend-caps.json, Nick's), and a Cockpit-started build reads
  that file; the factory will not stop itself at $3.
STOP and ask Huraira before spending anything:
(a) Who enters the corrected details: the Cockpit needs a signed-in owner, and you must not sign in or type credentials.
    Huraira does it in the Cockpit, or tells you how. A re-plan makes a new proposal whose details start empty.
(b) How the $3 cap is held: Huraira watches and cancels at $3, or approves a per-run override (WFACT_CAP_PER_BUILD_USD
    exists for one run) through a change he reviews, or accepts the $5 cap for this run. Money is Nick's (CLAUDE.md §3):
    no change to spend-caps.json.
(c) Every paid action (re-plan, direction, build, continue) is started by Huraira or after his explicit yes for that
    action, with its cost line.
Then verify the build yourself from the stored site and the jobs row (not from the builder's report), with a second
reviewer where the brief asks for one (label same-vendor review as such), and report with ids, cost and wall time.
```

---

Changes this prompt makes to the previous one: it records phases 14–17 as done with their SHAs and CI ids; it adds the
measured facts phase 18 and 19 depend on (no notification channel or preference table; the tablist; the alias block still
used 185 times, so it is a rename and not a deletion; the Overpass sans imports; the icon still in use; Lighthouse not
installed); the tooling notes this session hit (wrapped grep/cat, GateGuard, the early-returning CI watch, the app's own
dark-mode setting, stale console errors); and the Package 5 starting facts and stop questions (test contact details on
403305ec, the $3 cap against the live $5 cap, no sign-in by the agent).
