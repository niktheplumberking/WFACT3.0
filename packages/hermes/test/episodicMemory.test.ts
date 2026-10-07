/**
 * Step 5: Hermes-lite answers "what happened on <client>'s build" from the Documentation agent's structured entries,
 * through the same allowlisted memory tool, with the tone filter still applied.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { HermesLite, detectClientSlug, isHistoryQuestion } from "../src/controller.js";
import { MockModelClient } from "../src/modelClient.js";
import { ToolRegistry } from "../src/tools/schema.js";
import { readClientMemoryTool } from "../src/tools/memoryTools.js";
import { EPISODIC_LOG_HEADING, episodeId, parseEpisodes, renderEpisode, validateEpisode, type Episode } from "../src/tools/episodes.js";

const RUN = "0cfc6675-c312-47b1-8c51-a48c62202fa6";
const BUILD = "b5abcbf9-df9e-4007-9053-895a7f407c28";
const QA = "a8d11664-cb92-47d3-bce1-e485cf565d54";

function episode(stage: "build" | "qa", taskId: string, status: string, summary: string, at: string, cost: number): Episode {
  return validateEpisode({
    v: 1, entryId: episodeId(RUN, stage, 0, taskId), workflow: { id: "build-and-verify", version: "1.0.0" }, workflowRunId: RUN,
    workflowTaskId: "549a6d92-1eda-49d2-ab1e-50e70756c22b", stage, cycle: 0, stageTaskId: taskId, at,
    actor: stage === "build" ? "agent:front-end-builder" : "agent:qa-evaluator", entitySlug: "bennett-co", clientSlug: "summit-line-roofing",
    outcome: { status, summary, reason: null }, inputs: [], artifact: null, failedChecks: [], checksRun: stage === "qa" ? 6 : null,
    evaluatorVerdict: stage === "qa" ? "approved" : null, corrections: { builderRounds: stage === "build" ? 3 : null, builderApproved: stage === "build" ? true : null, issuesReturnedCount: 0, issuesReturned: [] },
    cost: { meteredUsd: cost, calls: 1, unpricedCalls: 0, inputTokens: 10, outputTokens: 5, models: ["claude-sonnet-5"] },
    links: { auditRunQuery: `audit_log?run_id=eq.${RUN}&task_id=eq.${taskId}`, auditRowIds: [], traceIds: [] },
    backfilled: true, documentedBy: "agent:documentation", documentedAt: "2026-10-07T09:00:00.000Z", redactions: 0,
  });
}

const EPISODES = [
  episode("build", BUILD, "checkpointed", "Build cycle 0: the builder produced the page after 3 internal correction round(s).", "2026-09-30T16:29:58.000Z", 0.137098),
  episode("qa", QA, "verified_awaiting_launch_approval", "QA cycle 0: approved. 6 of 6 automated checks passed.", "2026-09-30T16:30:10.000Z", 0.036962),
];
const HUMAN_NOTE = "HAND-WRITTEN NOTE: the client loves purple.";
const MEMORY = `# Client: summit-line-roofing\n\n${HUMAN_NOTE}\n\n${EPISODIC_LOG_HEADING}\n\n${EPISODES.map(renderEpisode).join("\n")}`;

/** The real tool names and schemas, with file reads replaced by fixed content. */
function registry(memory: string, calls: string[]) {
  const r = new ToolRegistry();
  r.register({
    name: "memory.readContext", description: "fake", inputSchema: z.object({}), outputSchema: z.object({ content: z.string(), path: z.string() }),
    handler: async () => {
      calls.push("memory.readContext");
      return { content: "Business rules.", path: "memory/context.md" };
    },
  });
  r.register({
    ...readClientMemoryTool,
    handler: async ({ clientSlug }) => {
      calls.push(`memory.readClient:${clientSlug}`);
      const { episodes, problems } = parseEpisodes(memory);
      return { found: true, content: memory, path: `clients/${clientSlug}/memory.md`, episodes, episodeProblems: problems };
    },
  });
  r.register({
    name: "state.projectStatus", description: "fake", inputSchema: z.object({ entitySlug: z.string() }), outputSchema: z.object({ entitySlug: z.string(), projects: z.array(z.unknown()) }),
    handler: async ({ entitySlug }) => {
      calls.push("state.projectStatus");
      return { entitySlug, projects: [] };
    },
  });
  return r;
}

