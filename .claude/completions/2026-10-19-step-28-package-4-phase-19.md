# Step 28 Package 4 phase 19 — cleanup and the Package 4 exit check (2026-10-19)

Status: built, pushed; CI to be recorded at the next tracker update. Package 4 exit check PARTIALLY MET.

- `55e0a8a` alias rename: 185 uses → v2 tokens, `tokens.css` alias block deleted, 0 old names; computed-style fingerprint
  of every element in 21 rooms identical at 1440 light / 375 light / 1440 dark. Guard test in `tokens.test.ts` (vitest
  `css.include` widened to app.css; it was reading app.css as empty).
- `f76a1f6` Overpass sans removed (precache 1634.86 → 1582.33 KiB); dead pre-v2 Costs CSS deleted; toast clear of the
  Settings save bar; phone save bar kept above the tab bar.
- `8bd6de1` plain words on the pre-v2 screens (DOM sweep clean for owner/admin/PM, all fake switches, stop cases, live);
  wordmark label in name; dev `?fake-live=1`.
- `5589192` keyboard-only main flow fixes: ConfirmDialog and shell focus rescue (focus never left on `<body>`),
  `brandUpload` never throws; dev storage upload and `?fake-logo=1`.
- Lighthouse accessibility 100 in all 16 rooms; axe 0 in 21 rooms × 4 views; vitest 319/319.
- Logged: v2 app icon (Nick). Not done: rebuilding the pre-v2 screens (listed in PROGRESS.md Step 28).
- Next: Huraira decides on rebuilding the pre-v2 screens or a separate GO for Package 5.
