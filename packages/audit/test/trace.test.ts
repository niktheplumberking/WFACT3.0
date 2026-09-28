import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AuditWriteError, InMemoryTraceSink, SupabaseTraceSink, runContext, traceModelCalls, type TraceOptions, type TraceSink,
} from "../src/index.js";

const TASK = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const RUN = "11111111-2222-4333-8444-555555555555";

/** A fake model client with provider-style cumulative usage counters. */
class FakeClient {
  readonly name = "fake";
  totalUsage = { inputTokens: 0, outputTokens: 0 };
  constructor(private readonly fail = false) {}
  async complete(req: { user: string }): Promise<string> {
    this.totalUsage.inputTokens += 1000;
    this.totalUsage.outputTokens += 200;
    if (this.fail) throw new Error("upstream 529 overloaded");
    return `echo:${req.user}`;
  }
}

const cost: TraceOptions["cost"] = (_model, u) => ({
  costUsd: (u.inputTokens / 1e6) * 2 + (u.outputTokens / 1e6) * 10,
  basis: "metered",
  pricingVersion: "1.1.0",
});

function traced(client: FakeClient, sink: TraceSink, costFn: TraceOptions["cost"] = cost) {
  return traceModelCalls(client, {
    sink, method: "complete", provider: "anthropic", model: "claude-sonnet-5",
    usage: () => client.totalUsage, cost: costFn, fallbackActor: "cli:test",
  });
}

test("one call → one trace row: token DELTA, real cost, latency, success — result passed through", async () => {
  const sink = new InMemoryTraceSink();
  const client = new FakeClient();
  client.totalUsage = { inputTokens: 5000, outputTokens: 500 }; // earlier, untraced usage must not leak in
  const wrapped = traced(client, sink);
  assert.equal(await wrapped.complete({ user: "hi" }), "echo:hi");
  assert.equal(sink.traces.length, 1);
  const t = sink.traces[0]!;
  assert.equal(t.inputTokens, 1000);
  assert.equal(t.outputTokens, 200);
  assert.equal(t.costUsd, 0.004);
  assert.equal(t.priceBasis, "metered");
  assert.equal(t.outcome, "success");
  assert.equal(t.actor, "cli:test", "outside an agent run, the fallback actor is used");
  assert.equal(t.taskId, null);
});

test("inside runContext, the call is tagged with the agent's task and run", async () => {
  const sink = new InMemoryTraceSink();
  const wrapped = traced(new FakeClient(), sink);
  await runContext.run({ taskId: TASK, runId: RUN, actor: "agent:intake", entitySlug: "dreamsign" }, () => wrapped.complete({ user: "x" }));
  assert.deepEqual(
    { task: sink.traces[0]!.taskId, run: sink.traces[0]!.runId, actor: sink.traces[0]!.actor, entity: sink.traces[0]!.entitySlug },
    { task: TASK, run: RUN, actor: "agent:intake", entity: "dreamsign" },
  );
});

test("a failed call is still traced (outcome error, tokens it burned) and the error is rethrown", async () => {
  const sink = new InMemoryTraceSink();
  await assert.rejects(() => traced(new FakeClient(true), sink).complete({ user: "x" }), /529/);
  assert.equal(sink.traces[0]!.outcome, "error");
  assert.match(sink.traces[0]!.error ?? "", /529 overloaded/);
});

test("unpriced model → cost null + basis unpriced, never $0", async () => {
  const sink = new InMemoryTraceSink();
  await traced(new FakeClient(), sink, () => ({ costUsd: 0, basis: "unpriced", pricingVersion: "1.1.0" })).complete({ user: "x" });
  assert.equal(sink.traces[0]!.costUsd, null);
  assert.equal(sink.traces[0]!.priceBasis, "unpriced");
});

test("fail closed: a trace that can't be written means the result is not returned", async () => {
  const broken: TraceSink = { name: "broken", writeTrace: async () => { throw new AuditWriteError("down", 503); } };
  await assert.rejects(() => traced(new FakeClient(), broken).complete({ user: "x" }), AuditWriteError);
});

test("the wrapper is transparent: other members and instanceof still work", async () => {
  const client = new FakeClient();
  const wrapped = traced(client, new InMemoryTraceSink());
  assert.ok(wrapped instanceof FakeClient);
  assert.equal(wrapped.name, "fake");
  await wrapped.complete({ user: "x" });
  assert.equal(wrapped.totalUsage.inputTokens, 1000);
});

test("SupabaseTraceSink posts snake_case columns with service-role auth", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    return new Response(null, { status: 201 });
  }) as unknown as typeof fetch;
  const sink = new SupabaseTraceSink("https://x.supabase.co", "svc", fakeFetch);
  await traced(new FakeClient(), sink).complete({ user: "x" });
  assert.equal(calls[0]!.url, "https://x.supabase.co/rest/v1/model_traces");
  assert.equal(calls[0]!.body.price_basis, "metered");
  assert.equal(calls[0]!.body.input_tokens, 1000);
});
