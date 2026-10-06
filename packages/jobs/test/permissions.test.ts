/**
 * Step 6 in the Cockpit job runner: the "ask" job's Hermes-lite tool and model calls go through the controller's
 * gate, and the "verify" job reads on the QA agent's behalf, bound to the page's client and that client's entity.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { defineScope, HERMES_LITE_SCOPE } from "@wfact/agent-runtime";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { MockModelClient } from "@wfact/verification/modelClient";
import { askHermesGated } from "../src/hermesAsk.js";
import { handleJob, type HandlerDeps } from "../src/handlers.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

function model(answer = "All good.") {
  return { name: "mock", calls: 0, async complete() { this.calls += 1; return answer; } };
}

test("ask: with the controller scope Hermes reads its tools and calls its model; nothing is denied", async () => {
  const audit = new InMemoryAuditSink();
  const m = model();
  const a = await askHermesGated("How is DreamSign doing?", { audit, stateReader: null, modelClient: m });
  assert.equal(a.needsHuman, false);
  assert.equal(m.calls, 1);
  assert.ok(audit.events.some((e) => e.action === "tool.invoke" && e.outcome === "success"));
  assert.ok(!audit.events.some((e) => e.action === "agent.deny"));
  assert.deepEqual(HERMES_LITE_SCOPE.fsWrite, [], "the controller scope cannot write");
});

test("ask: a tool outside the controller's scope is refused, audited as agent.deny and as a rejected tool.invoke", async () => {
  const audit = new InMemoryAuditSink();
  const m = model();
  const narrow = defineScope({ models: ["hermes"], tools: ["memory.readContext"], maxCostUsdPerRun: 0.5, crossEntity: true });
  // Naming an entity makes Hermes read that client's memory file: memory.readClient, not in the narrow scope.
  await assert.rejects(() => askHermesGated("Status for DreamSign?", { audit, stateReader: null, modelClient: m, scope: narrow }), /not permitted/);
  assert.equal(m.calls, 0, "no model call after a refused tool");
  const deny = audit.events.find((e) => e.action === "agent.deny")!;
  assert.equal(deny.actor, "hermes-lite");
  assert.equal(deny.payload?.capability, "tool:memory.readClient");
  assert.ok(audit.events.some((e) => e.action === "tool.invoke" && e.outcome === "rejected" && e.payload?.tool === "memory.readClient"));
});

test("ask: the model call is gated too (a scope without the hermes slot gets no answer, and says why)", async () => {
  const audit = new InMemoryAuditSink();
  const m = model();
  const noModel = defineScope({ tools: ["memory.readContext"], crossEntity: true });
  const a = await askHermesGated("Anything new?", { audit, stateReader: null, modelClient: m, scope: noModel });
  assert.equal(m.calls, 0);
  assert.equal(a.needsHuman, true);
  assert.match(a.escalationReason ?? "", /model:hermes/);
});

test("verify job: QA runs bound to the page's client and the entity that owns it; reads are allowed by the QA scope", async () => {
  const audit = new InMemoryAuditSink();
  const deps = {
    readArtifact: async () => null,
    repoRoot: REPO_ROOT,
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: new MockModelClient(() => "VERDICT: APPROVED") }),
    audit,
    knownClientSlugs: ["dreamsign-pilot", "summit-line-roofing"],
  } as unknown as HandlerDeps;
  const job = { id: "11111111-2222-4333-8444-555555555555", kind: "verify" as const, status: "running" as const, createdBy: "t", params: { path: "clients/dreamsign-pilot/pages/missing.html", goal: "g" } };
  const out = await handleJob(job, deps);
  assert.equal(out.ok, false);
  assert.match(out.reason ?? "", /no page at/, "the read was permitted; the page simply is not there");
  assert.ok(!audit.events.some((e) => e.action === "agent.deny"));
});
