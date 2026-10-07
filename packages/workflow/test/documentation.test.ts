/**
 * Step 5 acceptance, in process: after a workflow run the client's memory file holds exactly one entry per stage,
 * written by the Documentation agent (not by a human), joined to the stage's audit task id; and a stage that cannot
 * be documented is escalated, never skipped.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink } from "@wfact/audit";
import { createSeedRegistry } from "@wfact/agent-runtime";
import { createFrontendBuilderAgent } from "@wfact/frontend-loop/agent";
import { MockModelClient as BuilderMock } from "@wfact/frontend-loop/modelClient";
import { createQaEvaluatorAgent } from "@wfact/verification/agent";
import { MockModelClient as EvaluatorMock } from "@wfact/verification/modelClient";
import { parseEpisodes } from "@wfact/hermes-lite/tools/episodes";
import {
  InMemoryMemoryStore,
  createDocumentationAgent,
  createDocumentationObserver,
  inMemoryRunRecords,
  registerDocumentationAgent,
} from "@wfact/documentation";
import { buildAndVerify, MemoryArtifactStore, type WorkflowDeps } from "../src/buildAndVerify.js";

const FIXTURES = path.join(import.meta.dirname, "..", "..", "verification", "test", "fixtures");
const BROKEN = readFileSync(path.join(FIXTURES, "broken.html"), "utf-8");
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
const MEM = "clients/dreamsign-pilot/memory.md";
const HUMAN = "# Client: dreamsign-pilot\n\nHand-written.\n";

function setup(firstPage: string, revisedPage?: string) {
  const sink = new InMemoryAuditSink();
  const memory = new InMemoryMemoryStore();
  memory.files.set(MEM, HUMAN);
  const registry = registerDocumentationAgent(createSeedRegistry());
  const docAgent = createDocumentationAgent({ records: inMemoryRunRecords(sink), memory });
  const builder = new BuilderMock((req) => (req.user.includes("Issues to fix") ? revisedPage ?? firstPage : firstPage));
  const deps: WorkflowDeps = {
    frontEndAgent: createFrontendBuilderAgent({ builderModel: builder, evaluatorModel: new BuilderMock(() => "VERDICT: APPROVED") }),
    qaAgent: createQaEvaluatorAgent({ evaluatorModel: new EvaluatorMock(() => "VERDICT: APPROVED") }),
    registry,
    audit: sink,
    reader: sink,
    artifacts: new MemoryArtifactStore(),
    knownClientSlugs: ["dreamsign-pilot", "summit-line-roofing"],
    stageObserver: createDocumentationObserver({ agent: docAgent, registry, audit: sink }),
  };
  return { deps, sink, memory };
}

const spawnedTasks = (sink: InMemoryAuditSink, runId: string, role: string) =>
  sink.events.filter((e) => e.runId === runId && e.actor === `agent:${role}` && e.action === "agent.spawn").map((e) => e.taskId);

test("after a clean run: one entry per stage (build, QA), written by the agent, joined to the audit task ids", async () => {
  const { deps, sink, memory } = setup(CLEAN);
  const result = await buildAndVerify(brief, deps);
  assert.equal(result.status, "awaiting_launch_approval");
  assert.deepEqual(result.documentationEscalations, []);

  const text = memory.files.get(MEM)!;
  assert.ok(text.startsWith(HUMAN));
  const { episodes, problems } = parseEpisodes(text);
  assert.deepEqual(problems, []);
  assert.deepEqual(episodes.map((e) => `${e.stage}:${e.cycle}:${e.outcome.status}`), ["build:0:checkpointed", "qa:0:verified_awaiting_launch_approval"]);
  assert.ok(episodes.every((e) => e.documentedBy === "agent:documentation" && !e.backfilled && e.workflowRunId === result.workflowRunId));
  assert.ok(episodes.every((e) => e.workflowTaskId === result.workflowTaskId));
  assert.deepEqual([episodes[0]!.stageTaskId], spawnedTasks(sink, result.workflowRunId, "front-end-builder"));
  assert.deepEqual([episodes[1]!.stageTaskId], spawnedTasks(sink, result.workflowRunId, "qa-evaluator"));
  assert.equal(episodes[1]!.checksRun, 6);
  assert.equal(episodes[0]!.artifact?.sha256, result.lastCheckpoint?.sha256);

  // Each entry's audit row ids are real rows of this run, and each has a documentation.entry row on the same run.
  const runRows = await inMemoryRunRecords(sink).auditRows(result.workflowRunId);
  const ids = new Set(runRows.map((r) => r.id));
  for (const e of episodes) {
    assert.ok(e.links.auditRowIds.length > 0 && e.links.auditRowIds.every((id) => ids.has(id)));
    assert.ok(runRows.some((r) => r.action === "documentation.entry" && r.payload.entryId === e.entryId));
  }
  // The workflow's own trail is unchanged by documentation (same four rows as before Step 5).
  assert.deepEqual(
    sink.events.filter((e) => e.runId === result.workflowRunId && e.actor === "workflow:build-and-verify").map((e) => e.action),
    ["workflow.start", "workflow.checkpoint", "workflow.checkpoint", "workflow.gate"],
  );
});

test("after a run with a revision: every stage gets its entry, in order", async () => {
  const { deps, memory } = setup(BROKEN, CLEAN);
  const result = await buildAndVerify(brief, deps);
  assert.equal(result.status, "awaiting_launch_approval");
  const { episodes, problems } = parseEpisodes(memory.files.get(MEM)!);
  assert.deepEqual(problems, []);
  assert.deepEqual(episodes.map((e) => `${e.stage}:${e.cycle}:${e.outcome.status}`), [
    "build:0:checkpointed",
    "qa:0:returned_to_builder",
    "build:1:checkpointed",
    "qa:1:verified_awaiting_launch_approval",
  ]);
  assert.ok(episodes[1]!.failedChecks.length > 0, "the failed checks are recorded");
  assert.ok(episodes[1]!.corrections.issuesReturnedCount > 0);
});

test("a stage that cannot be documented is escalated (row + result), and the run itself is not undone", async () => {
  const { deps, sink, memory } = setup(CLEAN);
  memory.failAppends = "EROFS: read-only file system";
  const result = await buildAndVerify(brief, deps);
  assert.equal(result.status, "awaiting_launch_approval", "the verified build still stands");
  assert.equal(result.documentationEscalations?.length, 2);
  const rows = sink.events.filter((e) => e.runId === result.workflowRunId && e.action === "workflow.documentation_escalated");
  assert.deepEqual(rows.map((r) => r.payload?.stage), ["build", "qa"]);
  assert.ok(rows.every((r) => /EROFS/.test(String(r.payload?.reason)) && r.outcome === "failure"));
  assert.equal(memory.files.get(MEM), HUMAN, "nothing half-written");
});
