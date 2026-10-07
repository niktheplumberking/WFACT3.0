import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink, AuditWriteError, type AuditEvent, type AuditSink } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent } from "@wfact/frontend-loop/agent";
import { MockModelClient as BuilderMock } from "@wfact/frontend-loop/modelClient";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { MockModelClient as EvaluatorMock } from "@wfact/verification/modelClient";
import {
  buildAndVerify,
  resumeBuildAndVerify,
  runProgress,
  runIdOfError,
  MemoryArtifactStore,
  type WorkflowDeps,
} from "../src/buildAndVerify.js";

const FIXTURES = path.join(import.meta.dirname, "..", "..", "verification", "test", "fixtures");
// The plan's own pattern: broken.html is the deliberately broken stage-1 output.
const BROKEN = readFileSync(path.join(FIXTURES, "broken.html"), "utf-8");
// clean.html plus the clean-agency template's other two sections, so required-sections can pass.
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

/** Builder whose first page and revised page are scripted; its own reviewer always approves. */
function setup(opts: {
  firstPage: string;
  revisedPage?: string;
  sink?: AuditSink & { listByRun: InMemoryAuditSink["listByRun"] };
  store?: MemoryArtifactStore;
  maxQaRevisions?: number;
  qaVerdict?: string;
}) {
  const builder = new BuilderMock((req) => (req.user.includes("Issues to fix") ? opts.revisedPage ?? opts.firstPage : opts.firstPage));
  const qaModel = new EvaluatorMock(() => opts.qaVerdict ?? "VERDICT: APPROVED");
  const sink = opts.sink ?? new InMemoryAuditSink();
  const store = opts.store ?? new MemoryArtifactStore();
  const deps: WorkflowDeps = {
    frontEndAgent: createFrontendBuilderAgent({ builderModel: builder, evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: qaModel }),
    registry: createSeedRegistry(),
    audit: sink,
    reader: sink,
    artifacts: store,
    knownClientSlugs: ["dreamsign-pilot", "bennett-co"],
    maxQaRevisions: opts.maxQaRevisions,
  };
  return { deps, builder, qaModel, sink, store };
}

const actions = (events: AuditEvent[], runId: string) =>
  events.filter((e) => e.runId === runId && e.actor === "workflow:build-and-verify").map((e) => e.action);

test("clean build: build → checkpoint → QA → verified checkpoint → launch gate; never deploys", async () => {
  const { deps, sink } = setup({ firstPage: CLEAN });
  const result = await buildAndVerify(brief, deps);

  assert.equal(result.status, "awaiting_launch_approval");
  assert.equal(result.cycles, 1);
  assert.equal(result.lastCheckpoint?.stage, "verified");
  assert.deepEqual(actions((sink as InMemoryAuditSink).events, result.workflowRunId), [
    "workflow.start",
    "workflow.checkpoint",
    "workflow.checkpoint",
    "workflow.gate",
  ]);
  const gate = (sink as InMemoryAuditSink).events.find((e) => e.action === "workflow.gate")!;
  assert.equal(gate.payload?.tier, "hard-gate");
  // Every row of the run — workflow + both agents — shares the run id.
  const runRows = (sink as InMemoryAuditSink).events.filter((e) => e.runId === result.workflowRunId);
  assert.ok(runRows.some((e) => e.actor === "agent:front-end-builder"));
  assert.ok(runRows.some((e) => e.action === "verification.decision"));
});

