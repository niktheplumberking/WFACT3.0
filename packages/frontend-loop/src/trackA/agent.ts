/**
 * Track A as a `front-end-builder` agent (Step 4B M3): same role, input shape and lifecycle as the
 * single-page builder (src/agent.ts), so the workflow and jobs runner use it unchanged. The difference
 * is the output: a multi-page site (`result.site`) built from content-as-data, and revisions edit that
 * content (`revision.contentJson`), not HTML.
 */
import { AgentInputError, type Agent } from "@wfact/agent-runtime";
import { parseBrief } from "../brief.js";
import type { FrontendBuildInput } from "../agent.js";
import { FRONT_END_BUILDER_ROLE } from "../agent.js";
import type { FrontendLoopResult } from "../loop.js";
import type { ModelClient } from "../modelClient.js";
import { TrackALoop, TRACK_A_TEMPLATE } from "./loop.js";

export interface TrackABuilderAgentOptions {
  builderModel: ModelClient;
  evaluatorModel: ModelClient;
  maxRounds?: number;
  nowIso?: () => string;
}

export function createTrackABuilderAgent(opts: TrackABuilderAgentOptions): Agent<FrontendBuildInput, FrontendLoopResult> {
  const loop = new TrackALoop(opts);
  return {
    role: FRONT_END_BUILDER_ROLE,
    retry: { maxAttempts: 1, baseDelayMs: 2000 },
    parseInput(raw: unknown): FrontendBuildInput {
      const r = (raw ?? {}) as { brief?: unknown; revision?: unknown };
      const input: FrontendBuildInput = { brief: parseBrief(r.brief), template: TRACK_A_TEMPLATE };
      if (r.revision !== undefined) {
        const rev = r.revision as { html?: unknown; issues?: unknown; contentJson?: unknown };
        if (typeof rev.contentJson !== "string" || rev.contentJson.length === 0) {
          throw new AgentInputError("a Track A revision needs revision.contentJson (the site content being revised)");
        }
        if (!Array.isArray(rev.issues) || rev.issues.length === 0 || !rev.issues.every((i) => typeof i === "string" && i)) {
          throw new AgentInputError("revision.issues must be a non-empty list of specific issues");
        }
        input.revision = { html: typeof rev.html === "string" ? rev.html : "", issues: rev.issues as string[], contentJson: rev.contentJson };
      }
      return input;
    },
    execute: ({ brief, revision }) => (revision ? loop.revise(brief, revision.contentJson!, revision.issues) : loop.run(brief)),
    escalationReason: (result) => (result.needsHuman ? result.escalationReason ?? "Track A builder needs a human" : null),
    summarize: (result) => ({
      approved: result.approved,
      correctionRounds: result.rounds.length,
      template: result.template.id,
      clientSlug: result.brief.clientSlug,
      pages: result.site?.pages ?? [],
      bytes: Object.values(result.site?.files ?? {}).reduce((n, f) => n + f.length, 0),
    }),
  };
}
