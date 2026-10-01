#!/usr/bin/env node
/**
 * Independent re-check of a built page (Step 4B M1), as its own process:
 *   npm run qa -- <page.html> --brief <brief.json> [--out <dir>] [--expect-sha256 <hex>]
 *                 [--no-lighthouse] [--review-always] [--external-links]
 *
 * Runs, in order: the production QA gate (the Phase 5 six + the claims gate) with the brief as the
 * only fact source; the rendered suite (headless Chromium at 1440/768/375, axe, Lighthouse, links,
 * console, layout, JS budget, reduced motion, design rules); then the cross-vendor screenshot review.
 * Like VerificationLoop, the review is skipped (no model spend) when a deterministic check failed,
 * unless --review-always is given (used to gather evidence on a page already known to fail).
 *
 * The reviewer is the one config/reviewer.json names; its key (AGENT37_API_KEY + AGENT37_BASE_URL, or
 * OPENAI_API_KEY) comes from the environment (`doppler run -- npm run qa ...`) and is never printed.
 * WFACT_BUILDER_VENDOR names the builder's vendor (default "agent37", today's builder).
 * Exit 0 only when every check passed and the review ran and passed.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { QA_GATE_CHECKS, runChecks } from "@wfact/verification/registry";
import { knownClientSlugs } from "@wfact/verification/paths";
import type { CheckResult, VerificationContext } from "@wfact/verification/checks/types";
import { createRenderedQa, reviewerFromEnv } from "./index.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(name);

async function main() {
  const file = process.argv[2];
  const briefPath = arg("--brief");
  if (!file || file.startsWith("--") || !briefPath) {
    console.error("Usage: npm run qa -- <page.html> --brief <brief.json> [--out <dir>] [--expect-sha256 <hex>] [--no-lighthouse] [--review-always] [--external-links]");
    process.exitCode = 2;
    return;
  }
  const started = new Date();
  const bytes = readFileSync(file);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const expected = arg("--expect-sha256");
  console.log(`page: ${file}\nsha256: ${sha256}${expected ? (sha256 === expected ? "  (matches checkpoint)" : "  (DOES NOT MATCH the expected checkpoint hash)") : ""}`);
  if (expected && sha256 !== expected) {
    process.exitCode = 1;
    return;
  }
  const brief = JSON.parse(readFileSync(briefPath, "utf-8")) as { clientSlug: string; goal: string; brandNotes: string; requiredSections?: string[] };
  const outDir = path.resolve(arg("--out") ?? path.join("qa-out", `${brief.clientSlug}-${started.toISOString().replace(/[:.]/g, "-")}`));
  mkdirSync(outDir, { recursive: true });

  const ctx: VerificationContext = {
    html: bytes.toString("utf-8"),
    clientSlug: brief.clientSlug,
    requiredSections: brief.requiredSections ?? [],
    otherClientSlugs: knownClientSlugs().filter((s) => s !== brief.clientSlug),
    factSources: [brief.goal, brief.brandNotes],
  };
  const builderVendor = process.env.WFACT_BUILDER_VENDOR || "agent37";
  const qa = createRenderedQa({
    outDir,
    lighthouse: !flag("--no-lighthouse"),
    checkExternalLinks: flag("--external-links"),
    reviewer: reviewerFromEnv(),
    builderVendor,
  });

  console.log(`reviewer: ${qa.review.provider} ${qa.review.model}${qa.review.sameVendorAsBuilder ? ` (SAME VENDOR AS BUILDER ${builderVendor}; approved in config/reviewer.json)` : ""}`);
  const results: CheckResult[] = runChecks(ctx, QA_GATE_CHECKS);
  results.push(...(await qa.rendered.run(ctx)));
  const deterministicPassed = results.every((r) => r.passed);
  let reviewRan = false;
  if (deterministicPassed || flag("--review-always")) {
    results.push(...(await qa.review.run(ctx)));
    reviewRan = true;
  }

  for (const r of results) {
    console.log(`[${r.notRun ? "NOT RUN" : r.passed ? "PASS" : "FAIL"}] ${r.checkId}`);
    for (const d of r.details) console.log(`    - ${d}`);
  }
  const metrics = qa.rendered.lastRun?.metrics ?? {};
  for (const [page, m] of Object.entries(metrics)) {
    console.log(`metrics ${page}: JS ${(m.jsBytes / 1024).toFixed(1)} KB, LCP ${m.lcpMs === null ? "n/a" : `${(m.lcpMs / 1000).toFixed(2)} s`}, CLS ${m.cls ?? "n/a"}, Lighthouse perf ${m.performanceScore ?? "n/a"}`);
  }
  for (const c of qa.review.calls) {
    console.log(`review call: ${c.provider} ${c.model}, ${c.inputTokens} in / ${c.outputTokens} out tokens, ${c.costUsd === null ? "UNPRICED" : `$${c.costUsd.toFixed(4)}`}, ${(c.ms / 1000).toFixed(1)} s`);
  }
  if (!reviewRan) console.log("screenshot review: not run because a deterministic check failed (no model spend on a page already failing)");

  const failed = results.filter((r) => !r.passed).map((r) => r.checkId);
  const verdict = failed.length === 0 && reviewRan ? "PASS" : "FAIL";
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        page: file, sha256, brief: briefPath, builderVendor, startedAt: started.toISOString(), finishedAt: new Date().toISOString(),
        verdict, failed, results, metrics,
        reviewer: { provider: qa.review.provider, model: qa.review.model, sameVendorAsBuilder: qa.review.sameVendorAsBuilder },
        reviewCalls: qa.review.calls, reviewFindings: qa.review.lastFindings,
        screenshots: qa.rendered.lastRun?.shots.map((s) => ({ page: s.page, viewport: s.viewport, width: s.width, file: s.file })) ?? [],
      },
      null,
      2,
    ),
  );
  console.log(`\nQA: ${verdict}${failed.length ? ` (failed: ${failed.join(", ")})` : ""}\nreport + screenshots: ${outDir}`);
  process.exitCode = verdict === "PASS" ? 0 : 1;
}

main().catch((err) => {
  console.error("rendered QA crashed rather than faking a result:", err);
  process.exitCode = 1;
});
