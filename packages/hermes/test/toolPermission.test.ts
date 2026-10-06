/**
 * Step 6: Hermes-lite's tool calls also go through a permission check injected by the composition root (the
 * jobs runner passes the controller's PermissionGate from @wfact/agent-runtime). Here the check is a stand-in.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { InMemoryAuditSink, AuditWriteError } from "@wfact/audit";
import { ToolRegistry, ToolNotPermittedError, ToolNotAllowlistedError } from "../src/tools/schema.js";

function registry(authorize: (name: string) => Promise<void>, sink = new InMemoryAuditSink()) {
  const r = new ToolRegistry({ audit: { sink, actor: "hermes-lite" }, authorize });
  let ran = 0;
  r.register({
    name: "memory.readContext",
    description: "test",
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    handler: async () => {
      ran += 1;
      return { ok: true };
    },
  });
  return { r, sink, ran: () => ran };
}

test("a permitted tool runs; the check sees the tool name", async () => {
  const asked: string[] = [];
  const { r, ran } = registry(async (n) => void asked.push(n));
  assert.deepEqual(await r.invoke("memory.readContext", {}), { ok: true });
  assert.deepEqual(asked, ["memory.readContext"]);
  assert.equal(ran(), 1);
});

test("a refused tool never runs and is recorded as a rejected tool.invoke", async () => {
  const { r, sink, ran } = registry(async () => {
    throw new Error("permission denied for role \"hermes-lite\": tool:memory.readContext");
  });
  await assert.rejects(() => r.invoke("memory.readContext", {}), ToolNotPermittedError);
  assert.equal(ran(), 0);
  assert.equal(sink.events[0]!.outcome, "rejected");
  assert.match(String(sink.events[0]!.payload?.error), /ToolNotPermittedError/);
});

test("the allowlist is still checked first; an audit failure inside the check surfaces as itself (fail closed)", async () => {
  const { r } = registry(async () => {
    throw new AuditWriteError("audit down", 503);
  });
  await assert.rejects(() => r.invoke("shell.exec", {}), ToolNotAllowlistedError);
  await assert.rejects(() => r.invoke("memory.readContext", {}), AuditWriteError);
});
