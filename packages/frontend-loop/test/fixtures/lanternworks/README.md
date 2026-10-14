# Lanternworks fixture (SYNTHETIC rehearsal client)

- `content.json`: the Track B content stored for job `55ddba7c` (plan `403305ec`), downloaded 2026-10-14 from the
  artifacts bucket (`clients/lanternworks-studio/sites/track-b/content.json`). It reached the launch gate with zero QA
  issues and is the thin, off-brief site the Package 1 checks must now refuse.
- `raw-request.txt`: copy of `clients/lanternworks-studio/raw-request.txt` (fictional request, Step 25 rehearsal).
- `requested.json`: what the Intake model is expected to extract from it (the test runs it through `verifyRequested`).

Redacted before commit: the stored content's contact facts were the owner's test values entered in the Cockpit (a phone
number, "test@lanternworks.com", "Testing Address"). The phone and address are removed and the email is the request's own
`hello@lanternworks.example`; nothing else in the file was changed.
- `hero-sample.jpg`: a SYNTHETIC test photo (a 1200 px JPEG of the Package 2 screenshot), used as an owner-supplied image in the Package 3 media tests.
