import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { VerificationLoop } from "../src/verificationLoop.js";
import { MockModelClient } from "../src/modelClient.js";
import type { VerificationContext } from "../src/checks/types.js";

const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures");
function loadFixture(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
}

const cleanCtx: VerificationContext = {
  html: loadFixture("clean.html"),
  clientSlug: "dreamsign-pilot",
  requiredSections: ["hero", "contact"],
  otherClientSlugs: ["bennett-co"],
};

const brokenCtx: VerificationContext = {
  html: loadFixture("broken.html"),
  clientSlug: "dreamsign-pilot",
  requiredSections: ["hero", "contact"],
  otherClientSlugs: ["bennett-co"],
};

test("broken build: failed_checks status, evaluator never called", async () => {
  const evaluator = new MockModelClient(() => "VERDICT: APPROVED");
  const loop = new VerificationLoop({ evaluatorModel: evaluator });

  const result = await loop.run(brokenCtx, "A homepage for DreamSign.");

  assert.equal(result.status, "failed_checks");
  assert.equal(result.evaluator, null);
  assert.equal(evaluator.calls.length, 0, "evaluator must not be called when checks already failed");
});

test("clean build, no evaluator configured: blocked_no_evaluator, never fabricates approval", async () => {
  const loop = new VerificationLoop({ evaluatorModel: null });

  const result = await loop.run(cleanCtx, "A homepage for DreamSign.");

  assert.equal(result.status, "blocked_no_evaluator");
  assert.equal(result.evaluator, null);
  assert.ok(result.checkResults.every((r) => r.passed));
});

test("clean build, evaluator approves: status approved", async () => {
  const evaluator = new MockModelClient(() => "VERDICT: APPROVED");
  const loop = new VerificationLoop({ evaluatorModel: evaluator });

  const result = await loop.run(cleanCtx, "A homepage for DreamSign.");

  assert.equal(result.status, "approved");
  assert.equal(evaluator.calls.length, 1);
});

test("clean build, evaluator requests changes: status changes_requested, issues carried through", async () => {
  const evaluator = new MockModelClient(
    () => "VERDICT: CHANGES_REQUESTED\nISSUES:\n- copy reads like a placeholder",
  );
  const loop = new VerificationLoop({ evaluatorModel: evaluator });

  const result = await loop.run(cleanCtx, "A homepage for DreamSign.");

  assert.equal(result.status, "changes_requested");
  assert.deepEqual(result.evaluator?.issues, ["copy reads like a placeholder"]);
});