test("detectClientSlug: a client named in plain words maps to its folder; longest match wins; unknown names do not", () => {
  const slugs = ["dreamsign-pilot", "summit-line", "summit-line-roofing", "harbor-street-bakery"];
  assert.equal(detectClientSlug("What happened on Summit Line Roofing's build?", slugs), "summit-line-roofing");
  assert.equal(detectClientSlug("what happened on summit-line-roofing", slugs), "summit-line-roofing");
  assert.equal(detectClientSlug("How is Harbor Street Bakery doing?", slugs), "harbor-street-bakery");
  assert.equal(detectClientSlug("What happened on Summit's build?", slugs), null);
  assert.equal(detectClientSlug("../../etc/passwd", ["../../etc"]), null, "only well-formed slugs are candidates");
  assert.equal(isHistoryQuestion("What happened on X's build?"), true);
  assert.equal(isHistoryQuestion("What is the client's phone number?"), false);
});

test("'What happened on <client>'s build?' is answered from the agent-written entries, not the hand-written notes", async () => {
  const calls: string[] = [];
  const model = new MockModelClient(() => "The build was approved; the RLS rules held and nothing was deployed.");
  const hermes = new HermesLite({ toolRegistry: registry(MEMORY, calls), modelClient: model, clientSlugs: ["summit-line-roofing", "dreamsign-pilot"] });
  const a = await hermes.answerStatusQuestion("What happened on Summit Line Roofing's build?");
  assert.equal(a.needsHuman, false);
  assert.equal(a.clientSlug, "summit-line-roofing");
  assert.equal(a.entitySlug, "bennett-co", "taken from the entries");
  assert.equal(a.episodesUsed, 2);
  assert.deepEqual(a.sourcesUsed, ["memory/context.md", "clients/summit-line-roofing/memory.md#episodic-log (2 entries)"]);
  const prompt = model.calls[0]!.user;
  assert.match(prompt, /written by the Documentation agent from the audit trail \(not by a human\)/);
  assert.match(prompt, /1 workflow run\(s\), 2 stage entries; metered model cost across them \$0\.1741/);
  assert.match(prompt, /verified_awaiting_launch_approval/);
  assert.ok(!prompt.includes(HUMAN_NOTE), "hand-written prose is not the source of a history answer");
  assert.deepEqual(calls, ["memory.readContext", "memory.readClient:summit-line-roofing"], "no live-state call for a history answer");
  // The tone filter still runs on the answer.
  assert.ok(a.toneFilter.replacedTerms.includes("RLS"));
  assert.ok(!a.answer.includes("RLS"));
});

test("a non-history question about a client gets the whole memory file, as before", async () => {
  const calls: string[] = [];
  const model = new MockModelClient(() => "ok");
  const hermes = new HermesLite({ toolRegistry: registry(MEMORY, calls), modelClient: model, clientSlugs: ["summit-line-roofing"] });
  const a = await hermes.answerStatusQuestion("What colours does Summit Line Roofing like?");
  assert.equal(a.episodesUsed, 0);
  assert.ok(model.calls[0]!.user.includes(HUMAN_NOTE));
});

test("a hand-edited entry is left out of the answer, and the model is told so", async () => {
  const tampered = MEMORY.replace("6 of 6 automated checks passed", "all checks skipped");
  const model = new MockModelClient(() => "ok");
  const hermes = new HermesLite({ toolRegistry: registry(tampered, []), modelClient: model, clientSlugs: ["summit-line-roofing"] });
  const a = await hermes.answerStatusQuestion("What happened on Summit Line Roofing's build?");
  assert.equal(a.episodesUsed, 1);
  assert.match(model.calls[0]!.user, /1 entry was left out because it failed validation or had been edited by hand/);
  assert.ok(!model.calls[0]!.user.includes("all checks skipped"));
});

test("memory.readClient (real tool) returns parsed episodes alongside the file", async () => {
  const real = new ToolRegistry();
  real.register(readClientMemoryTool);
  const out = (await real.invoke("memory.readClient", { clientSlug: "summit-line-roofing" })) as { found: boolean; episodes: Episode[]; episodeProblems: unknown[] };
  assert.equal(out.found, true);
  assert.ok(Array.isArray(out.episodes));
  assert.deepEqual(out.episodeProblems, [], "every entry in the committed memory file validates");
  await assert.rejects(real.invoke("memory.readClient", { clientSlug: "../dreamsign-pilot" }), /schema validation/);
});
