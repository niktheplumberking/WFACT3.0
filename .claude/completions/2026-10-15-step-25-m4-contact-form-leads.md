# 2026-10-15 — Step 25 / MVP M4: contact form that saves leads (PARTIAL)

Built locally (not applied, not deployed, not pushed): migration 0025 + attack test (`1da9a5a`), `submit-lead` Edge Function + 19 tests +
Deno CI job (`60061b7`), both starters wired through `brief.leadForm` set by the runner (`b1cd762`), `launch.form-connected` check with a
seeded failure (`f8b1bf7`), BLOCKED-ON-NICK row for CRM/notification and the missing Cockpit leads view (`b7989d3`), trackers `7f84e9a`.

Waiting on Huraira's GO: apply 0025 and run the attack test, set `LEAD_IP_SALT`, deploy `submit-lead` with verify_jwt false, create a
synthetic Lanternworks `clients` + `lead_sites` row (origins http://127.0.0.1:4173 and :4174), then the live JS/no-JS submits and curl refusals.
