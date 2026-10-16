# 2026-10-16 — Step 28 Package 4 phase 16: Team and access

Status: Step 28 IN PROGRESS; phase 16 built and pushed.

- Code: `e5c6333` (pages/Team.tsx new at /team; pre-v2 AccountsTab removed from pages/Decisions.tsx; /decisions/accounts
  redirects; app.css; dev ?fake-team=1; flows.test.tsx button name updated). Trackers: commit after `e5c6333`.
- Writes: only the existing decide_account_request rpc (approve with role / reject with a reason of 3+ characters).
- Data checked read-only (2026-10-16): profiles (id, role, full_name, created_at), profile_clients (profile_id, client_id; 0 rows),
  no invite table/rpc/Edge Function; RLS: profile_clients and profiles readable by owner/admin.
- Tests: vitest 287/287 (13 new). Mutation: letting admins choose any role fails the admin test.
- tsc clean; build clean; dist/ grep for fake/dev strings: 0 files.
- Browser (cockpit-fake, synthetic): axe 0 at 1440x900 and 375x812, light and dark, and with the decline dialog open; keyboard:
  Enter opens the dialog, focus on "Why", Escape closes and returns focus; admin has no role choice; PM sees the notice; console clean.
- Logged in BLOCKED-ON-NICK: invite, per-person Change, PM role words, the dropped "Recently decided" list.
- Phase 15 CI: `38934744558` green incl. Deploy Cockpit to Vercel.
