/**
 * The verification loop as a `qa-evaluator` agent on the shared runtime (Continuation Plan
 * Stage 2). Thin adapter: `VerificationLoop` is unchanged (its own suite still proves the
 * checks → evaluator behaviour). The run's audit context is handed to the loop, so its
 * `verification.decision` row lands on the same task_id/run_id as the agent's lifecycle rows —
 * which is what Stage 3's checkpoint needs to find it.
 *
 * A failed verification is a *completed* QA run with a failing verdict, not an escalation: the
 * agent did its job. The workflow (Stage 3) routes on `output.status`.
 */
import { AgentInputError, type Agent } from "@wfact/agent-runtime";
import type { Check, VerificationContext } from "./checks/types.js";
import type { ModelClient } from "./modelClient.js";
import { VerificationLoop, type VerificationResult } from "./verificationLoop.js";

export const QA_EVALUATOR_ROLE = "qa-evaluator";

export interface QaInput {
  ctx: VerificationContext;
  goal: string;
}

export interface QaEvaluatorAgentOptions {
  evaluatorModel: ModelClient | null;
  checks?: Check[];
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new AgentInputError(`${field} must be an array of strings`);
  }
  return value;
}

export function createQaEvaluatorAgent(opts: QaEvaluatorAgentOptions): Agent<QaInput, VerificationResult> {
  return {
    role: QA_EVALUATOR_ROLE,
    retry: { maxAttempts: 1, baseDelayMs: 2000 },
    parseInput(raw: unknown): QaInput {
      const r = (raw ?? {}) as Record<string, unknown>;
      if (typeof r.html !== "string" || r.html.length === 0) throw new AgentInputError("html must be a non-empty string");
      if (typeof r.clientSlug !== "string" || !/^[a-z][a-z0-9-]*$/.test(r.clientSlug)) {
        throw new AgentInputError("clientSlug must be a lowercase-hyphen slug");
      }
      if (typeof r.goal !== "string" || r.goal.length === 0) throw new AgentInputError("goal must be a non-empty string");
      return {
        ctx: {
          html: r.html,
          clientSlug: r.clientSlug,
          requiredSections: stringArray(r.requiredSections ?? [], "requiredSections"),
          otherClientSlugs: stringArray(r.otherClientSlugs ?? [], "otherClientSlugs"),
        },
        goal: r.goal,
      };
    },
    execute: ({ ctx, goal }, runCtx) =>
      new VerificationLoop({
        checks: opts.checks,
        evaluatorModel: opts.evaluatorModel,
        audit: runCtx.audit ?? undefined,
      }).run(ctx, goal),
    summarize: (result) => ({
      status: result.status,
      failedChecks: result.checkResults.filter((c) => !c.passed).map((c) => c.checkId),
      evaluatorVerdict: result.evaluator?.verdict ?? null,
    }),
  };
}
