# RLS Attack Test — Results

## Run 2: 2026-09-21, against the canonical project

**Run against**: `WFACT 3.0 Project` (Supabase project `mcaxxhgjptwowwrluhra`, org
`xwdydbzmucvupwmqdhwg`), created 2026-09-21 and confirmed by Huraira as the canonical Supabase project
going forward (replacing `wfact-3-sandbox` below — access to that org was lost/not carried over, see
`BLOCKED-ON-NICK.md`). Migrations `0001`–`0005` applied fresh to this project via the Supabase MCP
(`apply_migration`, all 5 succeeded in order), then `scripts/rls_attack_test.sql` run section by
section via `execute_sql` — same script, same expected values as Run 1 below. Per `CLAUDE.md` §1: this
is the independent check, not the builder's own report; every number is an actual query result against
a project this session did not build the schema into by assumption — it was verified empty first
(`public.projects` did not exist) before any migration ran.

**Result: PASS.** Every row matched Run 1's expected values exactly, including the entity-consistency
trigger rejecting the mismatched insert (`P0001: entity law violation...`). Unlike Run 1, no recursion
error occurred on the first PM query — migration 0005's fix was already in place before the attack test
ran, so nothing new was caught in the RLS logic itself this time. Synthetic attack-test seed data was
deleted afterward (`entities`/`clients`/`projects`/`tasks`/`correction_rounds`/`auth.users` rows with
the test IDs) so the project is clean before Phase 3's real smoke test runs against it — confirmed all
7 tables back to 0 rows via `list_tables`.

**New finding, not in Run 1**: `get_advisors(security)` flagged `public.rls_auto_enable()` (SECURITY
DEFINER, publicly executable) — this is a Supabase-platform-provisioned event trigger function (auto-
enables RLS on newly created tables), not part of migrations `0001`–`0005` and not something this
project's schema introduced. Confirmed via `pg_get_functiondef`: it `RETURNS event_trigger`, which
Postgres only invokes through the event-trigger system, not as a callable RPC, so the practical risk is
low despite the lint's WARN level. Logged as a carry-forward item below rather than "fixed" — it isn't
this project's function to modify.

## Run 1: 2026-09-08, original sandbox (superseded)

**Run against**: `wfact-3-sandbox` (Supabase project `xwljilyjirmcryakbirk`, Designtive org), a dedicated
sandbox created for this sprint — separate from Nick's real 2.0 Supabase project (still blocked, see
`BLOCKED-ON-NICK.md`). Schema: migrations `0001`–`0005` in `packages/db/migrations/`. Test script:
`scripts/rls_attack_test.sql`.

**Run date**: 2026-09-08. Per `CLAUDE.md` §1: this is the independent check, not the builder's own
report — every number below is an actual query result, not a claim.

**Superseded 2026-09-21**: this project is no longer reachable from the build environment (see Run 2
above); `wfact-3-sandbox` itself was never confirmed torn down, it's simply no longer the project in
use. Results below kept for history — they were real when run.

## Result: PASS

| Check | Expected | Actual | Result |
|---|---|---|---|
| PM (scoped to DreamSign only) sees clients | 1 | 1 | ✅ |
| PM sees projects | 1 | 1 | ✅ |
| PM sees tasks | 1 | 1 | ✅ |
| PM sees correction_rounds | 1 | 1 | ✅ |
| PM sees entities | 1 | 1 | ✅ |
| PM direct-fetch Bennett client by ID | 0 | 0 | ✅ |
| PM direct-fetch Bennett project by ID | 0 | 0 | ✅ |
| PM direct-fetch Bennett tasks by entity_id | 0 | 0 | ✅ |
| Owner sees entities | 2 | 2 | ✅ |
| Owner sees clients | 2 | 2 | ✅ |
| Owner sees projects | 2 | 2 | ✅ |
| Owner sees tasks | 2 | 2 | ✅ |
| Owner sees correction_rounds | 1 | 1 | ✅ |
| Anonymous sees entities/clients/projects/tasks/correction_rounds/profiles | 0 each | 0 each | ✅ |
| Insert project with mismatched entity_id (client=DreamSign, entity=Bennett) | rejected | rejected (`entity law violation`, P0001) | ✅ |

**Cross-entity isolation held. The entity law is now enforced at the schema level (trigger), not just
by convention** — directly satisfying Ecosystem Blueprint §4 Phase 1's requirement.

## A real bug this test caught (log this in the lessons ledger, not just here)

The first attack query **failed**, not passed: `ERROR 54001: stack depth limit exceeded` inside
`is_owner_or_admin()`. Root cause: that function was `SECURITY INVOKER` and read `public.profiles`,
whose own RLS policy called `is_owner_or_admin()` again — Postgres does not guarantee left-to-right
short-circuit evaluation of a policy's `OR` expression, so the planner recursed into it indefinitely.

Fix (migration `0005`): moved the three RLS helper functions to a `private` schema (never exposed by
PostgREST) and made them `SECURITY DEFINER` again. Because the function owner also owns `profiles`, and
Postgres exempts a table's owner from its own RLS policies, the internal read no longer re-triggers the
calling policy. This also happens to satisfy the original advisor finding (these functions are no longer
callable as public RPC endpoints) — one fix, two problems solved, verified by re-running `get_advisors`
(clean) and the attack test (now passing) afterward.

**This is exactly the discipline `CLAUDE.md` §1 exists to enforce**: the first version of this schema
looked correct on review and was not. Only the independent attack test caught it. See
`memory/lessons-ledger.md` for the logged lesson.

## Known open items, not blocking this phase

`get_advisors(security)` still flags `auth_leaked_password_protection` (disabled) — a project-level Auth
setting (HaveIBeenPwned checking on signup), not a schema/RLS issue, and not part of Phase 2's scope.
Carry this forward to whoever configures the real production Supabase project's Auth settings.

**Added Run 2, 2026-09-21**: `get_advisors(security)` also flags `public.rls_auto_enable()`, a Supabase-
platform-provisioned event trigger (not part of this schema) as a publicly-executable SECURITY DEFINER
function. It `RETURNS event_trigger`, so Postgres rejects direct invocation outside the event-trigger
system — low practical risk despite the WARN. Not this project's function to modify; carry forward to
whoever manages the real production project, same as the item above.

## How to re-run this

```
-- Fresh project: apply packages/db/migrations/0001 through 0005 in order, then run
-- scripts/rls_attack_test.sql end to end. Expect every row above to match, and the final
-- INSERT to be rejected with an "entity law violation" error, not succeed.
```
