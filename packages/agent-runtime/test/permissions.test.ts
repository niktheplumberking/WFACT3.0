/**
 * Step 6: the permission policy is typed, versioned, default-deny and enforced in one place. These tests prove the
 * decision function, the scope validator, the gate's audit trail, and the runtime's use of it (model calls, the
 * agent's audit sink, client/entity binding, spend ceiling, denials never retried or reported "completed").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { InMemoryAuditSink, AuditWriteError, recordAudit } from "@wfact/audit";
import {
  AgentRegistry,
  HERMES_LITE_SCOPE,
  PERMISSION_POLICY_VERSION,
  PermissionDeniedError,
  PermissionGate,
  SEED_AGENT_DEFINITIONS,
  createSeedRegistry,
  decide,
  defineScope,
  fileClientEntityResolver,
  guardModelClient,
  guardModelPair,
  permissionGateFor,
  runAgent,
  validateScope,
  type Agent,
  type AgentDefinition,
  type AgentScope,
  type Binding,
  type Capability,
} from "../src/index.js";

const TASK_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const noSleep = async () => {};
const A: Binding = { entitySlug: "dreamsign", clientSlug: "dreamsign-pilot" };

// ---------------------------------------------------------------------------------------------
// decide(): default deny
// ---------------------------------------------------------------------------------------------

const EVERY_KIND: Capability[] = [
  { kind: "model", slot: "builder" },
  { kind: "spend", usd: 0 },
  { kind: "tool", name: "memory.readContext" },
  { kind: "db", table: "audit_log", op: "insert", entitySlug: "dreamsign" },
  { kind: "fs", op: "read", path: "clients/dreamsign-pilot/brief.json" },
  { kind: "fs", op: "write", path: "clients/dreamsign-pilot/pages/x.html" },
];

test("default deny: no scope, or an empty scope, denies every capability kind", () => {
  for (const cap of EVERY_KIND) {
    assert.equal(decide(null, A, cap).allowed, false, `null scope must deny ${cap.kind}`);
    assert.equal(decide(defineScope(), A, cap).allowed, false, `empty scope must deny ${cap.kind}`);
  }
  assert.equal(decide(defineScope({ models: ["builder"] }), A, { kind: "network", host: "x" } as unknown as Capability).allowed, false, "an unknown capability kind is denied");
  assert.equal(decide({ ...defineScope({ models: ["builder"] }), version: "0.9.0" }, A, { kind: "model", slot: "builder" }).allowed, false, "a scope for another policy version is denied");
});

test("fs: {client} matches only the bound client; traversal, absolute and odd paths are denied", () => {
  const scope = defineScope({ fsWrite: ["clients/{client}/pages/*", "clients/{client}/sites/**"] });
  const w = (p: string, b: Binding = A) => decide(scope, b, { kind: "fs", op: "write", path: p });
  assert.equal(w("clients/dreamsign-pilot/pages/clean-agency.html").allowed, true);
  assert.equal(w("clients/dreamsign-pilot/sites/track-a/_next/static/a.js").allowed, true, "** spans folders");
  const other = w("clients/summit-line-roofing/pages/x.html");
  assert.equal(other.allowed, false);
  assert.match((other as { reason: string }).reason, /not the client this run is bound to/);
  for (const bad of ["clients/dreamsign-pilot/../summit-line-roofing/pages/x.html", "/etc/passwd", "clients\\dreamsign-pilot\\pages\\x.html", "clients/dreamsign-pilot/pages/.env", "clients/dreamsign-pilot/sites"]) {
    assert.equal(w(bad).allowed, false, `must deny ${bad}`);
  }
  assert.equal(w("clients/dreamsign-pilot/pages/x.html", { entitySlug: "dreamsign", clientSlug: null }).allowed, false, "no bound client: {client} matches nothing");
  assert.equal(decide(scope, A, { kind: "fs", op: "read", path: "clients/dreamsign-pilot/pages/x.html" }).allowed, false, "write grant is not a read grant");
});

test("db: table, operation and the row's entity must all match; null only matches null", () => {
  const scope = defineScope({ db: [{ table: "plan_approvals", ops: ["insert"] }] });
  const d = (cap: Partial<Extract<Capability, { kind: "db" }>>, b: Binding = A) =>
    decide(scope, b, { kind: "db", table: "plan_approvals", op: "insert", entitySlug: "dreamsign", ...cap });
  assert.equal(d({}).allowed, true);
  assert.equal(d({ op: "update" }).allowed, false);
  assert.equal(d({ table: "jobs" }).allowed, false);
  assert.match((d({ entitySlug: "bennett-co" }) as { reason: string }).reason, /entity "bennett-co".*bound to "dreamsign"/);
  assert.equal(d({ entitySlug: null }).allowed, false, "a run for an entity cannot write an unattributed row");
  assert.equal(d({ entitySlug: "dreamsign" }, { entitySlug: null, clientSlug: null }).allowed, false, "an unbound run cannot touch an entity's rows");
});

test("client binding: another entity's client folder is denied; an unknown (new) client is allowed for the bound slug only", () => {
  const scope = defineScope();
  assert.equal(decide(scope, A, { kind: "client", clientSlug: "dreamsign-pilot", ownerEntity: "dreamsign" }).allowed, true);
  assert.equal(decide(scope, A, { kind: "client", clientSlug: "dreamsign-pilot", ownerEntity: null }).allowed, true);
  assert.equal(decide(scope, { entitySlug: "dreamsign", clientSlug: "summit-line-roofing" }, { kind: "client", clientSlug: "summit-line-roofing", ownerEntity: "bennett-co" }).allowed, false);
  assert.equal(decide(scope, A, { kind: "client", clientSlug: "other", ownerEntity: null }).allowed, false);
});

test("spend: allowed only while the run is under its ceiling; a zero ceiling allows nothing", () => {
  const scope = defineScope({ maxCostUsdPerRun: 1 });
  assert.equal(decide(scope, A, { kind: "spend", usd: 0.99 }).allowed, true);
  assert.equal(decide(scope, A, { kind: "spend", usd: 1 }).allowed, false);
  assert.equal(decide(defineScope(), A, { kind: "spend", usd: 0 }).allowed, false);
});

// ---------------------------------------------------------------------------------------------
// validateScope(): structural rules, refused at registration
// ---------------------------------------------------------------------------------------------

test("validateScope refuses malformed scopes and any clients/ pattern that does not name the bound client", () => {
  const bad: [string, unknown][] = [
    ["string list (the old descriptive form)", ["model:builder"]],
    ["other policy version", { ...defineScope(), version: "0.1.0" }],
    ["clients/* reaches every client", defineScope({ fsRead: ["clients/*/brief.json"] })],
    ["repo-wide wildcard", defineScope({ fsRead: ["**"] })],
    ["{client} outside clients/", defineScope({ fsRead: ["memory/{client}.md"] })],
    ["table wildcard", defineScope({ db: [{ table: "*", ops: ["select"] }] })],
    ["empty ops", defineScope({ db: [{ table: "jobs", ops: [] }] })],
    ["cross-entity scope that writes", defineScope({ crossEntity: true, fsWrite: ["memory/context.md"] })],
    ["cross-entity scope with a db insert", defineScope({ crossEntity: true, db: [{ table: "jobs", ops: ["insert"] }] })],
    ["cost over the ceiling", defineScope({ maxCostUsdPerRun: 1000 })],
    ["negative cost", defineScope({ maxCostUsdPerRun: -1 })],
    ["bad tool name", defineScope({ tools: ["rm -rf"] })],
  ];
  for (const [why, scope] of bad) assert.throws(() => validateScope("t", scope as AgentScope), /t:/, why);
  validateScope("hermes-lite", HERMES_LITE_SCOPE); // cross-entity, read-only: allowed
  for (const def of SEED_AGENT_DEFINITIONS) validateScope(def.role, def.permissionScope);
  assert.equal(PERMISSION_POLICY_VERSION, "1.0.0");
});

