/**
 * Raw request → Intake → Planner → pending owner approval (Continuation Plan Stage 4 acceptance:
 * "a brief goes in one end and a Planner-approved task list comes out the other, without a human
 * hand-writing the intermediate structure"). The "approved" half is a human in the Cockpit; this
 * module stops at `awaiting_owner_approval` and never decides for them.
 *
 * Intake and Planner are registered onto the seed registry HERE, at composition time — Stage 2's
 * claim that a new agent needs no change to packages/agent-runtime, now proven by two real agents.
 *
 * Step 4B M2: the Direction agent (direction.ts) runs between Intake and the Planner on the ORIGINAL
 * request text, and its result is stored with the plan for the owner's track choice. It is advisory:
 * if it fails, the plan is still written with `direction: null` and the reason, and the owner chooses
 * the track without a recommendation. A re-plan reuses the stored direction (the request is unchanged).
 */
import { randomUUID } from "node:crypto";
import type { AuditSink } from "@wfact/audit";
import { createSeedRegistry, permissionGateFor, PermissionDeniedError, runAgent, type AgentRegistry, type AgentRun } from "@wfact/agent-runtime";
import { createIntakeAgent, INTAKE_DEFINITION, INTAKE_ROLE, type IntakeResult } from "./intake.js";
import { createPlannerAgent, PLANNER_DEFINITION, PLANNER_ROLE, type Plan } from "./planner.js";
import { createDirectionAgent, DIRECTION_DEFINITION, DIRECTION_ROLE, type DirectionResult } from "./direction.js";
import type { JsonModelClient } from "./modelClient.js";
import type { PlanStore } from "./planStore.js";
import { parseBrief } from "@wfact/frontend-loop/brief";
import type { KnownEntity } from "@wfact/hermes-lite/entities";

export function registryWithPlanning(): AgentRegistry {
  const registry = createSeedRegistry();
  registry.register(INTAKE_DEFINITION);
  registry.register(PLANNER_DEFINITION);
  return registry;
}

/** Step 4B M2: Intake + Planner + Direction, composed here; the planning-only registry is unchanged. */
export function registryWithPlanningAndDirection(): AgentRegistry {
  const registry = registryWithPlanning();
  registry.register(DIRECTION_DEFINITION);
  return registry;
}

export interface PlanningDeps {
  intakeModel: JsonModelClient;
  /** Step 21 K: the entity table's rows, which intake matches a request against. */
  entities: readonly KnownEntity[];
  plannerModel: JsonModelClient;
  /** Step 4B M2. Absent = no direction step (the plan records why); production always passes it. */
  directionModel?: JsonModelClient;
  store: PlanStore;
  audit: AuditSink | null;
  registry?: AgentRegistry;
}

export type PlanningStatus =
  | "awaiting_owner_approval"
  | "intake_escalated" // e.g. entity ambiguous after the one allowed re-classification
  | "intake_rejected" // raw request failed validation (empty, oversized)
  | "plan_failed" // planner rejected/escalated (unexecutable plan twice, API down)
  | "replan_limit_reached" // owner rejected a re-plan: escalate to a human, don't plan a third time
  | "direction_failed"; // a direction re-run did not produce a recommendation; the plan is unchanged

export interface PlanningResult {
  status: PlanningStatus;
  runId: string;
  planId: string | null;
  plan: Plan | null;
  intake: IntakeResult | null;
  /** Step 4B M2: the direction summary and track recommendation, or null with `directionNote`. */
  direction: DirectionResult | null;
  directionNote: string | null;
  reason: string | null;
  runs: { intake: AgentRun<IntakeResult> | null; planner: AgentRun<Plan> | null; direction?: AgentRun<DirectionResult> | null };
}

/** The request text exactly as Intake read it (same flattening as the Intake agent's parseInput). */
function rawTextOf(raw: unknown): string {
  if (typeof raw === "string") return raw;
  const r = (raw ?? {}) as { text?: unknown };
  return typeof r.text === "string" ? r.text : JSON.stringify(raw, null, 2);
}

async function directionFor(
  intake: IntakeResult,
  rawText: string,
  deps: PlanningDeps,
  registry: AgentRegistry,
  runId: string,
): Promise<{ direction: DirectionResult | null; note: string | null; run: AgentRun<DirectionResult> | null }> {
  if (!deps.directionModel) return { direction: null, note: "no direction model configured for this run", run: null };
  const run = await runAgent(
    createDirectionAgent({ model: deps.directionModel }),
    { taskId: randomUUID(), role: DIRECTION_ROLE, input: { intake, rawText }, entitySlug: intake.entitySlug ?? undefined, clientSlug: intake.clientSlug },
    { registry, audit: deps.audit ? { sink: deps.audit } : null, runId },
  );
  if (run.status !== "completed" || !run.output) {
    return { direction: null, note: `direction step ${run.status}: ${run.reason ?? "no output"}; the owner chooses the track without a recommendation`, run };
  }
  return { direction: run.output, note: null, run };
}

