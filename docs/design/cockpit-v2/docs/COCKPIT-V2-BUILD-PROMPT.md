# Build prompt: WFACT Cockpit v2 (locked design, 14 Oct 2026)

You are a senior front-end engineer working in the WFACT 3.0 monorepo. Your job is to rebuild the Cockpit UI in `apps/cockpit` to match a **locked** design. The design, the copy and the decisions are final. Build them faithfully. Do not restyle, rename, simplify or "improve" anything. If something in the design conflicts with the code or the database, stop and write the conflict into `BLOCKED-ON-NICK.md`. Do not guess.

The repo law still applies: **never trust "done", only "verified"** (`CLAUDE.md`). Each phase ends with passing tests and a screenshot check at 1440 and 375 px.

---

## 0. Read these first, in order

1. `README.md`, `CLAUDE.md`, `PRODUCT.md`, `docs/HANDOFF.md`, `PROGRESS.md`
2. The design source of truth (copy it into `docs/design/cockpit-v2/` if it is not there yet):
   - `Cockpit Design System.dc.html`: rationale, tokens (light and dark), components, annotations, locked decisions
   - `Cockpit.dc.html`: the live reference component with every screen and state. Read its logic class for exact copy, states and derivations.
   - `Cockpit Screens.dc.html`, `Cockpit Screens 2.dc.html`: every screen at 1440 and 375
   - `Cockpit Prototype.dc.html`: the main flow, clickable
   - `CLAUDE.md` (design): the locked system in one page
3. The existing code you will keep and build on:
   - `src/styles/tokens.css`, `src/styles/app.css`: you replace their **values and components**, but keep the file roles
   - `src/shell/Shell.tsx`: navigation, account menu, phone tab bar, focus-on-navigate, skip link
   - `src/pages/*.tsx`: Home, Decisions, Work, Activity, Costs, Misc
   - `src/lib/recovery.ts`: `diagnoseJob`, `continueOptions`, `reportText`. These are the source of every stop card.
   - `src/lib/timeline.ts`: `deriveTimeline`, `estimate`, `stallNote`, `stepMedians`, `checkLabel`, `CHECK_LABEL`. These are the source of the live build view.
   - `src/lib/inputs.ts` (`SLOTS`, `savePlanInputs`, `looksLikeSecret`), `src/lib/costs.ts` (`CAPS`, `capped`, `total`), `src/lib/attention.ts`, `src/lib/model.ts`, `src/stages.ts`
   - `src/components/BuildTimeline.tsx`, `Recovery.tsx`, `Placeholders.tsx`, `LogoUpload.tsx`, `ui.tsx`

**Do not touch** RLS, migrations, job runners or `packages/*`. This is a UI rebuild only. Every write still goes through the existing `requestJob`, `savePlanInputs` and Supabase calls.

---

## 1. Hard rules (non-negotiable)

- **No deploy or publish control anywhere.** "Record that it is live" only records a date, after a person has launched the site outside the Cockpit.
- **Honest data only.** Every number, status and time comes from real rows. A room that does not exist yet shows a "Coming later" card with no figures. Never ship mock data. The design's sample clients and figures are illustrative only.
- **Nothing is shown as done unless a check proved it.** Use `deriveTimeline` states as they are. Never infer success.
- **The factory never invents.** Missing details are listed by name. "Build without it" means left out, never made up.
- **Vocabulary.** On screen: Proposal, Build, Fast local site / Showcase site with motion, Rounds of fixes, Ready for your approval, Waiting for: X. Never on screen outside **Technical details**: plan, job, run, track A/B, entity, needs_input, tokens, model names, run ids, SHAs, GitHub run numbers.
- **One primary button per view.**
- **Money confirms.** Any action that starts paid work opens a confirm dialog that states the rough cost and the $2.00 per-build stop. Undoable actions show a toast with "Undo" or "Changed my mind".
- **Accessibility: WCAG 2.2 AA.**
  - 44 px minimum targets and visible focus
  - full keyboard use and focus trapped in dialogs
  - polite live regions for progress
  - no horizontal scroll at 375 px
  - respects `prefers-reduced-motion` and the in-app setting
  - text-size setting scales the whole UI
  - Lighthouse a11y ≥ 95 and zero axe violations per room

### Locked decisions

