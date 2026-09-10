import { test } from "node:test";
import assert from "node:assert/strict";
import { withBoundedRetry, EscalationError } from "../src/escalation.js";

test("succeeds without retrying when the function succeeds first try", async () => {
  let calls = 0;
  const result = await withBoundedRetry(
    async () => {
      calls += 1;
      return "ok";
    },
    { maxAttempts: 3, baseDelayMs: 1, sleep: async () => {} },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 1);
});

test("retries up to maxAttempts, then escalates instead of retrying forever", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  await assert.rejects(
    () =>
      withBoundedRetry(
        async () => {
          calls += 1;
          throw new Error("model unavailable");
        },
        { maxAttempts: 3, baseDelayMs: 10, sleep: async (ms) => void sleeps.push(ms) },
      ),
    EscalationError,
  );
  assert.equal(calls, 3, "must stop at the hard cap, not retry indefinitely");
  assert.deepEqual(sleeps, [10, 20], "backoff must be exponential, one fewer sleep than attempts");
});

test("recovers if a later attempt succeeds within the budget", async () => {
  let calls = 0;
  const result = await withBoundedRetry(
    async () => {
      calls += 1;
      if (calls < 2) throw new Error("transient");
      return "recovered";
    },
    { maxAttempts: 3, baseDelayMs: 1, sleep: async () => {} },
  );
  assert.equal(result, "recovered");
  assert.equal(calls, 2);
});

test("EscalationError carries the reason a human needs to see", async () => {
  try {
    await withBoundedRetry(
      async () => {
        throw new Error("no API key configured");
      },
      { maxAttempts: 1, baseDelayMs: 1, sleep: async () => {} },
    );
    assert.fail("should have thrown");
  } catch (err) {
    assert.ok(err instanceof EscalationError);
    assert.equal(err.reason, "no API key configured");
    assert.equal(err.attempts, 1);
  }
});
