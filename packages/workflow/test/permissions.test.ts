/**
 * Step 6 in the build-and-verify workflow: the builder's page is written through the builder's scope, the QA read
 * goes through the QA agent's scope, and both are bound to the brief's client. A builder that tries to put its
 * output in another client's folder, or a brief that points at another entity's client, is stopped and audited.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { AgentRegistry, SEED_AGENT_DEFINITIONS, createSeedRegistry, defineScope, type Agent } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent, type FrontendBuildInput } from "@wfact/frontend-loop/agent";
import type { FrontendLoopResult } from "@wfact/frontend-loop/loop";
import { MockModelClient as BuilderMock } from "@wfact/frontend-loop/modelClient";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { MockModelClient as EvaluatorMock } from "@wfact/verification/modelClient";
import { buildAndVerify, gatedArtifactStore, MemoryArtifactStore, type WorkflowDeps } from "../src/buildAndVerify.js";
import { permissionGateFor } from "@wfact/agent-runtime";

const FIXTURES = path.join(import.meta.dirname, "..", "..", "verification", "test", "fixtures");
const CLEAN = readFileSync(path.join(FIXTURES, "clean.html"), "utf-8").replace(
  '<section id="contact">',
  '<section id="services"><p>What we do.</p></section>\n  <section id="process"><p>How it works.</p></section>\n  <section id="contact">',
);
const brief = {
  clientSlug: "dreamsign-pilot",
  entitySlug: "dreamsign",
  projectName: "DreamSign Homepage",
  goal: "A one-page homepage introducing DreamSign's services.",
  requiredSections: ["hero", "services", "process", "contact"],
  brandNotes: "Clean, trustworthy, restrained.",
  templatePreference: "clean-agency",
  source: "placeholder-2.0-case",
};

function deps(over: Partial<WorkflowDeps> = {}) {
  const sink = new InMemoryAuditSink();
  const store = new MemoryArtifactStore();
  const d: WorkflowDeps = {
    frontEndAgent: createFrontendBuilderAgent({ builderModel: new BuilderMock(() => CLEAN), evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: new EvaluatorMock(() => "VERDICT: APPROVED") }),
    registry: createSeedRegistry(),
    audit: sink,
    reader: sink,
    artifacts: store,
    knownClientSlugs: ["dreamsign-pilot", "summit-line-roofing"],
    ...over,
  };
  return { d, sink, store };
}

test("the clean path still reaches the launch gate with permissions enforced, and every agent run records zero denials", async () => {
  const { d, sink, store } = deps();
  const r = await buildAndVerify(brief, d);
  assert.equal(r.status, "awaiting_launch_approval");
  assert.deepEqual([...store.files.keys()], ["clients/dreamsign-pilot/pages/clean-agency.html"]);
  const summaries = sink.events.filter((e) => e.action === "agent.complete").map((e) => (e.payload?.permissions as { denied: number }).denied);
  assert.deepEqual(summaries, [0, 0]);
  assert.ok(!sink.events.some((e) => e.action === "agent.deny"));
});

test("a builder whose output targets ANOTHER client's folder: the write is denied, audited on the builder's task, nothing is written", async () => {
  const honest = createFrontendBuilderAgent({ builderModel: new BuilderMock(() => CLEAN), evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") });
  // A steered builder: same role and input contract, but its result claims to be for summit-line-roofing.
  const steered: Agent<FrontendBuildInput, FrontendLoopResult> = {
    ...honest,
    async execute(input, ctx) {
      const out = await honest.execute(input, ctx);
      return { ...out, brief: { ...out.brief, clientSlug: "summit-line-roofing" } };
    },
  };
  const { d, sink, store } = deps({ frontEndAgent: steered });
  const r = await buildAndVerify(brief, d);
  assert.equal(r.status, "build_failed");
  assert.match(r.reason ?? "", /fs:write:clients\/summit-line-roofing\/pages\/clean-agency\.html/);
  assert.equal(store.files.size, 0, "no file was written anywhere");
  const deny = sink.events.find((e) => e.action === "agent.deny")!;
  assert.equal(deny.actor, "agent:front-end-builder");
  assert.equal(deny.runId, r.workflowRunId);
  const buildTask = sink.events.find((e) => e.actor === "agent:front-end-builder" && e.action === "agent.spawn")!.taskId;
  assert.equal(deny.taskId, buildTask, "the denial hangs off the builder's own task id");
});

test("a brief that points at another entity's client folder never builds: the builder run is rejected and audited", async () => {
  const builder = new BuilderMock(() => CLEAN);
  const { d, sink, store } = deps({
    frontEndAgent: createFrontendBuilderAgent({ builderModel: builder, evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
  });
  // summit-line-roofing belongs to bennett-co (clients/summit-line-roofing/brief.json); this brief claims dreamsign.
  const r = await buildAndVerify({ ...brief, clientSlug: "summit-line-roofing" }, d);
  assert.equal(r.status, "build_failed");
  assert.match(r.reason ?? "", /belongs to entity "bennett-co"/);
  assert.equal(builder.calls.length, 0);
  assert.equal(store.files.size, 0);
  assert.ok(sink.events.some((e) => e.action === "agent.deny" && e.payload?.capability === "client:summit-line-roofing(owner=bennett-co)"));
});

test("a builder scope without the pages grant cannot have its page written", async () => {
  const registry = new AgentRegistry([
    { ...SEED_AGENT_DEFINITIONS[0]!, permissionScope: defineScope({ models: ["builder", "evaluator"], fsWrite: ["clients/{client}/sites/**"], maxCostUsdPerRun: 5 }) },
    SEED_AGENT_DEFINITIONS[1]!,
  ]);
  const { d, store } = deps({ registry });
  const r = await buildAndVerify(brief, d);
  assert.equal(r.status, "build_failed");
  assert.equal(store.files.size, 0);
});

test("gatedArtifactStore: the QA role may read its client's checkpoint but may not write, and may not read another client's", async () => {
  const store = new MemoryArtifactStore();
  const written = await store.write("clients/dreamsign-pilot/pages/a.html", "<html></html>");
  const other = await store.write("clients/summit-line-roofing/pages/a.html", "<html></html>");
  const qa = gatedArtifactStore(store, permissionGateFor(createSeedRegistry(), "qa-evaluator", { taskId: null, runId: null, entitySlug: "dreamsign", clientSlug: "dreamsign-pilot", audit: null }));
  assert.equal(await qa.readVerified(written), "<html></html>");
  await assert.rejects(() => qa.write("clients/dreamsign-pilot/pages/b.html", "x"), /fs:write/);
  await assert.rejects(() => qa.readVerified(other), /not the client this run is bound to/);
});
