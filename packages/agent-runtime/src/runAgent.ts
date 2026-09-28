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
 */
import { randomUUID } from "node:crypto";
import { recordAudit, AuditWriteError, type AuditContext, type AuditSink } from "@wfact/audit";
import { withBoundedRetry, EscalationError } from "@wfact/hermes-lite/escalation";
import type { Agent, AgentRun, AgentRunStatus, AgentTask } from "./agent.js";
import type { AgentRegistry } from "./registry.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_RETRY = { maxAttempts: 1, baseDelayMs: 1000 };

export interface RunAgentOptions {
  registry: AgentRegistry;
  /** When set, every lifecycle step writes an audit_log row under this task's id. */
  audit?: { sink: AuditSink } | null;
  /** Correlates this run with sibling runs (e.g. one workflow). Generated if omitted. */
  runId?: string;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
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

  // The task id must be a real UUID before anything else — it's the key every audit row hangs off.
  const taskIdValid = UUID_PATTERN.test(task.taskId);
  const audit: AuditContext | null =
    opts.audit && taskIdValid
      ? { sink: opts.audit.sink, actor: `agent:${agent.role}`, runId, taskId: task.taskId, entitySlug }
      : null;

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
        },
      });
    }
    // Terminate: nothing from this run is retained anywhere but the returned report + audit trail.
    return { taskId: task.taskId, runId, role: agent.role, status, output, attempts, reason, startedAt, finishedAt: now().toISOString() };
  };

  // ---- validate: task shape, role, registry, deadline, retry budget, input schema — before spawning ----
  if (!taskIdValid) {
    return finish("rejected", null, 0, `taskId must be a UUID, got ${JSON.stringify(task.taskId)}`);
  }
  if (task.role !== agent.role) {
    return finish("rejected", null, 0, `task is addressed to role "${task.role}", not "${agent.role}"`);
  }
  if (!opts.registry.has(agent.role)) {
    return finish("rejected", null, 0, `agent role "${agent.role}" is not registered`);
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

  // ---- spawn ----
  if (audit) {
    await recordAudit(audit, {
      action: "agent.spawn",
      outcome: "info",
      payload: { role: agent.role, maxAttempts, deadline: task.deadline ?? null },
    });
  }

  // ---- execute, bounded ----
  let attempts = 0;
  let output: O;
  try {
    output = await withBoundedRetry(
      (attempt) => {
        attempts = attempt;
        return agent.execute(input, { taskId: task.taskId, runId, attempt, entitySlug, audit });
      },
      { maxAttempts, baseDelayMs: agent.retry?.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs, sleep: opts.sleep },
    );
  } catch (err) {
    // An agent's own audit write failing is not an agent outcome — fail closed, don't report a run.
    if (err instanceof EscalationError && err.lastError instanceof AuditWriteError) throw err.lastError;
    const reason = err instanceof EscalationError ? err.message : `unexpected: ${String(err)}`;
    return finish("escalated", null, attempts, reason);
  }

  // ---- report ----
  const escalation = agent.escalationReason?.(output) ?? null;
  return finish(escalation ? "escalated" : "completed", output, attempts, escalation);
}
