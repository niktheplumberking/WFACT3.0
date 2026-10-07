#!/usr/bin/env node
/**
 * Phase 3 smoke test entry point: `npm run ask -- "what stage is DreamSign in"`.
 * Wires the real tool registry (memory + Supabase-if-configured) and the real Claude model
 * client. Exits with a clear, honest message rather than a fake answer if either is unconfigured.
 */
import { buildToolRegistry } from "./tools/registry.js";
import { listClientSlugs } from "./tools/memoryTools.js";
import { stateReaderFromEnv } from "./state.js";
import { modelClientFromEnv, ClaudeModelClient } from "./modelClient.js";
import { HermesLite } from "./controller.js";
import { randomUUID } from "node:crypto";
import { auditSinkFromEnv, recordAudit, traceSinkFromEnv, type AuditContext } from "@wfact/audit";
import { costForModel } from "./routing.js";
import { traceModelClient } from "./tracing.js";

// Stage 5: prices come from the one table in config/model-routing.json (costForModel), not a copy here.

async function main() {
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) {
    console.error('Usage: npm run ask -- "what stage is DreamSign in"');
    process.exitCode = 1;
    return;
  }

  const { client: rawModelClient, reason: modelReason } = modelClientFromEnv();
  if (!rawModelClient) {
    console.error(`BLOCKED: ${modelReason}`);
    process.exitCode = 1;
    return;
  }
  // Stage 5: trace the call to model_traces when the store is available (Hermes' status answer isn't
  // an agent run, so it is tagged with actor "hermes-lite" and no task id).
  const { sink: traceSink, reason: traceReason } = traceSinkFromEnv();
  if (!traceSink) console.error(`NOTE (traces): ${traceReason}\n`);
  const modelClient = traceSink ? traceModelClient(rawModelClient, traceSink, "hermes-lite") : rawModelClient;

  const { reader: stateReader, reason: stateReason } = stateReaderFromEnv();
  if (!stateReader) {
    console.error(`NOTE: live state layer unavailable — ${stateReason}`);
    console.error("Continuing with memory files only.\n");
  }

  // Stage 1 audit log: every tool call below, plus the final answer, lands in public.audit_log
  // under one run_id. No sink → say so loudly, never pretend the run was audited.
  const { sink: auditSink, reason: auditReason } = auditSinkFromEnv();
  const runId = randomUUID();
  const audit: AuditContext | undefined = auditSink ? { sink: auditSink, actor: "hermes-lite", runId } : undefined;
  if (!audit) {
    console.error(`NOTE (audit): ${auditReason}\n`);
  }

  const registry = buildToolRegistry(stateReader, audit);
  // Step 5: known client folders, so "What happened on <client>'s build?" reads that client's episodic entries.
  const hermes = new HermesLite({ toolRegistry: registry, modelClient, clientSlugs: listClientSlugs() });

  const result = await hermes.answerStatusQuestion(question);

  if (audit) {
    const usage = modelClient instanceof ClaudeModelClient ? modelClient.totalUsage : null;
    const priced = usage && modelClient instanceof ClaudeModelClient ? costForModel(modelClient.modelIdUsed, usage) : null;
    await recordAudit(audit, {
      action: "hermes.answer",
      outcome: result.needsHuman ? "failure" : "success",
      entitySlug: result.entitySlug,
      payload: {
        question,
        sourcesUsed: result.sourcesUsed,
        clientSlug: result.clientSlug ?? null,
        episodesUsed: result.episodesUsed ?? 0,
        needsHuman: result.needsHuman,
        escalationReason: result.escalationReason,
        model: modelClient instanceof ClaudeModelClient ? modelClient.modelIdUsed : modelClient.name,
        ...(usage ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } : {}),
        ...(priced ? { costUsd: priced.costUsd, priceBasis: priced.basis } : {}),
      },
    });
    console.error(`(audit: run_id ${runId} written to audit_log)`);
  }

  if (result.needsHuman) {
    console.error(`ESCALATED — needs a human: ${result.escalationReason}`);
    process.exitCode = 1;
    return;
  }

  console.log(result.answer);
  console.error(`\n(sources: ${result.sourcesUsed.join(", ")})`);
  if (result.episodesUsed) console.error(`(answered from ${result.episodesUsed} episodic entries for client ${result.clientSlug})`);
  if (result.toneFilter.remainingAcronyms.length > 0) {
    console.error(`(tone filter flagged for review: ${result.toneFilter.remainingAcronyms.join(", ")})`);
  }

  if (modelClient instanceof ClaudeModelClient) {
    const { inputTokens, outputTokens } = modelClient.totalUsage;
    const { costUsd: cost } = costForModel(modelClient.modelIdUsed, { inputTokens, outputTokens });
    if (cost !== null) {
      console.error(
        `(cost: ${inputTokens} in / ${outputTokens} out tokens, model ${modelClient.modelIdUsed}, ` +
          `$${cost.toFixed(4)} — log this in BLOCKED-ON-NICK.md's budget tracking per the Fast-Track ` +
          `Plan's routing rule)`,
      );
    } else {
      console.error(
        `(cost: ${inputTokens} in / ${outputTokens} out tokens, model ${modelClient.modelIdUsed} — ` +
          `no pricing on file for this model, re-verify at anthropic.com/pricing before logging a dollar figure)`,
      );
    }
  }
}

main().catch((err) => {
  console.error("Hermes-lite crashed rather than guessing an answer:", err);
  process.exitCode = 1;
});
