/**
 * The one executor every agent runs on — spawn → validate → execute (bounded retry) → report →
 * terminate (Blueprint §3's lifecycle). Retry/escalation is Hermes-lite's own `withBoundedRetry`,
 * imported, not re-implemented (Continuation Plan Stage 2, task 1).
 *
 * Never throws for an agent-level outcome: an unregistered role, bad input, a blown deadline, an
 * exhausted retry budget, or an agent that says "needs a human" all come back as a structured
 * `AgentRun` with a status and a reason — the caller routes on that, never on a caught exception.
 * The one thing that DOES throw is an audit write failure, because audit is fail-closed
 * (packages/audit): a run is never reported without its trail.
 *
 * Step 6 (permissions): every run gets its own PermissionGate built from the role's registered scope and
 * bound to the task's entity and client. The gate is the current gate for the whole attempt (guarded model
 * clients find it there), the agent sees it as `ctx.permissions`, and the audit sink handed to the agent is
 * gated too (an agent may only write audit rows its scope allows, attributed to its own entity). A task that
 * names a client folder belonging to another entity is rejected before spawn. A denial is never retried, and
 * a run with a denial is never reported "completed", even if the agent swallowed the error.
 */
import { randomUUID } from "node:crypto";
import { recordAudit, AuditWriteError, runContext, type AuditContext, type AuditSink } from "@wfact/audit";
import { withBoundedRetry, EscalationError } from "@wfact/hermes-lite/escalation";
import type { Agent, AgentRun, AgentRunStatus, AgentTask } from "./agent.js";
import type { AgentRegistry } from "./registry.js";
import {
  fileClientEntityResolver,
  PermissionDeniedError,
  PermissionGate,
  withPermissionGate,
  type ClientEntityResolver,
} from "./permissions.js";
import { INJECTION_PATTERNS_VERSION, scanForInjection } from "./injection.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;
const DEFAULT_RETRY = { maxAttempts: 1, baseDelayMs: 1000 };

