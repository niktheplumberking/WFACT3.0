# Common Mistakes

Read at session start. Each item was paid for in a real incident (see `PROGRESS.md` for evidence).

1. **Pushing `main` deploys the Cockpit to production.** Work on `huraira-work`; push `main` only when Huraira says so
   (CLAUDE.md Part C). Local `main` can lag `origin/main`; check `git rev-parse main origin/main` first.
2. **Marking a step done on your own report.** Done means a separate check passed (test, SQL, CI run id, browser).
   Run `/step-close <id>`, then `node scripts/check-trackers.mjs` must print OK.
3. **Vercel Hobby has a 12-serverless-function ceiling** (Step 20). It caused a silent outage once. Do not add API routes
   to the Cockpit without checking the count.
4. **A Vercel git-deploy can build empty** when Root Directory / env vars are wrong. Deploys here come only from CI
   (`apps/cockpit/vercel.json` disables git deploys on `main`).
5. **Supabase `dispatch-job` Edge Function secrets are not in Doppler** (`GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO`,
   `GITHUB_DISPATCH_REF`). If Cockpit jobs never start, check these first. Its CORS allowlist is hardcoded.
6. **Never print or commit a secret.** Names only. Secrets live in Doppler project `wfact-3-0-codebase`; the only GitHub
   secret is `DOPPLER_TOKEN`. `.env.example` is the shape, not the source.
7. **Agent 37 (the builder's provider) fails in three known ways:** HTTP 402 when credits run out, dropped connections
   (ECONNRESET; retried since `734ded5`), and unpriced token cost (`model_traces.cost_usd` is null).
8. **Same-vendor review is not independent.** The screenshot reviewer is also Agent 37 today; OpenAI returns 429 (no
   credits). Say so in any report that relies on cross-model review.
9. **Synthetic inputs must stay labelled.** `clients/summit-line-roofing` and `clients/dreamsign-pilot` are provisional
   stand-ins, not real clients. Do not let them count toward Blueprint goal 1.
10. **Do not trust a doc over the code or the Blueprint.** Where docs disagree, `docs/HANDOFF.md` section 2 says which governs.
