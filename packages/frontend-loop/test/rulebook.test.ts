/** Step 4B M1: the builder receives every design rule; every rule has a failing fixture on disk. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { FrontendLoop } from "../src/loop.js";
import { MockModelClient } from "../src/modelClient.js";
import { HAND_PICKED_TEMPLATES } from "../src/templates.js";
import { DESIGN_RULEBOOK, rulebookPromptText } from "../src/rulebook.js";
import type { PilotBrief } from "../src/brief.js";

const brief: PilotBrief = {
  clientSlug: "dreamsign-pilot",
  entitySlug: "dreamsign",
  projectName: "DreamSign Homepage",
  goal: "A one-page homepage introducing DreamSign's services.",
  requiredSections: ["hero", "contact"],
  brandNotes: "Clean, trustworthy, restrained.",
  source: "placeholder-2.0-case",
};

test("rulebook is versioned and has both banned patterns and required qualities", () => {
  assert.match(DESIGN_RULEBOOK.version, /^\d+\.\d+\.\d+$/);
  assert.ok(DESIGN_RULEBOOK.rules.some((r) => r.kind === "banned"));
  assert.ok(DESIGN_RULEBOOK.rules.some((r) => r.kind === "required"));
});

test("every rule names a failing fixture that exists", () => {
  for (const r of DESIGN_RULEBOOK.rules as (typeof DESIGN_RULEBOOK.rules[number] & { fixture: string })[]) {
    assert.ok(existsSync(path.join(import.meta.dirname, "..", "design", r.fixture)), `${r.id}: ${r.fixture} missing`);
  }
});

test("the builder's system prompt carries every rule id, on generate and on fix", async () => {
  const builder = new MockModelClient(() => "<html>page</html>");
  const evaluator = new MockModelClient((_req, i) => (i === 0 ? "VERDICT: CHANGES_REQUESTED\nISSUES:\n- x" : "VERDICT: APPROVED"));
  await new FrontendLoop({ builderModel: builder, evaluatorModel: evaluator }).run(brief, HAND_PICKED_TEMPLATES[0]!);
  assert.equal(builder.calls.length, 2);
  for (const call of builder.calls) {
    for (const r of DESIGN_RULEBOOK.rules) assert.ok(call.system.includes(r.id), `${r.id} missing from builder prompt`);
    assert.ok(call.system.includes(rulebookPromptText()));
  }
});
