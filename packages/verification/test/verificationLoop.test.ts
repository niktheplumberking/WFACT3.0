import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { VerificationLoop } from "../src/verificationLoop.js";
import { MockModelClient } from "../src/modelClient.js";
import type { AsyncCheckSuite, CheckResult, VerificationContext } from "../src/checks/types.js";
import type { ModelClient, ModelRequest } from "../src/modelClient.js";
import { InMemoryAuditSink } from "@wfact/audit";

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

// --- One round, all findings (2026-10-14): the screenshot review and the evaluator run concurrently. ---

const events: string[] = [];
const tick = () => new Promise((r) => setTimeout(r, 20));

function review(result: Omit<CheckResult, "checkId">): AsyncCheckSuite & { runs: number } {
  const suite = {
    id: "rendered.review",
    description: "mock screenshot review",
    runs: 0,
    async run(): Promise<CheckResult[]> {
      suite.runs += 1;
      events.push("review:start");
      await tick();
      events.push("review:end");
      return [{ checkId: "review.DR-FONT", ...result }];
    },
  };
  return suite;
}

class SlowEvaluator implements ModelClient {
  readonly name = "slow-mock";
  calls = 0;
  constructor(private readonly reply: string | Error) {}
  async complete(_req: ModelRequest): Promise<string> {
    this.calls += 1;
    events.push("evaluator:start");
    await tick();
    events.push("evaluator:end");
    if (this.reply instanceof Error) throw this.reply;
    return this.reply;
  }
}

test("review fails AND evaluator requests changes: one changes_requested verdict carries BOTH layers' findings", async () => {
  events.length = 0;
  const suite = review({ passed: false, details: ["DR-FONT: body font is not the brief's pairing"] });
  const evaluator = new SlowEvaluator("VERDICT: CHANGES_REQUESTED\nISSUES:\n- fake social proof in the hero");
  const sink = new InMemoryAuditSink();
  const result = await new VerificationLoop({ reviewSuites: [suite], evaluatorModel: evaluator, audit: { sink, actor: "verification-loop" } }).run(cleanCtx, "goal");
  assert.equal(result.status, "changes_requested");
  assert.ok(result.checkResults.some((c) => c.checkId === "review.DR-FONT" && !c.passed), "the review failure is in the verdict");
  assert.deepEqual(result.evaluator?.issues, ["fake social proof in the hero"], "the evaluator issues are in the same verdict");
  assert.deepEqual(events.slice(0, 2).sort(), ["evaluator:start", "review:start"], "both started before either finished");
  const row = sink.events[0]!;
  assert.equal(row.outcome, "failure");
  assert.ok((row.payload?.checks as { checkId: string }[]).some((c) => c.checkId === "review.DR-FONT"), "audit row has the review result");
  assert.deepEqual((row.payload?.evaluator as { issues: string[] }).issues, ["fake social proof in the hero"], "audit row has the evaluator verdict");
  const costIds = (row.payload?.costs as { id: string }[]).map((c) => c.id);
  assert.ok(costIds.includes("rendered.review") && costIds.includes("evaluator"), "audit row has both layers' costs");
});

test("review fails but evaluator approves: still changes_requested (pass needs every layer)", async () => {
  const result = await new VerificationLoop({ reviewSuites: [review({ passed: false, details: ["x"] })], evaluatorModel: new SlowEvaluator("VERDICT: APPROVED") }).run(cleanCtx, "goal");
  assert.equal(result.status, "changes_requested");
  assert.equal(result.evaluator?.verdict, "approved");
});

test("review NOT RUN: blocked_no_evaluator (not verified) even when the evaluator approves", async () => {
  const result = await new VerificationLoop({ reviewSuites: [review({ passed: false, notRun: true, details: ["reviewer unreachable"] })], evaluatorModel: new SlowEvaluator("VERDICT: APPROVED") }).run(cleanCtx, "goal");
  assert.equal(result.status, "blocked_no_evaluator");
  assert.equal(result.evaluator?.verdict, "approved", "the evaluator's verdict is still on record");
});

test("review passes and evaluator approves: approved; review passes and no evaluator: blocked_no_evaluator", async () => {
  const ok = await new VerificationLoop({ reviewSuites: [review({ passed: true, details: [] })], evaluatorModel: new SlowEvaluator("VERDICT: APPROVED") }).run(cleanCtx, "goal");
  assert.equal(ok.status, "approved");
  const none = await new VerificationLoop({ reviewSuites: [review({ passed: true, details: [] })], evaluatorModel: null }).run(cleanCtx, "goal");
  assert.equal(none.status, "blocked_no_evaluator");
});

test("evaluator throws: recorded beside a failed review, but propagates when the review passed (never a fake verdict)", async () => {
  const failed = await new VerificationLoop({ reviewSuites: [review({ passed: false, details: ["x"] })], evaluatorModel: new SlowEvaluator(new Error("boom")) }).run(cleanCtx, "goal");
  assert.equal(failed.status, "changes_requested");
  assert.equal(failed.evaluator, null);
  assert.match(failed.evaluatorError ?? "", /boom/);
  await assert.rejects(new VerificationLoop({ reviewSuites: [review({ passed: true, details: [] })], evaluatorModel: new SlowEvaluator(new Error("boom")) }).run(cleanCtx, "goal"), /boom/);
});

test("deterministic failure still returns at once: neither the review nor the evaluator is called", async () => {
  const suite = review({ passed: true, details: [] });
  const evaluator = new SlowEvaluator("VERDICT: APPROVED");
  const result = await new VerificationLoop({ reviewSuites: [suite], evaluatorModel: evaluator }).run(brokenCtx, "goal");
  assert.equal(result.status, "failed_checks");
  assert.equal(suite.runs, 0);
  assert.equal(evaluator.calls, 0);
});
