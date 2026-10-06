/**
 * Step 6: the QA agent's I/O is gated. Its evaluator client is guarded in the factory, a browser suite needs
 * tool:qa.renderedBrowser, a review suite needs model:reviewer, and its own verification.decision row is an
 * audit_log insert for the run's entity only.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { AgentRegistry, SEED_AGENT_DEFINITIONS, createSeedRegistry, defineScope, runAgent } from "@wfact/agent-runtime";
import { createQaEvaluatorAgent, QA_EVALUATOR_ROLE } from "../src/agent.js";
import { MockModelClient } from "../src/modelClient.js";
import type { AsyncCheckSuite } from "../src/checks/types.js";

const TASK_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const html = readFileSync(path.join(import.meta.dirname, "fixtures", "clean.html"), "utf-8");
const input = { html, clientSlug: "dreamsign-pilot", requiredSections: ["hero", "contact"], otherClientSlugs: ["summit-line-roofing"], goal: "g" };
const task = { taskId: TASK_ID, role: QA_EVALUATOR_ROLE, input, entitySlug: "dreamsign", clientSlug: "dreamsign-pilot" };

function suite(id: string, calls: string[]): AsyncCheckSuite {
  return { id, description: id, run: async () => { calls.push(id); return [{ checkId: id, passed: true, details: [] }]; } };
}

const qaRegistry = (scope: Parameters<typeof defineScope>[0]) =>
  new AgentRegistry([SEED_AGENT_DEFINITIONS[0]!, { ...SEED_AGENT_DEFINITIONS[1]!, permissionScope: defineScope(scope) }]);

test("seed qa-evaluator scope: browser suite, reviewer and evaluator all run; the decision row is attributed to the run's entity", async () => {
  const sink = new InMemoryAuditSink();
  const calls: string[] = [];
  const agent = createQaEvaluatorAgent({
    evaluatorModel: new MockModelClient(() => "VERDICT: APPROVED"),
    asyncChecks: [suite("rendered", calls)],
    reviewSuites: [suite("screenshot-review", calls)],
  });
  const run = await runAgent(agent, task, { registry: createSeedRegistry(), audit: { sink } });
  assert.equal(run.status, "completed");
  assert.equal(run.output?.status, "approved");
  assert.deepEqual(calls, ["rendered", "screenshot-review"]);
  const decision = sink.events.find((e) => e.action === "verification.decision")!;
  assert.equal(decision.entitySlug, "dreamsign");
  assert.equal(decision.payload?.clientSlug, "dreamsign-pilot");
});

test("a QA scope without the reviewer slot: the screenshot review is denied before it runs, and the run escalates", async () => {
  const sink = new InMemoryAuditSink();
  const calls: string[] = [];
  const agent = createQaEvaluatorAgent({ evaluatorModel: new MockModelClient(() => "VERDICT: APPROVED"), reviewSuites: [suite("screenshot-review", calls)] });
  const registry = qaRegistry({ models: ["evaluator"], db: [{ table: "audit_log", ops: ["insert"] }], tools: ["qa.renderedBrowser"], maxCostUsdPerRun: 2 });
  const run = await runAgent(agent, task, { registry, audit: { sink } });
  assert.deepEqual(calls, []);
  assert.equal(run.status, "escalated");
  assert.equal(sink.events.find((e) => e.action === "agent.deny")?.payload?.capability, "model:reviewer");
});

test("a QA scope without the browser tool: the rendered suite never starts", async () => {
  const sink = new InMemoryAuditSink();
  const calls: string[] = [];
  const agent = createQaEvaluatorAgent({ evaluatorModel: null, asyncChecks: [suite("rendered", calls)] });
  const registry = qaRegistry({ models: ["evaluator"], db: [{ table: "audit_log", ops: ["insert"] }], maxCostUsdPerRun: 2 });
  const run = await runAgent(agent, task, { registry, audit: { sink } });
  assert.deepEqual(calls, []);
  assert.equal(run.status, "escalated");
  assert.equal(sink.events.find((e) => e.action === "agent.deny")?.payload?.capability, "tool:qa.renderedBrowser");
});

test("a QA scope without audit_log insert cannot write its verification.decision row", async () => {
  const sink = new InMemoryAuditSink();
  const agent = createQaEvaluatorAgent({ evaluatorModel: new MockModelClient(() => "VERDICT: APPROVED") });
  const registry = qaRegistry({ models: ["evaluator"], maxCostUsdPerRun: 2 });
  const run = await runAgent(agent, task, { registry, audit: { sink } });
  assert.equal(run.status, "escalated");
  assert.ok(!sink.events.some((e) => e.action === "verification.decision"));
  assert.match(String(sink.events.find((e) => e.action === "agent.deny")?.payload?.capability), /^db:insert:audit_log/);
});

test("QA for a client folder that belongs to another entity is rejected before it reads anything", async () => {
  const sink = new InMemoryAuditSink();
  const evaluator = new MockModelClient(() => "VERDICT: APPROVED");
  const run = await runAgent(
    createQaEvaluatorAgent({ evaluatorModel: evaluator }),
    { ...task, input: { ...input, clientSlug: "summit-line-roofing" }, clientSlug: "summit-line-roofing" },
    { registry: createSeedRegistry(), audit: { sink } },
  );
  assert.equal(run.status, "rejected");
  assert.equal(evaluator.calls.length, 0);
  assert.deepEqual(sink.events.map((e) => e.action), ["agent.deny", "agent.reject"]);
});