test("deliberately broken stage-1 output is caught BEFORE any verified checkpoint or gate, and the builder gets the specific failed checks", async () => {
  const { deps, sink, builder, qaModel } = setup({ firstPage: BROKEN, maxQaRevisions: 1 });
  const result = await buildAndVerify(brief, deps);

  assert.equal(result.status, "failed_verification");
  assert.equal(result.cycles, 2, "1 original build + 1 bounded revision, then stop");
  const acts = actions((sink as InMemoryAuditSink).events, result.workflowRunId);
  assert.ok(!acts.includes("workflow.gate"), "stage two (the launch gate) never ran");
  assert.ok(
    !(sink as InMemoryAuditSink).events.some((e) => e.action === "workflow.checkpoint" && e.payload?.stage === "verified"),
    "nothing was ever checkpointed as verified",
  );
  assert.equal(acts.at(-1), "workflow.halt");

  // The failure is specific: named check ids, not "failed".
  const failedIds = result.qaFailure!.failedChecks.map((c) => c.checkId);
  assert.ok(failedIds.length > 0);
  // ...and those exact check ids were handed back to the builder in its revision prompt.
  const revisionPrompt = builder.calls.find((c) => c.user.includes("Issues to fix"))!.user;
  for (const id of failedIds) assert.ok(revisionPrompt.includes(`[${id}]`), `builder was told about ${id}`);
  assert.equal(qaModel.calls.length, 0, "the evaluator model is never paid for on a build the checks already caught");
});

test("broken first, fixed on revision → verified in 2 cycles", async () => {
  const { deps } = setup({ firstPage: BROKEN, revisedPage: CLEAN });
  const result = await buildAndVerify(brief, deps);
  assert.equal(result.status, "awaiting_launch_approval");
  assert.equal(result.cycles, 2);
  assert.equal(result.lastCheckpoint?.cycle, 1);
});

test("crash between stages → resume from the durable checkpoint without re-running the build", async () => {
  const store = new InMemoryAuditSink();
  let crash = true;
  const crashingSink = {
    name: "crashing",
    listByRun: store.listByRun.bind(store),
    write: async (e: AuditEvent) => {
      if (crash && e.actor === "agent:qa-evaluator" && e.action === "agent.spawn") {
        throw new AuditWriteError("simulated crash right after the build checkpoint", null);
      }
      return store.write(e);
    },
  };
  const artifacts = new MemoryArtifactStore();
  const first = setup({ firstPage: CLEAN, sink: crashingSink, store: artifacts });
  await assert.rejects(() => buildAndVerify(brief, first.deps), AuditWriteError);
  const runId = store.events.find((e) => e.action === "workflow.start")!.runId!;
  assert.ok(store.events.some((e) => e.action === "workflow.checkpoint" && e.payload?.stage === "build"));
  assert.equal(first.builder.calls.length, 1);

  crash = false;
  const second = setup({ firstPage: CLEAN, sink: crashingSink, store: artifacts });
  const resumed = await resumeBuildAndVerify(runId, second.deps);
  assert.equal(resumed.status, "awaiting_launch_approval");
  assert.equal(resumed.workflowRunId, runId);
  assert.equal(second.builder.calls.length, 0, "resume went straight to QA from the checkpoint");
});

test("an artifact changed after its checkpoint is refused on resume, not verified", async () => {
  const store = new InMemoryAuditSink();
  let crash = true;
  const sink = {
    name: "s",
    listByRun: store.listByRun.bind(store),
    write: async (e: AuditEvent) => {
      if (crash && e.actor === "agent:qa-evaluator") throw new AuditWriteError("crash", null);
      return store.write(e);
    },
  };
  const artifacts = new MemoryArtifactStore();
  await assert.rejects(() => buildAndVerify(brief, setup({ firstPage: CLEAN, sink, store: artifacts }).deps));
  const runId = store.events.find((e) => e.action === "workflow.start")!.runId!;

  artifacts.files.set("clients/dreamsign-pilot/pages/clean-agency.html", CLEAN + "<!-- edited after checkpoint -->");
  crash = false;
  const again = setup({ firstPage: CLEAN, sink, store: artifacts });
  const resumed = await resumeBuildAndVerify(runId, again.deps);
  assert.equal(resumed.status, "checkpoint_corrupt");
  assert.equal(again.qaModel.calls.length, 0);
});

test("resuming a run that already ended does nothing", async () => {
  const { deps } = setup({ firstPage: CLEAN });
  const done = await buildAndVerify(brief, deps);
  const again = await resumeBuildAndVerify(done.workflowRunId, deps);
  assert.equal(again.status, "already_finished");
});

