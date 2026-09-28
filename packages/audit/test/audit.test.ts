import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AuditValidationError,
  AuditWriteError,
  InMemoryAuditSink,
  SupabaseAuditSink,
  auditSinkFromEnv,
  recordAudit,
  toAuditRow,
  validateAuditEvent,
} from "../src/index.js";

const RUN_ID = "11111111-2222-4333-8444-555555555555";

test("a well-formed event validates and maps to the table's column names", () => {
  const event = {
    actor: "hermes-lite",
    action: "tool.invoke",
    outcome: "success" as const,
    runId: RUN_ID,
    entitySlug: "dreamsign",
    payload: { tool: "memory.readContext" },
  };
  validateAuditEvent(event);
  assert.deepEqual(toAuditRow(event), {
    actor: "hermes-lite",
    action: "tool.invoke",
    outcome: "success",
    task_id: null,
    run_id: RUN_ID,
    entity_slug: "dreamsign",
    payload: { tool: "memory.readContext" },
  });
});

test("malformed events are refused locally, mirroring the table's CHECK constraints", () => {
  const base = { actor: "x", action: "tool.invoke", outcome: "info" as const };
  assert.throws(() => validateAuditEvent({ ...base, actor: "" }), AuditValidationError);
  assert.throws(() => validateAuditEvent({ ...base, action: "Tool Invoke!" }), AuditValidationError);
  // @ts-expect-error deliberately invalid outcome
  assert.throws(() => validateAuditEvent({ ...base, outcome: "maybe" }), AuditValidationError);
  assert.throws(() => validateAuditEvent({ ...base, taskId: "not-a-uuid" }), AuditValidationError);
});

test("SupabaseAuditSink POSTs one row with service-role auth and never asks for the row back", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(null, { status: 201 });
  }) as unknown as typeof fetch;

  const sink = new SupabaseAuditSink("https://example.supabase.co/", "service-key", fakeFetch);
  await sink.write({ actor: "verification-loop", action: "verification.decision", outcome: "failure" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "https://example.supabase.co/rest/v1/audit_log");
  const headers = calls[0]!.init.headers as Record<string, string>;
  assert.equal(headers.apikey, "service-key");
  assert.equal(headers.Authorization, "Bearer service-key");
  assert.equal(headers.Prefer, "return=minimal");
  assert.equal(JSON.parse(calls[0]!.init.body as string).action, "verification.decision");
});

test("a rejected write fails closed with AuditWriteError, not a silent drop", async () => {
  const fakeFetch = (async () =>
    new Response('{"message":"new row violates row-level security policy"}', { status: 401 })) as unknown as typeof fetch;
  const sink = new SupabaseAuditSink("https://example.supabase.co", "wrong-key", fakeFetch);
  await assert.rejects(
    () => sink.write({ actor: "a", action: "tool.invoke", outcome: "success" }),
    (err: unknown) => err instanceof AuditWriteError && err.status === 401,
  );
});

test("a network failure also fails closed", async () => {
  const fakeFetch = (async () => {
    throw new Error("ECONNREFUSED");
  }) as unknown as typeof fetch;
  const sink = new SupabaseAuditSink("https://example.supabase.co", "k", fakeFetch);
  await assert.rejects(() => sink.write({ actor: "a", action: "tool.invoke", outcome: "success" }), AuditWriteError);
});

test("auditSinkFromEnv refuses the anon key and explains why, instead of faking a sink", () => {
  const onlyAnon = auditSinkFromEnv({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" });
  assert.equal(onlyAnon.sink, null);
  assert.match(onlyAnon.reason ?? "", /SUPABASE_SERVICE_ROLE_KEY/);

  const configured = auditSinkFromEnv({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc" });
  assert.ok(configured.sink instanceof SupabaseAuditSink);
});

test("recordAudit applies the context's attribution to every row", async () => {
  const sink = new InMemoryAuditSink();
  await recordAudit(
    { sink, actor: "hermes-lite", runId: RUN_ID, entitySlug: "dreamsign" },
    { action: "hermes.answer", outcome: "success", payload: { sources: 2 } },
  );
  assert.deepEqual(sink.events, [
    {
      actor: "hermes-lite",
      runId: RUN_ID,
      taskId: null,
      entitySlug: "dreamsign",
      action: "hermes.answer",
      outcome: "success",
      payload: { sources: 2 },
    },
  ]);
});
