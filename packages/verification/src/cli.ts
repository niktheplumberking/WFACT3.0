#!/usr/bin/env node
/**
 * Phase 5 smoke-test entry point:
 *   npm run verify -- <path/to/page.html> <clientSlug> <goal> <section1,section2,...>
 *
 * Meant to run against whatever `packages/frontend-loop`'s cli.ts just wrote
 * (`clients/<slug>/pages/<template>.html`) — a separate process, separate invocation, on purpose:
 * verification should never be able to see itself as "the same run" as the build it's checking.
 * Same refuse-to-fabricate pattern as `packages/hermes/src/cli.ts` and
 * `packages/frontend-loop/src/cli.ts`: the deterministic checks always run for real; the
 * evaluator step is skipped with an explicit BLOCKED status, never faked, when
 * ANTHROPIC_API_KEY is unset.
 */
import { readFileSync } from "node:fs";
import { formatVerificationSummary } from "./verificationLoop.js";
import { createSeedRegistry, runAgent } from "@wfact/agent-runtime";
import { createQaEvaluatorAgent, QA_EVALUATOR_ROLE } from "./agent.js";
import { evaluatorModelClientFromEnv, ClaudeModelClient } from "./modelClient.js";
import { knownClientSlugs } from "./paths.js";
import { randomUUID } from "node:crypto";
import { auditSinkFromEnv, traceSinkFromEnv } from "@wfact/audit";
import { costForModel } from "@wfact/hermes-lite/routing";
import { traceModelClient } from "@wfact/hermes-lite/tracing";

// Stage 5: prices come from the one table in packages/hermes/config/model-routing.json (costForModel).

async function main() {
  const [htmlPath, clientSlug, goal, sectionsArg] = process.argv.slice(2);
  if (!htmlPath || !clientSlug || !goal) {
    console.error("Usage: npm run verify -- <path/to/page.html> <clientSlug> <goal> [section1,section2,...]");
    process.exitCode = 1;
    return;
  }

  const html = readFileSync(htmlPath, "utf-8");
  const requiredSections = sectionsArg ? sectionsArg.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const otherClientSlugs = knownClientSlugs();

  const { client: rawEvaluator, reason } = evaluatorModelClientFromEnv();
  // Stage 5: trace the evaluator's calls (tagged with the qa-evaluator task) when the store is available.
  const { sink: traceSink, reason: traceReason } = traceSinkFromEnv();
  if (!traceSink) console.error(`NOTE (traces): ${traceReason}\n`);
  const evaluatorModel = rawEvaluator && traceSink ? traceModelClient(rawEvaluator, traceSink, "cli:verify") : rawEvaluator;
  if (!evaluatorModel) {
    console.error(`NOTE (evaluator): ${reason}\n`);
  }

  // Stage 1 audit log + Stage 2 runtime: verification runs as the registered `qa-evaluator` agent.
  // Its lifecycle rows and the loop's `verification.decision` row share one task_id/run_id.
  // WFACT_TASK_ID (optional) ties it to an existing task; a hand-run mints a fresh one.
  const { sink: auditSink, reason: auditReason } = auditSinkFromEnv();
  if (!auditSink) {
    console.error(`NOTE (audit): ${auditReason}\n`);
  }

  const run = await runAgent(
    createQaEvaluatorAgent({ evaluatorModel }),
    {
      taskId: process.env.WFACT_TASK_ID || randomUUID(),
      role: QA_EVALUATOR_ROLE,
      input: { html, clientSlug, requiredSections, otherClientSlugs, goal },
    },
    { registry: createSeedRegistry(), audit: auditSink ? { sink: auditSink } : null },
  );
  const runId = run.runId;
  const audit = auditSink;
  if (!run.output) {
    console.error(`${run.status.toUpperCase()} — verification did not run: ${run.reason}`);
    process.exitCode = 1;
    return;
  }
  const result = run.output;

  console.log(formatVerificationSummary(result));

  if (evaluatorModel instanceof ClaudeModelClient) {
    const { inputTokens, outputTokens } = evaluatorModel.totalUsage;
    const { costUsd } = costForModel(evaluatorModel.modelIdUsed, { inputTokens, outputTokens });
    console.error(
      `(cost — evaluator (claude ${evaluatorModel.modelIdUsed}): ${inputTokens} in / ` +
        `${outputTokens} out tokens, ${costUsd === null ? "price unknown" : `$${costUsd.toFixed(4)}`})`,
    );
  }

  if (audit) {
    console.error(`(audit: run_id ${runId} written to audit_log)`);
  }

  process.exitCode = result.status === "approved" ? 0 : 1;
}

main().catch((err) => {
  console.error("verification crashed rather than faking a result:", err);
  process.exitCode = 1;
});
