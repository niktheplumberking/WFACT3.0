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

/** Deterministic sink for tests — no network, fully inspectable. */
export class InMemoryAuditSink implements AuditSink {
  readonly name = "memory";
  public readonly events: AuditEvent[] = [];

  async write(event: AuditEvent): Promise<void> {
    validateAuditEvent(event);
    this.events.push(structuredClone(event));
  }
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
