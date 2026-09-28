/**
 * One handler per Cockpit job kind. Each calls the SAME library code the CLIs call — no pipeline
 * logic lives here, only "load inputs → call the pipeline → shape a JSON result for the Cockpit".
 *
 * `ok` means the domain outcome is the good one (plan awaiting approval, build verified, page
 * approved, question answered). Anything else is ok:false with the specific reason — a job that ran
 * correctly but ended in "failed_verification" must look failed in the Cockpit, not green.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AuditSink } from "@wfact/audit";
import { createSeedRegistry, runAgent, type Agent } from "@wfact/agent-runtime";
import type { QaInput } from "@wfact/verification/agent";
import { QA_EVALUATOR_ROLE } from "@wfact/verification/agent";
import type { VerificationResult } from "@wfact/verification/verificationLoop";
import { intakeAndPlan, replan, type PlanningDeps, type PlanningResult } from "@wfact/planning/pipeline";
import type { PlanStore } from "@wfact/planning/planStore";
import { buildAndVerify, resumeBuildAndVerify, qaFailureToIssues, type WorkflowDeps, type WorkflowResult } from "@wfact/workflow";
import type { Job } from "./jobStore.js";

export interface HandlerDeps {
  planning: PlanningDeps;
  planStore: PlanStore;
  workflow: WorkflowDeps;
  /** Reads a page by repo-relative path from the artifact store (null if absent). */
  readArtifact: (relPath: string) => Promise<string | null>;
  repoRoot: string;
  qaAgent: Agent<QaInput, VerificationResult>;
  audit: AuditSink | null;
  knownClientSlugs: string[];
  /** Hermes-lite status answer — injected so tests don't need a model or Supabase. */
  ask: (question: string) => Promise<{ answer: string; sourcesUsed: string[]; needsHuman: boolean; escalationReason: string | null }>;
}

export interface JobOutcome {
  ok: boolean;
  result: Record<string, unknown>;
  reason: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_PATH = /^clients\/[a-z][a-z0-9-]*\/pages\/[a-z0-9-]+\.html$/;

function str(params: Record<string, unknown>, key: string, max: number): string {
  const v = params[key];
  if (typeof v !== "string" || !v.trim() || v.length > max) throw new Error(`params.${key} is missing or invalid`);
  return v;
}
function uuid(params: Record<string, unknown>, key: string): string {
  const v = params[key];
  if (typeof v !== "string" || !UUID.test(v)) throw new Error(`params.${key} must be a UUID`);
  return v;
}

function planningOutcome(r: PlanningResult): JobOutcome {
  return {
    ok: r.status === "awaiting_owner_approval",
    reason: r.reason,
    result: {
      status: r.status,
      runId: r.runId,
      planId: r.planId,
      intake: r.intake && {
        entitySlug: r.intake.entitySlug,
        entityConfidence: r.intake.entityConfidence,
        leadType: r.intake.leadType,
        clientName: r.intake.clientName,
        clientSlug: r.intake.clientSlug,
      },
      plan: r.plan && {
        templateId: r.plan.templateId,
        sections: r.plan.brief.requiredSections,
        tasks: r.plan.tasks,
        openQuestions: r.plan.openQuestions.length,
      },
    },
  };
}

function workflowOutcome(r: WorkflowResult): JobOutcome {
  return {
    ok: r.status === "awaiting_launch_approval",
    reason: r.reason,
    result: {
      status: r.status,
      workflowRunId: r.workflowRunId,
      cycles: r.cycles,
      lastCheckpoint: r.lastCheckpoint,
      qaIssues: r.qaFailure ? qaFailureToIssues(r.qaFailure) : [],
      correctionRounds: r.builderRounds.length,
      // Stage 6 (Documentation agent) is the proper home for the per-client correction log; CI runs
      // can't write clients/<slug>/memory.md into the repo, so the rounds are kept here for now.
      builderRounds: r.builderRounds.map((x) => ({ round: x.round, verdict: x.verdict, issues: x.issues })),
    },
  };
}

export async function handleJob(job: Job, deps: HandlerDeps): Promise<JobOutcome> {
  const p = job.params ?? {};
  switch (job.kind) {
    case "intake":
      return planningOutcome(await intakeAndPlan({ text: str(p, "text", 20_000), source: "intake-raw" }, deps.planning));

    case "replan":
      return planningOutcome(await replan(uuid(p, "planId"), deps.planning));

    case "build_plan": {
      const planId = uuid(p, "planId");
      const stored = await deps.planStore.get(planId);
      if (!stored) return { ok: false, reason: `plan ${planId} not found`, result: { planId } };
      // Re-checked here even though the jobs trigger checked at request time: approval is the gate.
      if (stored.status !== "approved") {
        return { ok: false, reason: `plan ${planId} is "${stored.status}" — only an owner-approved plan is built`, result: { planId } };
      }
      const outcome = workflowOutcome(await buildAndVerify(stored.plan.brief, deps.workflow));
      return { ...outcome, result: { planId, ...outcome.result } };
    }

    case "resume":
      return workflowOutcome(await resumeBuildAndVerify(uuid(p, "workflowRunId"), deps.workflow));

    case "verify": {
      const relPath = str(p, "path", 200);
      if (!PAGE_PATH.test(relPath)) throw new Error("params.path must be clients/<slug>/pages/<name>.html");
      const clientSlug = relPath.split("/")[1]!;
      let html = await deps.readArtifact(relPath);
      let source = "artifact-store";
      if (html === null) {
        html = await readFile(path.join(deps.repoRoot, relPath), "utf-8").catch(() => null);
        source = "repo";
      }
      if (html === null) return { ok: false, reason: `no page at ${relPath} (artifact store or repo)`, result: { path: relPath } };
      const sections = Array.isArray(p.sections) ? (p.sections as unknown[]).filter((s): s is string => typeof s === "string") : [];
      const run = await runAgent(
        deps.qaAgent,
        {
          taskId: crypto.randomUUID(),
          role: QA_EVALUATOR_ROLE,
          input: {
            html,
            clientSlug,
            requiredSections: sections,
            otherClientSlugs: deps.knownClientSlugs.filter((s) => s !== clientSlug),
            goal: str(p, "goal", 1000),
          },
        },
        { registry: createSeedRegistry(), audit: deps.audit ? { sink: deps.audit } : null },
      );
      const v = run.output;
      return {
        ok: v?.status === "approved",
        reason: v ? (v.status === "approved" ? null : `verification ${v.status}`) : `qa-evaluator ${run.status}: ${run.reason}`,
        result: {
          path: relPath,
          source,
          status: v?.status ?? run.status,
          checks: v?.checkResults.map((c) => ({ checkId: c.checkId, passed: c.passed, details: c.details })) ?? [],
          evaluator: v?.evaluator ?? null,
        },
      };
    }

    case "ask": {
      const a = await deps.ask(str(p, "question", 500));
      return {
        ok: !a.needsHuman,
        reason: a.needsHuman ? a.escalationReason : null,
        result: { answer: a.answer, sources: a.sourcesUsed, needsHuman: a.needsHuman },
      };
    }
  }
}
