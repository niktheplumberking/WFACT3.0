#!/usr/bin/env node
/**
 * Phase 5 smoke-test entry point:
 *   npm run verify -- <path/to/page.html> <clientSlug> <goal> [section1,section2,...] [--stage launch]
 *
 * Step 7: this CLI and `npm run qa` (packages/rendered-qa) now share ONE check list, the evaluation registry
 * (config/eval-registry.json). This CLI runs the registry's deterministic text gate (the goal argument is the
 * only fact source). It has no browser (rendered-qa depends on this package, not the other way round), so the
 * registry's rendered and screenshot-review checks are reported NOT RUN and the run ends "not verified", never
 * approved; no model is called for a run that cannot be approved. Use `npm run qa` for a full verification.
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
import { evaluatorModelClientFromEnv } from "./modelClient.js";
import { knownClientSlugs } from "./paths.js";
import { registryGateChecks } from "./registry.js";
import { notRunResults, registry, registryTable } from "./evalRegistry.js";
import { assertCrossModelSeparation, identityFromVendor, modelIdentity } from "./crossModel.js";
import type { AsyncCheckSuite } from "./checks/types.js";
import { randomUUID } from "node:crypto";
import { auditSinkFromEnv, traceSinkFromEnv } from "@wfact/audit";
import { traceModelClient } from "@wfact/hermes-lite/tracing";

// Stage 5: prices come from the one table in packages/hermes/config/model-routing.json (costForModel).

/** The registry's browser and screenshot-review checks, which this CLI cannot run: NOT RUN, so never approved. */
const NO_BROWSER_SUITE: AsyncCheckSuite = {
  id: "registry.not-run-here",
  description: "Registry checks npm run verify cannot run (no browser).",
  run: async () => notRunResults(["rendered", "review"], "npm run verify has no browser; run npm run qa (packages/rendered-qa) for the rendered checks and the screenshot review"),
};

async function main() {
  const argv = process.argv.slice(2);
  const stageAt = argv.indexOf("--stage");
  const stage = stageAt >= 0 ? argv[stageAt + 1] : "preview";
  const positional = argv.filter((_, i) => stageAt < 0 || (i !== stageAt && i !== stageAt + 1));
  const [htmlPath, clientSlug, goal, sectionsArg] = positional;
  if (!htmlPath || !clientSlug || !goal || (stage !== "preview" && stage !== "launch")) {
    console.error("Usage: npm run verify -- <path/to/page.html> <clientSlug> <goal> [section1,section2,...] [--stage preview|launch]");
    process.exitCode = 1;
    return;
  }

  const html = readFileSync(htmlPath, "utf-8");
  const requiredSections = sectionsArg ? sectionsArg.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const otherClientSlugs = knownClientSlugs();

  // Step 7: the evaluator must be another model family than the builder (WFACT_BUILDER_VENDOR, default agent37,
  // today's builder). A same-family pair is refused here, loudly, before anything runs.
  const builderIdentity = identityFromVendor(process.env.WFACT_BUILDER_VENDOR || "agent37", process.env.WFACT_BUILDER_MODEL || undefined);
  const { client: rawEvaluator, reason } = evaluatorModelClientFromEnv(process.env, { avoid: builderIdentity });
  const separation = assertCrossModelSeparation(builderIdentity, rawEvaluator ? modelIdentity(rawEvaluator) : null);
  console.error(`(cross-model: builder ${separation.builder.family}, evaluator ${separation.evaluator?.family ?? "none"}; config/evaluator.json v${separation.configVersion})`);
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
    createQaEvaluatorAgent({ evaluatorModel, checks: registryGateChecks(), reviewSuites: [NO_BROWSER_SUITE] }),
    {
      taskId: process.env.WFACT_TASK_ID || randomUUID(),
      role: QA_EVALUATOR_ROLE,
      input: { html, clientSlug, requiredSections, otherClientSlugs, goal, factSources: [goal], stage },
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
  console.log(`\nEvaluation registry v${registry().version} (${registry().checks.length} checks):`);
  for (const line of registryTable(result.checkResults)) console.log(`  ${line}`);

  // Step 7: cost per check (deterministic checks are $0; model calls priced from the one routing price table).
  const costs = result.costs ?? [];
  const total = costs.some((c) => c.usd === null) ? null : costs.reduce((a, c) => a + (c.usd ?? 0), 0);
  console.error(`(cost per check: ${costs.map((c) => `${c.id} ${c.ms} ms ${c.usd === null ? "UNPRICED" : `$${c.usd.toFixed(4)}`}`).join("; ")})`);
  console.error(`(total model cost: ${total === null ? "includes UNPRICED calls" : `$${total.toFixed(4)}`})`);

  if (audit) {
    console.error(`(audit: run_id ${runId} written to audit_log)`);
  }

  process.exitCode = result.status === "approved" ? 0 : 1;
}

main().catch((err) => {
  console.error("verification crashed rather than faking a result:", err);
  process.exitCode = 1;
});
