/**
 * Step 6: the builder agents are gated wherever they are composed. Model clients are guarded inside the agent
 * factories (so a CLI, the jobs runner or a test cannot hand over an ungated client), and the Track B isolated
 * build is a named tool only the front-end-builder scope grants.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { AgentRegistry, SEED_AGENT_DEFINITIONS, createSeedRegistry, defineScope, runAgent } from "@wfact/agent-runtime";
import { MockModelClient } from "../src/modelClient.js";
import { loadBrief } from "../src/brief.js";
import { STARTER_VERSION, type TrackBBuild } from "../src/trackB/build.js";
import { createTrackBBuilderAgent } from "../src/trackB/agent.js";
import { createFrontendBuilderAgent } from "../src/agent.js";

const TASK = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const FX = path.join(import.meta.dirname, "fixtures", "track-b");
const brief = loadBrief(path.join(FX, "northfold.brief.json"));
const FIXTURE_TEXT = readFileSync(path.join(FX, "northfold.content.json"), "utf-8");
const fake: TrackBBuild = {
  files: { "index.html": "<html></html>" },
  binary: [],
  pages: ["index.html"],
  source: {},
  record: { starterVersion: STARTER_VERSION } as TrackBBuild["record"],
};

function trackB(builds: { n: number }) {
  return createTrackBBuilderAgent({
    builderModel: new MockModelClient(() => FIXTURE_TEXT),
    evaluatorModel: new MockModelClient(() => "VERDICT: APPROVED"),
    build: async () => {
      builds.n += 1;
      return fake;
    },
  });
}

// The fixture client is synthetic (no clients/ folder), so the binding rests on the task's own entity.
const task = { taskId: TASK, role: "front-end-builder", input: { brief }, entitySlug: brief.entitySlug, clientSlug: brief.clientSlug };

test("front-end-builder with its seed scope: models and the isolated build are allowed, every allow counted", async () => {
  const builds = { n: 0 };
  const sink = new InMemoryAuditSink();
  const run = await runAgent(trackB(builds), task, { registry: createSeedRegistry(), audit: { sink } });
  assert.equal(run.status, "completed");
  assert.equal(builds.n, 1);
  const perms = sink.events.at(-1)!.payload?.permissions as { allowed: number; denied: number };
  assert.equal(perms.denied, 0);
  assert.ok(perms.allowed >= 6, "client binding + 2 model calls (slot and budget each) + the build tool");
});

test("a builder role whose scope lacks build.trackBIsolated cannot start the build: denied, audited, never built", async () => {
  const builds = { n: 0 };
  const sink = new InMemoryAuditSink();
  const registry = new AgentRegistry([
    { ...SEED_AGENT_DEFINITIONS[0]!, permissionScope: defineScope({ models: ["builder", "evaluator"], maxCostUsdPerRun: 5 }) },
  ]);
  const run = await runAgent(trackB(builds), task, { registry, audit: { sink } });
  assert.equal(builds.n, 0);
  assert.equal(run.status, "escalated");
  const deny = sink.events.find((e) => e.action === "agent.deny")!;
  assert.equal(deny.payload?.capability, "tool:build.trackBIsolated");
  assert.equal(deny.taskId, TASK);
});

test("a builder role without the evaluator slot cannot ask its reviewer: the self-review call is denied", async () => {
  const sink = new InMemoryAuditSink();
  const reviewer = new MockModelClient(() => "VERDICT: APPROVED");
  const agent = createFrontendBuilderAgent({ builderModel: new MockModelClient(() => "<html><body>hi</body></html>"), evaluatorModel: reviewer });
  const registry = new AgentRegistry([
    { ...SEED_AGENT_DEFINITIONS[0]!, permissionScope: defineScope({ models: ["builder"], maxCostUsdPerRun: 5 }) },
  ]);
  const dreamsign = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "..", "..", "..", "clients", "dreamsign-pilot", "brief.json"), "utf-8"));
  const run = await runAgent(agent, { taskId: TASK, role: "front-end-builder", input: { brief: dreamsign }, entitySlug: "dreamsign", clientSlug: "dreamsign-pilot" }, { registry, audit: { sink } });
  assert.equal(run.status, "escalated");
  assert.equal(reviewer.calls.length, 0, "the reviewer model was never called");
  assert.ok(sink.events.some((e) => e.action === "agent.deny" && e.payload?.capability === "model:evaluator"));
});

test("the builder agent's clients are gated even when called outside runAgent: no gate, no model call", async () => {
  const builder = new MockModelClient(() => "<html></html>");
  const agent = createFrontendBuilderAgent({ builderModel: builder, evaluatorModel: new MockModelClient(() => "VERDICT: APPROVED") });
  const dreamsign = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "..", "..", "..", "clients", "dreamsign-pilot", "brief.json"), "utf-8"));
  await assert.rejects(() => agent.execute(agent.parseInput({ brief: dreamsign }), {} as never), /outside any agent run/);
  assert.equal(builder.calls.length, 0);
});

test("the builder !== evaluator rule still holds after guarding", () => {
  const same = new MockModelClient(() => "");
  assert.throws(() => createTrackBBuilderAgent({ builderModel: same, evaluatorModel: same }), /distinct ModelClient instances/);
  assert.throws(() => createFrontendBuilderAgent({ builderModel: same, evaluatorModel: same }), /distinct ModelClient instances/);
});
