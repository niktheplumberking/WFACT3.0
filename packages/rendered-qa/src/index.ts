/**
 * Step 4B M1 entry point: the rendered suite (deterministic, browser) and the screenshot review suite
 * (model), wired so the reviewer always sees the screenshots of the page the rendered suite just
 * checked. Hand both to VerificationLoop / createQaEvaluatorAgent:
 *   asyncChecks:  [qa.rendered]   any failure = failed_checks, no model call
 *   reviewSuites: [qa.review]     runs only after every deterministic check passed
 * Which reviewer runs comes from config/reviewer.json (see reviewer.ts).
 */
import { createRenderedSuite, type RenderedQaOptions, type RenderedSuite } from "./rendered.js";
import { createScreenshotReviewSuite, loadReviewerDecision, type ReviewerDecision, type ReviewerProvider, type ScreenshotReviewSuite } from "./reviewer.js";

export interface ReviewerSetup {
  provider: ReviewerProvider;
  model: string;
  /** By value from the environment; never logged. Null/absent = review NOT RUN. */
  apiKey: string | null | undefined;
  baseUrl?: string | null;
  decision: ReviewerDecision;
}

/** The reviewer the decision record names, with its key from the environment (names only in errors). */
export function reviewerFromEnv(env: NodeJS.ProcessEnv = process.env, decision: ReviewerDecision = loadReviewerDecision()): ReviewerSetup {
  return decision.provider === "agent37"
    ? { provider: "agent37", model: decision.model, apiKey: env.AGENT37_API_KEY, baseUrl: env.AGENT37_BASE_URL, decision }
    : { provider: "openai", model: decision.model, apiKey: env.OPENAI_API_KEY, decision };
}

export interface RenderedQaSetup extends RenderedQaOptions {
  reviewer: ReviewerSetup;
  /** Vendor of the builder model, e.g. "agent37". A same-vendor reviewer needs the recorded approval. */
  builderVendor: string;
}

export interface RenderedQa {
  rendered: RenderedSuite;
  review: ScreenshotReviewSuite;
}

export function createRenderedQa(setup: RenderedQaSetup): RenderedQa {
  const rendered = createRenderedSuite(setup);
  const review = createScreenshotReviewSuite({
    provider: setup.reviewer.provider,
    model: setup.reviewer.model,
    apiKey: setup.reviewer.apiKey,
    baseUrl: setup.reviewer.baseUrl,
    decision: setup.reviewer.decision,
    builderVendor: setup.builderVendor,
    rulebook: setup.rulebook,
    shots: () => rendered.lastRun?.shots ?? [],
  });
  return { rendered, review };
}

export { TRACK_A_BUDGET, TRACK_B_BUDGET, VIEWPORTS, runRenderedQa, createRenderedSuite, pageUrl } from "./rendered.js";
export { createScreenshotReviewSuite, parseReview, loadReviewerDecision, REVIEW_CHECK_ID, DEFAULT_MODELS } from "./reviewer.js";
export { loadRulebook } from "./rulebook.js";
