# Cockpit redesign: prompt for Claude Design

Written 2026-10-14 for Huraira. Paste everything below the line into Claude Design. It is self-contained: it describes the
product, the people, every screen, the real build steps and failure cases, and what to hand back. It complements Build-quality
Package 4 (plain-language Cockpit, `docs/BUILD-QUALITY-AND-COCKPIT-UX-PROMPTS.md`); the coding agent implements the approved
design in `apps/cockpit` afterwards. Nothing here changes the hard rules: no deploy button, launch and money stay human.

---

You are a senior product designer. Design the complete UI and UX of **the Cockpit**: the control room of WFACT, an AI-run web
agency. Clients ask for a website; the factory plans it, builds it, checks it and stops at "ready for your approval". The Cockpit
is where a person starts that work, makes every decision, watches what is happening and fixes anything that stops.

The goal: a control room that feels **calm, modern and genuinely beautiful**, that a **non-technical owner can run end to end
without help**, and that still gives a technical person **full control and every detail on demand**. Easy first, powerful
underneath. Design it as a product another agency would pay for, not an internal tool.

## 1. The people

| Person | What they need | How technical |
|---|---|---|
| **Nick, owner** | "Is everything OK, and what needs me?" Approves proposals, final designs, launches and money. Uses a phone as often as a laptop. | Not technical. Must never meet an engineering word. |
| **Huraira, technical owner** | Runs the factory daily: starts builds, reads why something failed, fixes it, watches cost. | Technical. Wants detail, speed, shortcuts and control. |
| **Admins** | Same as Huraira for day-to-day running. | Mixed. |
| **Project managers** | See only the clients assigned to them; can follow progress, cannot approve money or launches. | Mixed. |

Design for all four with one product: the same screens, with detail revealed by role and by the person's own settings.

## 2. What the product does (the one path every project follows)

**Request → Proposal → Details needed → Building → Ready for your approval → Live**

1. **Request**: someone pastes what the client asked for (an email, notes), and can attach the client's logo and the live web
   address.
2. **Proposal**: the factory reads the request and writes a proposal: what the site is, its pages, a recommended kind of site
   ("Fast local site" or "Showcase site with motion"), and questions it could not answer. The owner approves it (choosing the
   kind of site), or asks for changes with a note, which produces a new proposal.
