/**
 * The front-end loop as a `front-end-builder` agent on the shared runtime (Continuation Plan
 * Stage 2). A thin adapter: `FrontendLoop` itself is unchanged, so its existing test suite still
 * proves the build → review → fix behaviour; this file only maps it onto the Agent lifecycle —
 * typed input, one bounded execution, and "hit the round cap" surfaced as an escalation instead of
 * a flag the caller has to remember to check.
 */
import type { Agent } from "@wfact/agent-runtime";
import { parseBrief, type PilotBrief } from "./brief.js";
import { selectTemplate, type PageTemplate } from "./templates.js";
import { FrontendLoop, type FrontendLoopResult } from "./loop.js";
import type { ModelClient } from "./modelClient.js";

export const FRONT_END_BUILDER_ROLE = "front-end-builder";

export interface FrontendBuildInput {
  brief: PilotBrief;
  template: PageTemplate;
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
  // exactly as it did when the CLI built the loop directly.
  const loop = new FrontendLoop(opts);
  return {
    role: FRONT_END_BUILDER_ROLE,
    // One attempt by default: a full multi-round build is expensive to repeat, and FrontendLoop
    // already bounds its own correction rounds. A task can raise this via retryBudget.
    retry: { maxAttempts: 1, baseDelayMs: 2000 },
    parseInput(raw: unknown): FrontendBuildInput {
      const brief = parseBrief((raw as { brief?: unknown } | null)?.brief);
      return { brief, template: selectTemplate(brief.templatePreference) };
    },
    execute: ({ brief, template }) => loop.run(brief, template),
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
