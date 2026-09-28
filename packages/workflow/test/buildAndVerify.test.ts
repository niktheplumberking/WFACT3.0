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
