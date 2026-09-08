# Lessons Ledger

Carried over from 2.0 as-is (Playbook §3): never-repeat mistakes, owner veto included. Any agent may
**propose** an addition here (via the Lessons agent, once it exists, or directly during this sprint).
Nothing lands without a human approving it — this file is never auto-written to. Per Ecosystem
Blueprint §11: "measuring and proposing is autonomous, changing a rule, gate, skill, or routing decision
is not."

Format per entry: date, what happened, what it cost, the rule going forward.

---

## Inherited from WFACT 2.0 (do not repeat)

1. **"Done" meant "an agent said so."** A whole feature pack was silently never installed because
   nothing outside the builder verified the build. → Rule: independent verification is structural, never
   optional, for every stage of every pipeline (WFACT's own build included).
2. **No observability layer.** 2.0 had reports and a registry but no real-time tracing of what an agent
   did and why, and often couldn't answer "why did this fail." → Rule: every agent run, tool call, and
   model call gets traced (cost, latency, outcome) from Phase 8 onward in the full build; even this
   sprint's minimal loop logs correction rounds honestly (Phase 4/5/7).
3. **Memory was an afterthought.** A single Supabase table (Amir's memory/diary) nobody finished wiring.
   → Rule: memory is a first-class subsystem with its own retrieval, decay, and conflict-resolution
   design (Ecosystem Blueprint §8), not a table bolted on at the end.
4. **No task/event queue.** Worked at one project at a time, would not survive concurrent clients.
   → Rule: design the queue in from Phase 6 of the full build, even though it isn't load-bearing until
   concurrency starts.
5. **Multi-agent chains were never load-tested for their real failure mode.** Sequential, dependent
   agent chains compound error multiplicatively — at a 95% per-step success rate, a 10-step chain only
   succeeds ~59% of the time. → Rule: per-stage verification, not a single final check, and measure real
   loop success rate before trusting it with a live client.
6. **DreamSign took 40+ correction batches; Nick's front-end complaint logged 26+.** This is the number
   3.0 has to beat with a real measurement, not an opinion. Tracked per-project going forward.
7. **API cost per client was never measured in 2.0 (flagged UNVERIFIED).** → Rule: real cost per client
   tracked from Phase 2 of the roadmap onward, before any local-model migration decision is made.
8. **A whole class of retired ceremony (Experience Charter, Concept Pitch, invention mandate, Strix
   pentesting, follower tracking, the prompt bank, the scroll-film studio) got demoted for real reasons.**
   → Rule: existing in the 2.0 repo is not a reason to inherit something into 3.0. Every carry-over must
   be justified by a real, cited test or result (see `CLAUDE.md` §5), not by inertia.

## This sprint (2026, 100-hour build)

1. **RLS helper functions using `SECURITY INVOKER` to read a table that has its own RLS policy calling
   that same function caused infinite recursion (`stack depth limit exceeded`).** Postgres does not
   guarantee short-circuit (left-to-right) evaluation of a policy's `OR` expression, so a naive
   `id = auth.uid() or is_owner_or_admin()` policy can call `is_owner_or_admin()` before checking the
   cheap identity condition, and if that function reads the same RLS-protected table, it recurses.
   Caught by the RLS attack test itself (`scripts/rls_attack_test.sql`), not by review — the schema
   looked correct on read-through. → Rule: any RLS helper function that reads a table protected by a
   policy referencing that same function must be `SECURITY DEFINER`, owned by the table owner (so the
   internal read is RLS-exempt), and moved to a non-PostgREST-exposed schema (`private`) rather than
   `public`, so it's neither recursive nor a public RPC endpoint. See
   `packages/db/RLS_ATTACK_TEST_RESULTS.md` for the full trace. Full credit to the discipline in
   `CLAUDE.md` §1 for this being caught in Phase 2 against a sandbox, not months later against a real
   client's data.
