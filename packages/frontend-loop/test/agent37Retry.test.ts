/** Agent 37 client: transient gateway failures are retried with a hard cap; nothing else is. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Agent37ModelClient, AGENT37_RETRY_DELAYS_MS } from "../src/modelClient.js";

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 2 } }), { status: 200 });

function client(responses: (() => Response | Promise<Response>)[]) {
  const slept: number[] = [];
  let calls = 0;
  const c = new Agent37ModelClient("https://gw.example/v1/", "k", {
    fetchImpl: (async () => {
      const r = responses[Math.min(calls, responses.length - 1)]!;
      calls += 1;
      return r();
    }) as typeof fetch,
    sleep: async (ms) => void slept.push(ms),
  });
  return { c, slept, calls: () => calls };
}
const REQ = { system: "s", user: "u" };

test("a dropped connection then success: retried after a wait, the answer comes back (job ad49df57)", async () => {
  const t = client([() => Promise.reject(new TypeError("fetch failed")), () => ok("page")]);
  assert.equal(await t.c.complete(REQ), "page");
  assert.equal(t.calls(), 2);
  assert.deepEqual(t.slept, [AGENT37_RETRY_DELAYS_MS[0]]);
  assert.equal(t.c.retries, 1);
});

test("HTTP 502 and 429 are transient; the cap is 4 attempts, then a clear escalation error", async () => {
  const t = client([() => new Response("upstream_unreachable", { status: 502 }), () => new Response("slow down", { status: 429 })]);
  await assert.rejects(t.c.complete(REQ), /HTTP 429 slow down \(after 4 attempts; gateway unavailable, escalating\)/);
  assert.equal(t.calls(), 4);
  assert.deepEqual(t.slept, AGENT37_RETRY_DELAYS_MS);
});

test("a 4xx and an unusable 200 are not retried", async () => {
  const bad = client([() => new Response("bad key", { status: 401 })]);
  await assert.rejects(bad.c.complete(REQ), /HTTP 401 bad key$/);
  assert.equal(bad.calls(), 1);
  const empty = client([() => new Response(JSON.stringify({ choices: [{ message: {}, finish_reason: "error" }] }), { status: 200 })]);
  await assert.rejects(empty.c.complete(REQ), /no usable completion/);
  assert.equal(empty.calls(), 1);
  assert.deepEqual([...bad.slept, ...empty.slept], []);
});

test("Step 4D: a call that hangs is cut off by the timeout and retried like a dropped connection", async () => {
  const slept: number[] = [];
  let calls = 0;
  const c = new Agent37ModelClient("https://gw.example/v1/", "k", {
    timeoutMs: 20,
    fetchImpl: ((_url: string, init: RequestInit) => {
      calls += 1;
      // AbortSignal.timeout's timer does not keep the process alive on its own; hold the loop open until the abort fires.
      if (calls === 1) {
        const keepAlive = setTimeout(() => {}, 5_000);
        return new Promise((_res, rej) => init.signal!.addEventListener("abort", () => { clearTimeout(keepAlive); rej(init.signal!.reason); }));
      }
      return Promise.resolve(ok("page"));
    }) as unknown as typeof fetch,
    sleep: async (ms) => void slept.push(ms),
  });
  assert.equal(await c.complete(REQ), "page");
  assert.equal(calls, 2);
  assert.deepEqual(slept, [AGENT37_RETRY_DELAYS_MS[0]]);
});