1. The monthly cap ($20) stops **new builds only**. A running build finishes inside its per-build cap ($2.00).
2. Client details are relayed by a person. A client-facing link is a "Coming later" room.
3. Only **owners** may tick "Launch with placeholders". Other roles see "Only an owner can choose to launch with placeholders."
4. PMs see **cost so far** on their own clients' project pages. The Costs room and the caps stay owner/admin.
5. "Ask the factory a question" is a **command palette action**, not a top-bar box. It uses the existing `requestJob("ask", …)`. Remove `AskBox` from the top bar.
6. WFACT is a **typeset wordmark**: "WFACT" in Newsreader 600, then "Cockpit" in Newsreader italic. Remove the "WF" glyph tile.

---

## 2. Design tokens (replace `tokens.css` values)

Keep CSS custom properties. Theme via `[data-theme="dark"]`, with light as the default and system as an option. Accent via `[data-accent]`.

```css
:root {
  --paper:#F4F2ED; --sheet:#FBFAF7; --sunk:#ECE9E2; --line:#DFDBD2; --line-2:#C7C1B5;
  --ink:#1C1B18; --ink-2:#46433D; --ink-3:#625E55; --inv:#FBFAF7;
  --need:#8A4F00; --need-dot:#D4891F; --need-w:#F5E6CC;   /* needs you: diamond */
  --done:#2A6641; --done-w:#DCEADF;                        /* done: tick */
  --stop:#A93322; --stop-w:#F6DDD7;                        /* stopped: stop sign */
  --acc:#1C1B18; --acc-ink:#FBFAF7; --focus:var(--ink);
  --face-display:"Newsreader", Georgia, serif;
  --face-text:"Atkinson Hyperlegible Next", system-ui, sans-serif;
  --face-figure:"Overpass Mono", ui-monospace, monospace;
  --r-sm:8px; --r-ctl:10px; --r-card:14px; --r-panel:18px; --r-pill:999px;
  --row:20px; /* compact: 11px */
  color-scheme: light;
}
[data-theme="dark"] {
  --paper:#121211; --sheet:#1B1B19; --sunk:#232220; --line:#2F2E2B; --line-2:#4A4843;
  --ink:#EEECE6; --ink-2:#C4C0B7; --ink-3:#A09B91; --inv:#121211;
  --need:#F2B865; --need-dot:#F2B865; --need-w:#3A2B14;
  --done:#82CC9C; --done-w:#17301F; --stop:#F59380; --stop-w:#3D1C15;
  --acc:#EEECE6; --acc-ink:#121211; color-scheme: dark;
}
[data-accent="harbour"]{--acc:#1F5D66} [data-theme="dark"][data-accent="harbour"]{--acc:#86C7CF}
[data-accent="clay"]{--acc:#8C4A2C}    [data-theme="dark"][data-accent="clay"]{--acc:#E6A584}
[data-accent="moss"]{--acc:#3E5A2C}    [data-theme="dark"][data-accent="moss"]{--acc:#AFCB93}
```

- **Spacing:** 4 px base.
- **Type scale:**

  | Style | Face and weight | Size / line height |
  |---|---|---|
  | display | Newsreader 400 | clamp(34px, 4.4vw, 58px) / 1.03, -0.02em |
  | title | Newsreader 400 | 46 / 1.08 |
  | section | Newsreader 500 | 26 |
  | item | Newsreader 500 | 22 / 1.25 |
  | client quote | Newsreader italic | 24 / 1.4 |
  | lead | Atkinson | 18 |
  | body | Atkinson | 16 |
  | label | Atkinson 600 | 15 |
  | small (minimum) | Atkinson | 14 |
  | figures | Overpass Mono 600 | 16, tabular nums |
  | eyebrow | Overpass Mono 600 | 12 caps, 0.08em |

- **Fonts:** load Newsreader (opsz 6..72, 400/500/600 and italic 400). Atkinson and Overpass Mono are already in use.
- **Icons:** keep `@phosphor-icons/react`. Status glyphs:

  | State | Glyph |
  |---|---|
  | needs you | `Diamond` fill |
  | done | `CheckCircle` fill |
  | stopped | `StopCircle` fill |
  | running | `CircleNotch` bold, rotating |
  | waiting | `Circle` regular |
  | skipped | `MinusCircle` |
  | no build yet | `CircleDashed` |

- **Motion:**
  - Enter animations run 180 to 400 ms with a 6 px rise.
  - The running ring turns once every 1.1 s.
  - The progress bar eases over 800 ms.
  - Nothing decorative loops.
  - Reduced motion disables every animation.
- **Contrast floor:** text 4.5:1. The tokens above pass. Do not alter them.

---

## 3. Components to build (`src/components/ui.tsx` and siblings)