test("the registry refuses to register a role whose scope is invalid or grants a model slot it does not declare", () => {
  const def: AgentDefinition = { role: "t", description: "t", skillset: [], modelSlots: [], permissionScope: defineScope() };
  const registry = new AgentRegistry();
  assert.throws(() => registry.register({ ...def, permissionScope: ["fs:write:*"] as unknown as AgentScope }), /typed scope/);
  assert.throws(() => registry.register({ ...def, permissionScope: defineScope({ models: ["builder"] }) }), /not in its modelSlots/);
  assert.equal(registry.has("t"), false);
});

// ---------------------------------------------------------------------------------------------
// Each seed role can do exactly its scope
// ---------------------------------------------------------------------------------------------

const PROBES: Capability[] = [
  { kind: "model", slot: "builder" },
  { kind: "model", slot: "evaluator" },
  { kind: "model", slot: "reviewer" },
  { kind: "model", slot: "planner" },
  { kind: "tool", name: "build.trackBIsolated" },
  { kind: "tool", name: "qa.renderedBrowser" },
  { kind: "tool", name: "memory.readClient" },
  { kind: "db", table: "audit_log", op: "insert", entitySlug: "dreamsign" },
  { kind: "db", table: "audit_log", op: "insert", entitySlug: "bennett-co" },
  { kind: "db", table: "plan_approvals", op: "insert", entitySlug: "dreamsign" },
  { kind: "db", table: "jobs", op: "update", entitySlug: "dreamsign" },
  { kind: "fs", op: "write", path: "clients/dreamsign-pilot/pages/clean-agency.html" },
  { kind: "fs", op: "write", path: "clients/dreamsign-pilot/sites/track-a/index.html" },
  { kind: "fs", op: "write", path: "clients/summit-line-roofing/pages/x.html" },
  { kind: "fs", op: "write", path: "clients/dreamsign-pilot/memory.md" },
  { kind: "fs", op: "write", path: "memory/context.md" },
  { kind: "fs", op: "read", path: "clients/dreamsign-pilot/pages/clean-agency.html" },
  { kind: "fs", op: "read", path: "clients/dreamsign-pilot/brief.json" },
  { kind: "fs", op: "read", path: "clients/summit-line-roofing/brief.json" },
  { kind: "fs", op: "read", path: "memory/context.md" },
];