test("a malformed brief is refused before any row is written", async () => {
  const { deps, sink } = setup({ firstPage: CLEAN });
  await assert.rejects(() => buildAndVerify({ goal: "x" }, deps));
  assert.equal((sink as InMemoryAuditSink).events.length, 0);
});

// ---- Step 4D: a person can reopen a halted run and continue from what was saved ----

test("reopen: a run halted at its revision cap continues from its saved site with a fresh revision budget", async () => {
  const store = new MemoryArtifactStore();
  const sink = new InMemoryAuditSink();
  const first = setup({ firstPage: BROKEN, maxQaRevisions: 1, sink, store });
  const halted = await buildAndVerify(brief, first.deps);
  assert.equal(halted.status, "failed_verification");
  assert.equal(runProgress(await sink.listByRun(halted.workflowRunId)).state, "halted");

  // Without a person's request nothing is reopened.
  const refused = await resumeBuildAndVerify(halted.workflowRunId, setup({ firstPage: CLEAN, sink, store }).deps);
  assert.equal(refused.status, "already_finished");

  // The builder is fixed (now answers with a clean page); a person presses "fix and continue".
  const second = setup({ firstPage: CLEAN, maxQaRevisions: 1, sink, store });
  const resumed = await resumeBuildAndVerify(halted.workflowRunId, second.deps, { reopen: { reason: "fix and continue", by: "user-1" } });
  assert.equal(resumed.status, "awaiting_launch_approval", "a halted-at-cap run no longer halts again on its first failed check");
  assert.equal(resumed.workflowRunId, halted.workflowRunId);
  assert.ok(second.builder.calls.length >= 1, "the builder fixed the saved site's issues");
  const acts = actions(sink.events, halted.workflowRunId);
  assert.ok(acts.includes("workflow.reopen"));
  const reopen = sink.events.find((e) => e.action === "workflow.reopen")!;
  assert.equal(reopen.payload?.by, "user-1");
  assert.equal(reopen.payload?.fromStatus, "failed_verification");
});

test("reopen: a run that reached the launch gate, or whose saved site changed, is never reopened (and nothing is written)", async () => {
  const sink = new InMemoryAuditSink();
  const store = new MemoryArtifactStore();
  const done = await buildAndVerify(brief, setup({ firstPage: CLEAN, sink, store }).deps);
  const gated = await resumeBuildAndVerify(done.workflowRunId, setup({ firstPage: CLEAN, sink, store }).deps, { reopen: { reason: "x", by: "u" } });
  assert.equal(gated.status, "already_finished");
  assert.ok(!sink.events.some((e) => e.action === "workflow.reopen"));

  // checkpoint_corrupt: run halts because the artifact changed after its checkpoint
  const sink2 = new InMemoryAuditSink();
  const store2 = new MemoryArtifactStore();
  let crash = true;
  const crashing = { name: "c", listByRun: sink2.listByRun.bind(sink2), write: async (e: AuditEvent) => { if (crash && e.actor === "agent:qa-evaluator") throw new AuditWriteError("crash", null); return sink2.write(e); } };
  await assert.rejects(() => buildAndVerify(brief, setup({ firstPage: CLEAN, sink: crashing, store: store2 }).deps));
  const runId = sink2.events.find((e) => e.action === "workflow.start")!.runId!;
  store2.files.set("clients/dreamsign-pilot/pages/clean-agency.html", CLEAN + "<!-- edited -->");
  crash = false;
  const corrupt = await resumeBuildAndVerify(runId, setup({ firstPage: CLEAN, sink: crashing, store: store2 }).deps);
  assert.equal(corrupt.status, "checkpoint_corrupt");
  const again = await resumeBuildAndVerify(runId, setup({ firstPage: CLEAN, sink: crashing, store: store2 }).deps, { reopen: { reason: "x", by: "u" } });
  assert.equal(again.status, "checkpoint_corrupt");
  assert.match(again.reason ?? "", /fresh build is needed/);
  assert.ok(!sink2.events.some((e) => e.action === "workflow.reopen"), "a run that cannot continue is not reopened");
});

