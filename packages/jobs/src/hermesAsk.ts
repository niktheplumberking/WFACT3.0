/**
 * The Cockpit "ask" job: Hermes-lite answers a status question. Step 6: Hermes-lite is the controller, not an
 * agent, but its tool calls and its model call go through the same PermissionGate as every agent, with the
 * controller's own scope (HERMES_LITE_SCOPE: three read-only tools, the "hermes" model slot, a spend ceiling;
 * cross-entity because it answers about any entity, and therefore read-only by rule). A refused tool is audited
 * as agent.deny (actor hermes-lite) and as a rejected tool.invoke.
 */
import type { AuditSink } from "@wfact/audit";
import {
  HERMES_LITE_ROLE,
  HERMES_LITE_SCOPE,
  PermissionGate,
  guardModelClient,
  withPermissionGate,
  type AgentScope,
} from "@wfact/agent-runtime";
import { HermesLite, type HermesAnswer } from "@wfact/hermes-lite/controller";
import { buildToolRegistry } from "@wfact/hermes-lite/tools/registry";
import type { StateReader } from "@wfact/hermes-lite/state";
import type { ModelClient } from "@wfact/hermes-lite/modelClient";

export interface GatedHermesDeps {
  audit: AuditSink;
  stateReader: StateReader | null;
  /** Already traced by the caller. Guarded here. */
  modelClient: ModelClient;
  /** Tests only: a narrower scope to prove refusals. Production always uses HERMES_LITE_SCOPE. */
  scope?: AgentScope;
  runId?: string;
}

export async function askHermesGated(question: string, deps: GatedHermesDeps): Promise<HermesAnswer> {
  const ctx = { sink: deps.audit, actor: HERMES_LITE_ROLE, runId: deps.runId ?? crypto.randomUUID() };
  const gate = new PermissionGate({
    role: HERMES_LITE_ROLE,
    scope: deps.scope ?? HERMES_LITE_SCOPE,
    binding: { entitySlug: null, clientSlug: null },
    audit: ctx,
  });
  const hermes = new HermesLite({
    toolRegistry: buildToolRegistry(deps.stateReader, ctx, (name) => gate.authorize({ kind: "tool", name })),
    modelClient: guardModelClient(deps.modelClient, "hermes"),
  });
  return withPermissionGate(gate, () => hermes.answerStatusQuestion(question));
}
