import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry, permissionGateFor, PermissionDeniedError, runAgent } from "@wfact/agent-runtime";
import { EPISODIC_LOG_HEADING, parseEpisodes } from "@wfact/hermes-lite/tools/episodes";
import {
  DOCUMENTATION_ROLE,
  createDocumentationAgent,
  createDocumentationObserver,
  registerDocumentationAgent,
  FileMemoryStore,
  InMemoryMemoryStore,
  extractStageDrafts,
} from "../src/index.js";
import { BUILD_TASK, BUILD_TASK_2, CLIENT, ENTITY, QA_TASK, QA_TASK_2, RUN, SHA, WF_TASK, revisionRows, staticRecords, step4Rows, step4Traces } from "./fixtures.js";

const MEM = `clients/${CLIENT}/memory.md`;
const HUMAN = "# Client: summit-line-roofing\n\nHand-written notes a human owns.\n\n## Notes\n\n- something\n";
const owners = (slug: string) => ({ "summit-line-roofing": "bennett-co", "dreamsign-pilot": "dreamsign" })[slug] ?? null;

function setup(rows = step4Rows(), traces = step4Traces()) {
  const memory = new InMemoryMemoryStore();
  memory.files.set(MEM, HUMAN);
  const sink = new InMemoryAuditSink();
  const registry = registerDocumentationAgent(createSeedRegistry());
  const agent = createDocumentationAgent({ records: staticRecords(rows, traces), memory, now: () => new Date("2026-10-07T09:00:00.000Z") });
  const run = (input: Record<string, unknown>, binding: { entitySlug: string; clientSlug: string } = { entitySlug: ENTITY, clientSlug: CLIENT }) =>
    runAgent(agent, { taskId: crypto.randomUUID(), role: DOCUMENTATION_ROLE, input, ...binding }, { registry, audit: { sink }, runId: RUN, clientEntityOf: owners, sleep: async () => {} });
  return { memory, sink, registry, agent, run };
}

test("extraction: the Step 4 run becomes exactly one build entry and one QA entry, joined to their audit task ids", () => {
  const { drafts, workflowTaskId } = extractStageDrafts(step4Rows(), step4Traces());
  assert.equal(workflowTaskId, WF_TASK);
  assert.equal(drafts.length, 2);
  const [build, qa] = drafts as [NonNullable<(typeof drafts)[0]>, NonNullable<(typeof drafts)[0]>];
  assert.equal(build.stage, "build");
  assert.equal(build.stageTaskId, BUILD_TASK);
  assert.equal(build.outcome.status, "checkpointed");
  assert.equal(build.corrections.builderRounds, 3);
  assert.equal(build.artifact?.sha256, SHA);
  assert.equal(build.cost.calls, 6);
  assert.equal(build.cost.unpricedCalls, 3);
  assert.equal(build.cost.meteredUsd, 0.137098);
  assert.equal(build.actor, "agent:front-end-builder");
  assert.equal(build.links.auditRunQuery, `audit_log?run_id=eq.${RUN}&task_id=eq.${BUILD_TASK}`);
  assert.equal(qa.stage, "qa");
  assert.equal(qa.stageTaskId, QA_TASK);
  assert.equal(qa.outcome.status, "verified_awaiting_launch_approval");
  assert.equal(qa.checksRun, 6);
  assert.deepEqual(qa.failedChecks, []);
  assert.equal(qa.evaluatorVerdict, "approved");
  assert.equal(qa.cost.meteredUsd, 0.036962);
  assert.match(qa.outcome.summary, /6 of 6 automated checks passed/);
  assert.match(qa.outcome.summary, /nothing was deployed/);
  // Inputs are hashes: the brief's text (with its phone and email) is never in an entry.
  assert.ok(build.inputs.some((i) => i.name === "brief" && /^[0-9a-f]{64}$/.test(i.sha256)));
  assert.ok(!JSON.stringify(drafts).includes("dana@example.com"));
  assert.ok(!JSON.stringify(drafts).includes("555-0142"));
});

