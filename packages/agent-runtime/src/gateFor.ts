/**
 * A gate for I/O an orchestrator performs ON BEHALF OF an agent role, after (or around) that role's run: the
 * workflow writing the builder's page and reading it back for QA, the planning pipeline storing the Planner's
 * plan, the verify job reading a page for the QA agent. Same scope, same binding rules, same `agent.deny` row
 * (actor `agent:<role>`, the role's task id) as a gate inside the run, so "what the builder may write" is
 * decided by the builder's scope no matter which process does the writing.
 */
import type { AuditSink } from "@wfact/audit";
import { PermissionGate } from "./permissions.js";
import type { AgentRegistry } from "./registry.js";

export interface GateForOptions {
  taskId: string | null;
  runId: string | null;
  entitySlug: string | null;
  clientSlug: string | null;
  audit: AuditSink | null;
}

/** Throws AgentNotRegisteredError for an unknown role: no registration, no scope, nothing allowed. */
export function permissionGateFor(registry: AgentRegistry, role: string, opts: GateForOptions): PermissionGate {
  const scope = registry.get(role).permissionScope;
  return new PermissionGate({
    role,
    scope,
    binding: { entitySlug: opts.entitySlug, clientSlug: opts.clientSlug },
    audit: opts.audit
      ? { sink: opts.audit, actor: `agent:${role}`, taskId: opts.taskId, runId: opts.runId, entitySlug: opts.entitySlug }
      : null,
  });
}
