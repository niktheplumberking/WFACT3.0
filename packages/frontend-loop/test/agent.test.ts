import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry, runAgent } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent, FRONT_END_BUILDER_ROLE } from "../src/agent.js";
import { MockModelClient } from "../src/modelClient.js";

const TASK_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const rawBrief = {
  clientSlug: "dreamsign-pilot",
  entitySlug: "dreamsign",
  projectName: "DreamSign Homepage",
  goal: "A one-page homepage introducing DreamSign's services.",
  requiredSections: ["hero", "services", "process", "contact"],
  brandNotes: "Clean, trustworthy, restrained.",
  templatePreference: "clean-agency",
  source: "placeholder-2.0-case",
};

test("front-end-builder is a seeded, registered role", () => {
  assert.ok(createSeedRegistry().has(FRONT_END_BUILDER_ROLE));
});

test("runs the unchanged FrontendLoop through runAgent: approved build → completed run, audited", async () => {
  const sink = new InMemoryAuditSink();
  const agent = createFrontendBuilderAgent({
    builderModel: new MockModelClient(() => "<html>page</html>"),
    evaluatorModel: new MockModelClient(() => "VERDICT: APPROVED"),
  });
  const run = await runAgent(agent, { taskId: TASK_ID, role: FRONT_END_BUILDER_ROLE, input: { brief: rawBrief } }, {
    registry: createSeedRegistry(),
    audit: { sink },
  });
  assert.equal(run.status, "completed");
  assert.equal(run.output?.approved, true);
  assert.equal(run.output?.finalHtml, "<html>page</html>");
  assert.equal(run.output?.template.id, "clean-agency");
  assert.deepEqual(sink.events.map((e) => e.action), ["agent.spawn", "agent.complete"]);
  assert.deepEqual(sink.events[1]!.payload?.summary, {
    approved: true,
    correctionRounds: 1,
    template: "clean-agency",
    clientSlug: "dreamsign-pilot",
    htmlBytes: "<html>page</html>".length,
  });
});

test("hitting the round cap becomes an escalated run with the loop's own reason — output kept", async () => {
  const agent = createFrontendBuilderAgent({
    builderModel: new MockModelClient(() => "<html>still wrong</html>"),
    evaluatorModel: new MockModelClient(() => "VERDICT: CHANGES_REQUESTED\nISSUES:\n- nope"),
    maxRounds: 2,
  });
  const run = await runAgent(agent, { taskId: TASK_ID, role: FRONT_END_BUILDER_ROLE, input: { brief: rawBrief } }, {
    registry: createSeedRegistry(),
  });
  assert.equal(run.status, "escalated");
  assert.match(run.reason ?? "", /2-round cap/);
  assert.equal(run.output?.rounds.length, 2);
});

test("a malformed brief is rejected before any model is called", async () => {
  const builder = new MockModelClient(() => "<html></html>");
  const agent = createFrontendBuilderAgent({ builderModel: builder, evaluatorModel: new MockModelClient(() => "") });
  const run = await runAgent(agent, { taskId: TASK_ID, role: FRONT_END_BUILDER_ROLE, input: { brief: { goal: "x" } } }, {
    registry: createSeedRegistry(),
  });
  assert.equal(run.status, "rejected");
  assert.equal(builder.calls.length, 0);
});

test("builder === evaluator is still refused at composition time, as before", () => {
  const same = new MockModelClient(() => "");
  assert.throws(() => createFrontendBuilderAgent({ builderModel: same, evaluatorModel: same }), /distinct ModelClient/);
});
