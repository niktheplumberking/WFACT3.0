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
import { auditReaderFromEnv, auditSinkFromEnv, traceSinkFromEnv } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent } from "@wfact/frontend-loop/agent";
import { modelClientFromEnv } from "@wfact/frontend-loop/modelClient";
import { appendCorrectionLogRows, formatCorrectionSummary } from "@wfact/frontend-loop/correctionLog";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { evaluatorModelClientFromEnv } from "@wfact/verification/modelClient";
import { traceModelClient } from "@wfact/hermes-lite/tracing";
import { knownClientSlugs } from "@wfact/verification/paths";
import { planStoreFromEnv } from "@wfact/planning/planStore";
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

function blocked(msg: string): never {
  console.error(`BLOCKED: ${msg}`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const resumeIdx = args.indexOf("--resume");
  const resumeRunId = resumeIdx >= 0 ? args[resumeIdx + 1] : undefined;
  const planIdx = args.indexOf("--plan");
  const planId = planIdx >= 0 ? args[planIdx + 1] : undefined;
  const briefPath = resumeIdx >= 0 || planIdx >= 0 ? undefined : args[0];
  if (!briefPath && !resumeRunId && !planId) {
    console.error(
      "Usage: npm run build-and-verify -- <path/to/brief.json>  |  -- --plan <approved-plan-id>  |  -- --resume <run-id>",
    );
    process.exitCode = 1;
    return;
  }

  // Stage 4: build from an owner-APPROVED Planner plan. The approval is a human decision recorded by
  // the database (plan_approvals, migration 0007) — this refuses anything not approved.
  let planBrief: unknown = undefined;
  if (planId) {
    const { store, reason } = planStoreFromEnv();
    if (!store) blocked(reason!);
    const stored = await store.get(planId);
    if (!stored) blocked(`plan ${planId} not found`);
    if (stored.status !== "approved") blocked(`plan ${planId} is "${stored.status}" — only an owner-approved plan is built`);
    console.error(`(building from approved plan ${planId}, decided ${stored.decidedAt}; brief source "${stored.plan.brief.source}")`);
    planBrief = stored.plan.brief;
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

  // Stage 5: every model call is traced to model_traces (tokens, real cost, latency, outcome), tagged
  // with the agent task that made it. Required, like the checkpoint store: an untraced run is exactly
  // the "cost estimated, not measured" gap Blueprint §16K rules out.
  const { sink: traceSink, reason: traceReason } = traceSinkFromEnv();
  if (!traceSink) blocked(`trace store unavailable — ${traceReason}`);
  const builderModel = traceModelClient(builder.client, traceSink, "cli:build-and-verify");
  const reviewerModel = traceModelClient(builderReviewer.client, traceSink, "cli:build-and-verify");
  const qaModel = qa.client ? traceModelClient(qa.client, traceSink, "cli:build-and-verify") : null;

  const deps: WorkflowDeps = {
    frontEndAgent: createFrontendBuilderAgent({ builderModel, evaluatorModel: reviewerModel }),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: qaModel }),
    registry: createSeedRegistry(),
    audit: sink,
    reader,
    artifacts: new FileArtifactStore(REPO_ROOT),
    knownClientSlugs: knownClientSlugs(),
  };

  const result = resumeRunId
    ? await resumeBuildAndVerify(resumeRunId, deps)
    : await buildAndVerify(planBrief ?? JSON.parse(readFileSync(briefPath!, "utf-8")), deps);

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
      const brief = (planBrief ?? JSON.parse(readFileSync(briefPath!, "utf-8"))) as { clientSlug: string };
      const memoryPath = path.join(REPO_ROOT, "clients", brief.clientSlug, "memory.md");
      try {
        appendCorrectionLogRows(memoryPath, result.builderRounds, "4_homepage_build", `workflow ${WORKFLOW_ID} run ${result.workflowRunId.slice(0, 8)}`);
        console.error(`(correction log appended to ${path.relative(REPO_ROOT, memoryPath)})`);
      } catch (err) {
        console.error(`NOTE: correction log not appended — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  console.error(`(every model call traced to model_traces under run ${result.workflowRunId} — Cockpit → Models)`);

  process.exitCode = result.status === "awaiting_launch_approval" ? 0 : 1;
}

main().catch((err) => {
  console.error("build-and-verify crashed — resume from the last checkpoint with --resume <run-id>:", err);
  process.exitCode = 1;
});
