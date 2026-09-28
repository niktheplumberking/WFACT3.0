/**
 * Append-only audit writer — Continuation Build Plan Stage 1, Blueprint §3/§12 ("append-only log of
 * every action, every approval, every model decision, tied to the task ID"). Writes rows to
 * `public.audit_log` (packages/db/migrations/0006_audit_log.sql), which refuses UPDATE/DELETE/TRUNCATE
 * by trigger — this package has no update or delete path either, not even an unused one.
 *
 * Zero runtime dependencies on purpose: it talks to Supabase's REST endpoint with Node's built-in
 * `fetch`, so `packages/hermes` and `packages/verification` can link it (`file:../audit`) without
 * dragging a second copy of supabase-js into their dependency trees.
 *
 * Fail closed: a sink that can't write throws `AuditWriteError`; callers decide whether the action
 * itself should stop. Hermes-lite and the verification loop both treat an audit failure as fatal
 * for the action being audited — an unaudited agent action is exactly what Blueprint §16K rules out.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type AuditOutcome = "success" | "failure" | "rejected" | "info";

export interface AuditEvent {
  /** Who acted: an agent/controller/human identifier, e.g. "hermes-lite", "verification-loop". */
  actor: string;
  /** Dotted, lowercase namespace, e.g. "tool.invoke", "verification.decision". */
  action: string;
  outcome: AuditOutcome;
  /** The unit of work (Blueprint §3's typed task), when one exists. */
  taskId?: string | null;
  /** Correlates every row written by one process invocation / workflow run. */
  runId?: string | null;
  entitySlug?: string | null;
  payload?: Record<string, unknown>;
}

export interface AuditSink {
  readonly name: string;
  write(event: AuditEvent): Promise<void>;
}

export class AuditValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditValidationError";
  }
}

export class AuditWriteError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
    this.name = "AuditWriteError";
  }
}

// Mirrors the table's own CHECK constraints so a malformed row fails locally, before a network call.
const ACTION_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OUTCOMES: readonly AuditOutcome[] = ["success", "failure", "rejected", "info"];

export function validateAuditEvent(event: AuditEvent): void {
  if (!event.actor || event.actor.length > 200) {
    throw new AuditValidationError(`actor must be 1-200 characters, got ${JSON.stringify(event.actor)}`);
  }
  if (!ACTION_PATTERN.test(event.action)) {
    throw new AuditValidationError(`action must be a dotted lowercase name, got ${JSON.stringify(event.action)}`);
  }
  if (!OUTCOMES.includes(event.outcome)) {
    throw new AuditValidationError(`outcome must be one of ${OUTCOMES.join("/")}, got ${JSON.stringify(event.outcome)}`);
  }
  for (const key of ["taskId", "runId"] as const) {
    const value = event[key];
    if (value != null && !UUID_PATTERN.test(value)) {
      throw new AuditValidationError(`${key} must be a UUID, got ${JSON.stringify(value)}`);
    }
  }
}

/** Row shape as the `audit_log` table names its columns. */
export function toAuditRow(event: AuditEvent): Record<string, unknown> {
  return {
    actor: event.actor,
    action: event.action,
    outcome: event.outcome,
    task_id: event.taskId ?? null,
    run_id: event.runId ?? null,
    entity_slug: event.entitySlug ?? null,
    payload: event.payload ?? {},
  };
}

/**
 * Writes through Supabase's REST API with the service role. The service role is required, not
 * preferred: RLS gives anon/authenticated no insert policy on `audit_log`, by design, so the
 * Cockpit (anon key in the browser) can read the trail but never forge it.
 */
export class SupabaseAuditSink implements AuditSink {
  readonly name = "supabase";
  private readonly endpoint: string;

  constructor(
    url: string,
    private readonly serviceRoleKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.endpoint = `${url.replace(/\/+$/, "")}/rest/v1/audit_log`;
  }

  async write(event: AuditEvent): Promise<void> {
    validateAuditEvent(event);
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(toAuditRow(event)),
      });
    } catch (err) {
      throw new AuditWriteError(`audit_log write failed before a response: ${String(err)}`, null);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AuditWriteError(
        `audit_log write rejected (HTTP ${response.status}): ${body.slice(0, 300)}`,
        response.status,
      );
    }
  }
}

/** A row read back out of audit_log. */
export interface AuditRecord extends AuditEvent {
  occurredAt: string;
}

/**
 * Read side, added in Stage 3: a workflow's checkpoints ARE audit_log rows, so recovering from a
 * crash means reading them back. Read-only by construction — there is still no update/delete path.
 */
export interface AuditReader {
  /** Every row for one run, oldest first. */
  listByRun(runId: string): Promise<AuditRecord[]>;
}

/** Deterministic sink (and reader) for tests — no network, fully inspectable. */
export class InMemoryAuditSink implements AuditSink, AuditReader {
  readonly name = "memory";
  public readonly events: AuditEvent[] = [];
  private readonly timestamps: string[] = [];