const EXPECTED_ALLOWED: Record<string, string[]> = {
  "front-end-builder": [
    "model:builder",
    "model:evaluator",
    "tool:build.trackBIsolated",
    "fs:write:clients/dreamsign-pilot/pages/clean-agency.html",
    "fs:write:clients/dreamsign-pilot/sites/track-a/index.html",
  ],
  "qa-evaluator": [
    "model:evaluator",
    "model:reviewer",
    "tool:qa.renderedBrowser",
    "db:insert:audit_log(entity=dreamsign)",
    "fs:read:clients/dreamsign-pilot/pages/clean-agency.html",
    "fs:read:clients/dreamsign-pilot/brief.json",
  ],
};

test("each seed role is allowed exactly its scope over a probe set, and nothing else", async () => {
  const { describeCapability } = await import("../src/permissions.js");
  for (const def of SEED_AGENT_DEFINITIONS) {
    const allowed = PROBES.filter((c) => decide(def.permissionScope, A, c).allowed).map(describeCapability);
    assert.deepEqual(allowed, EXPECTED_ALLOWED[def.role], def.role);
  }
});

// ---------------------------------------------------------------------------------------------
// The gate: every denial audited, fail closed
// ---------------------------------------------------------------------------------------------

test("a denial writes agent.deny (role, capability, task id, reason) and throws; an allow writes nothing and is counted", async () => {
  const sink = new InMemoryAuditSink();
  const gate = new PermissionGate({
    role: "front-end-builder",
    scope: SEED_AGENT_DEFINITIONS[0]!.permissionScope,
    binding: A,
    audit: { sink, actor: "agent:front-end-builder", taskId: TASK_ID, runId: TASK_ID, entitySlug: "dreamsign" },
  });
  await gate.authorize({ kind: "model", slot: "builder" });
  assert.equal(sink.events.length, 0);
  await assert.rejects(() => gate.authorize({ kind: "fs", op: "write", path: "clients/summit-line-roofing/pages/x.html" }), PermissionDeniedError);
  assert.equal(sink.events.length, 1);
  const row = sink.events[0]!;
  assert.equal(row.action, "agent.deny");
  assert.equal(row.outcome, "rejected");
  assert.equal(row.taskId, TASK_ID);
  assert.equal(row.payload?.role, "front-end-builder");
  assert.equal(row.payload?.capability, "fs:write:clients/summit-line-roofing/pages/x.html");
  assert.match(String(row.payload?.reason), /not the client this run is bound to/);
  assert.equal(row.payload?.policyVersion, PERMISSION_POLICY_VERSION);
  assert.deepEqual(gate.summary(), { policyVersion: PERMISSION_POLICY_VERSION, allowed: 1, denied: 1, spentUsd: 0, maxCostUsdPerRun: 1 });
});

