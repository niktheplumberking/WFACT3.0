import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { InMemoryAuditSink, AuditWriteError, type AuditSink } from "@wfact/audit";
import { VerificationLoop } from "../src/verificationLoop.js";
import { MockModelClient } from "../src/modelClient.js";
import type { VerificationContext } from "../src/checks/types.js";

const FIXTURES_DIR = path.join(import.meta.dirname, "fixtures");
const RUN_ID = "11111111-2222-4333-8444-555555555555";
const TASK_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function ctx(fixture: string): VerificationContext {
  return {
    html: readFileSync(path.join(FIXTURES_DIR, fixture), "utf-8"),
    clientSlug: "dreamsign-pilot",
    requiredSections: ["hero", "contact"],
    otherClientSlugs: ["bennett-co"],
  };
}

test("a broken build's failed_checks decision is audited as failure, with the specific failed checks", async () => {
  const sink = new InMemoryAuditSink();
  const loop = new VerificationLoop({ audit: { sink, actor: "verification-loop", runId: RUN_ID, taskId: TASK_ID } });
  const result = await loop.run(ctx("broken.html"), "test goal");

  assert.equal(result.status, "failed_checks");
  assert.equal(sink.events.length, 1);
  const row = sink.events[0]!;
  assert.equal(row.action, "verification.decision");
  assert.equal(row.outcome, "failure");
  assert.equal(row.taskId, TASK_ID);
  assert.equal(row.entitySlug, "dreamsign-pilot");
  assert.equal(row.payload?.status, "failed_checks");
  const checks = row.payload?.checks as { checkId: string; passed: boolean }[];
  assert.equal(checks.length, result.checkResults.length);
  assert.ok(checks.some((c) => !c.passed), "the failing check ids are on record, not just 'failed'");
});

test("an approved decision is audited as success with the evaluator's verdict", async () => {
  const sink = new InMemoryAuditSink();
  const evaluatorModel = new MockModelClient(() => "VERDICT: APPROVED");
  const loop = new VerificationLoop({ evaluatorModel, audit: { sink, actor: "verification-loop" } });
  const result = await loop.run(ctx("clean.html"), "test goal");

  assert.equal(result.status, "approved");
  assert.equal(sink.events[0]!.outcome, "success");
  assert.deepEqual(sink.events[0]!.payload?.evaluator, { verdict: "approved", issues: [] });
});

test("checks-only (no evaluator) is audited as failure — not verified, per CLAUDE.md §1", async () => {
  const sink = new InMemoryAuditSink();
  const loop = new VerificationLoop({ audit: { sink, actor: "verification-loop" } });
  const result = await loop.run(ctx("clean.html"), "test goal");
  assert.equal(result.status, "blocked_no_evaluator");
  assert.equal(sink.events[0]!.outcome, "failure");
});

test("fail closed: an audit write error propagates instead of returning an unaudited decision", async () => {
  const brokenSink: AuditSink = {
    name: "broken",
    write: async () => {
      throw new AuditWriteError("down", 503);
    },
  };
  const loop = new VerificationLoop({ audit: { sink: brokenSink, actor: "verification-loop" } });
  await assert.rejects(() => loop.run(ctx("broken.html"), "test goal"), AuditWriteError);
});
