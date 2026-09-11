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