test("fail closed: if the agent.deny row cannot be written, the audit failure is what surfaces", async () => {
  const gate = new PermissionGate({
    role: "x",
    scope: defineScope(),
    binding: A,
    audit: { sink: { name: "down", write: async () => { throw new AuditWriteError("down", 503); } }, actor: "agent:x" },
  });
  await assert.rejects(() => gate.authorize({ kind: "model", slot: "builder" }), AuditWriteError);
});

test("permissionGateFor: an orchestrator acting for a role gets that role's scope; an unregistered role gets nothing", () => {
  const registry = createSeedRegistry();
  const gate = permissionGateFor(registry, "front-end-builder", { taskId: TASK_ID, runId: null, ...A, audit: null });
  assert.equal(gate.check({ kind: "fs", op: "write", path: "clients/dreamsign-pilot/pages/a.html" }).allowed, true);
  assert.equal(gate.check({ kind: "fs", op: "read", path: "clients/dreamsign-pilot/pages/a.html" }).allowed, false);
  assert.throws(() => permissionGateFor(registry, "intruder", { taskId: null, runId: null, ...A, audit: null }), /not registered/);
});

// ---------------------------------------------------------------------------------------------
// runAgent integration
// ---------------------------------------------------------------------------------------------

const PROBE_DEF: AgentDefinition = {
  role: "probe",
  description: "test agent",
  skillset: [],
  modelSlots: ["intake"],
  permissionScope: defineScope({ models: ["intake"], db: [{ table: "audit_log", ops: ["insert"] }], maxCostUsdPerRun: 0.001 }),
};

function probeRegistry(extra: Partial<AgentDefinition> = {}) {
  const r = createSeedRegistry();
  r.register({ ...PROBE_DEF, ...extra });
  return r;
}

function mockClient(name = "mock") {
  return { name, calls: 0, async complete(_req: { system: string; user: string }) { this.calls += 1; return "ok"; } };
}

function probeAgent(execute: Agent<unknown, string>["execute"], retries = 3): Agent<unknown, string> & { attempts: number } {
  const a = {
    role: "probe",
    attempts: 0,
    retry: { maxAttempts: retries, baseDelayMs: 1 },
    parseInput: (raw: unknown) => raw,
    async execute(input: unknown, ctx: Parameters<Agent<unknown, string>["execute"]>[1]) {
      a.attempts += 1;
      return execute(input, ctx);
    },
  };
  return a;
}

