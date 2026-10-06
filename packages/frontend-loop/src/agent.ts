/**
 * The front-end loop as a `front-end-builder` agent on the shared runtime (Continuation Plan
 * Stage 2). A thin adapter: `FrontendLoop` itself is unchanged, so its existing test suite still
 * proves the build → review → fix behaviour; this file only maps it onto the Agent lifecycle —
 * typed input, one bounded execution, and "hit the round cap" surfaced as an escalation instead of
 * a flag the caller has to remember to check.
 */
import { AgentInputError, guardModelPair, type Agent } from "@wfact/agent-runtime";
import { parseBrief, type PilotBrief } from "./brief.js";
import { selectTemplate, type PageTemplate } from "./templates.js";
import { FrontendLoop, type FrontendLoopResult } from "./loop.js";
import type { ModelClient } from "./modelClient.js";

export const FRONT_END_BUILDER_ROLE = "front-end-builder";

export interface FrontendBuildInput {
  brief: PilotBrief;
  template: PageTemplate;
  /**
   * Stage 3: when present, revise this page against these specific issues (from the QA agent)
   * instead of generating from scratch.
   */
  revision?: { html: string; issues: string[]; contentJson?: string };
}

export interface FrontendBuilderAgentOptions {
  builderModel: ModelClient;
  evaluatorModel: ModelClient;
  maxRounds?: number;
  nowIso?: () => string;
}

export function createFrontendBuilderAgent(
  opts: FrontendBuilderAgentOptions,
): Agent<FrontendBuildInput, FrontendLoopResult> {
  // Constructed once, up front: the builder ≠ evaluator instance check fires at composition time,
  // exactly as it did when the CLI built the loop directly. Step 6: both clients are guarded here, so every
  // call asks the run's gate for model:builder / model:evaluator and budget (guardModelPair keeps the
  // same-instance check meaningful).
  const models = guardModelPair(opts.builderModel, "builder", opts.evaluatorModel, "evaluator");
  const loop = new FrontendLoop({ ...opts, builderModel: models.builder, evaluatorModel: models.evaluator });
  return {
    role: FRONT_END_BUILDER_ROLE,
    // One attempt by default: a full multi-round build is expensive to repeat, and FrontendLoop
    // already bounds its own correction rounds. A task can raise this via retryBudget.
    retry: { maxAttempts: 1, baseDelayMs: 2000 },
    parseInput(raw: unknown): FrontendBuildInput {
      const r = (raw ?? {}) as { brief?: unknown; revision?: unknown };
      const brief = parseBrief(r.brief);
      const input: FrontendBuildInput = { brief, template: selectTemplate(brief.templatePreference) };
      if (r.revision !== undefined) {
        const rev = r.revision as { html?: unknown; issues?: unknown };
        if (typeof rev.html !== "string" || rev.html.length === 0) {
          throw new AgentInputError("revision.html must be the non-empty page being revised");
        }
        if (!Array.isArray(rev.issues) || rev.issues.length === 0 || !rev.issues.every((i) => typeof i === "string" && i)) {
          throw new AgentInputError("revision.issues must be a non-empty list of specific issues");
        }
        input.revision = { html: rev.html, issues: rev.issues as string[] };
      }
      return input;
    },
    execute: ({ brief, template, revision }) =>
      revision ? loop.revise(brief, template, revision.html, revision.issues) : loop.run(brief, template),
    escalationReason: (result) => (result.needsHuman ? result.escalationReason ?? "front-end loop needs a human" : null),
    summarize: (result) => ({
      approved: result.approved,
      correctionRounds: result.rounds.length,
      template: result.template.id,
      clientSlug: result.brief.clientSlug,
      htmlBytes: result.finalHtml?.length ?? 0,
    }),
  };
}
