# Step 28 Package 4 phase 18 — Notifications (2026-10-19)

Status: built, pushed; CI to be recorded with phase 19.

- Code: `b6a6e39`. Trackers: `736edde`.
- `components/kit.tsx` `Tabs` (tablist, arrows/Home/End, tab controls tabpanel; segmented look via `app.css`).
- `pages/Misc.tsx` `Notifications()`: Inbox from Home attention (dot + "Unread.", chip, time, client: title, line),
  loading / failed / empty / PM states; Preferences: "In the app", "Always on" for three events, no dead controls.
- `lib/prefs.ts` `NOTIFY_LINES`: one wording shared with Settings → Notifications.
- Spend notice left out (Home attention is "What needs you"; design's month vs live 7-day cap). Logged with email/phone,
  quiet hours and digest in BLOCKED-ON-NICK.md.
- Verification: vitest 314/314 (11 new), mutation (tab role, PM gate) caught 4 failures; tsc clean; build clean; dist
  has no dev code; axe 0 in both tabs at 1440/375 light and dark and as PM; focus ring on real Tab.
- Next: phase 19 (cleanup and Package 4 exit check), on GO.
