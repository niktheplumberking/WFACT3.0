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
import { SITE_FILE_RE, type AsyncCheckSuite, type Check, type VerificationContext } from "./checks/types.js";
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
  /** Step 4B M1: rendered-QA browser suites (deterministic). */
  asyncChecks?: AsyncCheckSuite[];
  /** Step 4B M1: cross-vendor screenshot review suites (model). */
  reviewSuites?: AsyncCheckSuite[];
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new AgentInputError(`${field} must be an array of strings`);
  }
  return value;
}

/**
 * Step 4B M3: a multi-page site. Every file path must be safe (SITE_FILE_RE: no "..", no absolute paths;
 * folders allowed since M4) and every page must exist. Binary files (M4: fonts) are base64 and listed.
 */
function parseSite(value: unknown): NonNullable<VerificationContext["site"]> {
  const s = (value ?? {}) as { files?: unknown; pages?: unknown; binary?: unknown };
  if (typeof s.files !== "object" || s.files === null) throw new AgentInputError("site.files must be an object of file name → content");
  const files = s.files as Record<string, unknown>;
  const pages = stringArray(s.pages, "site.pages");
  if (pages.length === 0) throw new AgentInputError("site.pages must list at least one page");
  for (const [name, content] of Object.entries(files)) {
    if (!SITE_FILE_RE.test(name)) throw new AgentInputError(`site file name ${JSON.stringify(name)} is not allowed`);
    if (typeof content !== "string") throw new AgentInputError(`site file ${name} must be text`);
  }
  for (const p of pages) if (typeof files[p] !== "string" || !p.endsWith(".html")) throw new AgentInputError(`site page ${p} has no file`);
  const binary = s.binary === undefined ? [] : stringArray(s.binary, "site.binary");
  for (const b of binary) {
    if (files[b] === undefined) throw new AgentInputError(`site.binary lists ${b} but there is no such file`);
    if (pages.includes(b)) throw new AgentInputError(`site page ${b} cannot be binary`);
  }
  return { files: files as Record<string, string>, pages, ...(binary.length ? { binary } : {}) };
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
          ...(r.factSources !== undefined ? { factSources: stringArray(r.factSources, "factSources") } : {}),
          ...(r.site !== undefined ? { site: parseSite(r.site) } : {}),
        },
        goal: r.goal,
      };
    },
    execute: ({ ctx, goal }, runCtx) =>
      new VerificationLoop({
        checks: opts.checks,
        asyncChecks: opts.asyncChecks,
        reviewSuites: opts.reviewSuites,
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