test("guarded model client: an in-scope slot runs; an out-of-scope slot is denied, audited, not retried, and the run escalates", async () => {
  const sink = new InMemoryAuditSink();
  const ok = guardModelClient(mockClient(), "intake");
  const forbidden = guardModelClient(mockClient(), "builder");
  const agent = probeAgent(async () => {
    await ok.complete({ system: "s", user: "u" });
    return forbidden.complete({ system: "s", user: "u" });
  });
  const run = await runAgent(agent, { taskId: TASK_ID, role: "probe", input: {}, entitySlug: "dreamsign" }, { registry: probeRegistry(), audit: { sink }, sleep: noSleep });
  assert.equal(run.status, "escalated");
  assert.match(run.reason ?? "", /permission denied for role "probe": model:builder/);
  assert.equal(agent.attempts, 1, "a denial is final: the agent is not re-executed even with a retry budget of 3");
  const deny = sink.events.filter((e) => e.action === "agent.deny");
  assert.equal(deny.length, 1);
  assert.equal(deny[0]!.taskId, TASK_ID);
  assert.equal(deny[0]!.payload?.capability, "model:builder");
  const done = sink.events.at(-1)!;
  assert.equal(done.action, "agent.escalate");
  assert.deepEqual((done.payload?.permissions as { allowed: number; denied: number }).denied, 1);
});

test("a model call outside any agent run is denied (no scope at all)", async () => {
  const client = guardModelClient(mockClient(), "intake");
  await assert.rejects(() => client.complete({ system: "s", user: "u" }), /outside any agent run/);
  assert.equal(client.calls, 0);
});

test("guardModelPair keeps the builder !== evaluator identity check meaningful", () => {
  const one = mockClient();
  const same = guardModelPair(one, "builder", one, "evaluator");
  assert.equal(same.builder, same.evaluator, "the same instance stays the same, so the loop still refuses it");
  const two = guardModelPair(mockClient(), "builder", mockClient(), "evaluator");
  assert.notEqual(two.builder, two.evaluator);
  assert.throws(() => guardModelClient(two.builder, "evaluator"), /already guarded/);
});

test("a swallowed denial still fails the run: output discarded, never 'completed'", async () => {
  const forbidden = guardModelClient(mockClient(), "planner");
  const agent = probeAgent(async () => {
    try {
      await forbidden.complete({ system: "s", user: "u" });
    } catch {
      // a careless (or compromised) agent pretends nothing happened
    }
    return "looks fine";
  });
  const run = await runAgent(agent, { taskId: TASK_ID, role: "probe", input: {} }, { registry: probeRegistry(), sleep: noSleep });
  assert.equal(run.status, "escalated");
  assert.equal(run.output, null);
  assert.match(run.reason ?? "", /continued after the denial/);
});

test("spend ceiling: a metered client is refused once the run has spent its ceiling", async () => {
  const sink = new InMemoryAuditSink();
  // Shape of the real Claude client: name "claude", modelIdUsed, cumulative totalUsage. 1000 output tokens of
  // claude-haiku-4-5 = $0.005 at the price table, over the probe's $0.001 ceiling.
  const raw = {
    name: "claude",
    modelIdUsed: "claude-haiku-4-5",
    totalUsage: { inputTokens: 0, outputTokens: 0 },
    calls: 0,
    async complete() {
      this.calls += 1;
      this.totalUsage.outputTokens += 1000;
      return "ok";
    },
  };
  const client = guardModelClient(raw, "intake");
  const agent = probeAgent(async () => {
    await client.complete();
    return (await client.complete()) as string;
  }, 1);
  const run = await runAgent(agent, { taskId: TASK_ID, role: "probe", input: {} }, { registry: probeRegistry(), audit: { sink }, sleep: noSleep });
  assert.equal(raw.calls, 1, "the second call never reached the model");
  assert.equal(run.status, "escalated");
  assert.match(run.reason ?? "", /spend:\$0\.0050.*ceiling of \$0\.001/);
  assert.ok(sink.events.some((e) => e.action === "agent.deny" && String(e.payload?.capability).startsWith("spend:")));
});

test("entity isolation: a task naming a client folder owned by another entity is rejected before spawn and audited", async () => {
  const sink = new InMemoryAuditSink();
  const agent = probeAgent(async () => "should never run");
  // Real repo data: clients/summit-line-roofing/brief.json says entitySlug "bennett-co".
  const run = await runAgent(
    agent,
    { taskId: TASK_ID, role: "probe", input: {}, entitySlug: "dreamsign", clientSlug: "summit-line-roofing" },
    { registry: probeRegistry(), audit: { sink } },
  );
  assert.equal(run.status, "rejected");
  assert.equal(agent.attempts, 0);
  assert.match(run.reason ?? "", /belongs to entity "bennett-co"/);
  assert.deepEqual(sink.events.map((e) => e.action), ["agent.deny", "agent.reject"]);
  assert.equal(sink.events[0]!.payload?.capability, "client:summit-line-roofing(owner=bennett-co)");
});

