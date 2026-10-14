# WFACT Cockpit design: locked direction (14 Oct 2026)

The design direction and UI are locked. Treat these files as the source of truth; extend them, do not restyle them.

- Cockpit.dc.html: the one live component (all screens, states, prototype logic). Screens, prototype and canvases import it.
- Cockpit Design System.dc.html: rationale, tokens (light/dark), components, annotations, locked decisions.
- Cockpit Screens.dc.html / Cockpit Screens 2.dc.html: every screen at 1440 and 375.
- Cockpit Prototype.dc.html: the clickable main flow.

Locked system:
- Type: Newsreader (display, client quotes in italic), Atkinson Hyperlegible Next (text), Overpass Mono (figures, ids).
- Colour: warm paper neutrals; status only: amber = needs you (diamond), green = done (tick), red = stopped (stop sign); running = ink + turning ring; waiting = hollow circle. Accent (ink/harbour/clay/moss) is personal and never means status.
- Radius 8/10/14/18/999; 4px spacing; 44px minimum targets; one primary button per view.
- Vocabulary: Proposal, Build, Fast local site / Showcase site with motion, Rounds of fixes, Ready for your approval, Waiting for: X. Engineering terms only inside Technical details.
- Six-step path: Request, Proposal, Details needed, Building, Ready for approval, Live.

Locked decisions:
- No deploy/publish control anywhere. "Record that it is live" only records a date.
- Monthly cap ($20) stops new builds only; running builds finish inside the per-build cap ($2.00).
- Client details are relayed by a person; a client link is a "coming later" room.
- Only owners may tick "launch with placeholders".
- PMs see cost so far on their own clients' project pages; Costs room and caps stay owner/admin.
- "Ask the factory" is a command-palette action.
- WFACT is a typeset wordmark until a real mark exists.
