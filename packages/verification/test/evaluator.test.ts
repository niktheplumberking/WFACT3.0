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
