/**
 * Step 4B M1 entry point: the rendered suite (deterministic, browser) and the cross-vendor screenshot
 * review suite (model), wired so the reviewer always sees the screenshots of the page the rendered
 * suite just checked. Hand both to VerificationLoop / createQaEvaluatorAgent:
 *   asyncChecks:  [qa.rendered]   any failure = failed_checks, no model call
 *   reviewSuites: [qa.review]     runs only after every deterministic check passed
 */
import { createRenderedSuite, type RenderedQaOptions, type RenderedSuite } from "./rendered.js";
import { createScreenshotReviewSuite, type ScreenshotReviewSuite } from "./reviewer.js";

export interface RenderedQaSetup extends RenderedQaOptions {
  /** OPENAI_API_KEY (by value from the environment; never logged). Null/absent = review NOT RUN. */
  reviewerApiKey: string | null | undefined;
  /** Vendor of the builder model, e.g. "agent37". The reviewer refuses to share it. */
  builderVendor: string;
  reviewerModel?: string;
}

export interface RenderedQa {
  rendered: RenderedSuite;
  review: ScreenshotReviewSuite;
}

export function createRenderedQa(setup: RenderedQaSetup): RenderedQa {
  const rendered = createRenderedSuite(setup);
  const review = createScreenshotReviewSuite({
    apiKey: setup.reviewerApiKey,
    builderVendor: setup.builderVendor,
    model: setup.reviewerModel,
    rulebook: setup.rulebook,
    shots: () => rendered.lastRun?.shots ?? [],
  });
  return { rendered, review };
}

export { TRACK_A_BUDGET, VIEWPORTS, runRenderedQa, createRenderedSuite } from "./rendered.js";
export { createScreenshotReviewSuite, parseReview, REVIEW_CHECK_ID, DEFAULT_REVIEWER_MODEL } from "./reviewer.js";
export { loadRulebook } from "./rulebook.js";
