# @wfact/workflow — build → verify (Continuation Plan Stage 3)

The one entry point for a client pipeline. Replaces running `frontend-loop`'s `build-page` and then
`verification`'s `verify` by hand.

```bash
doppler run -- npm run build-and-verify -- ../../clients/<slug>/brief.json
doppler run -- npm run build-and-verify -- --resume <workflow-run-id>
```

## What it does (Blueprint Phase 6, Fig. 02)

1. **Build**: the `front-end-builder` agent (on `@wfact/agent-runtime`) writes
   `clients/<slug>/pages/<template>.html`.
2. **Checkpoint**: a `workflow.checkpoint` row in `audit_log` with stage `build`, the path and a sha256.
   This means "built, not yet verified".
3. **QA**: the `qa-evaluator` agent checks the *checkpointed* file, re-hashed first. If the hash
   changed, the run halts with `checkpoint_corrupt`; it never verifies a changed file.
4. **On failure**: the exact failed check IDs and evaluator issues go back to the builder as a
   revision (`FrontendLoop.revise`), then QA runs again. This is bounded (`maxQaRevisions`,
   default 2), then it halts with those specifics.
5. **On pass**: a `verified` checkpoint, then `workflow.gate` (`launch`, `hard-gate`). **It never
   deploys.** Launch is a human decision (CLAUDE.md §3).

**Crash recovery**: `--resume <run-id>` reads the run's rows back from `audit_log` and continues from
the last checkpoint. It doesn't re-run a checkpointed build, and it doesn't re-open a finished run.

## Stand-in disclosure (Continuation Plan rule 2)

This is a **hand-rolled, in-process workflow, not the durable execution engine the Blueprint names**
(n8n / Temporal, §3 and §13):
- There's no queue.
- Nothing restarts a crashed run automatically; a human or CLI runs `--resume`.
- Only one workflow is defined.

Durability means only that checkpoints survive in Postgres. The Plan defers the real engine until
multiple concurrent workflows need it. Also logged in `PROGRESS.md`.

## Evidence

- Unit tests (7, run in CI):
  - Clean path ends at the launch gate.
  - `packages/verification/test/fixtures/broken.html` is caught before any verified checkpoint or
    gate, and the builder's revision prompt contains every failed check ID.
  - Broken-then-fixed passes on the second cycle.
  - A crash after the build checkpoint resumes with zero builder calls.
  - A tampered artifact is refused on resume.
  - A finished run isn't re-opened.
  - A malformed brief writes no rows.
- Live (2026-09-28), run `cb59c6a4…`, DreamSign placeholder brief, secrets via Doppler only:
  - `awaiting_launch_approval` in 1 cycle; the builder took 2 internal correction rounds.
  - The artifact on disk re-hashes to the checkpoint's `6771ed270ff7…`.
  - An independent re-run of the verification CLI: 6/6 checks pass and the evaluator approves.