  async write(event: AuditEvent): Promise<void> {
    validateAuditEvent(event);
    this.events.push(structuredClone(event));
    this.timestamps.push(new Date().toISOString());
  }

  async listByRun(runId: string): Promise<AuditRecord[]> {
    return this.events
      .map((e, i) => ({ ...structuredClone(e), occurredAt: this.timestamps[i]! }))
      .filter((e) => e.runId === runId);
  }
}

export class SupabaseAuditReader implements AuditReader {
  private readonly endpoint: string;

  constructor(
    url: string,
    private readonly serviceRoleKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.endpoint = `${url.replace(/\/+$/, "")}/rest/v1/audit_log`;
  }

  async listByRun(runId: string): Promise<AuditRecord[]> {
    if (!UUID_PATTERN.test(runId)) throw new AuditValidationError(`runId must be a UUID, got ${JSON.stringify(runId)}`);
    const query = `?run_id=eq.${runId}&order=occurred_at.asc&select=*`;
    const response = await this.fetchImpl(this.endpoint + query, {
      headers: { apikey: this.serviceRoleKey, Authorization: `Bearer ${this.serviceRoleKey}` },
    });
    if (!response.ok) {
      throw new AuditWriteError(`audit_log read failed (HTTP ${response.status})`, response.status);
    }
    type Row = {
      occurred_at: string; actor: string; action: string; outcome: AuditOutcome;
      task_id: string | null; run_id: string | null; entity_slug: string | null; payload: Record<string, unknown>;
    };
    return ((await response.json()) as Row[]).map((r) => ({
      occurredAt: r.occurred_at,
      actor: r.actor,
      action: r.action,
      outcome: r.outcome,
      taskId: r.task_id,
      runId: r.run_id,
      entitySlug: r.entity_slug,
      payload: r.payload,
    }));
  }
}

/** Same env contract (and same refusal to use the anon key) as `auditSinkFromEnv`. */
export function auditReaderFromEnv(env: NodeJS.ProcessEnv = process.env): {
  reader: AuditReader | null;
  reason: string | null;
} {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { reader: null, reason: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set — cannot read audit_log." };
  }
  return { reader: new SupabaseAuditReader(url, key), reason: null };
}

/**
 * Build a SupabaseAuditSink from env, or return null with a clear reason. Never falls back to the
 * anon key (RLS would reject every write anyway) and never to a silent no-op sink pretending to
 * audit — same refuse-to-fabricate pattern as `stateReaderFromEnv` in packages/hermes.
 */
export function auditSinkFromEnv(env: NodeJS.ProcessEnv = process.env): {
  sink: AuditSink | null;
  reason: string | null;
} {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return {
      sink: null,
      reason:
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set — audit_log rows will NOT be " +
        "written for this run. (The anon key can't write audit_log by design; see migration 0006.)",
    };
  }
  return { sink: new SupabaseAuditSink(url, key), reason: null };
}

/** Everything a caller needs to attribute its audit rows. */
export interface AuditContext {
  sink: AuditSink;
  actor: string;
  runId?: string | null;
  taskId?: string | null;
  entitySlug?: string | null;
}

/** Write one event under a context's attribution. */
export async function recordAudit(
  ctx: AuditContext,
  event: Pick<AuditEvent, "action" | "outcome" | "payload"> & { entitySlug?: string | null },
): Promise<void> {
  await ctx.sink.write({
    actor: ctx.actor,
    runId: ctx.runId ?? null,
    taskId: ctx.taskId ?? null,
    entitySlug: event.entitySlug ?? ctx.entitySlug ?? null,
    action: event.action,
    outcome: event.outcome,
    payload: event.payload,
  });
}

// =============================================================================================
// Stage 5 — observability seed: per-model-call traces (public.model_traces, migration 0008).
// Lives beside the audit writer because it shares its transport, its fail-closed rule and its
// zero-dependency constraint; the TABLE is separate (Blueprint §2: observability reports, it doesn't
// decide — and cost data is owner-only, unlike the audit trail).
// =============================================================================================

/**
 * The run context an agent executes under. `runAgent` (packages/agent-runtime) enters it around
 * every attempt, so a traced model client can tag each call with the task that made it — without
 * threading ids through every model interface. Calls made outside any agent run (e.g. Hermes-lite's
 * status answer) fall back to the tracer's own actor and carry no task_id.
 */
export interface RunContext {
  taskId: string | null;
  runId: string | null;
  actor: string;
  entitySlug: string | null;
}
export const runContext = new AsyncLocalStorage<RunContext>();

export interface TraceEvent {
  runId: string | null;
  taskId: string | null;
  actor: string;
  provider: "anthropic" | "agent37";
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** null ⇔ basis "unpriced" (enforced by a table constraint too). */
  costUsd: number | null;
  priceBasis: "metered" | "unpriced";
  pricingVersion: string | null;
  latencyMs: number;
  outcome: "success" | "error";
  error: string | null;
  entitySlug: string | null;
}

