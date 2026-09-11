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
import { modelClientFromEnv } from "./modelClient.js";
import { FrontendLoop } from "./loop.js";
import { appendCorrectionLogRows, formatCorrectionSummary } from "./correctionLog.js";
import { repoRoot } from "./paths.js";

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

  const { client: builderModel, reason: builderReason } = modelClientFromEnv();
  if (!builderModel) {
    console.error(`BLOCKED (builder model): ${builderReason}`);
    process.exitCode = 1;
    return;
  }
  const { client: evaluatorModel, reason: evaluatorReason } = modelClientFromEnv();
  if (!evaluatorModel) {
    console.error(`BLOCKED (evaluator model): ${evaluatorReason}`);
    process.exitCode = 1;
    return;
  }

  const loop = new FrontendLoop({ builderModel, evaluatorModel });
  const result = await loop.run(brief, template);

  console.error(formatCorrectionSummary(result.rounds, result.approved));

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
      "frontend-loop (Claude, self-reviewed)",
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
