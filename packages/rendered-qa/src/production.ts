/**
 * The production QA wiring (Step 4B M1), shared by the Cockpit job runner and the workflow CLI so
 * both verify a page the same way: the Phase 5 six + the claims gate, the rendered browser suite,
 * then the screenshot review (reviewer chosen in config/reviewer.json), then the evaluator. There is no switch to turn rendered
 * QA off: if the browser or the reviewer cannot run, the run ends "not verified", never "approved".
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { QA_GATE_CHECKS } from "@wfact/verification/registry";
import type { QaEvaluatorAgentOptions } from "@wfact/verification/agent";
import type { ModelClient } from "@wfact/verification/modelClient";
import { createRenderedQa, reviewerFromEnv } from "./index.js";
import type { Budget } from "./rendered.js";

export interface ProductionQaSetup {
  evaluatorModel: ModelClient | null;
  /** The builder ModelClient's name ("agent37", "claude"); the reviewer refuses to share its vendor. */
  builderVendor: string;
  /** Screenshot folder; defaults to a fresh temp directory. */
  outDir?: string;
  env?: NodeJS.ProcessEnv;
  /** The track's budget (TRACK_A_BUDGET by default; TRACK_B_BUDGET, with its motion budget, for Track B). */
  budget?: Budget;
}

export function productionQaOptions(setup: ProductionQaSetup): QaEvaluatorAgentOptions {
  const env = setup.env ?? process.env;
  const qa = createRenderedQa({
    outDir: setup.outDir ?? mkdtempSync(path.join(tmpdir(), "wfact-rendered-qa-")),
    reviewer: reviewerFromEnv(env),
    builderVendor: setup.builderVendor,
    ...(setup.budget ? { budget: setup.budget } : {}),
  });
  return {
    evaluatorModel: setup.evaluatorModel,
    checks: QA_GATE_CHECKS,
    asyncChecks: [qa.rendered],
    reviewSuites: [qa.review],
  };
}
