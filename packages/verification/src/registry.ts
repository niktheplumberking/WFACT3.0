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
import { runOneCheck } from "./runCheck.js";
import { gateTextChecks } from "./evalRegistry.js";

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
 * facts). Kept as its own list so `CHECK_REGISTRY` stays exactly the Phase 5 six. `QA_GATE_CHECKS` is both:
 * the Step 4B M1 gate, kept unchanged for the tests that pin it. Since Step 7 production QA runs
 * `registryGateChecks()` (a superset, from config/eval-registry.json) instead.
 */
export const CLAIMS_CHECKS: Check[] = CLAIMS;
export const QA_GATE_CHECKS: Check[] = [...CHECK_REGISTRY, ...CLAIMS];

/**
 * Runs every check in the registry (or a caller-supplied subset) against one context. For a multi-page
 * site (Step 4B M3) each check runs on every page and its details name the page; required sections are
 * the one site-wide property (a section may live on any page), so that check sees all pages at once.
 */
export function runChecks(ctx: VerificationContext, checks: Check[] = CHECK_REGISTRY): CheckResult[] {
  return checks.map((check) => runOneCheck(ctx, check));
}

/**
 * Step 7: the gate every production entry point runs (the jobs runner, the workflow CLI, `npm run qa`,
 * `npm run verify`), derived from the versioned evaluation registry (config/eval-registry.json): every
 * deterministic text check in registry order, each wrapped with its severity and stage. A superset of
 * QA_GATE_CHECKS; QA_GATE_CHECKS stays exactly the Step 4B M1 ten for the tests that pin that set.
 */
export function registryGateChecks(): Check[] {
  return gateTextChecks();
}

export { gates } from "./evalRegistry.js";

export type { Check, CheckResult, VerificationContext };
