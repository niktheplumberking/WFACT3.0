#!/usr/bin/env node
/**
 * Phase 4 smoke-test entry point:
 *   npm run build-page -- clients/dreamsign-pilot/brief.json
 *
 * Mirrors packages/hermes/src/cli.ts: refuses to fabricate a result rather than mocking around a
 * missing credential. ANTHROPIC_API_KEY is required for both the builder and evaluator roles (two
 * separate client instances, see modelClient.ts) — the same open blocker tracked in
 * BLOCKED-ON-NICK.md since Phase 3 also stops this phase's live run.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadBrief } from "./brief.js";
import { selectTemplate } from "./templates.js";
import { modelClientFromEnv, Agent37ModelClient, ClaudeModelClient } from "./modelClient.js";
import { FrontendLoop } from "./loop.js";
import { appendCorrectionLogRows, formatCorrectionSummary } from "./correctionLog.js";
import { repoRoot } from "./paths.js";

// claude-sonnet-5 pricing, checked 2026-06-24 — see packages/hermes/src/cli.ts for the same note.
const CLAUDE_PRICING_USD_PER_MTOK = { input: 2.0, output: 10.0 };

async function main() {
  const briefPath = process.argv[2];
  if (!briefPath) {
    console.error("Usage: npm run build-page -- <path/to/brief.json>");
    process.exitCode = 1;
    return;
  }

  const brief = loadBrief(briefPath);
  if (brief.source !== "nick") {
    console.error(
      `NOTE: this brief is marked source="${brief.source}" — not yet Nick's real, approved brief. ` +
        "Per the Operator's Manual's Phase 4 fallback, proceeding anyway; swap to Nick's real brief " +
        "the moment it arrives.\n",
    );
  }
  const template = selectTemplate(brief.templatePreference);

  const { client: builderModel, reason: builderReason, chose: builderChose } = modelClientFromEnv("builder");
  if (!builderModel) {
    console.error(`BLOCKED (builder model): ${builderReason}`);
    process.exitCode = 1;
    return;
  }
  console.error(`(builder model: ${builderChose})`);
  const { client: evaluatorModel, reason: evaluatorReason, chose: evaluatorChose } =
    modelClientFromEnv("evaluator");
  if (!evaluatorModel) {
    console.error(`BLOCKED (evaluator model): ${evaluatorReason}`);
    process.exitCode = 1;
    return;
  }
  console.error(`(evaluator model: ${evaluatorChose})`);

  const loop = new FrontendLoop({ builderModel, evaluatorModel });
  const result = await loop.run(brief, template);

  console.error(formatCorrectionSummary(result.rounds, result.approved));

  for (const [role, client] of [
    ["builder", builderModel],
    ["evaluator", evaluatorModel],
  ] as const) {
    if (client instanceof ClaudeModelClient) {
      const { inputTokens, outputTokens } = client.totalUsage;
      const cost =
        (inputTokens / 1_000_000) * CLAUDE_PRICING_USD_PER_MTOK.input +
        (outputTokens / 1_000_000) * CLAUDE_PRICING_USD_PER_MTOK.output;
      console.error(
        `(cost — ${role} (claude ${client.modelIdUsed}): ${inputTokens} in / ${outputTokens} out ` +
          `tokens, $${cost.toFixed(4)})`,
      );
    } else if (client instanceof Agent37ModelClient) {
      console.error(
        `(cost — ${role} (agent37): ${client.totalUsage.promptTokens} prompt / ` +
          `${client.totalUsage.completionTokens} completion tokens this run; billed per Agent 37's ` +
          `own free-tier terms, not Anthropic-equivalent pricing)`,
      );
    }
  }

  if (result.needsHuman) {
    console.error(`ESCALATED — needs a human: ${result.escalationReason}`);
    process.exitCode = 1;
    return;
  }

  const outPath = join(repoRoot(), "clients", brief.clientSlug, "pages", `${template.id}.html`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, result.finalHtml ?? "", "utf-8");
  console.log(`Page written to ${outPath}`);

  const memoryPath = join(repoRoot(), "clients", brief.clientSlug, "memory.md");
  try {
    appendCorrectionLogRows(
      memoryPath,
      result.rounds,
      "4_homepage_build",
      `frontend-loop (builder: ${builderModel.name}, evaluator: ${evaluatorModel.name})`,
    );
    console.error(`Correction log appended to ${memoryPath}`);
  } catch (err) {
    console.error(
      `NOTE: could not append correction log automatically — ${
        err instanceof Error ? err.message : String(err)
      }. Log it manually in ${memoryPath}.`,
    );
  }
}

main().catch((err) => {
  console.error("frontend-loop crashed rather than faking a result:", err);
  process.exitCode = 1;
});