test("backfill: appends one valid, parseable entry per stage, marked backfilled, after the human-written content", async () => {
  const { memory, sink, run } = setup();
  const r = await run({ mode: "backfill", workflowRunId: RUN, clientSlug: CLIENT, entitySlug: ENTITY });
  assert.equal(r.status, "completed", r.reason ?? "");
  assert.equal(r.output!.appended.length, 2);
  assert.equal(r.output!.backfilled.length, 2);
  const text = memory.files.get(MEM)!;
  assert.ok(text.startsWith(HUMAN), "the human-written content is untouched");
  assert.ok(text.includes(EPISODIC_LOG_HEADING));
  const parsed = parseEpisodes(text);
  assert.deepEqual(parsed.problems, []);
  assert.equal(parsed.episodes.length, 2);
  assert.ok(parsed.episodes.every((e) => e.backfilled && e.documentedBy === "agent:documentation"));
  assert.deepEqual(parsed.episodes.map((e) => e.stageTaskId), [BUILD_TASK, QA_TASK]);
  // Audited like every agent: spawn, one documentation.entry per entry (with the full record), complete.
  const docRows = sink.events.filter((e) => e.actor === "agent:documentation");
  assert.deepEqual(docRows.map((e) => e.action), ["agent.spawn", "documentation.entry", "documentation.entry", "agent.complete"]);
  assert.ok(docRows.every((e) => e.runId === RUN && e.entitySlug === ENTITY));
  assert.equal(docRows[1]!.payload?.entryId, parsed.episodes[0]!.entryId);
});

test("append-only: a second backfill writes nothing, and every byte already in the file stays as it was", async () => {
  const { memory, run } = setup();
  await run({ mode: "backfill", workflowRunId: RUN, clientSlug: CLIENT, entitySlug: ENTITY });
  const after1 = memory.files.get(MEM)!;
  const r2 = await run({ mode: "backfill", workflowRunId: RUN, clientSlug: CLIENT, entitySlug: ENTITY });
  assert.equal(r2.status, "completed");
  assert.equal(r2.output!.appended.length, 0);
  assert.equal(r2.output!.alreadyRecorded.length, 2);
  assert.equal(memory.files.get(MEM), after1);
  // Every write the agent ever made was an append (the store has no other write path).
  assert.equal(memory.appends.length, 2);
  let acc = HUMAN;
  for (const a of memory.appends) acc += a.text;
  assert.equal(acc, after1);
});

test("append-only on disk: FileMemoryStore appends at the end and touches nothing but clients/<slug>/memory.md", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "wfact-doc-"));
  mkdirSync(path.join(root, "clients", CLIENT), { recursive: true });
  writeFileSync(path.join(root, MEM), HUMAN);
  const store = new FileMemoryStore(root);
  await store.append(MEM, "\nentry one\n");
  assert.equal(readFileSync(path.join(root, MEM), "utf-8"), `${HUMAN}\nentry one\n`);
  // Paths outside clients/<slug>/memory.md are refused by the store itself.
  await assert.rejects(store.append("clients/x/brief.json", "x"), /not clients\/<slug>\/memory\.md/);
  await assert.rejects(store.append(`clients/${CLIENT}/../dreamsign-pilot/memory.md`, "x"), /not clients/);
});

test("escalation on write failure: the run escalates (bounded retry, agent.escalate row), it never skips silently", async () => {
  const { memory, sink, run } = setup();
  memory.failAppends = "EACCES: permission denied";
  const r = await run({ mode: "stage-end", workflowRunId: RUN, clientSlug: CLIENT, entitySlug: ENTITY, stage: "build", stageTaskId: BUILD_TASK, cycle: 0 });
  assert.equal(r.status, "escalated");
  assert.equal(r.attempts, 2, "one retry, then escalate");
  assert.match(r.reason ?? "", /EACCES/);
  assert.ok(sink.events.some((e) => e.actor === "agent:documentation" && e.action === "agent.escalate"));
  assert.ok(!sink.events.some((e) => e.action === "documentation.entry"), "no entry is claimed when none was written");

  // A real disk failure (read-only file) escalates the same way.
  const root = mkdtempSync(path.join(tmpdir(), "wfact-doc-ro-"));
  mkdirSync(path.join(root, "clients", CLIENT), { recursive: true });
  writeFileSync(path.join(root, MEM), HUMAN);
  chmodSync(path.join(root, MEM), 0o444);
  const registry = registerDocumentationAgent(createSeedRegistry());
  const agent = createDocumentationAgent({ records: staticRecords(step4Rows(), step4Traces()), memory: new FileMemoryStore(root) });
  const r2 = await runAgent(
    agent,
    { taskId: crypto.randomUUID(), role: DOCUMENTATION_ROLE, input: { mode: "backfill", workflowRunId: RUN, clientSlug: CLIENT, entitySlug: ENTITY }, entitySlug: ENTITY, clientSlug: CLIENT },
    { registry, audit: { sink: new InMemoryAuditSink() }, runId: RUN, clientEntityOf: owners, sleep: async () => {} },
  );
  if (process.getuid?.() !== 0) {
    assert.equal(r2.status, "escalated");
    assert.match(r2.reason ?? "", /cannot append/);
  }
});