test("fileClientEntityResolver reads clients/<slug>/brief.json and returns null for unknown or malformed slugs", () => {
  const root = mkdtempSync(path.join(tmpdir(), "wfact-perm-"));
  mkdirSync(path.join(root, "clients", "acme"), { recursive: true });
  writeFileSync(path.join(root, "clients", "acme", "brief.json"), JSON.stringify({ entitySlug: "bennett-co" }));
  const resolve = fileClientEntityResolver(root);
  assert.equal(resolve("acme"), "bennett-co");
  assert.equal(resolve("nobody"), null);
  assert.equal(resolve("../acme"), null);
  assert.equal(fileClientEntityResolver()("dreamsign-pilot"), "dreamsign", "the real repo's client folders resolve");
});

test("the agent's own audit sink is gated: rows for its own entity pass, a row attributed to another entity is denied", async () => {
  const sink = new InMemoryAuditSink();
  const agent = probeAgent(async (_i, ctx) => {
    await recordAudit(ctx.audit!, { action: "probe.note", outcome: "info" });
    await recordAudit(ctx.audit!, { action: "probe.forge", outcome: "info", entitySlug: "bennett-co" });
    return "x";
  });
  const run = await runAgent(agent, { taskId: TASK_ID, role: "probe", input: {}, entitySlug: "dreamsign" }, { registry: probeRegistry(), audit: { sink }, sleep: noSleep });
  assert.equal(run.status, "escalated");
  const actions = sink.events.map((e) => e.action);
  assert.ok(actions.includes("probe.note"));
  assert.ok(!actions.includes("probe.forge"), "the forged row was never written");
  assert.ok(actions.includes("agent.deny"));
});

test("a role without audit_log insert cannot write audit rows of its own", async () => {
  const sink = new InMemoryAuditSink();
  const agent = probeAgent(async (_i, ctx) => {
    await recordAudit(ctx.audit!, { action: "probe.note", outcome: "info" });
    return "x";
  });
  const registry = probeRegistry({ permissionScope: defineScope({ models: ["intake"], maxCostUsdPerRun: 0.01 }) });
  const run = await runAgent(agent, { taskId: TASK_ID, role: "probe", input: {} }, { registry, audit: { sink }, sleep: noSleep });
  assert.equal(run.status, "escalated");
  assert.ok(!sink.events.some((e) => e.action === "probe.note"));
});

test("every completed run records its permission summary (allows are counted, the policy version is on the row)", async () => {
  const sink = new InMemoryAuditSink();
  const ok = guardModelClient(mockClient(), "intake");
  const agent = probeAgent(async () => ok.complete({ system: "s", user: "u" }));
  const run = await runAgent(agent, { taskId: TASK_ID, role: "probe", input: {}, entitySlug: "dreamsign", clientSlug: "dreamsign-pilot" }, { registry: probeRegistry(), audit: { sink } });
  assert.equal(run.status, "completed");
  const complete = sink.events.at(-1)!;
  assert.deepEqual(complete.payload?.permissions, { policyVersion: PERMISSION_POLICY_VERSION, allowed: 3, denied: 0, spentUsd: 0, maxCostUsdPerRun: 0.001 });
  assert.deepEqual(sink.events.find((e) => e.action === "agent.spawn")!.payload?.binding, { entitySlug: "dreamsign", clientSlug: "dreamsign-pilot" });
});

test("a malformed clientSlug is rejected before anything runs", async () => {
  const run = await runAgent(probeAgent(async () => "x"), { taskId: TASK_ID, role: "probe", input: {}, clientSlug: "../etc" }, { registry: probeRegistry() });
  assert.equal(run.status, "rejected");
  assert.match(run.reason ?? "", /clientSlug/);
});
