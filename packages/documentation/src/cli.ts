#!/usr/bin/env node
/**
 * Backfill / materialize episodic entries for finished workflow runs:
 *
 *   doppler run -p wfact-3-0-codebase -c dev -- npm run document -- --client <slug> --run <workflow-run-id> [--run <id> ...]
 *
 * For each run, the Documentation agent (through runAgent, audited like every agent run) reads the run's audit_log
 * and model_traces rows and appends every stage not yet in clients/<slug>/memory.md:
 *   - a stage the agent already documented live (a documentation.entry row, e.g. from a Cockpit run on a GitHub
 *     runner whose disk is gone) is written exactly as recorded ("materialized");
 *   - any other stage is generated from the raw trail and marked backfilled.
 * Entries already in the file are never written twice. The client's entity comes from clients/<slug>/brief.json,
 * and the agent refuses a run that belongs to another client or entity.
 *
 * Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (Doppler). Refuses to run without the audit sink: an unaudited
 * agent run is exactly what Blueprint §16K rules out.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { auditSinkFromEnv } from "@wfact/audit";
import { createSeedRegistry, fileClientEntityResolver, runAgent } from "@wfact/agent-runtime";
import { DOCUMENTATION_ROLE, createDocumentationAgent, registerDocumentationAgent } from "./agent.js";
import { FileMemoryStore } from "./memoryStore.js";
import { runRecordReaderFromEnv } from "./records.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function blocked(msg: string): never {
  console.error(`BLOCKED: ${msg}`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const client = args[args.indexOf("--client") + 1];
  const runs = args.flatMap((a, i) => (a === "--run" && args[i + 1] ? [args[i + 1]!] : []));
  if (args.indexOf("--client") < 0 || !client || !/^[a-z][a-z0-9-]*$/.test(client) || runs.length === 0 || runs.some((r) => !UUID_RE.test(r))) {
    console.error("Usage: npm run document -- --client <slug> --run <workflow-run-uuid> [--run <uuid> ...]");
    process.exitCode = 1;
    return;
  }
  const entitySlug = fileClientEntityResolver(REPO_ROOT)(client);
  if (!entitySlug) blocked(`clients/${client}/brief.json names no entity, so the run cannot be bound to one`);
  const { sink, reason: sinkReason } = auditSinkFromEnv();
  if (!sink) blocked(sinkReason!);
  const { reader, reason: readerReason } = runRecordReaderFromEnv();
  if (!reader) blocked(readerReason!);

  const registry = registerDocumentationAgent(createSeedRegistry());
  const agent = createDocumentationAgent({ records: reader, memory: new FileMemoryStore(REPO_ROOT) });
  let failed = 0;
  for (const runId of runs) {
    const run = await runAgent(
      agent,
      { taskId: randomUUID(), role: DOCUMENTATION_ROLE, input: { mode: "backfill", workflowRunId: runId, clientSlug: client, entitySlug }, entitySlug, clientSlug: client },
      // The agent's own rows go on the run it documents, beside the rows it read.
      { registry, audit: { sink }, runId },
    );
    if (run.status === "completed" && run.output) {
      const o = run.output;
      console.log(
        `run ${runId}: ${o.appended.length} appended (${o.backfilled.length} backfilled, ${o.materialized.length} materialized), ` +
          `${o.alreadyRecorded.length} already recorded, ${o.excludedRows} foreign row(s) excluded -> ${o.memoryPath} (task ${run.taskId})`,
      );
    } else {
      failed += 1;
      console.log(`run ${runId}: ${run.status.toUpperCase()} — ${run.reason} (task ${run.taskId})`);
    }
  }
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error("documentation backfill crashed:", err);
  process.exitCode = 1;
});
