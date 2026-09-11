import { test } from "node:test";
import assert from "node:assert/strict";
import { FrontendLoop, parseReviewResponse } from "../src/loop.js";
import { MockModelClient } from "../src/modelClient.js";
import { HAND_PICKED_TEMPLATES } from "../src/templates.js";
import type { PilotBrief } from "../src/brief.js";

const brief: PilotBrief = {
  clientSlug: "dreamsign-pilot",
  entitySlug: "dreamsign",
  projectName: "DreamSign Homepage",
  goal: "A one-page homepage introducing DreamSign's services.",
  requiredSections: ["hero", "services", "process", "contact"],
  brandNotes: "Clean, trustworthy, restrained.",
  source: "placeholder-2.0-case",
};
const template = HAND_PICKED_TEMPLATES[0]!;

test("constructor refuses to share one ModelClient instance for both roles", () => {
  const model = new MockModelClient(() => "VERDICT: APPROVED");
  assert.throws(
    () => new FrontendLoop({ builderModel: model, evaluatorModel: model }),
    /distinct ModelClient instances/,
  );
});

test("approved on the first round: one generate call, one review call, no fix call", async () => {
  const builder = new MockModelClient(() => "<html>page</html>");
  const evaluator = new MockModelClient(() => "VERDICT: APPROVED");
  const loop = new FrontendLoop({ builderModel: builder, evaluatorModel: evaluator });

  const result = await loop.run(brief, template);

  assert.equal(result.approved, true);
  assert.equal(result.needsHuman, false);
  assert.equal(result.rounds.length, 1);
  assert.equal(result.rounds[0]!.verdict, "approved");
  assert.equal(builder.calls.length, 1);
  assert.equal(evaluator.calls.length, 1);
});

test("changes requested twice then approved: three rounds logged, builder called for fixes", async () => {
  const builder = new MockModelClient((_req, i) => `<html>draft-${i}</html>`);
  let reviewCall = 0;
  const evaluator = new MockModelClient(() => {
    reviewCall += 1;
    return reviewCall < 3
      ? "VERDICT: CHANGES_REQUESTED\nISSUES:\n- missing contact section"
      : "VERDICT: APPROVED";
  });
  const loop = new FrontendLoop({ builderModel: builder, evaluatorModel: evaluator });

  const result = await loop.run(brief, template);

  assert.equal(result.approved, true);
  assert.equal(result.rounds.length, 3);
  assert.deepEqual(
    result.rounds.map((r) => r.verdict),
    ["changes_requested", "changes_requested", "approved"],
  );
  // 1 initial generate + 2 fix calls = 3 builder calls.
  assert.equal(builder.calls.length, 3);
});

test("hard cap: never-approving evaluator escalates instead of looping forever", async () => {
  const builder = new MockModelClient(() => "<html>draft</html>");
  const evaluator = new MockModelClient(
    () => "VERDICT: CHANGES_REQUESTED\nISSUES:\n- still not good enough",
  );
  const loop = new FrontendLoop({ builderModel: builder, evaluatorModel: evaluator, maxRounds: 3 });

  const result = await loop.run(brief, template);

  assert.equal(result.approved, false);
  assert.equal(result.needsHuman, true);
  assert.equal(result.rounds.length, 3);
  assert.match(result.escalationReason ?? "", /3-round cap/);
});

test("parseReviewResponse: unparseable output is treated as changes-requested, never silently approved", () => {
  const parsed = parseReviewResponse("looks great to me!");
  assert.equal(parsed.verdict, "changes_requested");
  assert.match(parsed.issues[0] ?? "", /did not follow the VERDICT protocol/);
});

test("parseReviewResponse: changes-requested with no issues listed still flags something", () => {
  const parsed = parseReviewResponse("VERDICT: CHANGES_REQUESTED\nISSUES:\n");
  assert.equal(parsed.verdict, "changes_requested");
  assert.equal(parsed.issues.length, 1);
});
