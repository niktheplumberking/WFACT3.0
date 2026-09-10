#!/usr/bin/env node
/**
 * Phase 3 smoke test entry point: `npm run ask -- "what stage is DreamSign in"`.
 * Wires the real tool registry (memory + Supabase-if-configured) and the real Claude model
 * client. Exits with a clear, honest message rather than a fake answer if either is unconfigured.
 */
import { buildToolRegistry } from "./tools/registry.js";
import { stateReaderFromEnv } from "./state.js";
import { modelClientFromEnv } from "./modelClient.js";
import { HermesLite } from "./controller.js";

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
}

main().catch((err) => {
  console.error("Hermes-lite crashed rather than guessing an answer:", err);
  process.exitCode = 1;
});