Match the Design System page exactly. Each component needs a test (Vitest + Testing Library) for its accessible name, role and state.

| Component | Notes |
|---|---|
| `Button` | Variants: primary (accent fill), secondary (sheet + line-2 border), quiet (underlined link-style). min-height 44 (48/50 for page-level primaries); padding `10px 18–24px`; `line-height:1.25`; `text-align:center` so wrapped labels grow. |
| `StatusChip` | Glyph plus word, always. Tones: need / done / stop / run / wait / skip / idle. Pill radius, 13 px 600. Text, not a button. |
| `PathSegments` | Six segments of 4–8 px: done = ink, current = tone colour, running = striped. `aria-hidden`; the step is always written in text beside it. |
| `ProgressStrip` | Six columns on desktop: glyph, number, name, one sentence, usual time. The current cell gets its tone wash, a 3 px ink top rule and `aria-current="step"`. Footer row: "The one thing to do next" plus **one** primary button. Phone: "Step N of 6", segments, the sentence, and a `<details>` listing all six. |
| `StepRow` | Number, title, time ("x so far" / took / "Usually …"), chip, sentence, optional per-check sub-list. The running row is raised (sheet + border); a stopped row gets the stop wash. |
| `FixCard` | Preceded by facts: what happened, money spent (chip + amount), what was tried. Then one primary from `continueOptions()[0]`, quiet alternatives, optional inline input (radiogroup "Add the real X" / "Build without it"). |
| `WhyDisclosure` | Evidence in plain words, a screenshot crop slot and the page, then Technical details holding the raw log. |
| `UploadRow` / `NeedRow` | Label, chip, one line on why. Actions: Upload / Answer (inline textarea) / "Build without it". Done state shows the file name or value plus Change; skipped shows "Add it after all". |
| `SitePreview` | Desktop and phone frames side by side (they stack on phone), with a page tablist. Load the real preview URL from `lib/sitePreview.ts`. |
| `TechDetails` | Native `<details>`: closed in Simple, open in Detailed. Every id has a copy button labelled "Copy". |
| `Toast` | Inverse ink in a polite live region, 9 s, optional action. Never the only place information appears. |
| `ConfirmDialog` | Native `<dialog>` with `role="alertdialog"`. Newsreader title; body with cost; "Not now" + primary. Focus goes to the primary and returns to the opener. |
| `EmptyState`, `ComingLater` | Comes with the copy from the design. |
| `CommandPalette` | ⌘K / Ctrl+K anywhere. Groups: Clients, Actions (New request, Ask the factory a question, switch Simple/Detailed, watch running build, switch theme), Go to, Settings. Arrow keys move, Enter runs the first or selected match, Esc closes. |
| `Segmented` | Simple/Detailed (`role="radiogroup"`), Grid/List, Inbox/Preferences. |

---

## 4. Shell (`Shell.tsx`)

- **Desktop:**
  - Left rail, 236 px. Wordmark; nav: Home (count of needs), Projects, Activity, Costs*, Team*, Notifications, Settings. *Owners/admins only.
  - "Coming later" group: System, Agents, Memory, Business, as honest cards.
  - Footer: Simple/Detailed segmented control, then the account button.
- **Top bar, 68 px:** breadcrumb, then "Search or run a command ⌘K" (opens the palette), the bell (unread dot plus an aria-label with the count), and New request (primary; hidden for PMs).
- **Phone:**
  - 60 px header: back button with a label, title in Newsreader, search, bell.
  - Bottom tab bar: Home, Projects, New (accent tile), Activity, More.
  - The More screen holds Costs, Team, Notifications, Settings, the Simple/Detailed switch and Coming later.
- Keep the skip link, the per-route title and focus-to-main on navigation.
- **Keyboard:**

  | Key | Action |
  |---|---|
  | ⌘K | Command palette |
  | / | Search |
  | G H, G P, G A, G C | Go to Home, Projects, Activity, Costs |
  | N | New request |
  | D | Switch Simple/Detailed |
  | ? | Shortcuts sheet |
  | Esc | Close |

---

## 5. One derivation to add: the six-step path

Add `src/lib/path.ts` with unit tests. Derive the step from **plan, inputs and job state, not the 11-stage slug alone**:

```
Request        intake requested, no plan yet
Proposal       latest plan status = pending (or a revision is being written)
Details needed plan approved AND (no build job yet OR preflight needs unanswered via unansweredNeeds())
Building       latest build job active, OR stopped (tone = stop, with diagnoseJob())
Ready for approval  latest build gate = awaiting_launch_approval and no approval recorded
Live           an owner recorded it live (stage 8_launch or later, set only by that action)
```

