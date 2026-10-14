/**
 * render.perf LCP noise (Cockpit job c775c396: 2.52-2.63 s against the 2.5 s Track B budget on all 3 rounds).
 * The budget is not raised: a near miss (within +10%) is measured twice more and the median of three is judged;
 * a clear miss fails at once with no extra measurement. No browser: the re-measure is a stub.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LCP_NEAR_MISS, TRACK_B_BUDGET, lcpFailureDetail, settleLcp } from "../src/rendered.js";

const BUDGET = TRACK_B_BUDGET.lcpMs; // 2500
const stub = (values: number[]) => {
  let i = 0;
  const calls = { n: 0 };
  return { calls, fn: async () => (calls.n++, values[i++]!) };
};

test("the budget is unchanged and the near-miss band is 10%", () => {
  assert.equal(BUDGET, 2500);
  assert.equal(LCP_NEAR_MISS, 0.1);
});

test("under budget: passes on one measurement, no re-measure", async () => {
  const s = stub([]);
  const r = await settleLcp(2400, BUDGET, s.fn);
  assert.deepEqual(r, { lcpMs: 2400, samples: [2400] });
  assert.equal(s.calls.n, 0);
});

test("near miss (c775c396's 2.52 s): two more measurements, the median of three decides, every sample recorded", async () => {
  const s = stub([2410, 2460]);
  const r = await settleLcp(2520, BUDGET, s.fn);
  assert.equal(s.calls.n, 2);
  assert.deepEqual(r.samples, [2520, 2410, 2460]);
  assert.equal(r.lcpMs, 2460, "median");
  assert.ok(r.lcpMs < BUDGET, "passes on the median");
});

test("near miss that is really over: the median still fails, and the failure line names all three values", async () => {
  const s = stub([2630, 2580]);
  const r = await settleLcp(2550, BUDGET, s.fn);
  assert.equal(r.lcpMs, 2580);
  assert.ok(!(r.lcpMs < BUDGET));
  const line = lcpFailureDetail("index.html: ", r, BUDGET);
  assert.match(line, /LCP 2\.58 s on mobile \(median of 2\.55 s, 2\.63 s, 2\.58 s/);
  assert.match(line, /the budget is 2\.5 s$/);
});

test("exactly at the band edge (+10%) is still a near miss; just past it is a clear miss with no re-measure", async () => {
  const edge = stub([2400, 2400]);
  assert.equal((await settleLcp(2750, BUDGET, edge.fn)).samples.length, 3);
  const clear = stub([2000, 2000]);
  const r = await settleLcp(2751, BUDGET, clear.fn);
  assert.equal(clear.calls.n, 0, "a clear miss fails immediately, as before");
  assert.deepEqual(r, { lcpMs: 2751, samples: [2751] });
  assert.equal(lcpFailureDetail("", r, BUDGET), "LCP 2.75 s on mobile (Lighthouse, applied throttling); the budget is 2.5 s");
});

test("an unmeasurable re-measure (NaN) never turns a near miss into a pass", async () => {
  const s = stub([Number.NaN, 2000]);
  const r = await settleLcp(2510, BUDGET, s.fn);
  assert.ok(Number.isNaN(r.lcpMs));
  assert.ok(!(r.lcpMs < BUDGET));
});
