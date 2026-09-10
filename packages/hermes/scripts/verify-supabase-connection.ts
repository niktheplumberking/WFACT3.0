#!/usr/bin/env node
/**
 * Manual, one-shot check: does the app-level Supabase credential path (SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY from env, exactly what state.ts uses in
 * production) actually reach the wfact-3-sandbox project and get back the shape state.ts expects?
 *
 * This is NOT part of `npm test` — it needs real credentials and a real network call, so it can't
 * run in CI or without a .env.local. Run it by hand once SUPABASE_SERVICE_ROLE_KEY is set:
 *
 *   npm run verify:supabase
 *
 * Until then, the query shape itself was verified once via the Supabase MCP's admin path
 * (execute_sql) on 2026-09-10 — see PROGRESS.md Phase 3 notes. That proved the schema and join
 * are correct; it did NOT prove this app's own credential path works, which is what this script
 * is for.
 */
import { stateReaderFromEnv } from "../src/state.js";

async function main() {
  const { reader, reason } = stateReaderFromEnv();
  if (!reader) {
    console.error(`Cannot run: ${reason}`);
    process.exitCode = 1;
    return;
  }

  for (const entitySlug of ["dreamsign", "bennett-co"]) {
    const rows = await reader.getProjectStatuses(entitySlug);
    console.log(`${entitySlug}: ${rows.length} project(s)`);
    for (const row of rows) {
      console.log(`  - ${row.projectName} (${row.clientName}): ${row.stage} / ${row.status}`);
    }
  }
  console.log("\nSupabase connection verified end to end through this app's own credential path.");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exitCode = 1;
});
