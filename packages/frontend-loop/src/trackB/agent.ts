/**
 * Track B as a `front-end-builder` agent (Step 4B M4): same role, input shape and lifecycle as the Track A
 * agent (src/trackA/agent.ts), so the workflow and the jobs runner use it unchanged. Output: a multi-page
 * static export (`result.site`, binary fonts as base64, plus the source that was built and the build
 * record); revisions edit the content (`revision.contentJson`), never the code.
 */
import { AgentInputError, guardModelPair, requirePermission, type Agent } from "@wfact/agent-runtime";
import { buildTrackBSite } from "./build.js";
import type { SiteContent } from "./content.js";
import { parseBrief } from "../brief.js";
import type { FrontendBuildInput } from "../agent.js";
import { FRONT_END_BUILDER_ROLE } from "../agent.js";
import type { FrontendLoopResult } from "../loop.js";
import { TrackBLoop, TRACK_B_TEMPLATE, type TrackBLoopOptions } from "./loop.js";

export function createTrackBBuilderAgent(opts: TrackBLoopOptions): Agent<FrontendBuildInput, FrontendLoopResult> {
  // Step 6: model calls and the isolated build go through the run's permission gate. The build is a named tool
  // (build.trackBIsolated) in the front-end-builder's scope, so no other role can start one.
  const models = guardModelPair(opts.builderModel, "builder", opts.evaluatorModel, "evaluator");
  const build = opts.build ?? ((c: SiteContent) => buildTrackBSite(c));
  const loop = new TrackBLoop({
    ...opts,
    builderModel: models.builder,
    evaluatorModel: models.evaluator,
    build: async (content) => {
      await requirePermission({ kind: "tool", name: "build.trackBIsolated" });
      return build(content);
    },
  });
  return {
    role: FRONT_END_BUILDER_ROLE,
    retry: { maxAttempts: 1, baseDelayMs: 2000 },
    parseInput(raw: unknown): FrontendBuildInput {
      const r = (raw ?? {}) as { brief?: unknown; revision?: unknown };
      const input: FrontendBuildInput = { brief: parseBrief(r.brief), template: TRACK_B_TEMPLATE };
      if (r.revision !== undefined) {
        const rev = r.revision as { html?: unknown; issues?: unknown; contentJson?: unknown };
        if (typeof rev.contentJson !== "string" || rev.contentJson.length === 0) {
          throw new AgentInputError("a Track B revision needs revision.contentJson (the site content being revised)");
        }
        if (!Array.isArray(rev.issues) || rev.issues.length === 0 || !rev.issues.every((i) => typeof i === "string" && i)) {
          throw new AgentInputError("revision.issues must be a non-empty list of specific issues");
        }
        input.revision = { html: typeof rev.html === "string" ? rev.html : "", issues: rev.issues as string[], contentJson: rev.contentJson };
      }
      return input;
    },
    execute: ({ brief, revision }) => (revision ? loop.revise(brief, revision.contentJson!, revision.issues) : loop.run(brief)),
    escalationReason: (result) => (result.needsHuman ? result.escalationReason ?? "Track B builder needs a human" : null),
    summarize: (result) => ({
      approved: result.approved,
      correctionRounds: result.rounds.length,
      template: result.template.id,
      clientSlug: result.brief.clientSlug,
      pages: result.site?.pages ?? [],
      files: Object.keys(result.site?.files ?? {}).length,
      bytes: Object.values(result.site?.files ?? {}).reduce((n, f) => n + f.length, 0),
      build: result.site?.buildRecord ?? null,
    }),
  };
}