export interface RunAgentOptions {
  registry: AgentRegistry;
  /** When set, every lifecycle step writes an audit_log row under this task's id. */
  audit?: { sink: AuditSink } | null;
  /** Correlates this run with sibling runs (e.g. one workflow). Generated if omitted. */
  runId?: string;
  /**
   * Step 6: which entity owns a client folder. Default: clients/<slug>/brief.json in this repo. A task whose
   * client belongs to another entity than the task's is rejected (agent.deny) before the agent spawns.
   */
  clientEntityOf?: ClientEntityResolver;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

/** The audit sink an agent writes through: each row must be an audit_log insert its scope allows, for its own entity. */
function gatedAuditSink(sink: AuditSink, gate: PermissionGate): AuditSink {
  return {
    name: `${sink.name}+gated`,
    async write(event) {
      await gate.authorize({ kind: "db", table: "audit_log", op: "insert", entitySlug: event.entitySlug ?? null });
      await sink.write(event);
    },
  };
}

export async function runAgent<I, O>(
  agent: Agent<I, O>,
  task: AgentTask<unknown>,
  opts: RunAgentOptions,
): Promise<AgentRun<O>> {
  const now = opts.now ?? (() => new Date());
  const runId = opts.runId ?? randomUUID();
  const startedAt = now().toISOString();
  const startMs = Date.now();
  const entitySlug = task.entitySlug ?? null;
  const clientSlug = task.clientSlug ?? null;

  // The task id must be a real UUID before anything else — it's the key every audit row hangs off.
  const taskIdValid = UUID_PATTERN.test(task.taskId);
  const audit: AuditContext | null =
    opts.audit && taskIdValid
      ? { sink: opts.audit.sink, actor: `agent:${agent.role}`, runId, taskId: task.taskId, entitySlug }
      : null;
  let gate: PermissionGate | null = null;
  let injectionSuspected: string[] = [];

  const finish = async (
    status: AgentRunStatus,
    output: O | null,
    attempts: number,
    reason: string | null,
  ): Promise<AgentRun<O>> => {
    if (audit) {
      await recordAudit(audit, {
        action: status === "completed" ? "agent.complete" : status === "escalated" ? "agent.escalate" : "agent.reject",
        outcome: status === "completed" ? "success" : status === "escalated" ? "failure" : "rejected",
        payload: {
          role: agent.role,
          attempts,
          reason,
          durationMs: Date.now() - startMs,
          ...(output !== null && agent.summarize ? { summary: agent.summarize(output) } : {}),
          ...(gate ? { permissions: gate.summary() } : {}),
        },
      });
    }
    // Terminate: nothing from this run is retained anywhere but the returned report + audit trail.
    return {
      taskId: task.taskId, runId, role: agent.role, status, output, attempts, reason, startedAt, finishedAt: now().toISOString(),
      ...(injectionSuspected.length ? { injectionSuspected } : {}),
    };
  };

  // ---- validate: task shape, role, registry, binding, deadline, retry budget, input schema — before spawning ----
  if (!taskIdValid) {
    return finish("rejected", null, 0, `taskId must be a UUID, got ${JSON.stringify(task.taskId)}`);
  }
  if (task.role !== agent.role) {
    return finish("rejected", null, 0, `task is addressed to role "${task.role}", not "${agent.role}"`);
  }
  if (!opts.registry.has(agent.role)) {
    return finish("rejected", null, 0, `agent role "${agent.role}" is not registered`);
  }
  if (clientSlug !== null && !SLUG_PATTERN.test(clientSlug)) {
    return finish("rejected", null, 0, `clientSlug must be a lowercase-hyphen slug, got ${JSON.stringify(clientSlug)}`);
  }
  const scope = opts.registry.get(agent.role).permissionScope;
  gate = new PermissionGate({ role: agent.role, scope, binding: { entitySlug, clientSlug }, audit });
  if (clientSlug !== null) {
    // Entity isolation in code (Step 6 task 3): the folder this run may touch must not belong to another entity.
    const ownerEntity = (opts.clientEntityOf ?? fileClientEntityResolver())(clientSlug);
    try {
      await gate.authorize({ kind: "client", clientSlug, ownerEntity });
    } catch (err) {
      if (err instanceof PermissionDeniedError) return finish("rejected", null, 0, err.message);
      throw err;
    }
  }
  if (task.deadline) {
    const deadline = Date.parse(task.deadline);
    if (Number.isNaN(deadline)) {
      return finish("rejected", null, 0, `deadline is not an ISO-8601 date: ${JSON.stringify(task.deadline)}`);
    }
    if (deadline <= now().getTime()) {
      return finish("rejected", null, 0, `deadline ${task.deadline} has already passed`);
    }
  }
  const maxAttempts = task.retryBudget ?? agent.retry?.maxAttempts ?? DEFAULT_RETRY.maxAttempts;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    return finish("rejected", null, 0, `retry budget must be an integer 1-10, got ${maxAttempts}`);
  }
  let input: I;
  try {
    input = agent.parseInput(task.input);
  } catch (err) {
    return finish("rejected", null, 0, `input failed the agent's schema: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ---- screen ingested client text (audit-only: the gate, not this scan, is what refuses an action) ----
  if (scope.scanInputForInjection) {
    const findings = scanForInjection(task.input);
    injectionSuspected = [...new Set(findings.map((f) => f.patternId))];
    if (findings.length > 0 && audit) {
      await recordAudit(audit, {
        action: "agent.injection_suspected",
        outcome: "info",
        payload: {
          role: agent.role,
          patternsVersion: INJECTION_PATTERNS_VERSION,
          patterns: injectionSuspected,
          findings: findings.slice(0, 10),
          handling: "treated as data: fenced in the prompt, schema-constrained output, every action gated by the role's scope",
        },
      });
    }
  }

  // ---- spawn ----
  if (audit) {
    await recordAudit(audit, {
      action: "agent.spawn",
      outcome: "info",
      payload: { role: agent.role, maxAttempts, deadline: task.deadline ?? null, binding: { entitySlug, clientSlug } },
    });
  }

  // ---- execute, bounded ----
  const runGate = gate;
  const agentAudit: AuditContext | null = audit ? { ...audit, sink: gatedAuditSink(audit.sink, runGate) } : null;
  let attempts = 0;
  let output: O;
  try {
    output = await withBoundedRetry(
      async (attempt) => {
        attempts = attempt;
        // A denial is final for the run: never re-execute an agent that already tried to step out of scope.
        const firstDenial = runGate.denials[0];
        if (firstDenial) throw new PermissionDeniedError(agent.role, firstDenial.capability, firstDenial.reason);
        // Stage 5: publish the task so traced model clients tag every call with it (runContext).
        return runContext.run({ taskId: task.taskId, runId, actor: `agent:${agent.role}`, entitySlug }, () =>
          withPermissionGate(runGate, () =>
            agent.execute(input, { taskId: task.taskId, runId, attempt, entitySlug, audit: agentAudit, permissions: runGate }),
          ),
        );
      },
      { maxAttempts, baseDelayMs: agent.retry?.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs, sleep: opts.sleep },
    );
  } catch (err) {
    // An agent's own audit write failing is not an agent outcome — fail closed, don't report a run.
    if (err instanceof EscalationError && err.lastError instanceof AuditWriteError) throw err.lastError;
    const firstDenial = runGate.denials[0];
    if (firstDenial) {
      return finish("escalated", null, attempts, new PermissionDeniedError(agent.role, firstDenial.capability, firstDenial.reason).message);
    }
    const reason = err instanceof EscalationError ? err.message : `unexpected: ${String(err)}`;
    return finish("escalated", null, attempts, reason);
  }

  // ---- report ----
  const swallowed = runGate.denials[0];
  if (swallowed) {
    // The agent caught a denial and carried on: its output is not trusted, and the run is not "completed".
    return finish("escalated", null, attempts, `${new PermissionDeniedError(agent.role, swallowed.capability, swallowed.reason).message} (the agent continued after the denial; output discarded)`);
  }
  const escalation = agent.escalationReason?.(output) ?? null;
  return finish(escalation ? "escalated" : "completed", output, attempts, escalation);
}
