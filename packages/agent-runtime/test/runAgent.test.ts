import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryAuditSink, AuditWriteError, recordAudit } from "@wfact/audit";
import {
  AgentInputError,
  AgentRegistry,
  createSeedRegistry,
  runAgent,
  SEED_AGENT_DEFINITIONS,
  type Agent,
  type AgentDefinition,
} from "../src/index.js";

const TASK_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const noSleep = async () => {};

// A toy agent defined entirely outside agent-runtime's src — the Stage 2 acceptance criterion is that
// a new agent needs only this (implement Agent + register a definition), no runtime code change.
const ECHO_DEF: AgentDefinition = {
  role: "echo-test",
  description: "Test-only agent: uppercases a string.",
  skillset: ["echo"],
  permissionScope: [],
  modelSlots: [],
};

function echoAgent(behaviour: { failTimes?: number; escalate?: boolean } = {}): Agent<{ text: string }, string> & {
  calls: number;
} {
  const agent = {
    role: "echo-test",
    calls: 0,
    retry: { maxAttempts: 3, baseDelayMs: 1 },
    parseInput(raw: unknown) {
      const text = (raw as { text?: unknown })?.text;
      if (typeof text !== "string" || !text) throw new AgentInputError("text must be a non-empty string");
      return { text };
    },
    async execute(input: { text: string }) {
      agent.calls += 1;
      if (agent.calls <= (behaviour.failTimes ?? 0)) throw new Error(`transient failure ${agent.calls}`);
      return input.text.toUpperCase();
    },
    escalationReason: (output: string) => (behaviour.escalate ? `output "${output}" needs a human look` : null),
    summarize: (output: string) => ({ length: output.length }),
  };
  return agent;
}

function registryWithEcho() {
  const registry = createSeedRegistry();
  registry.register(ECHO_DEF);
  return registry;
}

test("seed registry holds exactly the two agents that exist — no aspirational roles", () => {
  assert.deepEqual(
    createSeedRegistry().list().map((d) => d.role),
    ["front-end-builder", "qa-evaluator"],
  );
  assert.equal(SEED_AGENT_DEFINITIONS.length, 2);
});

test("registry refuses duplicate and malformed roles", () => {
  const registry = createSeedRegistry();
  assert.throws(() => registry.register({ ...ECHO_DEF, role: "qa-evaluator" }), /already registered/);
  assert.throws(() => registry.register({ ...ECHO_DEF, role: "Bad Role" }), /lowercase/);
});

test("a new agent runs by implementing Agent + registering a definition — lifecycle fully audited", async () => {
  const sink = new InMemoryAuditSink();
  const run = await runAgent(echoAgent(), { taskId: TASK_ID, role: "echo-test", input: { text: "hi" }, entitySlug: "dreamsign" }, {
    registry: registryWithEcho(),
    audit: { sink },
    sleep: noSleep,
  });
  assert.equal(run.status, "completed");
  assert.equal(run.output, "HI");
  assert.equal(run.attempts, 1);
  assert.deepEqual(sink.events.map((e) => e.action), ["agent.spawn", "agent.complete"]);
  for (const e of sink.events) {
    assert.equal(e.taskId, TASK_ID);
    assert.equal(e.runId, run.runId);
    assert.equal(e.actor, "agent:echo-test");
    assert.equal(e.entitySlug, "dreamsign");
  }
  assert.deepEqual(sink.events[1]!.payload?.summary, { length: 2 });
});

test("an unregistered role is rejected, never executed", async () => {
  const agent = echoAgent();
  const sink = new InMemoryAuditSink();
  const run = await runAgent(agent, { taskId: TASK_ID, role: "echo-test", input: { text: "hi" } }, {
    registry: createSeedRegistry(),
    audit: { sink },
  });
  assert.equal(run.status, "rejected");
  assert.match(run.reason ?? "", /not registered/);
  assert.equal(agent.calls, 0);
  assert.deepEqual(sink.events.map((e) => [e.action, e.outcome]), [["agent.reject", "rejected"]]);
});

