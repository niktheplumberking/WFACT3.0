#!/usr/bin/env node
/**
 * Phase 3 smoke test entry point: `npm run ask -- "what stage is DreamSign in"`.
 * Wires the real tool registry (memory + Supabase-if-configured) and the real Claude model
 * client. Exits with a clear, honest message rather than a fake answer if either is unconfigured.
 */
import { buildToolRegistry } from "./tools/registry.js";
import { stateReaderFromEnv } from "./state.js";
import { modelClientFromEnv, ClaudeModelClient } from "./modelClient.js";
import { HermesLite } from "./controller.js";

// Anthropic pricing per CLAUDE.md §6 ("re-verify anything time-sensitive before relying on it") —
// checked 2026-06-24 (Claude API pricing table): claude-sonnet-5 is $2/1M input, $10/1M output.
// Re-verify if ANTHROPIC_MODEL points at a different model than the default.
const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2.0, output: 10.0 },
};

async function main() {
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) {
    console.error('Usage: npm run ask -- "what stage is DreamSign in"');
    process.exitCode = 1;
    return;
  }

  const { client: modelClient, reason: modelReason } = modelClientFromEnv();
  if (!modelClient) {
    console.error(`BLOCKED: ${modelReason}`);
    process.exitCode = 1;
    return;
  }

  const { reader: stateReader, reason: stateReason } = stateReaderFromEnv();
  if (!stateReader) {
    console.error(`NOTE: live state layer unavailable — ${stateReason}`);
    console.error("Continuing with memory files only.\n");
  }

  const registry = buildToolRegistry(stateReader);
  const hermes = new HermesLite({ toolRegistry: registry, modelClient });

  const result = await hermes.answerStatusQuestion(question);

  if (result.needsHuman) {
    console.error(`ESCALATED — needs a human: ${result.escalationReason}`);
    process.exitCode = 1;
    return;
  }

  console.log(result.answer);
  console.error(`\n(sources: ${result.sourcesUsed.join(", ")})`);
  if (result.toneFilter.remainingAcronyms.length > 0) {
    console.error(`(tone filter flagged for review: ${result.toneFilter.remainingAcronyms.join(", ")})`);
  }

  if (modelClient instanceof ClaudeModelClient) {
    const { inputTokens, outputTokens } = modelClient.totalUsage;
    const rate = PRICING_USD_PER_MTOK[modelClient.modelIdUsed];
    if (rate) {
      const cost = (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
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
