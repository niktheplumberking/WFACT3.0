/**
 * The agent lifecycle contract — Continuation Build Plan Stage 2, Blueprint §3:
 *
 *   "Agent lifecycle: spawn on demand inside a runtime, execute a bounded task, report a structured
 *    result, terminate. No standing agent processes."
 *   "Task execution: every unit of work is a typed task object with an owner, a deadline, and a
 *    retry budget, not a free-form prompt."
 *
 * An Agent is deliberately small: parse its own input (a task either meets its schema or it doesn't),
 * execute once per attempt, and optionally say whether a completed output still needs a human. The
 * runtime (runAgent.ts) owns everything around that — registry gating, deadlines, bounded retry,
 * escalation, and the audit trail — so no agent re-implements any of it.
 */
import type { AuditContext } from "@wfact/audit";

/** Blueprint §3's typed task. `role` is the owner; it must match a registered agent role. */
export interface AgentTask<I = unknown> {
  /** UUID. Ties every audit row, checkpoint and trace for this unit of work together. */
  taskId: string;
  role: string;
  /** Raw input — the agent's own `parseInput` decides whether it meets the schema. */
  input: I;
  entitySlug?: string | null;
  /** ISO-8601. A task already past its deadline is rejected, not started. */
  deadline?: string | null;
  /** Total attempts allowed (1 = no retry). Overrides the agent's own default. */
  retryBudget?: number;
}

/** What an agent sees while executing one attempt. Nothing here persists after the run. */
export interface AgentRunContext {
  taskId: string;
  runId: string;
  attempt: number;
  entitySlug: string | null;
  /**
   * The run's audit context (same task_id/run_id), so an agent's own inner audit rows — e.g. the
   * verification loop's `verification.decision` — land on the same task as the lifecycle rows.
   */
  audit: AuditContext | null;
}

export interface Agent<I, O> {
  /** Must match a role in the AgentRegistry the task is run against. */
  readonly role: string;
  /** Default retry policy for this role; a task's `retryBudget` overrides `maxAttempts`. */
  readonly retry?: { maxAttempts: number; baseDelayMs: number };
  /** Validate raw task input. Throw `AgentInputError` (or anything) to reject the task. */
  parseInput(raw: unknown): I;
  /** One attempt. Throwing counts as a failed attempt; the runtime retries within budget. */
  execute(input: I, ctx: AgentRunContext): Promise<O>;
  /**
   * A completed output can still need a human (e.g. the front-end loop hit its round cap). Return a
   * reason to mark the run escalated, or null. Not retried — the agent already decided.
   */
  escalationReason?(output: O): string | null;
  /** Small, audit-safe summary of the output. Never the full output (pages, memory files). */
  summarize?(output: O): Record<string, unknown>;
}

export type AgentRunStatus = "completed" | "escalated" | "rejected";

/** The structured result every run reports — the "report" step of the lifecycle. */
export interface AgentRun<O> {
  taskId: string;
  runId: string;
  role: string;
  status: AgentRunStatus;
  /** Present when execution produced one (completed, or escalated by `escalationReason`). */
  output: O | null;
  attempts: number;
  reason: string | null;
  startedAt: string;
  finishedAt: string;
}

export class AgentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentInputError";
  }
}
