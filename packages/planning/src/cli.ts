#!/usr/bin/env node
/**
 * Stage 4 entry point — a raw request in, an owner-approvable plan out:
 *
 *   doppler run -- npm run intake -- <path/to/raw-request.txt|.json>
 *   doppler run -- npm run intake -- --replan <rejected-plan-id>
 *
 * Models come from Hermes-lite's routing table (packages/hermes/config/model-routing.json), slot
 * `intake` and slot `planner` — never named here. Output: a PENDING row in plan_approvals. The owner
 * approves/rejects it in the Cockpit's Approvals room; then:
 *
 *   doppler run -- npm run build-and-verify -- --plan <plan-id>     (packages/workflow)
 */
import { readFileSync } from "node:fs";
import { auditSinkFromEnv } from "@wfact/audit";
import { resolveModelRoute, estimateCostUsd } from "@wfact/hermes-lite/routing";
import { ClaudeJsonClient } from "./modelClient.js";
import { planStoreFromEnv } from "./planStore.js";
import { intakeAndPlan, replan, type PlanningResult } from "./pipeline.js";

function blocked(msg: string): never {
  console.error(`BLOCKED: ${msg}`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const replanIdx = args.indexOf("--replan");
  const replanId = replanIdx >= 0 ? args[replanIdx + 1] : undefined;
  const rawPath = replanIdx >= 0 ? undefined : args[0];
  if (!rawPath && !replanId) {
    console.error("Usage: npm run intake -- <raw-request file>   |   -- --replan <rejected-plan-id>");
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) blocked("ANTHROPIC_API_KEY is not set (use doppler run — docs/SECRETS.md)");
  const { store, reason } = planStoreFromEnv();
  if (!store) blocked(reason!);
  const { sink: audit, reason: auditReason } = auditSinkFromEnv();
  if (!audit) console.error(`NOTE (audit): ${auditReason}\n`);

  const intakeRoute = resolveModelRoute("intake");
  const plannerRoute = resolveModelRoute("planner");
  console.error(
    `(routing ${intakeRoute.configVersion}: intake → ${intakeRoute.model} [${intakeRoute.tier}, ${intakeRoute.source}]; ` +
      `planner → ${plannerRoute.model} [${plannerRoute.tier}, ${plannerRoute.source}])`,
  );
  const intakeModel = new ClaudeJsonClient(intakeRoute, apiKey);
  const plannerModel = new ClaudeJsonClient(plannerRoute, apiKey);
  const deps = { intakeModel, plannerModel, store, audit };

  let result: PlanningResult;
  if (replanId) {
    result = await replan(replanId, deps);
  } else {
    const text = readFileSync(rawPath!, "utf-8");
    let raw: unknown = text;
    if (rawPath!.endsWith(".json")) raw = JSON.parse(text);
    result = await intakeAndPlan(raw, deps);
  }

  console.log(`STATUS: ${result.status} (run ${result.runId})`);
  if (result.reason) console.log(`reason: ${result.reason}`);
  if (result.intake) {
    const i = result.intake;
    console.log(`intake: entity=${i.entitySlug} (${i.entityConfidence}), lead=${i.leadType}, client=${i.clientName} → ${i.clientSlug}`);
  }
  if (result.plan && result.planId) {
    const p = result.plan;
    console.log(`plan ${result.planId} — template ${p.templateId}; sections: ${p.brief.requiredSections.join(", ")}`);
    for (const t of p.tasks) console.log(`  ${t.order}. [${t.role} @ ${t.stage}] ${t.title}`);
    if (p.openQuestions.length) console.log(`open questions: ${p.openQuestions.join(" | ")}`);
    console.log("NEXT: owner approves or rejects this plan in the Cockpit → Approvals. Nothing is built until then.");
  }
  for (const [label, model] of [["intake", intakeModel], ["planner", plannerModel]] as const) {
    if (model.totalUsage.inputTokens === 0) continue;
    const cost = estimateCostUsd(model.route, model.totalUsage);
    console.error(
      `(cost — ${label} ${model.route.model}: ${model.totalUsage.inputTokens} in / ${model.totalUsage.outputTokens} out` +
        `${cost === null ? ", price unknown for an overridden model" : `, $${cost.toFixed(4)}`})`,
    );
  }
  process.exitCode = result.status === "awaiting_owner_approval" ? 0 : 1;
}

main().catch((err) => {
  console.error("intake crashed rather than faking a plan:", err);
  process.exitCode = 1;
});