test("a task addressed to a different role is rejected", async () => {
  const run = await runAgent(echoAgent(), { taskId: TASK_ID, role: "qa-evaluator", input: { text: "hi" } }, {
    registry: registryWithEcho(),
  });
  assert.equal(run.status, "rejected");
});

test("input that fails the agent's schema is rejected before spawning", async () => {
  const agent = echoAgent();
  const sink = new InMemoryAuditSink();
  const run = await runAgent(agent, { taskId: TASK_ID, role: "echo-test", input: { text: 42 } }, {
    registry: registryWithEcho(),
    audit: { sink },
  });
  assert.equal(run.status, "rejected");
  assert.match(run.reason ?? "", /text must be a non-empty string/);
  assert.equal(agent.calls, 0);
  assert.ok(!sink.events.some((e) => e.action === "agent.spawn"));
});

test("a non-UUID task id and a passed deadline are both rejected", async () => {
  const registry = registryWithEcho();
  const bad = await runAgent(echoAgent(), { taskId: "task-1", role: "echo-test", input: { text: "x" } }, { registry });
  assert.equal(bad.status, "rejected");
  const late = await runAgent(
    echoAgent(),
    { taskId: TASK_ID, role: "echo-test", input: { text: "x" }, deadline: "2020-01-01T00:00:00Z" },
    { registry },
  );
  assert.equal(late.status, "rejected");
  assert.match(late.reason ?? "", /already passed/);
});

test("transient failures retry within budget (Hermes' withBoundedRetry), then succeed", async () => {
  const agent = echoAgent({ failTimes: 2 });
  const run = await runAgent(agent, { taskId: TASK_ID, role: "echo-test", input: { text: "ok" } }, {
    registry: registryWithEcho(),
    sleep: noSleep,
  });
  assert.equal(run.status, "completed");
  assert.equal(run.attempts, 3);
});

test("exhausting the retry budget escalates with the last error — never retries forever", async () => {
  const agent = echoAgent({ failTimes: 99 });
  const sink = new InMemoryAuditSink();
  const run = await runAgent(agent, { taskId: TASK_ID, role: "echo-test", input: { text: "ok" }, retryBudget: 2 }, {
    registry: registryWithEcho(),
    audit: { sink },
    sleep: noSleep,
  });
  assert.equal(run.status, "escalated");
  assert.equal(agent.calls, 2, "task retryBudget overrides the agent's default of 3");
  assert.match(run.reason ?? "", /transient failure 2/);
  assert.equal(sink.events.at(-1)!.action, "agent.escalate");
});

test("an agent can escalate a completed output (e.g. round cap hit) — output kept, not retried", async () => {
  const agent = echoAgent({ escalate: true });
  const run = await runAgent(agent, { taskId: TASK_ID, role: "echo-test", input: { text: "ok" } }, {
    registry: registryWithEcho(),
  });
  assert.equal(run.status, "escalated");
  assert.equal(run.output, "OK");
  assert.equal(agent.calls, 1);
});

test("fail closed: an agent's own audit write failing propagates instead of becoming an escalation", async () => {
  const registry = new AgentRegistry([ECHO_DEF]);
  let firstWrite = true;
  const flakySink = {
    name: "flaky",
    write: async () => {
      if (firstWrite) {
        firstWrite = false; // let agent.spawn through, fail the agent's inner write
        return;
      }
      throw new AuditWriteError("audit down", 503);
    },
  };
  const agent: Agent<{ text: string }, string> = {
    ...echoAgent(),
    async execute(input, ctx) {
      await recordAudit(ctx.audit!, { action: "echo.inner", outcome: "info" });
      return input.text;
    },
  };
  await assert.rejects(
    () => runAgent(agent, { taskId: TASK_ID, role: "echo-test", input: { text: "x" } }, { registry, audit: { sink: flakySink }, sleep: noSleep }),
    AuditWriteError,
  );
});
