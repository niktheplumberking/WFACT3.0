# Hermes-lite — Phase 3 controller stand-in

## What this is, and why it isn't self-hosted Hermes

Phase 3's build target (Operator's Manual, Days 6–8) is the self-hosted **Hermes Agent** (Nous
Research). That has a real infra/budget dependency — `BLOCKED-ON-NICK.md` § *Nick's time / Budget &
spend approval* lists **"Where the self-hosted second brain + Hermes run (infra, budget)"** as
**OPEN**, due Day 3, and it is still open as of Phase 3 starting.

The Operator's Manual has a named fallback for exactly this:

> Hermes self-hosting eats more time than budgeted → Fallback: build "Hermes-lite," a thin script
> that reads memory, calls Claude, and applies the tone filter. Use it for this sprint, swap in
> real Hermes once there's runway. **Tell Nick if you do this, don't substitute silently.**

This package is that fallback, taken deliberately, not silently — flagged in `PROGRESS.md` and
`BLOCKED-ON-NICK.md`, and Nick needs to see it (see those two files). It is scoped to exactly what
Blueprint §Phase 3 says to build at this stage and nothing past it:

- ✅ One model path (Claude only). Model *routing* across Claude/GPT-5.6/Kimi K3 is Phase 4.
- ✅ Task decomposition (which memory/state to pull), context assembly, tool permission gating,
  escalation.
- ❌ No write tools of any kind — not gated off, simply never registered. Hermes decides, it
  doesn't act (CLAUDE.md §6).
- ❌ No multi-agent coordination — that's Phase 5 (Agent Runtime) and later.

## What's actually wired here

```
src/
  tools/
    schema.ts        the schema-validated tool wrapper + allowlist (CLAUDE.md §6's Gemini-CLI fix)
    memoryTools.ts    memory.readContext, memory.readClient — read-only, path-traversal-guarded
    stateTools.ts     state.projectStatus — read-only Supabase wrapper
    registry.ts       the allowlist assembly: the only place tools get registered
  state.ts            StateReader interface + the real Supabase-backed implementation
  modelClient.ts       ModelClient interface + ClaudeModelClient + a MockModelClient for tests
  toneFilter.ts        the plain-language fix, built in Phase 3 per the team's own call
  escalation.ts        bounded retry + exponential backoff + hard-cap escalation (CLAUDE.md §6)
  controller.ts         HermesLite — decomposition, context assembly, one model call, tone filter
  cli.ts                smoke-test entry point: `npm run ask -- "..."`
scripts/
  verify-supabase-connection.ts   manual, one-shot, needs real creds — see below
test/                              unit tests, no network, no API key required
```

## Verification status (per CLAUDE.md §1 — nothing here is "done" on its own report)

| Piece | Verified how | Result |
|---|---|---|
| Tool allowlist + schema validation | `test/schema.test.ts` — unregistered tool refused, bad input refused before handler runs, bad output caught after | **PASS**, 6/6 |
| Memory tools (real files, path-traversal guard) | `test/memoryTools.test.ts` — reads the real `memory/context.md`, rejects `../` attempts at the schema layer | **PASS**, 5/5 |
| Tone filter | `test/toneFilter.test.ts` — glossary replacement, phrase-before-substring ordering, unknown-acronym flagging | **PASS**, 5/5 |
| Bounded retry / escalation | `test/escalation.test.ts` — hard cap enforced, exponential backoff timing, recovers within budget | **PASS**, 4/4 |
| Full controller loop (memory + live state → model → tone filter), model mocked | `test/controller.test.ts` | **PASS**, 6/6 |
| Live Supabase query shape (join across `entities`/`clients`/`projects`) | Run directly against `wfact-3-sandbox` via the Supabase admin path (`execute_sql`), 2026-09-10 | **PASS** — returned the two RLS-attack-test fixture rows (`dreamsign`, `bennett-co`), confirming the join `state.ts` uses is correct |
| This app's *own* credential path reaching Supabase (not the admin path above) | Ran `scripts/verify-supabase-connection.ts` with `SUPABASE_URL` + the project's **anon** key, 2026-09-10 | **Connects and queries successfully — but returns 0 rows for both entities.** This is RLS correctly blocking an unauthenticated anon request, the same isolation Phase 2's attack test already proved. It also means: **Hermes cannot answer real status questions using only `SUPABASE_ANON_KEY`.** It needs `SUPABASE_SERVICE_ROLE_KEY` (trusted internal reader) — which is not yet in any `.env.local`, per `BLOCKED-ON-NICK.md`. Logged as a lessons-ledger proposal. |
| Live Claude smoke test (`npm run ask -- "what stage is DreamSign in?"`) — the actual Phase 3 exit check | Not run | **BLOCKED** — `ANTHROPIC_API_KEY` is unset. `BLOCKED-ON-NICK.md` already tracks "Claude / Anthropic API billing confirmation" as **OPEN, Day 1 — blocking**. `cli.ts` refuses to fabricate an answer without it (see `modelClientFromEnv`) rather than mocking around the gap. |

**Exit check status: not met.** Per the Operator's Manual: *"Hermes (or its stand-in) answers
'what's the status of X' correctly and in plain language, sourced from real memory and state, not
a canned response."* Everything up to the model call is built, wired against the real sandbox
database, and independently tested (26/26 automated checks pass, run via `npm test`). The one
step that needs a live Claude call is blocked on `ANTHROPIC_API_KEY`. This is the honest state —
see `PROGRESS.md` Phase 3.

## Running it

```bash
cd packages/hermes
npm install
npm test              # 26 tests, no credentials needed
npm run typecheck
```

To actually ask it something, once credentials exist (`.env.local`, never committed — see
`.env.example`):

```bash
npm run ask -- "what stage is DreamSign in?"
```

`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` unlock live state (falls back to memory-only, with a
clear note, if unset). `ANTHROPIC_API_KEY` is required — there is no fallback for it, by design.