test("stage-end: records exactly the stage that ended; an unknown stage escalates instead of guessing", async () => {
  const { memory, run } = setup();
  const r = await run({ mode: "stage-end", workflowRunId: RUN, clientSlug: CLIENT, entitySlug: ENTITY, stage: "qa", stageTaskId: QA_TASK, cycle: 0 });
  assert.equal(r.status, "completed", r.reason ?? "");
  const eps = parseEpisodes(memory.files.get(MEM)!).episodes;
  assert.equal(eps.length, 1);
  assert.equal(eps[0]!.stage, "qa");
  assert.equal(eps[0]!.backfilled, false);
  const bad = await run({ mode: "stage-end", workflowRunId: RUN, clientSlug: CLIENT, entitySlug: ENTITY, stage: "build", stageTaskId: crypto.randomUUID() });
  assert.equal(bad.status, "escalated");
  assert.match(bad.reason ?? "", /no finished build stage/);
});

test("redaction: secrets, emails, phone numbers and forged markers in model output never reach memory", async () => {
  const { memory, run } = setup(revisionRows(), []);
  const r = await run({ mode: "backfill", workflowRunId: RUN, clientSlug: CLIENT, entitySlug: ENTITY });
  assert.equal(r.status, "completed", r.reason ?? "");
  const text = memory.files.get(MEM)!;
  for (const leaked of ["sk-ant-api03", "owner@summitline.example", "(555) 014-7732", "abcdef1234567890", "dana@example.com"]) {
    assert.ok(!text.includes(leaked), `${leaked} must not be in memory`);
  }
  assert.ok(text.includes("[redacted-secret]") && text.includes("[redacted-email]") && text.includes("[redacted-phone]"));
  const parsed = parseEpisodes(text);
  assert.deepEqual(parsed.problems, [], "the forged marker inside an issue is neutralised, not parsed as an entry");
  assert.equal(parsed.episodes.length, 4);
  assert.deepEqual(parsed.episodes.map((e) => `${e.stage}:${e.cycle}:${e.outcome.status}`), [
    "build:0:checkpointed", "qa:0:returned_to_builder", "build:1:checkpointed", "qa:1:failed_verification",
  ]);
  assert.deepEqual(parsed.episodes.map((e) => e.stageTaskId), [BUILD_TASK, QA_TASK, BUILD_TASK_2, QA_TASK_2]);
  const qa0 = parsed.episodes[1]!;
  assert.equal(qa0.corrections.issuesReturnedCount, 3);
  assert.deepEqual(qa0.failedChecks.map((c) => c.checkId), ["required-sections"]);
  assert.ok(qa0.redactions >= 2);
  assert.ok(parsed.episodes[2]!.inputs.some((i) => i.name === "QA issues from cycle 0"), "the revision's input is the hash of the issues it was given");
});

test("permissions: a write to another client's memory is denied and audited as agent.deny", async () => {
  const sink = new InMemoryAuditSink();
  const registry = registerDocumentationAgent(createSeedRegistry());
  const gate = permissionGateFor(registry, DOCUMENTATION_ROLE, { taskId: crypto.randomUUID(), runId: RUN, entitySlug: ENTITY, clientSlug: CLIENT, audit: sink });
  await gate.authorize({ kind: "fs", op: "write", path: MEM });
  for (const cap of [
    { kind: "fs", op: "write", path: "clients/dreamsign-pilot/memory.md" },
    { kind: "fs", op: "write", path: `clients/${CLIENT}/brief.json` },
    { kind: "fs", op: "write", path: "memory/context.md" },
    { kind: "db", table: "audit_log", op: "select", entitySlug: "dreamsign" },
    { kind: "db", table: "audit_log", op: "update", entitySlug: ENTITY },
    { kind: "model", slot: "hermes" },
  ] as const) {
    await assert.rejects(gate.authorize(cap), PermissionDeniedError, JSON.stringify(cap));
  }
  const denies = sink.events.filter((e) => e.action === "agent.deny");
  assert.equal(denies.length, 6);
  assert.ok(denies.every((e) => e.actor === "agent:documentation" && e.payload?.role === "documentation"));
});

