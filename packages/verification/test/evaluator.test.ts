import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEvaluatorResponse } from "../src/evaluator.js";

test("parseEvaluatorResponse: approved, no issues", () => {
  const result = parseEvaluatorResponse("VERDICT: APPROVED");
  assert.deepEqual(result, { verdict: "approved", issues: [] });
});

test("parseEvaluatorResponse: changes requested, issues parsed from bullet list", () => {
  const result = parseEvaluatorResponse(
    "VERDICT: CHANGES_REQUESTED\nISSUES:\n- copy is repetitive\n- hero section too sparse",
  );
  assert.equal(result.verdict, "changes_requested");
  assert.deepEqual(result.issues, ["copy is repetitive", "hero section too sparse"]);
});

test("parseEvaluatorResponse: unparseable output is treated as changes-requested, never silently approved", () => {
  const result = parseEvaluatorResponse("Looks great to me!");
  assert.equal(result.verdict, "changes_requested");
  assert.match(result.issues[0]!, /did not follow the VERDICT protocol/);
});

test("parseEvaluatorResponse: CHANGES_REQUESTED with no issues listed still surfaces a message", () => {
  const result = parseEvaluatorResponse("VERDICT: CHANGES_REQUESTED\nISSUES:");
  assert.equal(result.verdict, "changes_requested");
  assert.deepEqual(result.issues, ["Evaluator requested changes but listed no specific issues."]);
});

test("evaluator knows the honesty rules and sees the brief's facts; 'needs client input' is a note on an approval (job c7fba41a)", async () => {
  const { RUBRIC, runEvaluator } = await import("../src/evaluator.js");
  const { MockModelClient } = await import("../src/modelClient.js");
  assert.match(RUBRIC, /never invented\. Their absence is correct/);
  assert.match(RUBRIC, /deliberately not connected to a handler before launch/);
  const model = new MockModelClient(() => "VERDICT: APPROVED\nNOTES:\n- NEEDS CLIENT INPUT: the opening date and the new shop's address");
  const v = await runEvaluator(
    model,
    { html: "<html><body><h1>x</h1></body></html>", requiredSections: ["hero"], factSources: ["Opening a second shop on Harbor Street."] } as never,
    "announce the second shop",
  );
  assert.deepEqual(v, { verdict: "approved", issues: [], notes: ["NEEDS CLIENT INPUT: the opening date and the new shop's address"] });
  assert.match(model.calls[0]!.user, /The approved brief: the ONLY facts the page may state ---\nOpening a second shop on Harbor Street\./);
  const blind = new MockModelClient(() => "VERDICT: APPROVED");
  await runEvaluator(blind, { html: "<p/>", requiredSections: [] } as never, "g");
  assert.match(blind.calls[0]!.user, /brief's facts were not supplied to this review/);
});

test("SAMPLE contradiction (jobs f696ba43, 2c930391): the rubric agrees with the claims gate; SAMPLE facts become client needs, unlabelled ones still fail", async () => {
  const { RUBRIC, LAUNCH_STAGE_NOTE, runEvaluator } = await import("../src/evaluator.js");
  const { MockModelClient } = await import("../src/modelClient.js");
  assert.match(RUBRIC, /visibly labelled SAMPLE is the factory's REQUIRED honest/);
  assert.match(RUBRIC, /never\s+fail a preview for a clearly SAMPLE-labelled placeholder/);
  assert.match(RUBRIC, /NOT labelled SAMPLE is invented and still fails/);
  assert.doesNotMatch(RUBRIC, /SAMPLE placeholder badges[^\n]*not publishable/i);
  const model = new MockModelClient(() => "VERDICT: APPROVED");
  await runEvaluator(model, { html: "<p/>", requiredSections: [] } as never, "g");
  assert.match(model.calls[0]!.user, /^Build stage: preview/);
  assert.ok(!model.calls[0]!.user.includes(LAUNCH_STAGE_NOTE));
  await runEvaluator(model, { html: "<p/>", requiredSections: [], stage: "launch" } as never, "g");
  assert.ok(model.calls[1]!.user.includes(LAUNCH_STAGE_NOTE), "at launch SAMPLE placeholders are defects again");
});

test("brand colours (Lanternworks 4c35703b): tints and shades of the brief's colours are on-brief in the rubric", async () => {
  const { RUBRIC } = await import("../src/evaluator.js");
  assert.match(RUBRIC, /tints and shades of the brief's colours/);
  assert.match(RUBRIC, /Flag a colour only when\s+its hue does not come from any of the brief's colours/);
});

test("parseEvaluatorResponse: NOTES after ISSUES are client needs, never issues (backward compatible)", () => {
  const v = parseEvaluatorResponse("VERDICT: CHANGES_REQUESTED\nISSUES:\n- the hero headline is cut off\nNOTES:\n- NEEDS CLIENT INPUT: the real phone number");
  assert.deepEqual(v, { verdict: "changes_requested", issues: ["the hero headline is cut off"], notes: ["NEEDS CLIENT INPUT: the real phone number"] });
  assert.deepEqual(parseEvaluatorResponse("VERDICT: CHANGES_REQUESTED\nISSUES:\n- a\n- b"), { verdict: "changes_requested", issues: ["a", "b"] });
});

test("Step 4D: a reply that ignores the format is asked for again once; a second one stops the run instead of blaming the site", async () => {
  const { runEvaluator } = await import("../src/evaluator.js");
  const ctx = { html: "<p>x</p>", requiredSections: ["hero"], clientSlug: "c", otherClientSlugs: [] } as never;
  let calls = 0;
  const flaky = { name: "m", complete: async () => (++calls === 1 ? "Sure! Here are my thoughts." : "VERDICT: APPROVED") };
  assert.equal((await runEvaluator(flaky as never, ctx, "goal")).verdict, "approved");
  assert.equal(calls, 2);
  const broken = { name: "m", complete: async () => "no format at all" };
  await assert.rejects(runEvaluator(broken as never, ctx, "goal"), /did not follow the VERDICT protocol after 2 tries/);
});
