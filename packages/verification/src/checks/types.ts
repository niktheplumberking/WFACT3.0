/**
 * Shared shape for every Phase 5 check. Operator's Manual, Phase 5 checklist: "Pick 5–8
 * highest-value checks from 2.0's 78 (no console errors, responsive check, secrets scan, image
 * optimization, isolation check)." This package implements exactly those 5 named examples plus one
 * more (`requiredSections`, a deterministic backstop for Phase 4's LLM-only evaluator) — 6 total,
 * inside the Manual's own 5–8 range. See `../../README.md` for why these six and not more.
 *
 * Deliberately synchronous and dependency-free (no headless browser, no DOM parser): every check
 * runs against the raw HTML string with regex/string scanning, same "no build step" spirit as the
 * pages `packages/frontend-loop` generates. This keeps the whole registry runnable in CI with zero
 * network calls and zero credentials, same as `packages/hermes`'s and `packages/frontend-loop`'s
 * unit tests.
 */

export interface VerificationContext {
  html: string;
  /** The client this page belongs to — used by the isolation check to know what "self" is. */
  clientSlug: string;
  /** From the brief + template (see `packages/frontend-loop/src/templates.ts`), unioned. */
  requiredSections: string[];
  /** Every other known client slug — anything found here inside `html` is a leak. */
  otherClientSlugs: string[];
  /**
   * Step 4B M1 claims gate: the texts a factual claim on the page may come from (the approved
   * brief's goal and brand notes today; content-as-data source fields from M3). A phone number,
   * hours, price or service area not found here is unsourced. Absent = no sources: every fact fails.
   */
  factSources?: string[];
}

export interface CheckResult {
  checkId: string;
  passed: boolean;
  /** Empty when passed; one entry per distinct problem found when failed. */
  details: string[];
  /**
   * Set when the check could not run (e.g. no reviewer model configured). Never a pass:
   * VerificationLoop reports the run as not verified instead of sending it back to the builder.
   */
  notRun?: boolean;
}

export interface Check {
  id: string;
  description: string;
  run(ctx: VerificationContext): CheckResult;
}

/**
 * A check suite that needs I/O (a headless browser, a model call). One suite can return several
 * results (e.g. one browser pass yields console, a11y, links and performance results).
 */
export interface AsyncCheckSuite {
  id: string;
  description: string;
  run(ctx: VerificationContext): Promise<CheckResult[]>;
}