/**
 * What the owner attached to the request in the Cockpit: the live address and the logo record (uploaded file, checked
 * by the database and again by the build). Set on the brief by code, never by a model, and carried into a re-plan.
 */
export interface OwnerAssets {
  siteUrl?: string;
  logo?: unknown;
}

function withoutRequestText(intake: IntakeResult): IntakeResult {
  const { requestText: _raw, ...rest } = intake;
  return rest;
}

function withOwnerAssets(plan: Plan, assets: OwnerAssets | null): Plan {
  if (!assets || (assets.siteUrl === undefined && assets.logo === undefined)) return plan;
  return {
    ...plan,
    brief: parseBrief({
      ...plan.brief,
      ...(assets.siteUrl !== undefined ? { siteUrl: assets.siteUrl } : {}),
      ...(assets.logo !== undefined ? { logo: assets.logo } : {}),
    }),
  };
}

/** Build-quality Package 1: the client's request, word for word, set on the brief by code after the Planner ran. */
function withRequest(plan: Plan, requestText: string | undefined): Plan {
  if (!requestText) return plan;
  return { ...plan, brief: parseBrief({ ...plan.brief, requestText, briefBasis: "request" }) };
}

async function planFrom(
  intake: IntakeResult,
  deps: PlanningDeps,
  registry: AgentRegistry,
  runId: string,
  intakeRun: AgentRun<IntakeResult> | null,
  replanOf: { id: string; note: string } | null,
  dir: { direction: DirectionResult | null; note: string | null; run: AgentRun<DirectionResult> | null },
  assets: OwnerAssets | null = null,
): Promise<PlanningResult> {
  const plannerTaskId = randomUUID();
  const plannerRun = await runAgent(
    createPlannerAgent({ model: deps.plannerModel, registry }),
    {
      taskId: plannerTaskId,
      role: PLANNER_ROLE,
      // The raw request stays off the Planner's input (it never needs it); code puts it on the brief below.
      input: { intake: withoutRequestText(intake), ownerFeedback: replanOf?.note },
      entitySlug: intake.entitySlug,
      // Step 6: the plan is for this client folder only; a client of another entity is refused before the run.
      clientSlug: intake.clientSlug,
    },
    { registry, audit: deps.audit ? { sink: deps.audit } : null, runId },
  );
  const runs = { intake: intakeRun, planner: plannerRun, direction: dir.run };
  const d = { direction: dir.direction, directionNote: dir.note };
  if (plannerRun.status !== "completed" || !plannerRun.output) {
    return { status: "plan_failed", runId, planId: null, plan: null, intake, ...d, reason: `planner ${plannerRun.status}: ${plannerRun.reason}`, runs };
  }
  let plan: Plan;
  try {
    plan = withRequest(withOwnerAssets(plannerRun.output, assets), intake.requestText);
  } catch (err) {
    return { status: "plan_failed", runId, planId: null, plan: null, intake, ...d, reason: `the attached logo or live address is not usable: ${err instanceof Error ? err.message : String(err)}`, runs };
  }
  // Step 6: the pipeline writes plan_approvals on the Planner's behalf, so the Planner's scope decides: insert
  // (and update, to supersede a pending predecessor) on plan_approvals, for the run's own entity only.
  const gate = permissionGateFor(registry, PLANNER_ROLE, {
    taskId: plannerTaskId,
    runId,
    entitySlug: intake.entitySlug,
    clientSlug: intake.clientSlug,
    audit: deps.audit,
  });
  try {
    await gate.authorize({ kind: "db", table: "plan_approvals", op: "insert", entitySlug: plan.brief.entitySlug });
    if (replanOf) await gate.authorize({ kind: "db", table: "plan_approvals", op: "update", entitySlug: plan.brief.entitySlug });
  } catch (err) {
    if (!(err instanceof PermissionDeniedError)) throw err;
    return { status: "plan_failed", runId, planId: null, plan: null, intake, ...d, reason: err.message, runs };
  }
  const planId = await deps.store.insertPending({
    plan,
    intake,
    revision: replanOf ? 2 : 1,
    supersedes: replanOf?.id ?? null,
    intakeRunId: intakeRun?.runId ?? null,
    direction: dir.direction,
    directionNote: dir.note,
  });
  return { status: "awaiting_owner_approval", runId, planId, plan, intake, ...d, reason: null, runs };
}