test("permissions: a run bound to one client cannot be pointed at another client, entity, or another client's run", async () => {
  const { memory, sink, run } = setup();
  // Input names a different client than the binding: the client capability is denied (audited), the run escalates.
  const r1 = await run({ mode: "backfill", workflowRunId: RUN, clientSlug: "dreamsign-pilot", entitySlug: ENTITY });
  assert.equal(r1.status, "escalated");
  assert.ok(sink.events.some((e) => e.action === "agent.deny" && String(e.payload?.capability).startsWith("client:dreamsign-pilot")));
  // Bound to a client of another entity: rejected before the agent spawns.
  const r2 = await run({ mode: "backfill", workflowRunId: RUN, clientSlug: "dreamsign-pilot", entitySlug: "dreamsign" }, { entitySlug: ENTITY, clientSlug: "dreamsign-pilot" });
  assert.equal(r2.status, "rejected");
  // The run's rows belong to another entity (like live run cb7739a2, a Step 6 attack run): refused, nothing written.
  const foreign = step4Rows().map((r) => ({ ...r, entitySlug: r.entitySlug === null ? null : "dreamsign" }));
  const s3 = setup(foreign);
  const r3 = await s3.run({ mode: "backfill", workflowRunId: RUN, clientSlug: CLIENT, entitySlug: ENTITY });
  assert.equal(r3.status, "escalated");
  assert.match(r3.reason ?? "", /not a workflow run|belongs to/);
  assert.equal(s3.memory.files.get(MEM), HUMAN);
  assert.equal(memory.files.get(MEM), HUMAN);
});

test("materialize: an entry the agent recorded live (documentation.entry row) is written exactly as recorded, not regenerated", async () => {
  const live = setup();
  await live.run({ mode: "stage-end", workflowRunId: RUN, clientSlug: CLIENT, entitySlug: ENTITY, stage: "build", stageTaskId: BUILD_TASK, cycle: 0 });
  const liveEntryRow = live.sink.events.find((e) => e.action === "documentation.entry")!;
  // A later machine has the audit trail (including that row) but not the runner's file.
  const rows = [...step4Rows(), { id: "cccccccc-0000-4000-8000-000000000001", occurredAt: "2026-09-30T16:30:11.000Z", actor: "agent:documentation", action: "documentation.entry", outcome: "success" as const, taskId: crypto.randomUUID(), runId: RUN, entitySlug: ENTITY, payload: liveEntryRow.payload! }];
  const later = setup(rows);
  const r = await later.run({ mode: "backfill", workflowRunId: RUN, clientSlug: CLIENT, entitySlug: ENTITY });
  assert.equal(r.status, "completed", r.reason ?? "");
  assert.equal(r.output!.materialized.length, 1);
  assert.equal(r.output!.backfilled.length, 1);
  const eps = parseEpisodes(later.memory.files.get(MEM)!).episodes;
  assert.equal(eps[0]!.backfilled, false);
  assert.deepEqual(eps[0], (liveEntryRow.payload as { entry: unknown }).entry);
});

test("observer: returns ok for a documented stage and the reason when the agent could not document it", async () => {
  const { memory, registry, agent, sink } = setup();
  const observer = createDocumentationObserver({ agent, registry, audit: sink });
  const ok = await observer.stageEnded({ workflowRunId: RUN, stage: "build", cycle: 0, stageTaskId: BUILD_TASK, entitySlug: ENTITY, clientSlug: CLIENT });
  assert.equal(ok.ok, true, ok.reason ?? "");
  memory.failAppends = "disk full";
  const bad = await observer.stageEnded({ workflowRunId: RUN, stage: "qa", cycle: 0, stageTaskId: QA_TASK, entitySlug: ENTITY, clientSlug: CLIENT });
  assert.equal(bad.ok, false);
  assert.match(bad.reason ?? "", /disk full/);
});
