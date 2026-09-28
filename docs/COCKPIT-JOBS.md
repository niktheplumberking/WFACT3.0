# Cockpit jobs — every pipeline action from the Cockpit

Decision (Huraira, 2026-09-28): all actions run from the Cockpit app, and the worker is **GitHub
Actions**. The Cockpit only *requests* work (Blueprint §2: "displays and gates, it does not compute
the work"); the pipelines run with the secrets on GitHub and write results back.

```
Cockpit → Actions room (signed in, owner/admin)
   │ 1. INSERT public.jobs (RLS + trigger: who, what, params validated; build only for APPROVED plans)
   │ 2. POST  /functions/v1/dispatch-job {jobId}   (Supabase Edge Function)
   ▼          re-checks owner/admin + job is yours + queued → GitHub workflow_dispatch(job_id) → "dispatched"
.github/workflows/cockpit-job.yml   (job_id validated as UUID; secrets from Doppler prd)
   └─ packages/jobs/src/run.ts → the SAME pipeline code as the CLIs → writes status/result to the job
Cockpit polls the jobs list every 5s while anything is in flight.
```

| Cockpit action | Job kind | Runs |
|---|---|---|
| New client request (paste) | `intake` | Intake → Planner → pending plan in **Approvals** |
| Re-plan from note (rejected plan) | `replan` | Planner with the owner's rejection note (once; then human) |
| Build + verify (approved plan) | `build_plan` | build-and-verify@1; pages → private `artifacts` bucket; ends at the launch **hard-gate** |
| Resume from last checkpoint (failed build) | `resume` | continues from the durable checkpoint, no rebuild |
| Verify a page | `verify` | qa-evaluator on a page (artifact store first, else repo) |
| Ask Hermes | `ask` | Hermes-lite status answer from memory + state |

There is deliberately **no deploy button** — Launch stays a human decision (CLAUDE.md §3).

## One-time setup (Huraira — needs a token only you can create)

The dispatcher needs a GitHub token that can start workflows on `niktheplumberking/WFACT3.0`. It
lives only in the Edge Function's secrets — never in the browser, the repo, or Doppler.

1. Create the token. Your account is a collaborator (not the repo owner), so use a **classic PAT**
   with scope `repo` (GitHub → Settings → Developer settings → Personal access tokens (classic)).
   If Nick prefers, he can create a *fine-grained* token on his account instead, limited to this repo
   with **Actions: Read and write** only — the tighter option.
2. Store it as the Edge Function secret `GITHUB_DISPATCH_TOKEN`: Supabase dashboard → project
   `mcaxxhgjptwowwrluhra` → Edge Functions → Secrets → add `GITHUB_DISPATCH_TOKEN`.
3. Try it: Cockpit → **Actions** → Ask Hermes. The job should go queued → dispatched → running →
   succeeded in ~1 minute, with a "run log" link to the GitHub run.

Until step 2 is done, the dispatcher fails each job immediately with "dispatcher not configured" —
it never leaves a job looking queued-and-fine.

## Guarantees (and where each is enforced)

- Only owner/admin can request or dispatch, only as themselves — RLS + `jobs_validate_request`
  trigger, re-checked in `dispatch-job`.
- Params validated in the database before any worker sees them (types, lengths, UUIDs, page-path
  shape); only the job id reaches GitHub, and it is UUID-checked before use — no user text in a shell.
- A build can only be requested for an **owner-approved** plan (trigger), and the runner re-checks.
- Status is forward-only, the request is immutable, jobs can't be deleted; every request/dispatch is
  in `audit_log`; every model call in a job is in `model_traces`.
- A runner crash marks the job failed (`--mark-failed` step) rather than leaving it "running".

## Known limits (honest)

- Startup is ~30–60 s per job (GitHub runner + install). Fine for builds; slow for a quick question.
- Runs from GitHub can't write `clients/<slug>/memory.md` into the repo; the correction rounds are in
  the job result instead. Stage 6's Documentation agent is the proper home for episodic memory.
- A job stuck in `dispatched` (e.g. GitHub outage) is visible as such; there is no auto-retry yet.