export interface TraceSink {
  readonly name: string;
  writeTrace(event: TraceEvent): Promise<void>;
}

export class SupabaseTraceSink implements TraceSink {
  readonly name = "supabase";
  private readonly endpoint: string;
  constructor(url: string, private readonly serviceRoleKey: string, private readonly fetchImpl: typeof fetch = fetch) {
    this.endpoint = `${url.replace(/\/+$/, "")}/rest/v1/model_traces`;
  }
  async writeTrace(e: TraceEvent): Promise<void> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          run_id: e.runId, task_id: e.taskId, actor: e.actor, provider: e.provider, model: e.model,
          input_tokens: e.inputTokens, output_tokens: e.outputTokens, cost_usd: e.costUsd,
          price_basis: e.priceBasis, pricing_version: e.pricingVersion, latency_ms: e.latencyMs,
          outcome: e.outcome, error: e.error, entity_slug: e.entitySlug,
        }),
      });
    } catch (err) {
      throw new AuditWriteError(`model_traces write failed before a response: ${String(err)}`, null);
    }
    if (!res.ok) {
      throw new AuditWriteError(`model_traces write rejected (HTTP ${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`, res.status);
    }
  }
}

export class InMemoryTraceSink implements TraceSink {
  readonly name = "memory";
  readonly traces: TraceEvent[] = [];
  async writeTrace(e: TraceEvent): Promise<void> {
    this.traces.push(structuredClone(e));
  }
}

export function traceSinkFromEnv(env: NodeJS.ProcessEnv = process.env): { sink: TraceSink | null; reason: string | null } {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { sink: null, reason: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set — model calls will NOT be traced." };
  }
  return { sink: new SupabaseTraceSink(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY), reason: null };
}

export interface TraceOptions {
  sink: TraceSink;
  /** Which async method to trace, e.g. "complete" or "completeJson". */
  method: string;
  provider: TraceEvent["provider"];
  model: string;
  /** Reads the client's cumulative, provider-reported token counters. */
  usage: () => { inputTokens: number; outputTokens: number };
  /** Price lookup — callers pass Hermes-lite's `costForModel` (the one price table). */
  cost: (model: string, usage: { inputTokens: number; outputTokens: number }) => {
    costUsd: number | null;
    basis: "metered" | "unpriced";
    pricingVersion: string | null;
  };
  /** Actor for calls made outside any agent run. */
  fallbackActor: string;
}

/**
 * Wrap a model client so every call to `opts.method` writes exactly one model_traces row: the
 * token DELTA of that call (provider-reported counters, read before and after), cost from the price
 * table, wall-clock latency, success/error — tagged with the current runContext's task.
 *
 * Fail closed, like the audit writer: if the trace can't be written, the call's result is not
 * returned (an untraced paid call is what Stage 5 exists to prevent). Sequential use only: the delta
 * is read from shared counters, so concurrent calls on ONE wrapped client would blur attribution —
 * every pipeline in this repo calls each client sequentially.
 */
export function traceModelCalls<T extends object>(client: T, opts: TraceOptions): T {
  const original = (client as Record<string, unknown>)[opts.method];
  if (typeof original !== "function") throw new Error(`traceModelCalls: client has no method "${opts.method}"`);
  // Snapshot the numbers: clients expose their live counter object, so holding the reference would
  // make before === after and every delta 0 (caught by test/trace.test.ts before it shipped).
  const readUsage = () => {
    const u = opts.usage();
    return { inputTokens: u.inputTokens, outputTokens: u.outputTokens };
  };
  const traced = async (...args: unknown[]) => {
    const before = readUsage();
    const started = Date.now();
    const ctx = runContext.getStore();
    let result: unknown;
    let error: unknown = null;
    try {
      result = await (original as (...a: unknown[]) => Promise<unknown>).apply(client, args);
    } catch (err) {
      error = err;
    }
    const after = readUsage();
    const usage = {
      inputTokens: Math.max(0, after.inputTokens - before.inputTokens),
      outputTokens: Math.max(0, after.outputTokens - before.outputTokens),
    };
    const price = opts.cost(opts.model, usage);
    await opts.sink.writeTrace({
      runId: ctx?.runId ?? null,
      taskId: ctx?.taskId ?? null,
      actor: ctx?.actor ?? opts.fallbackActor,
      provider: opts.provider,
      model: opts.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: price.basis === "metered" ? price.costUsd : null,
      priceBasis: price.basis,
      pricingVersion: price.pricingVersion,
      latencyMs: Date.now() - started,
      outcome: error ? "error" : "success",
      error: error ? (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 500) : null,
      entitySlug: ctx?.entitySlug ?? null,
    });
    if (error) throw error;
    return result;
  };
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === opts.method) return traced;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
