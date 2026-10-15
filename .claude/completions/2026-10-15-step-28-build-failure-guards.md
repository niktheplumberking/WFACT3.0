# 2026-10-15 — Step 28: build-failure guards

- Commits: `b8d240f` (code, evals, `docs/BUILD-FAILURE-DIAGNOSIS.md`), `f97e8e6` (trackers). Not pushed.
- Diagnosis: 25 build jobs since 2026-09-28, 3 passed. Repeat spend came from rule contradictions (latest: claims gate vs DR-FAKE-SOCIAL-PROOF on supplied quotes, `d3c45995`) and continues that changed nothing.
- Guards: supplied quotes pass `claims.sample-label`; STUCK breaker in `verifyLoop`; `wouldRepeat` refuses a no-change continue (`repeat_refused`), `force` overrides.
- Verification: 18 failure-mode evals (mutation-checked), verification 116, workflow 62, jobs 34, Cockpit 252, typecheck clean; independent agent review, 5 findings fixed.
- Open: live proof after push (re-press Harbor Street continue; cancel queued `caa201f1`); palette contradiction (side session); queued-never-dispatched jobs need a Cockpit signal.