Return `{ step: 0..5, tone: 'need'|'run'|'stop'|'done'|'wait', waitingOn: 'you'|'Nick'|'the factory'|name, sentence, nextAction: {label, href|action} }`.

This one function feeds:

- the Home list
- Projects (next step, waiting on)
- the Project progress strip and its single primary button
- Notifications

The sentences and labels come verbatim from `Cockpit.dc.html` (`stripLines`, `pjNext`, client `next` strings).

---

## 6. Screens (build in this order; each is a phase)

Read the matching `sc-if` block and the `renderVals()` section of `Cockpit.dc.html` for exact copy. Each screen ships with its states: empty, loading (skeleton), running, waiting on someone, failed/stopped, success.

1. **Home**
   - Eyebrow date, then a display sentence ("Good morning, Nick. Three things need you." / "All calm, Nick." / "Welcome, Nick."), then the spend line.
   - "What needs you": a numbered `<ol>` ordered stopped → approvals → missing details. Each row has one button; PM rows show "Nick decides this".
   - Then "Running now" (live counters) and "This month" (meter, "about N more builds").
   - Then "Every client", with path segments.
   - Home sections follow the user's order and visibility setting.
2. **Projects:** title plus summary sentence; search; sort; group; filter pills with counts (aria-pressed); "Save this view"; Grid/List. Cards have a pin button. List is `role=table`, stacked on phone. No-match state.
3. **New request**
   - Fields: textarea, business name, live address, logo drop zone (via `LogoUpload` / `brandUpload`).
   - One primary, "Send to the factory", with the cost line beside it.
   - "What happens next" aside with 5 steps.
   - Sending state as `role=status`.
4. **Project page:** title, meta and Test-client badge; `ProgressStrip`. Below it:
   - Main column: the proposal summary and page pills; details and files with the "N of M supplied" count; builds.
   - Side column: cost so far (visible to PMs for their own clients); the decisions timeline from the audit trail; Technical details.
5. **Proposal review**
   - Eyebrow, title, summary; then the client's own words as a Newsreader italic blockquote with attribution.
   - "Choose the kind of site": a `role=radiogroup` of two large cards. The recommended one carries the done-tinted "Recommended" tag plus its reasons.
   - Pages list, then open questions (need-wash rows).
   - Sticky bar: "Approve as a Fast local site" (owner only) and "Ask for changes", which expands a textarea and sends "for a new proposal".
6. **Needs from the client**
   - Header with a progress meter (`role=progressbar` plus a live text count).
   - Groups: Files (logo, one row per picture slot, each with what it should show), Details, Words, Questions.
   - "Placeholders still on the site" section.
   - Sticky "Start the build", disabled until the logo is in, with a sentence listing what will be left out.
7. **Live build**
   - Headline "Now: …" and a hidden `role=status` that announces **step changes only**.
   - Progress bar and four figures: running for, time left (`estimate()`; minutes, or "Not enough past builds to say"), spent so far, rounds of fixes.
   - Ten `StepRow`s in the brief's order:
     1. Getting ready
     2. Writing the site's words and structure
     3. Checking the words
     4. An independent reviewer reads the content
     5. Building the site
     6. Automatic checks in a real browser (with the 9 per-check results)
     7. Design review of the screenshots
     8. Final independent review
     9. Rounds of fixes ("Round 1 of 3: …", and for each round: what failed, what changed, the result)
     10. Ready for your approval
   - Map `deriveTimeline` kinds onto these rows. Where audit rows lack a sub-step, show it as waiting or skipped; **never fabricate**.
   - `stallNote()` banner when a step runs long.
   - Stopped and done banners.
   - "You can leave this page…" with a phone toggle.
   - Technical details: job, run, models, tokens, commit, each with copy.
8. **Stopped build / fix:** chip, then headline, then facts (money, tried), then failed checks list, then "who acts" note, then `FixCard`, then Why?. Build all **8 cases**, mapping each to `diagnoseJob().cause` / `haltStatus`:

   | Case | Source | Primary |
   |---|---|---|
   | Details nobody gave us | info / needs_input | Save the details and continue |
   | Unsourced phone/address/prices | info + claims.unsourced-fact | Fix it and continue (with inline add / build without) |
   | Reviewer did not answer | temporary | Check again without changes |
   | AI service out of credit / not set up | money / setup | Try again once it is set up (+ who to ask, "Copy a note for Huraira" via `reportText`) |
   | Checks still failed after last round | fixable / failed_verification | Fix it and continue (failed checks via `checkLabel`) |
   | Spending limit reached | setup + SPEND | Ask Nick to raise the limit for this build (owners see "Raise the limit for this build to $X") |
   | Stopped before saving | saved = none | Write the site again from the proposal (confirm: costs about one build) |
   | Stopped part-way, saved | saved = built / unknown | Continue from where it stopped |

