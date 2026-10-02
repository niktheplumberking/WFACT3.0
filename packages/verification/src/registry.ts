/**
 * The check registry itself — CLAUDE.md §5's "gate + registry verification culture ... the
 * 78-check registry that re-proves things on demand" applied at Phase 5 scale. This sprint's own
 * Manual is explicit: "Tempted to build all 78 checks? Don't. 5–8 well-chosen checks proving the
 * loop works is the actual goal this sprint, completeness is next sprint's job." These 6 are that
 * set — the Manual's 5 named examples plus one deterministic backstop (`requiredSections.ts`).
 */
import type { Check, CheckResult, VerificationContext } from "./checks/types.js";
import { secretsScanCheck } from "./checks/secretsScan.js";
import { responsiveCheck } from "./checks/responsive.js";
import { noConsoleErrorsCheck } from "./checks/noConsoleErrors.js";
import { imageOptimizationCheck } from "./checks/imageOptimization.js";
import { isolationCheck } from "./checks/isolation.js";
import { requiredSectionsCheck } from "./checks/requiredSections.js";
import { CLAIMS_CHECKS as CLAIMS } from "./checks/claims.js";

export const CHECK_REGISTRY: Check[] = [
  secretsScanCheck,
  responsiveCheck,
  noConsoleErrorsCheck,
  imageOptimizationCheck,
  isolationCheck,
  requiredSectionsCheck,
];

/**
 * Step 4B M1: the claims gate (content after </html>, SAMPLE labels, banned claims, unsourced
 * facts). Kept as its own list so `CHECK_REGISTRY` stays exactly the Phase 5 six; production QA
 * (the jobs runner, the workflow and verify CLIs) uses `QA_GATE_CHECKS`, which is both.
 */
export const CLAIMS_CHECKS: Check[] = CLAIMS;
export const QA_GATE_CHECKS: Check[] = [...CHECK_REGISTRY, ...CLAIMS];

/**
 * Runs every check in the registry (or a caller-supplied subset) against one context. For a multi-page
 * site (Step 4B M3) each check runs on every page and its details name the page; required sections are
 * the one site-wide property (a section may live on any page), so that check sees all pages at once.
 */
export function runChecks(ctx: VerificationContext, checks: Check[] = CHECK_REGISTRY): CheckResult[] {
  const site = ctx.site;
  if (!site) return checks.map((check) => check.run(ctx));
  const pageCtx = (html: string, page?: string): VerificationContext => ({ ...ctx, html, site: undefined, ...(page ? { pageOf: { page, site } } : {}) });
  return checks.map((check) => {
    if (check.id === requiredSectionsCheck.id) {
      const r = check.run(pageCtx(site.pages.map((p) => site.files[p] ?? "").join("\n")));
      return { ...r, details: r.details.map((d) => `site: ${d}`) };
    }
    const details: string[] = [];
    for (const page of site.pages) {
      const html = site.files[page];
      if (html === undefined) {
        details.push(`${page}: the page is missing from the site files`);
        continue;
      }
      details.push(...check.run(pageCtx(html, page)).details.map((d) => `${page}: ${d}`));
    }
    return { checkId: check.id, passed: details.length === 0, details };
  });
}

export type { Check, CheckResult, VerificationContext };
