/**
 * The structured run record the Documentation agent reads: a workflow run's audit_log rows and model_traces rows,
 * with their row ids (so an entry can link to the exact rows it was built from). Read-only by construction.
 *
 * The Supabase reader uses the service role over REST (like @wfact/audit's reader) because audit_log and
 * model_traces have no insert/select path for anon by design; every read is first authorized by the agent's
 * PermissionGate (db:select on the table, for the run's bound entity), see agent.ts.
 */
import type { AuditEvent, AuditOutcome, TraceEvent } from "@wfact/audit";

export interface RunAuditRow {
  id: string;
  occurredAt: string;
  actor: string;
  action: string;
  outcome: AuditOutcome;
  taskId: string | null;
  runId: string | null;
  entitySlug: string | null;
  payload: Record<string, unknown>;
}

export interface RunTraceRow {
  id: string;
  occurredAt: string;
  taskId: string | null;
  actor: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  priceBasis: "metered" | "unpriced";
  outcome: "success" | "error";
  entitySlug: string | null;
}

export interface RunRecordReader {
  /** Every audit_log row of one run, oldest first. */
  auditRows(runId: string): Promise<RunAuditRow[]>;
  /** Every model_traces row of one run, oldest first. */
  traces(runId: string): Promise<RunTraceRow[]>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class RunRecordReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunRecordReadError";
  }
}

export class SupabaseRunRecordReader implements RunRecordReader {
  private readonly rest: string;

  constructor(url: string, private readonly serviceRoleKey: string, private readonly fetchImpl: typeof fetch = fetch) {
    this.rest = `${url.replace(/\/+$/, "")}/rest/v1`;
  }

  private async get<T>(table: string, query: string): Promise<T[]> {
    const res = await this.fetchImpl(`${this.rest}/${table}?${query}`, {
      headers: { apikey: this.serviceRoleKey, Authorization: `Bearer ${this.serviceRoleKey}` },
    });
    if (!res.ok) throw new RunRecordReadError(`${table} read failed (HTTP ${res.status})`);
    return (await res.json()) as T[];
  }

  async auditRows(runId: string): Promise<RunAuditRow[]> {
    if (!UUID_RE.test(runId)) throw new RunRecordReadError(`runId must be a UUID, got ${JSON.stringify(runId)}`);
    type Row = { id: string; occurred_at: string; actor: string; action: string; outcome: AuditOutcome; task_id: string | null; run_id: string | null; entity_slug: string | null; payload: Record<string, unknown> | null };
    const rows = await this.get<Row>("audit_log", `run_id=eq.${runId}&order=occurred_at.asc,id.asc&select=id,occurred_at,actor,action,outcome,task_id,run_id,entity_slug,payload`);
    return rows.map((r) => ({
      id: r.id, occurredAt: r.occurred_at, actor: r.actor, action: r.action, outcome: r.outcome,
      taskId: r.task_id, runId: r.run_id, entitySlug: r.entity_slug, payload: r.payload ?? {},
    }));
  }

  async traces(runId: string): Promise<RunTraceRow[]> {
    if (!UUID_RE.test(runId)) throw new RunRecordReadError(`runId must be a UUID, got ${JSON.stringify(runId)}`);
    type Row = { id: string; occurred_at: string; task_id: string | null; actor: string; provider: string; model: string; input_tokens: number; output_tokens: number; cost_usd: number | string | null; price_basis: "metered" | "unpriced"; outcome: "success" | "error"; entity_slug: string | null };
    const rows = await this.get<Row>(
      "model_traces",
      `run_id=eq.${runId}&order=occurred_at.asc,id.asc&select=id,occurred_at,task_id,actor,provider,model,input_tokens,output_tokens,cost_usd,price_basis,outcome,entity_slug`,
    );
    return rows.map((r) => ({
      id: r.id, occurredAt: r.occurred_at, taskId: r.task_id, actor: r.actor, provider: r.provider, model: r.model,
      inputTokens: Number(r.input_tokens), outputTokens: Number(r.output_tokens),
      // PostgREST may return numeric(12,6) as a string; null stays null (unpriced, never $0).
      costUsd: r.cost_usd === null ? null : Number(r.cost_usd),
      priceBasis: r.price_basis, outcome: r.outcome, entitySlug: r.entity_slug,
    }));
  }
}

export function runRecordReaderFromEnv(env: NodeJS.ProcessEnv = process.env): { reader: RunRecordReader | null; reason: string | null } {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { reader: null, reason: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set — cannot read the run's audit trail." };
  }
  return { reader: new SupabaseRunRecordReader(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY), reason: null };
}

/** Deterministic row ids for in-memory rows (tests): a UUID built from the row's index. */
const idFor = (prefix: number, i: number) => `00000000-0000-4000-8${prefix}00-${String(i).padStart(12, "0")}`;

/**
 * Reads the in-memory sinks used by the workflow tests (InMemoryAuditSink, InMemoryTraceSink). Row ids are stable
 * per index; timestamps come from the sink (audit) or are synthesized in order (traces).
 */
export function inMemoryRunRecords(
  audit: { events: AuditEvent[]; listByRun(runId: string): Promise<(AuditEvent & { occurredAt: string })[]> },
  traces: { traces: TraceEvent[] } | null = null,
): RunRecordReader {
  return {
    async auditRows(runId) {
      // listByRun keeps the sink's order and filters by run, so the n-th listed row is the n-th event of this run.
      const indices = audit.events.map((e, i) => (e.runId === runId ? i : -1)).filter((i) => i >= 0);
      const listed = await audit.listByRun(runId);
      return listed.map((row, n) => ({
        id: idFor(0, indices[n] ?? n), occurredAt: row.occurredAt, actor: row.actor, action: row.action, outcome: row.outcome,
        taskId: row.taskId ?? null, runId: row.runId ?? null, entitySlug: row.entitySlug ?? null, payload: row.payload ?? {},
      }));
    },
    async traces(runId) {
      if (!traces) return [];
      const base = Date.now();
      return traces.traces
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t.runId === runId)
        .map(({ t, i }) => ({
          id: idFor(1, i), occurredAt: new Date(base + i).toISOString(), taskId: t.taskId, actor: t.actor, provider: t.provider,
          model: t.model, inputTokens: t.inputTokens, outputTokens: t.outputTokens, costUsd: t.costUsd, priceBasis: t.priceBasis,
          outcome: t.outcome, entitySlug: t.entitySlug,
        }));
    },
  };
}
