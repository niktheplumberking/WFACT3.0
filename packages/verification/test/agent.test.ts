import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry, runAgent } from "@wfact/agent-runtime";
import { createQaEvaluatorAgent, QA_EVALUATOR_ROLE } from "../src/agent.js";
import { MockModelClient } from "../src/modelClient.js";

const TASK_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures");
const input = (fixture: string) => ({
  html: readFileSync(path.join(FIXTURES_DIR, fixture), "utf-8"),
  clientSlug: "dreamsign-pilot",
  requiredSections: ["hero", "contact"],
  otherClientSlugs: ["bennett-co"],
  goal: "test goal",
});

test("qa-evaluator is a seeded, registered role", () => {
  assert.ok(createSeedRegistry().has(QA_EVALUATOR_ROLE));
});

test("broken build: completed QA run with failed_checks — decision row shares the run's task_id", async () => {
  const sink = new InMemoryAuditSink();
  const evaluator = new MockModelClient(() => "VERDICT: APPROVED");
  const run = await runAgent(createQaEvaluatorAgent({ evaluatorModel: evaluator }), {
    taskId: TASK_ID,
    role: QA_EVALUATOR_ROLE,
    input: input("broken.html"),
  }, { registry: createSeedRegistry(), audit: { sink } });

  assert.equal(run.status, "completed", "QA did its job; the verdict is in the output");
  assert.equal(run.output?.status, "failed_checks");
  assert.equal(evaluator.calls.length, 0, "no model call on a build the checks already caught");
  assert.deepEqual(sink.events.map((e) => e.action), ["agent.spawn", "verification.decision", "agent.complete"]);
  assert.ok(sink.events.every((e) => e.taskId === TASK_ID && e.runId === run.runId));
  const summary = sink.events[2]!.payload?.summary as { failedChecks: string[] };
  assert.ok(summary.failedChecks.length > 0);
});

test("clean build + approving evaluator: approved", async () => {
  const run = await runAgent(createQaEvaluatorAgent({ evaluatorModel: new MockModelClient(() => "VERDICT: APPROVED") }), {
    taskId: TASK_ID,
    role: QA_EVALUATOR_ROLE,
    input: input("clean.html"),
  }, { registry: createSeedRegistry() });
  assert.equal(run.output?.status, "approved");
});

test("malformed QA input (path-y slug, missing html) is rejected, never checked", async () => {
  const run = await runAgent(createQaEvaluatorAgent({ evaluatorModel: null }), {
    taskId: TASK_ID,
    role: QA_EVALUATOR_ROLE,
    input: { html: "", clientSlug: "../etc", goal: "x" },
  }, { registry: createSeedRegistry() });
  assert.equal(run.status, "rejected");
});
