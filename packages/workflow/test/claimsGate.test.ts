/**
 * Step 4B M1, end to end through the workflow (models mocked, checks real): the Step 4 artifact as
 * the builder's first page is caught by the claims gate, the builder's revision prompt carries the
 * exact claims check ids, and a clean revision then reaches the launch hard-gate (never deploys).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent } from "@wfact/frontend-loop/agent";
import { MockModelClient as BuilderMock } from "@wfact/frontend-loop/modelClient";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { MockModelClient as EvaluatorMock } from "@wfact/verification/modelClient";
import { QA_GATE_CHECKS } from "@wfact/verification/registry";
import { buildAndVerify, MemoryArtifactStore, type WorkflowDeps } from "../src/buildAndVerify.js";

const repo = path.resolve(import.meta.dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(path.join(repo, rel), "utf-8");
const STEP4 = read("packages/verification/test/fixtures/step4-summit-line-960b61ba.html");
const CLEAN = read("packages/frontend-loop/design/fixtures/clean.html");
const brief = JSON.parse(read("clients/summit-line-roofing/brief.json"));

test("Step 4 page is bounced to the builder with the exact claims check ids; the clean revision reaches the launch gate", async () => {
  const builder = new BuilderMock((req) => (req.user.includes("Issues to fix") ? CLEAN : STEP4));
  const qaModel = new EvaluatorMock(() => "VERDICT: APPROVED");
  const sink = new InMemoryAuditSink();
  const deps: WorkflowDeps = {
    frontEndAgent: createFrontendBuilderAgent({ builderModel: builder, evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: qaModel, checks: QA_GATE_CHECKS }),
    registry: createSeedRegistry(),
    audit: sink,
    reader: sink,
    artifacts: new MemoryArtifactStore(),
    knownClientSlugs: ["summit-line-roofing", "dreamsign-pilot"],
  };

  const result = await buildAndVerify(brief, deps);

  const bounce = sink.events.find((e) => e.action === "workflow.return_to_builder")!;
  const issues = bounce.payload?.issues as string[];
  for (const id of ["claims.after-html", "claims.sample-label", "claims.banned", "claims.unsourced-fact"]) {
    assert.ok(issues.some((i) => i.startsWith(`[${id}] `)), `issue list has [${id}]`);
  }
  assert.ok(issues.some((i) => i.includes('"(555) 014-7732"')), "the invented phone is named");
  const revisionPrompt = builder.calls.find((c) => c.user.includes("Issues to fix"))!.user;
  assert.ok(revisionPrompt.includes("[claims.after-html] Text after </html>"), "builder is told exactly what to fix");

  assert.equal(result.status, "awaiting_launch_approval");
  assert.equal(result.cycles, 2);
  assert.equal(qaModel.calls.length, 1, "the evaluator is paid for once, on the page that passed the gate");
});