test("reopen: a run that stopped before anything was saved builds again under the same run id, with the facts the owner added", async () => {
  const sink = new InMemoryAuditSink();
  const store = new MemoryArtifactStore();
  // The builder produces nothing usable the first time (no page).
  const bad = setup({ firstPage: "", sink, store });
  const halted = await buildAndVerify(brief, bad.deps);
  assert.equal(halted.status, "build_failed");
  assert.equal(halted.lastCheckpoint, null);
  assert.equal(runProgress(await sink.listByRun(halted.workflowRunId)).saved, "none");

  const withFacts = { ...brief, ownerFacts: [{ key: "phone", label: "Business phone", value: "0400 111 222" }] };
  const good = setup({ firstPage: CLEAN, sink, store });
  const resumed = await resumeBuildAndVerify(halted.workflowRunId, good.deps, { reopen: { reason: "details added", by: "u", brief: withFacts } });
  assert.equal(resumed.status, "awaiting_launch_approval");
  assert.equal(resumed.workflowRunId, halted.workflowRunId);
  assert.match(good.builder.calls[0]!.user, /Business phone: 0400 111 222/, "the owner's fact reached the builder");
  assert.deepEqual(actions(sink.events, halted.workflowRunId).filter((a) => a === "workflow.start").length, 1, "same run, not a second start");
});

test("an exception inside a started run carries its run id (so the Cockpit can offer to continue it)", async () => {
  const store = new InMemoryAuditSink();
  const crashing = { name: "c", listByRun: store.listByRun.bind(store), write: async (e: AuditEvent) => { if (e.actor === "agent:qa-evaluator") throw new AuditWriteError("down", null); return store.write(e); } };
  let caught: unknown;
  try {
    await buildAndVerify(brief, setup({ firstPage: CLEAN, sink: crashing }).deps);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof AuditWriteError, "the original error type is kept");
  assert.equal(runIdOfError(caught), store.events.find((e) => e.action === "workflow.start")!.runId);
});

test("runProgress reads what is saved, how often it was reopened, and how it ended", async () => {
  const sink = new InMemoryAuditSink();
  const r = await buildAndVerify(brief, setup({ firstPage: CLEAN, sink }).deps);
  const p = runProgress(await sink.listByRun(r.workflowRunId));
  assert.deepEqual({ saved: p.saved, state: p.state, reopens: p.reopens, savedCycle: p.savedCycle }, { saved: "verified", state: "gate", reopens: 0, savedCycle: 0 });
});

test("reopen: a crashed run continued with a new brief keeps that brief and a revision budget from its saved site on the NEXT resume too", async () => {
  const store = new InMemoryAuditSink();
  let crash = true;
  const sink = { name: "s", listByRun: store.listByRun.bind(store), write: async (e: AuditEvent) => { if (crash && e.actor === "agent:qa-evaluator") throw new AuditWriteError("crash", null); return store.write(e); } };
  const artifacts = new MemoryArtifactStore();
  await assert.rejects(() => buildAndVerify(brief, setup({ firstPage: BROKEN, sink, store: artifacts, maxQaRevisions: 1 }).deps));
  const runId = store.events.find((e) => e.action === "workflow.start")!.runId!;
  const withFacts = { ...brief, ownerFacts: [{ key: "phone", label: "Phone", value: "0400 111 222" }] };
  const again = setup({ firstPage: BROKEN, sink, store: artifacts, maxQaRevisions: 1 });
  crash = false;
  await resumeBuildAndVerify(runId, again.deps, { reopen: { reason: "details added", by: "u", brief: withFacts } });
  const row = store.events.find((e) => e.action === "workflow.reopen")!;
  assert.equal(row.payload?.baseCycle, 0);
  assert.ok(row.payload?.brief, "the newer brief is recorded");
});
