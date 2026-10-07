/**
 * The production QA wiring (Step 4B M1), shared by the Cockpit job runner and the workflow CLI so
 * both verify a page the same way: the evaluation registry's deterministic text gate (Step 7,
 * packages/verification/config/eval-registry.json), the rendered browser suite, then the screenshot
 * review (reviewer chosen in config/reviewer.json), then the evaluator. There is no switch to turn rendered
 * QA off: if the browser or the reviewer cannot run, the run ends "not verified", never "approved".
 *
 * Step 7: the evaluator must be a different model family from the builder (CLAUDE.md §6). A same-family pair
 * is refused here with CrossModelViolationError, before any build starts, so neither the job runner nor the
 * workflow CLI can be composed into a builder checking its own family's work.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { registryGateChecks } from "@wfact/verification/registry";
import type { QaEvaluatorAgentOptions } from "@wfact/verification/agent";
import type { ModelClient } from "@wfact/verification/modelClient";
import { assertCrossModelSeparation, identityFromVendor, modelIdentity, type Separation } from "@wfact/verification/crossModel";
import { createRenderedQa, reviewerFromEnv } from "./index.js";
import type { Budget } from "./rendered.js";

export interface ProductionQaSetup {
  evaluatorModel: ModelClient | null;
  /** The builder ModelClient's name ("agent37", "claude"); the reviewer refuses to share its vendor. */
  builderVendor: string;
  /** The builder client itself (Step 7): its exact model decides its family. Without it, the vendor decides. */
  builderModel?: object;
  /** Screenshot folder; defaults to a fresh temp directory. */
  outDir?: string;
  env?: NodeJS.ProcessEnv;
  /** The track's budget (TRACK_A_BUDGET by default; TRACK_B_BUDGET, with its motion budget, for Track B). */
  budget?: Budget;
}

/** Throws CrossModelViolationError when the evaluator would be the builder's instance or model family. */
export function productionSeparation(setup: Pick<ProductionQaSetup, "evaluatorModel" | "builderVendor" | "builderModel">): Separation {
  const builder = setup.builderModel ? modelIdentity(setup.builderModel) : identityFromVendor(setup.builderVendor);
  const sameInstance = Boolean(setup.builderModel && setup.evaluatorModel && (setup.builderModel as unknown) === setup.evaluatorModel);
  return assertCrossModelSeparation(builder, setup.evaluatorModel ? modelIdentity(setup.evaluatorModel) : null, { sameInstance });
}

export function productionQaOptions(setup: ProductionQaSetup): QaEvaluatorAgentOptions {
  productionSeparation(setup);
  const env = setup.env ?? process.env;
  const qa = createRenderedQa({
    outDir: setup.outDir ?? mkdtempSync(path.join(tmpdir(), "wfact-rendered-qa-")),
    reviewer: reviewerFromEnv(env),
    builderVendor: setup.builderVendor,
    ...(setup.budget ? { budget: setup.budget } : {}),
  });
  return {
    evaluatorModel: setup.evaluatorModel,
    checks: registryGateChecks(),
    asyncChecks: [qa.rendered],
    reviewSuites: [qa.review],
  };
}
