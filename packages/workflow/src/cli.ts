#!/usr/bin/env node
/**
 * The one entry point for a client pipeline (Continuation Plan Stage 3, task 3) — replaces running
 * `frontend-loop`'s build-page and then `verification`'s verify by hand:
 *
 *   npm run build-and-verify -- ../../clients/<slug>/brief.json
 *   npm run build-and-verify -- --resume <workflow-run-id>
 *
 * Secrets come from the environment (Doppler: `doppler run -- npm run build-and-verify -- …`, see
 * docs/SECRETS.md). Refuses to run without the audit sink: checkpoints are audit_log rows, so a
 * workflow with no durable checkpoint store would only be pretending to be recoverable.
 * Exit 0 only for `awaiting_launch_approval`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { auditReaderFromEnv, auditSinkFromEnv } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent } from "@wfact/frontend-loop/agent";
import { modelClientFromEnv } from "@wfact/frontend-loop/modelClient";
import { appendCorrectionLogRows, formatCorrectionSummary } from "@wfact/frontend-loop/correctionLog";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { evaluatorModelClientFromEnv, ClaudeModelClient } from "@wfact/verification/modelClient";
import { knownClientSlugs } from "@wfact/verification/paths";
import {
  buildAndVerify,
  resumeBuildAndVerify,
  qaFailureToIssues,
  FileArtifactStore,
  WORKFLOW_ID,
  WORKFLOW_VERSION,
  type WorkflowDeps,
} from "./buildAndVerify.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
// claude-sonnet-5 pricing, checked 2026-06-24 — same note as packages/hermes/src/cli.ts.
const CLAUDE_USD_PER_MTOK = { input: 2.0, output: 10.0 };

function blocked(msg: string): never {
  console.error(`BLOCKED: ${msg}`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const resumeIdx = args.indexOf("--resume");
  const resumeRunId = resumeIdx >= 0 ? args[resumeIdx + 1] : undefined;
  const briefPath = resumeIdx >= 0 ? undefined : args[0];
  if (!briefPath && !resumeRunId) {
    console.error("Usage: npm run build-and-verify -- <path/to/brief.json>   |   -- --resume <run-id>");
    process.exitCode = 1;
    return;
  }

  const { sink, reason: sinkReason } = auditSinkFromEnv();
  const { reader, reason: readerReason } = auditReaderFromEnv();
  if (!sink || !reader) blocked(`checkpoint store unavailable — ${sinkReason ?? readerReason}`);

  const builder = modelClientFromEnv("builder");
  if (!builder.client) blocked(`builder model: ${builder.reason}`);
  const builderReviewer = modelClientFromEnv("evaluator");
  if (!builderReviewer.client) blocked(`builder's reviewer model: ${builderReviewer.reason}`);
  // A fresh evaluator instance for QA — never the builder's reviewer instance (CLAUDE.md §6).
  const qa = evaluatorModelClientFromEnv();
  if (!qa.client) console.error(`NOTE (QA evaluator): ${qa.reason}\n`);
  console.error(`(builder: ${builder.chose}; builder's reviewer: ${builderReviewer.chose}; QA evaluator: ${qa.client?.name ?? "none"})`);

  const deps: WorkflowDeps = {
    frontEndAgent: createFrontendBuilderAgent({ builderModel: builder.client, evaluatorModel: builderReviewer.client }),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: qa.client }),
    registry: createSeedRegistry(),
    audit: sink,
    reader,
    artifacts: new FileArtifactStore(REPO_ROOT),
    knownClientSlugs: knownClientSlugs(),
  };

  const result = resumeRunId
    ? await resumeBuildAndVerify(resumeRunId, deps)
    : await buildAndVerify(JSON.parse(readFileSync(briefPath!, "utf-8")), deps);

  console.log(`${WORKFLOW_ID}@${WORKFLOW_VERSION} — run ${result.workflowRunId}`);
  console.log(`STATUS: ${result.status} after ${result.cycles} build→QA cycle(s)`);
  if (result.lastCheckpoint) {
    console.log(`last checkpoint: ${result.lastCheckpoint.stage} — ${result.lastCheckpoint.path} (sha256 ${result.lastCheckpoint.sha256.slice(0, 12)}…)`);
  }
  if (result.reason) console.log(`reason: ${result.reason}`);
  if (result.qaFailure) {
    console.log("specific failures (what the builder would be sent):");
    for (const issue of qaFailureToIssues(result.qaFailure)) console.log(`  - ${issue}`);
  }
  if (result.status === "awaiting_launch_approval") {
    console.log("NEXT: launch is a human hard-gate (CLAUDE.md §3). This workflow did not deploy anything.");
  }

  if (result.builderRounds.length > 0) {
    console.error(formatCorrectionSummary(result.builderRounds, result.status === "awaiting_launch_approval"));
    if (!resumeRunId) {
      const brief = JSON.parse(readFileSync(briefPath!, "utf-8")) as { clientSlug: string };
      const memoryPath = path.join(REPO_ROOT, "clients", brief.clientSlug, "memory.md");
      try {
        appendCorrectionLogRows(memoryPath, result.builderRounds, "4_homepage_build", `workflow ${WORKFLOW_ID} run ${result.workflowRunId.slice(0, 8)}`);
        console.error(`(correction log appended to ${path.relative(REPO_ROOT, memoryPath)})`);
      } catch (err) {
        console.error(`NOTE: correction log not appended — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  if (qa.client instanceof ClaudeModelClient) {
    const { inputTokens, outputTokens } = qa.client.totalUsage;
    const cost = (inputTokens / 1e6) * CLAUDE_USD_PER_MTOK.input + (outputTokens / 1e6) * CLAUDE_USD_PER_MTOK.output;
    console.error(`(cost — QA evaluator: ${inputTokens} in / ${outputTokens} out, $${cost.toFixed(4)})`);
  }

  process.exitCode = result.status === "awaiting_launch_approval" ? 0 : 1;
}

main().catch((err) => {
  console.error("build-and-verify crashed — resume from the last checkpoint with --resume <run-id>:", err);
  process.exitCode = 1;
});
