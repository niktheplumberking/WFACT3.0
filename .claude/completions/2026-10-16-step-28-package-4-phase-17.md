# 2026-10-16 — Step 28 Package 4 phase 17: Settings

Status: Step 28 IN PROGRESS; phase 17 built and pushed.

- Code: `dc4b05b` (pages/Settings.tsx new; pre-v2 Settings removed from pages/Misc.tsx; lib/prefs.ts new: Home layout,
  landing, saved-view keys; Home/Work/Activity read keys from it; OpenOn in App.tsx; SHORTCUTS exported from Shell; app.css).
- Storage: localStorage only (profiles has id, role, full_name, created_at; nothing else holds preferences; checked 2026-10-16).
- Tests: vitest 303/303 (16 new). Mutation: applying the appearance draft immediately fails the preview test.
- tsc clean; build clean; dist/ grep for fake/dev strings: 0 files.
- Browser (cockpit-fake, synthetic): axe 0 for all nine groups at 1440x900 and 375x812, light and dark, and with a dirty draft;
  dark preview inside a light page and light preview inside a dark page checked by computed colours; Save + Undo toast;
  "Open the Cockpit on" Projects redirects the first open of a tab only; console clean.
- Logged in BLOCKED-ON-NICK: per-person and team settings have nowhere to live; formats, notification channels,
  "Request a change", renaming views not built.
- Noticed, not changed: at 1440 the save bar and the toast share the bottom edge (the toast sits over the bar's right
  end for its 9 s); on phones the nine group buttons come before the group content.
- Phase 16 CI: `38942505031` green incl. Deploy Cockpit to Vercel.
