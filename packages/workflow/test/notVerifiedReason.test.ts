/**
 * 2026-10-03, Cockpit job 5c85914b (Track B): every deterministic check passed, then the design reviewer's
 * gateway answered HTTP 502 four times, so the review was NOT RUN. The run was correctly not verified, but
 * its reason said "no evaluator model was configured", sending the owner after a configuration that was
 * fine. The reason now names the review that could not run and what it said.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createTrackBBuilderAgent } from "@wfact/frontend-loop/trackB/agent";
import type { TrackBBuild } from "@wfact/frontend-loop/trackB/build";
import { MockModelClient as BuilderMock } from "@wfact/frontend-loop/modelClient";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { MockModelClient as EvaluatorMock } from "@wfact/verification/modelClient";
import type { AsyncCheckSuite } from "@wfact/verification/checks/types";
import { buildAndVerify, MemoryArtifactStore, notVerifiedReason, type WorkflowDeps } from "../src/buildAndVerify.js";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const FX = path.join(ROOT, "packages/frontend-loop/test/fixtures/track-b");
const brief = JSON.parse(readFileSync(path.join(FX, "northfold.brief.json"), "utf-8"));
const CONTENT = readFileSync(path.join(FX, "northfold.content.json"), "utf-8");
const OUTAGE = "NOT RUN: the agent37 reviewer gave no valid answer after 4 attempts (HTTP 502: upstream_unreachable). The design review is required; this is not a pass.";

test("the reason names a review that could not run, and keeps the no-evaluator wording only for that case", () => {
  assert.match(notVerifiedReason([{ checkId: "render.links", details: [] }]), /no evaluator model was configured/);
  const r = notVerifiedReason([{ checkId: "render.links", details: [] }, { checkId: "render.design-review", details: [OUTAGE], notRun: true }]);
  assert.match(r, /a required review could not run \(render\.design-review: NOT RUN: .*HTTP 502: upstream_unreachable/);
  assert.doesNotMatch(r, /no evaluator model/);
});

test("end to end: a design review that does not run halts as not verified, with the outage in the halt reason", async () => {
  const fakeBuild = async (): Promise<TrackBBuild> => ({
    files: { "index.html": "<!doctype html><html lang=\"en\"><head><title>x</title></head><body><main><h1>x</h1></main></body></html>" },
    binary: [],
    pages: ["index.html"],
    source: {},
    record: { starterVersion: "track-b-starter/1.0.0" } as TrackBBuild["record"],
  });
  const review: AsyncCheckSuite = { id: "design-review", description: "stand-in reviewer that is down", run: async () => [{ checkId: "render.design-review", passed: false, notRun: true, details: [OUTAGE] }] };
  const sink = new InMemoryAuditSink();
  const deps: WorkflowDeps = {
    frontEndAgent: createTrackBBuilderAgent({ builderModel: new BuilderMock(() => CONTENT), evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED"), build: fakeBuild }),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: new EvaluatorMock(() => "VERDICT: APPROVED"), checks: [], reviewSuites: [review] }),
    registry: createSeedRegistry(),
    audit: sink,
    reader: sink,
    artifacts: new MemoryArtifactStore(),
    knownClientSlugs: ["northfold-studio"],
  };
  const result = await buildAndVerify(brief, deps);
  assert.equal(result.status, "not_verified_no_evaluator");
  assert.match(result.reason ?? "", /a required review could not run .*HTTP 502: upstream_unreachable/);
  assert.match(result.reason ?? "", /start the build again once the reviewer is reachable/);
});
