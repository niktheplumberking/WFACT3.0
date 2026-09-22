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
import { VerificationLoop, formatVerificationSummary } from "./verificationLoop.js";
import { evaluatorModelClientFromEnv, ClaudeModelClient } from "./modelClient.js";
import { knownClientSlugs } from "./paths.js";

// claude-sonnet-5 pricing, checked 2026-06-24 — see packages/hermes/src/cli.ts for the same note.
const PRICING_USD_PER_MTOK = { input: 2.0, output: 10.0 };

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

  const { client: evaluatorModel, reason } = evaluatorModelClientFromEnv();
  if (!evaluatorModel) {
    console.error(`NOTE (evaluator): ${reason}\n`);
  }

  const loop = new VerificationLoop({ evaluatorModel });
  const result = await loop.run({ html, clientSlug, requiredSections, otherClientSlugs }, goal);

  console.log(formatVerificationSummary(result));

  if (evaluatorModel instanceof ClaudeModelClient) {
    const { inputTokens, outputTokens } = evaluatorModel.totalUsage;
    const cost =
      (inputTokens / 1_000_000) * PRICING_USD_PER_MTOK.input +
      (outputTokens / 1_000_000) * PRICING_USD_PER_MTOK.output;
    console.error(
      `(cost — evaluator (claude ${evaluatorModel.modelIdUsed}): ${inputTokens} in / ` +
        `${outputTokens} out tokens, $${cost.toFixed(4)})`,
    );
  }

  process.exitCode = result.status === "approved" ? 0 : 1;
}

main().catch((err) => {
  console.error("verification crashed rather than faking a result:", err);
  process.exitCode = 1;
});
