/**
 * Runs ONE check against a context: a single page, or every page of a site (Step 4B M3). Shared by
 * `runChecks` (registry.ts) and the Step 7 evaluation registry's wrappers (evalRegistry.ts), so both
 * walk a site the same way.
 *
 *   - a site-level check (`siteLevel: true`, Step 7: sitemap, duplicate titles, internal links...) runs once
 *     with the whole site in the context;
 *   - required sections are site-wide too (a section may live on any page), checked on all pages joined;
 *   - every other check runs on each page and its details name the page.
 */
import type { Check, CheckResult, VerificationContext } from "./checks/types.js";

/** A check that looks at the whole site at once instead of page by page. */
export interface SiteLevelCheck extends Check {
  siteLevel: true;
}

export const isSiteLevel = (check: Check): check is SiteLevelCheck => (check as Partial<SiteLevelCheck>).siteLevel === true;

const REQUIRED_SECTIONS_ID = "required-sections";

export function runOneCheck(ctx: VerificationContext, check: Check): CheckResult {
  const site = ctx.site;
  if (!site || isSiteLevel(check)) return check.run(ctx);
  const pageCtx = (html: string, page?: string): VerificationContext => ({ ...ctx, html, site: undefined, ...(page ? { pageOf: { page, site } } : {}) });
  if (check.id === REQUIRED_SECTIONS_ID) {
    const r = check.run(pageCtx(site.pages.map((p) => site.files[p] ?? "").join("\n")));
    return { ...r, details: r.details.map((d) => `site: ${d}`) };
  }
  const details: string[] = [];
  const notApplicable: string[] = [];
  for (const page of site.pages) {
    const html = site.files[page];
    if (html === undefined) {
      details.push(`${page}: the page is missing from the site files`);
      continue;
    }
    const r = check.run(pageCtx(html, page));
    details.push(...r.details.map((d) => `${page}: ${d}`));
    if (r.notApplicable) notApplicable.push(r.notApplicable);
  }
  const passed = details.length === 0;
  // N/A only when it held on every page; a check that ran on some page is a real result.
  const na = passed && notApplicable.length === site.pages.length ? { notApplicable: notApplicable[0] } : {};
  return { checkId: check.id, passed, details, ...na };
}
