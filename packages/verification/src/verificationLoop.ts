/**
 * Wires the check registry + the evaluator into one verification pass. CLAUDE.md §1: "Never
 * trust done, only verified" — so this deliberately does NOT collapse to a single boolean. A page
 * can fail the cheap deterministic checks (never even reaches the model), pass them but have no
 * evaluator configured (checks alone are not "verified" — an independent model step is still the
 * Manual's own requirement), or pass checks and get a real evaluator verdict. Each state is
 * distinct and named, same honesty pattern as `packages/frontend-loop/src/modelClient.ts`'s
 * `modelClientFromEnv` refusing to fabricate a result.
 */
import type { AsyncCheckSuite, Check, CheckResult, VerificationContext } from "./checks/types.js";
import { CHECK_REGISTRY, runChecks } from "./registry.js";
import type { ModelClient } from "./modelClient.js";
import { runEvaluator, type EvaluatorVerdict } from "./evaluator.js";
import { recordAudit, type AuditContext } from "@wfact/audit";

export type VerificationStatus =
  | "failed_checks"
  | "blocked_no_evaluator"
  | "changes_requested"
  | "approved";

export interface VerificationResult {
  status: VerificationStatus;
  checkResults: CheckResult[];
  evaluator: EvaluatorVerdict | null;
}

export interface VerificationLoopOptions {
  checks?: Check[];
  /**
   * Step 4B M1: deterministic checks that need I/O (the rendered-QA browser pass). Run with
   * `checks`; any failure is `failed_checks` and no model is called.
   */
  asyncChecks?: AsyncCheckSuite[];
  /**
   * Step 4B M1: model-based review suites (the cross-vendor screenshot reviewer). Run only after
   * every deterministic check passed, before the evaluator. A failed result is
   * `changes_requested`; a `notRun` result is `blocked_no_evaluator` (never a pass).
   */
  reviewSuites?: AsyncCheckSuite[];
  evaluatorModel?: ModelClient | null;
  /**
   * When set, every pass/fail decision writes one `verification.decision` row to `audit_log`
   * (Continuation Plan Stage 1). Fails closed: an audit write error propagates, so a decision is
   * never returned without its row.
   */
  audit?: AuditContext;
}

export class VerificationLoop {
  private readonly checks: Check[];
  private readonly asyncChecks: AsyncCheckSuite[];
  private readonly reviewSuites: AsyncCheckSuite[];
  private readonly evaluatorModel: ModelClient | null;
  private readonly audit: AuditContext | null;

  constructor(opts: VerificationLoopOptions = {}) {
    this.checks = opts.checks ?? CHECK_REGISTRY;
    this.asyncChecks = opts.asyncChecks ?? [];
    this.reviewSuites = opts.reviewSuites ?? [];
    this.evaluatorModel = opts.evaluatorModel ?? null;
    this.audit = opts.audit ?? null;
  }

  async run(ctx: VerificationContext, goal: string): Promise<VerificationResult> {
    const result = await this.decide(ctx, goal);
    if (this.audit) {
      await recordAudit(this.audit, {
        action: "verification.decision",
        // Only an approval is a success; blocked_no_evaluator is not "verified" (CLAUDE.md §1).
        outcome: result.status === "approved" ? "success" : "failure",
        entitySlug: ctx.clientSlug,
        payload: {
          status: result.status,
          goal,
          checks: result.checkResults.map(({ checkId, passed, details }) => ({ checkId, passed, details })),
          evaluator: result.evaluator,
          evaluatorModel: this.evaluatorModel?.name ?? null,
        },
      });
    }
    return result;
  }

  private async decide(ctx: VerificationContext, goal: string): Promise<VerificationResult> {
    const checkResults = runChecks(ctx, this.checks);
    for (const suite of this.asyncChecks) checkResults.push(...(await suite.run(ctx)));
    const checksPassed = checkResults.every((r) => r.passed);

    if (!checksPassed) {
      // Never even spend a model call on a build the cheap deterministic layer already caught —
      // this IS the Manual's Phase 5 exit check: "a deliberately broken test build gets caught
      // and returned before being marked done."
      return { status: "failed_checks", checkResults, evaluator: null };
    }

    if (this.reviewSuites.length > 0) {
      const reviewResults: CheckResult[] = [];
      for (const suite of this.reviewSuites) reviewResults.push(...(await suite.run(ctx)));
      checkResults.push(...reviewResults);
      if (reviewResults.some((r) => r.notRun)) {
        return { status: "blocked_no_evaluator", checkResults, evaluator: null };
      }
      if (reviewResults.some((r) => !r.passed)) {
        // The reviewer's rule ids go back to the builder like any failed check; no evaluator call.
        return { status: "changes_requested", checkResults, evaluator: null };
      }
    }

    if (!this.evaluatorModel) {
      return { status: "blocked_no_evaluator", checkResults, evaluator: null };
    }

    const evaluator = await runEvaluator(this.evaluatorModel, ctx, goal);
    return {
      status: evaluator.verdict === "approved" ? "approved" : "changes_requested",
      checkResults,
      evaluator,
    };
  }
}

/** Human-readable summary, same spirit as frontend-loop's `formatCorrectionSummary`. */
export function formatVerificationSummary(result: VerificationResult): string {
  const lines: string[] = [];
  for (const check of result.checkResults) {
    lines.push(`[${check.notRun ? "NOT RUN" : check.passed ? "PASS" : "FAIL"}] ${check.checkId}`);
    for (const detail of check.details) {
      lines.push(`    - ${detail}`);
    }
  }
  lines.push("");
  switch (result.status) {
    case "failed_checks":
      lines.push("VERIFICATION: FAILED — deterministic checks caught issues; evaluator not run.");
      break;
    case "blocked_no_evaluator":
      lines.push(
        result.checkResults.some((c) => c.notRun)
          ? "VERIFICATION: NOT VERIFIED — all deterministic checks passed, but a required review could not run (NOT RUN above). " +
              "Per CLAUDE.md §1, checks-only is not the same as verified; run it again once the reviewer is reachable."
          : "VERIFICATION: NOT VERIFIED — all deterministic checks passed, but no evaluator model " +
              "was configured. Per CLAUDE.md §1, checks-only is not the same as verified.",
      );
      break;
    case "changes_requested":
      if (!result.evaluator) {
        lines.push("VERIFICATION: CHANGES REQUESTED by the screenshot review (failed rules above); evaluator not run.");
        break;
      }
      lines.push("VERIFICATION: CHANGES REQUESTED by evaluator:");
      for (const issue of result.evaluator?.issues ?? []) {
        lines.push(`    - ${issue}`);
      }
      break;
    case "approved":
      lines.push("VERIFICATION: APPROVED — deterministic checks passed and evaluator approved.");
      break;
  }
  return lines.join("\n");
}