9. **Finished site review**
   - Two chips: "Every check passed" and the readiness chip.
   - Title, page tablist, then the `SitePreview`.
   - Placeholder rows, each with what the picture should show and "Add the picture"; the owner-only tick box.
   - Readiness line (`role=status`).
   - Technical details: 12 checks, screenshots, cost, rounds.
   - Sticky "Approve the site": owner only, disabled until placeholders are cleared or knowingly accepted. Its confirm says nothing is published. Beside it, "Ask for changes" (free text that becomes the next round's instructions, confirmed with its cost).
10. **Activity:** filters by client, person and type pills; save view; grouped by day; time, glyph, who, plain sentence, client. Translate audit actions through one phrase table; never show raw action slugs.
11. **Costs (owner/admin)**
    - Sentence headline ("This month: $X of your $Y cap."), last build cost.
    - 6-month trend with a dashed cap line and a full text alternative; cost per client.
    - "How the caps protect you" with a stacked spend bar showing where the build stopped.
    - Per-model table only under Technical details, with estimates labelled as estimates (`price_basis`).
12. **Team and access:** account requests (approve as role / decline), invite, people list with assigned clients, roles explained in plain words.
13. **Settings:** searchable group nav: Appearance, Detail level, Home, Notifications, Saved views, Keyboard, Budget, Language and region, Team defaults.
    - Appearance edits a **draft**, shown in a live preview with a sticky "N unsaved changes / Save / Discard" bar, and Undo after saving.
    - Persist per person, with owner-set team defaults: owners Simple/Home, admins Detailed/Projects, PMs Simple/Projects.
14. **Notifications:** Inbox (unread dot, chip, title, line, opens the target; "Mark all as read") and Preferences (event × channel checkbox table, quiet hours, digest). It uses the same source as Home attention.
15. **Command palette:** see section 3.

**Roles:** PMs never see approve, money or Team controls, and see only assigned clients (RLS already enforces this; the UI must match). Admins can run builds and fixes but cannot approve proposals, sites, launches or money.

---

## 7. Simple and Detailed

- A per-person setting (stored with the profile). Defaults by role. Switchable from the rail, More, the palette and the D key.
- **Simple:** plain sentences, rounded durations, all `TechDetails` closed.
- **Detailed:** `TechDetails` open, ids with copy buttons, exact timings, check slugs beside their plain names, technical line on project cards.
- **Money, missing details and placeholders show in both modes.**

---

## 8. Verification (every phase)

- `npm test` green, with new tests for:
  - `path.ts`
  - each component's role and name
  - stop-case mapping for all 8 causes, using fixture jobs in `src/test/fake.ts`
  - the money-confirm dialog
  - owner-only gates (approve, launch with placeholders, caps)
  - the PM view
- Playwright or manual screenshots at **1440 × 900 and 375 × 812**, light and dark, compared side by side with the matching frame in `Cockpit Screens*.dc.html`. Fix any drift.
- axe: zero violations per room. Lighthouse a11y ≥ 95. Keyboard-only run of the main flow:
  1. new request
  2. approve the proposal
  3. add the logo and a picture
  4. build
  5. stop and fix
  6. ready for approval
  7. approve
- At 375 px: `document.documentElement.scrollWidth === 375` on every screen.
- Grep the rendered DOM outside `<details>` for banned on-screen words: `plan|job|run id|track [AB]|entity|needs_input|token|sha|claude-|gpt-|gemini|hermes`. There must be none.
- Grep the codebase: no element anywhere labelled deploy or publish.
- Update `PROGRESS.md` with what is verified, with evidence. List anything not done honestly.

---

## 9. Deliverable

- A series of small PRs, one per phase above:
  1. tokens
  2. components
  3. shell
  4. path.ts
  5. each screen
- Each PR description includes:
  - the screens and states covered
  - the screenshots (1440/375, light/dark)
  - the test and axe results
  - any deviation from the design, with the reason (there should be none)

Start by restating the locked rules back in five lines. Then list the files you will change in phase 1. Then begin.
