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
  /**
   * Step 4B M3: a multi-page site. Every text check runs on every page (details prefixed with the page
   * file); required sections are checked across the whole site. `html` is then the home page.
   */
  site?: SiteFiles;
  /**
   * Step 4B M4: set by runChecks while a per-page check runs on one page of a site: the page's own file
   * name and the whole site's files, so a check can tell a file the site ships (a Next.js chunk) from an
   * external dependency.
   */
  pageOf?: { page: string; site: SiteFiles };
  /**
   * Step 7 evaluation registry: which gate this run is. "preview" (default) is every build; "launch" adds the
   * launch-candidate checks (canonical URL, og:image, sitemap, robots.txt, llms.txt, 404 page), which need the
   * production domain and run before a human launch decision. A launch-only check at preview reports N/A.
   */
  stage?: "preview" | "launch";
}

/**
 * A multi-page site's files (Step 4B M3; nested paths and binary files since M4, for a Next.js export
 * with `_next/static/...` chunks and fonts). Binary files are base64 text and listed in `binary`.
 */
export interface SiteFiles {
  files: Record<string, string>;
  pages: string[];
  binary?: string[];
}

/**
 * A safe site-relative file path: folders and names of letters, digits, "_", "." and "-", no leading dot,
 * no "..", and an extension a static site serves. Shared by the QA agent, rendered QA and the workflow.
 */
export const SITE_FILE_RE = /^(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_.-]*(\/[A-Za-z0-9_][A-Za-z0-9_.-]*)*\.(html|json|txt|xml|js|css|svg|woff2|woff|ico|png|jpg|jpeg|webp|avif|webmanifest)$/;

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
  /**
   * Step 7: a registry check of severity "minor" fails as advisory: reported (WARN) and audited, but it does not
   * fail the gate and is not sent back to the builder on its own. Blocker and major failures always gate.
   */
  advisory?: boolean;
  /**
   * Step 7: the check does not apply to this run, with the reason (e.g. a launch-only check at preview, or a
   * site-level check on a single-file page). Always `passed: true` with empty details; never a silent pass:
   * the reason is printed and audited, and a reasonless N/A is refused by the registry (2.0's audit law).
   */
  notApplicable?: string;
  /** Step 7: the registry severity of the check that produced this result (absent outside the registry gate). */
  severity?: "blocker" | "major" | "minor";
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