export async function intakeAndPlan(raw: unknown, deps: PlanningDeps, assets: OwnerAssets | null = null): Promise<PlanningResult> {
  const registry = deps.registry ?? registryWithPlanningAndDirection();
  const runId = randomUUID();
  const intakeRun = await runAgent(
    createIntakeAgent({ model: deps.intakeModel, entities: deps.entities }),
    { taskId: randomUUID(), role: INTAKE_ROLE, input: raw },
    { registry, audit: deps.audit ? { sink: deps.audit } : null, runId },
  );
  const none = { intake: intakeRun, planner: null };
  const noDir = { direction: null, directionNote: null };
  if (intakeRun.status === "rejected") {
    return { status: "intake_rejected", runId, planId: null, plan: null, intake: null, ...noDir, reason: intakeRun.reason, runs: none };
  }
  if (intakeRun.status === "escalated" || !intakeRun.output) {
    return { status: "intake_escalated", runId, planId: null, plan: null, intake: intakeRun.output, ...noDir, reason: intakeRun.reason, runs: none };
  }
  const dir = await directionFor(intakeRun.output, rawTextOf(raw), deps, registry, runId);
  return planFrom(intakeRun.output, deps, registry, runId, intakeRun, null, dir, assets);
}

/** Blueprint §5: "Re-plan once on rejection, escalate on second rejection." */
export async function replan(rejectedPlanId: string, deps: PlanningDeps): Promise<PlanningResult> {
  const registry = deps.registry ?? registryWithPlanningAndDirection();
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
      direction: prev.direction, directionNote: prev.directionNote,
      reason: `plan was already re-planned once and the owner rejected it again ("${prev.decisionNote}") — escalating to a human`,
    };
  }
  // The request did not change, so its direction does not either: reuse it rather than pay again.
  const dir = { direction: prev.direction, note: prev.directionNote, run: null };
  // What the owner attached to the request (live address, logo) is kept: a re-plan changes the plan, not the client's assets.
  const kept: OwnerAssets = { ...(prev.plan.brief.siteUrl ? { siteUrl: prev.plan.brief.siteUrl } : {}), ...(prev.plan.brief.logo ? { logo: prev.plan.brief.logo } : {}) };
  return planFrom(prev.intake, deps, registry, runId, null, { id: prev.id, note: prev.decisionNote ?? "" }, dir, kept);
}

/**
 * Re-run the direction step alone for a pending plan whose direction failed (rehearsal log #3/#9: plan 403305ec was built with
 * no track recommendation because direction truncated twice). The plan itself does not change: on success the pipeline
 * writes the same plan with the new direction as a new pending row that supersedes the old one (plan_approvals rows are
 * immutable; superseding a pending plan is the pipeline's one allowed move, migration 0011), at the same revision, so the
 * owner's one re-plan is not used up. On failure nothing is written. `requestText` is the fallback for plans stored before
 * the request was carried on the intake (the jobs handler looks it up from the intake job).
 */
export async function rerunDirection(planId: string, deps: PlanningDeps, requestText: string | null = null): Promise<PlanningResult> {
  const registry = deps.registry ?? registryWithPlanningAndDirection();
  const runId = randomUUID();
  const prev = await deps.store.get(planId);
  if (!prev) throw new Error(`plan ${planId} not found`);
  const keep = { status: "direction_failed" as const, runId, planId, plan: prev.plan, intake: prev.intake, runs: { intake: null, planner: null } };
  if (prev.status !== "pending") {
    return { ...keep, direction: prev.direction, directionNote: prev.directionNote, reason: `plan ${planId} is "${prev.status}"; direction is only re-run before the owner decides` };
  }
  const rawText = prev.intake.requestText ?? prev.plan.brief.requestText ?? requestText;
  if (!rawText) {
    return { ...keep, direction: prev.direction, directionNote: prev.directionNote, reason: "the client's original request is not on file for this plan, so direction cannot be re-run; re-plan it from a new request" };
  }
  const dir = await directionFor(prev.intake, rawText, deps, registry, runId);
  if (!dir.direction) {
    return { ...keep, direction: null, directionNote: dir.note, reason: dir.note, runs: { intake: null, planner: null, direction: dir.run } };
  }
  const gate = permissionGateFor(registry, PLANNER_ROLE, { taskId: randomUUID(), runId, entitySlug: prev.plan.brief.entitySlug, clientSlug: prev.plan.brief.clientSlug, audit: deps.audit });
  try {
    await gate.authorize({ kind: "db", table: "plan_approvals", op: "insert", entitySlug: prev.plan.brief.entitySlug });
    await gate.authorize({ kind: "db", table: "plan_approvals", op: "update", entitySlug: prev.plan.brief.entitySlug });
  } catch (err) {
    if (!(err instanceof PermissionDeniedError)) throw err;
    return { ...keep, direction: prev.direction, directionNote: prev.directionNote, reason: err.message };
  }
  const newId = await deps.store.insertPending({
    plan: prev.plan,
    intake: prev.intake,
    revision: prev.revision === 2 ? 2 : 1,
    supersedes: prev.id,
    intakeRunId: null,
    direction: dir.direction,
    directionNote: null,
  });
  return { status: "awaiting_owner_approval", runId, planId: newId, plan: prev.plan, intake: prev.intake, direction: dir.direction, directionNote: null, reason: null, runs: { intake: null, planner: null, direction: dir.run } };
}