3. **Details needed**: anything the site needs that the client never gave (phone, address, real customer quotes, the logo, the
   client's photos, answers to the open questions). Each can be answered, uploaded or skipped ("build without it").
4. **Building**: the factory writes the content, builds the site and checks it, fixing what the checks find, in a bounded number
   of rounds. This takes minutes and costs a little money per build.
5. **Ready for your approval**: every check passed. The owner sees the site itself (desktop and phone side by side), and chooses
   **Approve** or **Ask for changes** (free text that becomes the next round's instructions). Placeholder pictures still on the
   site are listed; the site is "not ready to launch" until they are added or the owner knowingly ticks "launch with
   placeholders".
6. **Live**: launch happens outside the Cockpit by a person. The Cockpit records it; it never deploys.

### Hard rules the design must keep (non-negotiable)
- **There is no deploy or publish button anywhere.** Launch and money are human decisions, shown as decisions, never automated.
- **Honest data only.** Every number, status and time is real. A room that does not exist yet shows an honest "coming later"
  card, never mock data. Nothing is shown as done unless a check proved it.
- **The factory never invents** client facts, quotes, people or pictures. The UI should make "missing" visible and easy to supply,
  never paper over it.
- Accessibility: WCAG 2.2 AA, 44 px touch targets, visible focus, full keyboard use, screen-reader labels and live regions for
  progress, no horizontal scroll at 375 px, respects reduced motion and text size settings.

## 3. Words (one vocabulary everywhere)

Engineering terms stay in the code, never on the screen. Use these words:

| Engineering term | On screen |
|---|---|
| plan | Proposal |
| job / run | Build |
| track A / track B | Fast local site / Showcase site with motion |
| entity | Agency |
| build-and-check cycles, revisions | Rounds of fixes |
| awaiting launch approval / launch gate | Ready for your approval |
| needs_input | Waiting for: (the thing, in plain words, e.g. "Waiting for the logo") |
| tokens, model names, run ids, commit SHAs, GitHub run numbers | Hidden by default. Shown only inside a collapsed **Technical details** drawer, with copy buttons |

Tone: short, warm, specific sentences. Say what happened, what it means, and the one thing to do next. No jargon, no blame, no
exclamation marks.

## 4. Screens to design

Design every screen at **desktop (1440)** and **phone (375)**, with these states where they apply: empty, loading, running,
waiting on someone, failed, success.

1. **Home: "What needs me"**. The first screen. A short, prioritised list of decisions and actions waiting on this person (approve
   a proposal, add a logo, approve a finished site, a build that stopped), each with one button. Below it: a calm overview of
   every client and where it is on the path, what is running right now, and this month's spend against the cap. If nothing needs
   them, say so plainly and show what the factory is doing.
2. **Projects**: every client, filterable and searchable, each with its position on the path, its next step, who it is waiting
   on, and the last build's result. Grid and list views; pin, group and sort.
3. **New request**: paste the client's request, attach the logo, add the live address. Show what will happen next and how long it
   usually takes. One primary button.
4. **Project page**: the heart of the product.
   - A **progress strip** across the top: Request → Proposal → Details needed → Building → Ready for approval → Live. Each step
     shows what is happening in one sentence, how long it usually takes, and the ONE thing the owner must do next as a single
     primary button.
   - The proposal (pages, kind of site and why, open questions), the details and files supplied, every build of this client
     with its result, the cost so far, and a timeline of decisions.
5. **Proposal review**: what the client wants (quoted from their own words), the recommended kind of site with the reasons, the
   pages, the questions still open, and Approve / Ask for changes. Make choosing the kind of site a clear, visual choice.
6. **Live build view** (see section 5): what is happening right now, step by step, in human words.
7. **Stopped build / fix view** (see section 6): why it stopped, whether money was spent, and the one-click fix.
8. **Needs from the client**: one place for everything missing: logo, pictures (one per placeholder slot, each with what the
   picture should show), contact details, opening hours, real customer quotes, open questions, and placeholders still on the
   site. Each item has upload / answer / skip and one line on why it matters. Show progress ("4 of 6 supplied").
9. **Finished site review**: the site itself, desktop and phone side by side, with a page switcher, Approve, Ask for changes
   (free text), the list of placeholders, and Technical details (checks run, screenshots, cost, rounds of fixes).
10. **Activity**: a human-readable feed of everything the factory and people did, filterable by client, person and type.
11. **Costs**: lead with plain sentences ("This build cost $0.68", "This month: $14.20 of your $20 cap"), a simple trend, cost per
    client; per-model tables only under Technical details. Show how a cap stops a build before it overspends.
12. **Team and access**: invite people, approve account requests, assign PMs to clients, roles explained in plain words.
13. **Settings and personalisation** (see section 7).
14. **Notifications**: an inbox and per-event preferences.
15. **Search / command palette**: jump to any client, build or setting; run common actions from the keyboard.

## 5. Showing what is running (the live build view)

A build runs these real steps, in order. Show each as a row (or a vertical timeline) with a plain sentence, its state (waiting,
running, done, skipped, needs you, stopped), how long it took or is taking, and the usual duration:

1. **Getting ready**: checks the logo, the pictures and the AI services are reachable, before any money is spent.
2. **Writing the site's words and structure** from the client's request.
3. **Checking the words**: every requested service, step and button is there, nothing invented, no thin pages.
4. **An independent reviewer reads the content** (a different AI than the one that wrote it).
5. **Building the site** (a few minutes).
6. **Automatic checks in a real browser**: loads on every page, links work, accessible, fast on phones, layout holds at every
   size, the logo shows, the main button is always reachable on phones, brand colours used correctly, motion on every section.
7. **Design review** of the screenshots.
8. **Final independent review**.
9. **Rounds of fixes**: when a check fails, the factory fixes that specific thing and checks again (at most a set number of
   rounds). Show each round: what failed, what was changed, the result.
10. **Ready for your approval**, or **Stopped** with the reason.

Show live: elapsed time, an honest estimate of time left, cost so far, and the current round ("Round 2 of 3: fixing the phone
layout"). Progress must update live, announce changes politely to screen readers, and never fake precision. A person can leave
and get a notification when it finishes or needs them.

## 6. When something stops (why, and how to fix it)

Every stop is shown as: **what happened** (one plain sentence), **was money spent** (yes, how much / no), **what the factory
already tried**, and **the ONE recommended fix** as a primary button, with the other options as quiet secondary actions. Real
cases to design for, with their real fixes:

| What happened (plain words) | Money spent? | Recommended fix |
|---|---|---|
| "The site needs details nobody gave us" (phone, address, quotes, logo, an answer) | No | Save the details and continue |
| "The checks found a phone number / address / prices on the site that nobody gave us" | Yes | Add the real detail, or build without it; then Fix it and continue |
| "The reviewer did not answer" (temporary; the factory retries by itself first) | No | Check again without changes |
| "An AI service is out of credit or not set up" | No | Try again once it is set up (and who to ask) |
| "The checks still failed after the last round of fixes" | Yes | Fix it and continue (with the exact failed checks listed in plain words) |
| "The build used up its spending limit and stopped on purpose" | Yes, up to the cap | Ask the owner to raise the limit for this build, or stop |
| "It stopped before saving anything" | No | Write the site again from the proposal |
| "It stopped part-way; the saved site is safe" | Partly | Continue from where it stopped |

Also design: a **"Why?"** expander showing the evidence (the failed check, the page, a screenshot crop) in plain words, with the
raw technical log only under Technical details; a confirmation step for anything that costs money ("This starts a new build. It
costs about one build."); and an undo or "changed my mind" path where the action allows it.

## 7. Customisation and controls

Give each person real control without clutter:
- **Appearance**: light, dark or system; an accent colour; comfortable or compact density; text size; reduce motion.
- **Detail level**: "Simple" (the default for owners: plain words, technical details collapsed) or "Detailed" (technical
  details open, ids and timings visible). Per person, switchable from anywhere.
- **Home**: choose, reorder and hide the home sections; pin clients; choose the default landing screen.
- **Notifications**: per event (needs me, build finished, build stopped, spend near the cap, client details supplied), per
  channel (in app, email, phone push), quiet hours, a daily or weekly digest.
- **Views**: saved filters and sorts on Projects and Activity, grid or list, columns shown.
- **Keyboard**: a command palette and shortcuts, with a cheat sheet.
- **Budget**: see the per-build and monthly caps and request a change (changing money stays an owner decision).
- **Language and region**: date, time and currency format.
- **Role defaults**: an owner sets sensible defaults for the team; each person can adjust their own.

Settings must be searchable, grouped in plain words, and every change previewable before it is saved.

## 8. Visual direction

- Calm, confident and modern: an editorial control room, not a dashboard of charts. Generous space, a clear type pairing (a
  characterful display face with a quiet, highly readable text face), real hierarchy, few colours with meaning (one for "needs
  you", one for "done", one for "stopped"), status that never relies on colour alone.
- Motion with a purpose: progress that feels alive, gentle state changes, never decoration; everything still works with reduced
  motion.
- Banned (it reads as AI-generated or templated): purple/blue gradient heroes, the generic three-card feature row, emoji as icons,
  centred-everything layouts, glassmorphism everywhere, fake avatars or logos, filler words ("seamless", "unlock", "supercharge"),
  thin low-contrast grey text, the same section rhythm repeated, gratuitous animation.
- It must be beautiful on a phone first: big touch targets, primary actions within thumb reach, readable without zooming.

## 9. What to hand back

1. A short design rationale: the concept, the type and colour system, and how Simple and Detailed modes work.
2. A design system: colour, type, spacing and radius tokens (light and dark), and the components (buttons, status chips, the
   progress strip, step rows, fix cards, upload rows, the side-by-side site preview, drawers, toasts, empty states, the command
   palette).
3. Every screen in section 4 at 1440 and 375, in the states listed.
4. A clickable prototype of the main flow: **new request → approve the proposal → add the logo and a picture → build (live steps)
   → one stop and its fix → ready for approval → approve**.
5. The stopped-build cards for every case in section 6.
6. Annotations a developer can build from: what each element shows, where its data comes from (request, proposal, build steps,
   costs), and accessibility notes (labels, focus order, live regions).

Before designing, list any assumption you are making and any question you would ask the owner; then design with your best
assumption rather than stopping.
