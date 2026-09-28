/**
 * Raw request → Intake → Planner → pending owner approval (Continuation Plan Stage 4 acceptance:
 * "a brief goes in one end and a Planner-approved task list comes out the other, without a human
 * hand-writing the intermediate structure"). The "approved" half is a human in the Cockpit; this
 * module stops at `awaiting_owner_approval` and never decides for them.
 *
 * Intake and Planner are registered onto the seed registry HERE, at composition time — Stage 2's
 * claim that a new agent needs no change to packages/agent-runtime, now proven by two real agents.
 */
import { randomUUID } from "node:crypto";
import type { AuditSink } from "@wfact/audit";
import { createSeedRegistry, runAgent, type AgentRegistry, type AgentRun } from "@wfact/agent-runtime";
import { createIntakeAgent, INTAKE_DEFINITION, INTAKE_ROLE, type IntakeResult } from "./intake.js";
import { createPlannerAgent, PLANNER_DEFINITION, PLANNER_ROLE, type Plan } from "./planner.js";
import type { JsonModelClient } from "./modelClient.js";
import type { PlanStore } from "./planStore.js";

export function registryWithPlanning(): AgentRegistry {
  const registry = createSeedRegistry();
  registry.register(INTAKE_DEFINITION);
  registry.register(PLANNER_DEFINITION);
  return registry;
}

export interface PlanningDeps {
  intakeModel: JsonModelClient;
  plannerModel: JsonModelClient;
  store: PlanStore;
  audit: AuditSink | null;
  registry?: AgentRegistry;
}

export type PlanningStatus =
  | "awaiting_owner_approval"
  | "intake_escalated" // e.g. entity ambiguous after the one allowed re-classification
  | "intake_rejected" // raw request failed validation (empty, oversized)
  | "plan_failed" // planner rejected/escalated (unexecutable plan twice, API down)
  | "replan_limit_reached"; // owner rejected a re-plan: escalate to a human, don't plan a third time

export interface PlanningResult {
  status: PlanningStatus;
  runId: string;
  planId: string | null;
  plan: Plan | null;
  intake: IntakeResult | null;
  reason: string | null;
  runs: { intake: AgentRun<IntakeResult> | null; planner: AgentRun<Plan> | null };
}

async function planFrom(
  intake: IntakeResult,
  deps: PlanningDeps,
  registry: AgentRegistry,
  runId: string,
  intakeRun: AgentRun<IntakeResult> | null,
  replanOf: { id: string; note: string } | null,
): Promise<PlanningResult> {
  const plannerRun = await runAgent(
    createPlannerAgent({ model: deps.plannerModel, registry }),
    {
      taskId: randomUUID(),
      role: PLANNER_ROLE,
      input: { intake, ownerFeedback: replanOf?.note },
      entitySlug: intake.entitySlug,
    },
    { registry, audit: deps.audit ? { sink: deps.audit } : null, runId },
  );
  const runs = { intake: intakeRun, planner: plannerRun };
  if (plannerRun.status !== "completed" || !plannerRun.output) {
    return { status: "plan_failed", runId, planId: null, plan: null, intake, reason: `planner ${plannerRun.status}: ${plannerRun.reason}`, runs };
  }
  const planId = await deps.store.insertPending({
    plan: plannerRun.output,
    intake,
    revision: replanOf ? 2 : 1,
    supersedes: replanOf?.id ?? null,
    intakeRunId: intakeRun?.runId ?? null,
  });
  return { status: "awaiting_owner_approval", runId, planId, plan: plannerRun.output, intake, reason: null, runs };
}

export async function intakeAndPlan(raw: unknown, deps: PlanningDeps): Promise<PlanningResult> {
  const registry = deps.registry ?? registryWithPlanning();
  const runId = randomUUID();
  const intakeRun = await runAgent(
    createIntakeAgent({ model: deps.intakeModel }),
    { taskId: randomUUID(), role: INTAKE_ROLE, input: raw },
    { registry, audit: deps.audit ? { sink: deps.audit } : null, runId },
  );
  const none = { intake: intakeRun, planner: null };
  if (intakeRun.status === "rejected") {
    return { status: "intake_rejected", runId, planId: null, plan: null, intake: null, reason: intakeRun.reason, runs: none };
  }
  if (intakeRun.status === "escalated" || !intakeRun.output) {
    return { status: "intake_escalated", runId, planId: null, plan: null, intake: intakeRun.output, reason: intakeRun.reason, runs: none };
  }
  return planFrom(intakeRun.output, deps, registry, runId, intakeRun, null);
}

/** Blueprint §5: "Re-plan once on rejection, escalate on second rejection." */
export async function replan(rejectedPlanId: string, deps: PlanningDeps): Promise<PlanningResult> {
  const registry = deps.registry ?? registryWithPlanning();
  const runId = randomUUID();
  const prev = await deps.store.get(rejectedPlanId);
  const empty = { intake: null, planner: null };
  if (!prev) throw new Error(`plan ${rejectedPlanId} not found`);
  if (prev.status !== "rejected") {
    throw new Error(`plan ${rejectedPlanId} is "${prev.status}" — only an owner-rejected plan is re-planned`);
  }
  if (prev.revision >= 2) {
    return {
      status: "replan_limit_reached", runId, planId: null, plan: null, intake: prev.intake, runs: empty,
      reason: `plan was already re-planned once and the owner rejected it again ("${prev.decisionNote}") — escalating to a human`,
    };
  }
  return planFrom(prev.intake, deps, registry, runId, null, { id: prev.id, note: prev.decisionNote ?? "" });
}
