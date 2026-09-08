# RLS Attack Test — Results

**Run against**: `wfact-3-sandbox` (Supabase project `xwljilyjirmcryakbirk`, Designtive org), a dedicated
sandbox created for this sprint — separate from Nick's real 2.0 Supabase project (still blocked, see
`BLOCKED-ON-NICK.md`). Schema: migrations `0001`–`0005` in `packages/db/migrations/`. Test script:
`scripts/rls_attack_test.sql`.

**Run date**: 2026-09-08. Per `CLAUDE.md` §1: this is the independent check, not the builder's own
report — every number below is an actual query result, not a claim.

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

## Known open item, not blocking this phase

`get_advisors(security)` still flags `auth_leaked_password_protection` (disabled) — a project-level Auth
setting (HaveIBeenPwned checking on signup), not a schema/RLS issue, and not part of Phase 2's scope.
Carry this forward to whoever configures the real production Supabase project's Auth settings.

## How to re-run this

```
-- Fresh project: apply packages/db/migrations/0001 through 0005 in order, then run
-- scripts/rls_attack_test.sql end to end. Expect every row above to match, and the final
-- INSERT to be rejected with an "entity law violation" error, not succeed.
```
