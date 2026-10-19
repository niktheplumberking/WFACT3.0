import { test } from "node:test";
import assert from "node:assert/strict";
import { MockJsonModel, MockTextModel } from "../src/testing/mockModel.js";

// Step 21 J: the one shared scripted double behind every package's MockModelClient / MockJsonClient.
test("records every request, answers by call index, and throws a scripted Error", async () => {
  const m = new MockTextModel<{ user: string }>((_, i) => (i === 1 ? new Error("scripted outage") : `answer ${i}`), "family-x");
  assert.equal(await m.complete({ user: "a" }), "answer 0");
  await assert.rejects(m.complete({ user: "b" }), /scripted outage/);
  assert.equal(await m.complete({ user: "c" }), "answer 2");
  assert.deepEqual(m.calls.map((c) => c.user), ["a", "b", "c"]);
  assert.equal(m.family, "family-x");
  assert.equal(m.name, "mock");
});

test("a JSON answer is a fresh copy each call, so a test cannot change the script", async () => {
  const script = { items: [1] };
  const m = new MockJsonModel<string>(() => script);
  const first = (await m.completeJson("q")) as { items: number[] };
  first.items.push(2);
  assert.deepEqual(await m.completeJson("q"), { items: [1] });
  assert.equal(m.route, null);
  assert.deepEqual(m.totalUsage, { inputTokens: 0, outputTokens: 0 });
});
