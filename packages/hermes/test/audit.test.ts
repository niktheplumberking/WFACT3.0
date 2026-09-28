import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { InMemoryAuditSink, AuditWriteError, type AuditSink } from "@wfact/audit";
import { ToolRegistry, ToolNotAllowlistedError, ToolInputValidationError } from "../src/tools/schema.js";

const RUN_ID = "11111111-2222-4333-8444-555555555555";

const echoTool = {
  name: "test.echo",
  description: "Echoes a validated string back.",
  inputSchema: z.object({ value: z.string().min(1) }),
  outputSchema: z.object({ value: z.string() }),
  handler: async ({ value }: { value: string }) => ({ value }),
};

function auditedRegistry(sink: AuditSink) {
  const registry = new ToolRegistry({ audit: { sink, actor: "hermes-lite", runId: RUN_ID } });
  registry.register(echoTool);
  return registry;
}

test("a successful tool call writes one success row, with output logged by size only", async () => {
  const sink = new InMemoryAuditSink();
  await auditedRegistry(sink).invoke("test.echo", { value: "hello" });
  assert.equal(sink.events.length, 1);
  const [row] = sink.events;
  assert.equal(row!.action, "tool.invoke");
  assert.equal(row!.outcome, "success");
  assert.equal(row!.runId, RUN_ID);
  assert.equal(row!.payload?.tool, "test.echo");
  assert.equal(row!.payload?.outputBytes, JSON.stringify({ value: "hello" }).length);
  assert.equal("output" in (row!.payload ?? {}), false, "tool output content never goes into the trail");
});

test("a non-allowlisted call is refused AND audited as rejected — the attempt is on record", async () => {
  const sink = new InMemoryAuditSink();
  await assert.rejects(() => auditedRegistry(sink).invoke("shell.exec", { cmd: "rm -rf /" }), ToolNotAllowlistedError);
  assert.equal(sink.events.length, 1);
  assert.equal(sink.events[0]!.outcome, "rejected");
  assert.deepEqual(sink.events[0]!.payload?.input, { cmd: "rm -rf /" });
  assert.match(String(sink.events[0]!.payload?.error), /ToolNotAllowlistedError/);
});

test("schema-invalid input is audited as rejected", async () => {
  const sink = new InMemoryAuditSink();
  await assert.rejects(() => auditedRegistry(sink).invoke("test.echo", { value: "" }), ToolInputValidationError);
  assert.equal(sink.events[0]!.outcome, "rejected");
});

test("a handler that throws is audited as failure", async () => {
  const sink = new InMemoryAuditSink();
  const registry = new ToolRegistry({ audit: { sink, actor: "hermes-lite" } });
  registry.register({
    ...echoTool,
    handler: async () => {
      throw new Error("disk on fire");
    },
  });
  await assert.rejects(() => registry.invoke("test.echo", { value: "x" }), /disk on fire/);
  assert.equal(sink.events[0]!.outcome, "failure");
});

test("fail closed: if the audit write fails, the tool result is not handed back", async () => {
  const brokenSink: AuditSink = {
    name: "broken",
    write: async () => {
      throw new AuditWriteError("audit_log write rejected (HTTP 500)", 500);
    },
  };
  await assert.rejects(() => auditedRegistry(brokenSink).invoke("test.echo", { value: "x" }), AuditWriteError);
});

test("oversized input is truncated in the audit row, not dumped whole", async () => {
  const sink = new InMemoryAuditSink();
  await assert.rejects(() => auditedRegistry(sink).invoke("nope", { blob: "x".repeat(10_000) }));
  const input = sink.events[0]!.payload?.input;
  assert.equal(typeof input, "string");
  assert.ok((input as string).length < 2100);
  assert.match(input as string, /truncated/);
});

test("no audit context configured → registry behaves exactly as before", async () => {
  const registry = new ToolRegistry();
  registry.register(echoTool);
  assert.deepEqual(await registry.invoke("test.echo", { value: "hi" }), { value: "hi" });
});
