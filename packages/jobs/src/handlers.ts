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
import { createSeedRegistry, fileClientEntityResolver, permissionGateFor, PermissionDeniedError, runAgent, type Agent } from "@wfact/agent-runtime";
import type { QaInput } from "@wfact/verification/agent";
import { QA_EVALUATOR_ROLE } from "@wfact/verification/agent";
import type { VerificationResult } from "@wfact/verification/verificationLoop";
import { intakeAndPlan, replan, rerunDirection, type PlanningDeps, type PlanningResult } from "@wfact/planning/pipeline";
import { canonicalSections } from "@wfact/planning/planner";
import { REQUEST_TEXT_MAX } from "@wfact/frontend-loop/request";
import type { RequestTextLookup } from "./requestLookup.js";
import type { PlanStore } from "@wfact/planning/planStore";
import type { Plan } from "@wfact/planning/planner";
import type { PilotBrief } from "@wfact/frontend-loop/brief";
import { buildAndVerify, recordedBuilderTemplate, resumeBuildAndVerify, qaFailureToIssues, runIdOfError, runProgress, type ContinueFrom, type ReopenRequest, type WorkflowDeps, type WorkflowResult } from "@wfact/workflow";
import type { Job } from "./jobStore.js";
import { IMAGE_INPUT_PREFIX, LAUNCH_PLACEHOLDERS_KEY, LOGO_INPUT_KEY, ownerFactsFrom, type PlanInput, type PlanInputStore } from "./inputStore.js";
import { parseImageRecord, SLOT_RE, type SuppliedImage } from "@wfact/frontend-loop/media";
import { parseBriefLogo } from "@wfact/frontend-loop/brandAsset";

export interface HandlerDeps {
  planning: PlanningDeps;
  planStore: PlanStore;
  workflow: WorkflowDeps;
  /**
   * Step 4B M3: the same workflow with the Track A (multi-page, content-as-data) builder. Production
   * (run.ts) always sets it; when absent, Track A falls back to `workflow` (the single-page builder that
   * M2 used), which only older tests rely on.
   */
  trackAWorkflow?: WorkflowDeps;
  /**
   * Step 4B M4: the same workflow with the Track B builder (Next.js static export, isolated build) and the
   * Track B QA budget. Production sets it; without it a Track B plan is refused, never built as Track A.
   */
  trackBWorkflow?: WorkflowDeps;
  /** Reads a page by repo-relative path from the artifact store (null if absent). */
  readArtifact: (relPath: string) => Promise<string | null>;
  repoRoot: string;
  qaAgent: Agent<QaInput, VerificationResult>;
  audit: AuditSink | null;
  knownClientSlugs: string[];
  /** Step 4D: details the owner added to an approved plan; absent in older tests (no inputs). */
  inputs?: PlanInputStore;
  /**
   * Step 4D: when a finished build stopped only because the design reviewer was unreachable (everything else passed),
   * the runner waits and continues it by itself, a bounded number of times, instead of asking a person. Defaults:
   * 60 s then 180 s, and only while a retry plus a full quality pass still fits inside the job's 26-minute step (a retry is
   * not started after 15 minutes). Tests pass zero delays.
   */
  autoHeal?: { delaysMs: number[]; maxElapsedMs: number };
  sleep?: (ms: number) => Promise<void>;
  /**
   * Build-quality Package 1: finds the client's request for a plan written before the request was carried on the brief
   * (the intake job's text). Absent in older tests: such plans then build from the summary only, and say so.
   */
  requests?: RequestTextLookup;
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
      // Step 4B M2: the direction summary the owner sees in Approvals, plus why it is missing if it is.
      direction: r.direction && {
        niche: r.direction.niche,
        primaryGoal: r.direction.primaryGoal,
        recommendedTrack: r.direction.recommendation.track,
        confidence: r.direction.recommendation.confidence,
        withheldReason: r.direction.recommendation.withheldReason,
      },
      directionNote: r.directionNote,
    },
  };
}

function workflowOutcome(r: WorkflowResult, extra: Record<string, unknown> = {}): JobOutcome {
  return {
    ok: r.status === "awaiting_launch_approval",
    reason: r.reason,
    result: {
      ...extra,
      status: r.status,
      workflowRunId: r.workflowRunId,
      // Step 4D: what the run asked of the client, so the Cockpit can list it instead of burying it in an audit row.
      needsFromClient: r.needsFromClient ?? [],
      // Build-quality Package 3: placeholder images still on the site, and whether the owner chose to launch with them.
      placeholders: r.placeholders ?? [],
      launchWithPlaceholders: r.launchWithPlaceholders === true,
      cycles: r.cycles,
      lastCheckpoint: r.lastCheckpoint,
      qaIssues: r.qaFailure ? qaFailureToIssues(r.qaFailure) : [],
      correctionRounds: r.builderRounds.length,
      // The per-stage record now lives in the client's episodic memory (Step 5, Documentation agent; durable as
      // documentation.entry rows). The rounds stay here too: the Cockpit's job view reads them.
      builderRounds: r.builderRounds.map((x) => ({ round: x.round, verdict: x.verdict, issues: x.issues })),
      // Step 5: stages the Documentation agent could not record (each also a workflow.documentation_escalated row).
      documentationEscalations: r.documentationEscalations ?? [],
    },
  };
}

/**
 * Step 4D: writes `job.run` (task = the Cockpit job, run = the workflow run) as soon as a run starts. Without it a job that
 * died before reporting (GitHub's 30-minute limit, a crashed runner) has no way to say which run it was, and its saved
 * site could not be continued.
 */
function linkRun(wf: WorkflowDeps, job: Job, deps: HandlerDeps): WorkflowDeps {
  const sink = deps.audit;
  if (!sink) return wf;
  return {
    ...wf,
    onRunStart: async (runId) => {
      await wf.onRunStart?.(runId);
      await sink.write({ actor: "job-runner", action: "job.run", outcome: "info", taskId: job.id, runId, payload: { jobId: job.id, kind: job.kind } });
    },
  };
}

/** The run's own record decides what is saved, never this process's memory (a resumed run reports no rounds). */
async function finishWorkflow(r: WorkflowResult, wf: WorkflowDeps, extra: Record<string, unknown>): Promise<JobOutcome> {
  const progress = runProgress(await wf.reader.listByRun(r.workflowRunId));
  return workflowOutcome(r, { ...extra, progress });
}

/**
 * An exception inside a started run no longer loses the run: the job still fails (with the error), but it names the run
 * and what was saved, so the Cockpit can offer to continue it. Exceptions before any run exists (a malformed brief) are rethrown.
 */
async function crashed(err: unknown, knownRunId: string | null, wf: WorkflowDeps, extra: Record<string, unknown>): Promise<JobOutcome> {
  const runId = runIdOfError(err) ?? knownRunId;
  if (!runId) throw err;
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  let progress: ReturnType<typeof runProgress> | null = null;
  try {
    progress = runProgress(await wf.reader.listByRun(runId));
  } catch {
    /* the audit store may be the thing that is down; the run id alone still lets the Cockpit offer to continue */
  }
  return { ok: false, reason: message.slice(0, 2000), result: { ...extra, status: "crashed", workflowRunId: runId, progress, cycles: null, qaIssues: [], builderRounds: [], needsFromClient: [] } };
}

const REVIEWER_OUTAGE = /a required review could not run/i;
const NOT_AN_OUTAGE = /HTTP (400|401|402|403|404)\b|credits|api key|not set|not configured/i;

/** True only for "everything passed but the reviewer did not answer": waiting and asking again is safe and cheap. */
export function isTransientReviewerOutage(o: JobOutcome): boolean {
  return !o.ok && o.result.status === "not_verified_no_evaluator" && REVIEWER_OUTAGE.test(o.reason ?? "") && !NOT_AN_OUTAGE.test(o.reason ?? "");
}

/**
 * Bounded automatic retry (CLAUDE.md §6: bounded, backed off, then a human). Only the reviewer outage qualifies; the site is
 * already saved, so each retry re-runs the checks and the review and nothing else. Each retry is recorded on the run.
 */
async function autoHeal(first: JobOutcome, wf: WorkflowDeps, extra: Record<string, unknown>, deps: HandlerDeps, startedAt: number): Promise<JobOutcome> {
  // 15 min: the wait, then a quality pass (worst case ~8 min since the reviewer's time cap) must end before the 26-minute
  // step limit. At 18 min a retry could be killed mid-check (jobs 63278e56, b880a7d5 ended within 40 s of the limit).
  const cfg = deps.autoHeal ?? { delaysMs: [60_000, 180_000], maxElapsedMs: 15 * 60_000 };
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let outcome = first;
  let attempts = 0;
  for (const delay of cfg.delaysMs) {
    if (!isTransientReviewerOutage(outcome) || Date.now() - startedAt + delay > cfg.maxElapsedMs) break;
    const runId = outcome.result.workflowRunId as string;
    await sleep(delay);
    attempts += 1;
    try {
      const r = await resumeBuildAndVerify(runId, wf, { reopen: { reason: `automatic retry ${attempts}: the design reviewer did not answer`, by: "auto" } });
      outcome = await finishWorkflow(r, wf, extra);
    } catch (err) {
      outcome = await crashed(err, runId, wf, extra);
      break;
    }
  }
  if (attempts > 0) outcome = { ...outcome, result: { ...outcome.result, autoRetries: attempts } };
  return outcome;
}

export async function handleJob(job: Job, deps: HandlerDeps): Promise<JobOutcome> {
  const startedAt = Date.now();
  const p = job.params ?? {};
  switch (job.kind) {
    case "intake": {
      // The live address and the logo record the owner attached (the jobs trigger checked both, and that the file was
      // uploaded); set on the brief by code, never by a model. The build checks the logo's bytes again.
      const assets = {
        ...(typeof p.siteUrl === "string" ? { siteUrl: p.siteUrl } : {}),
        ...(p.logo !== undefined ? { logo: p.logo } : {}),
      };
      return planningOutcome(await intakeAndPlan({ text: str(p, "text", 20_000), source: "intake-raw" }, deps.planning, assets));
    }

    case "replan":
      return planningOutcome(await replan(uuid(p, "planId"), deps.planning));

    case "direction": {
      // Re-run the direction step alone for a pending plan whose direction failed (rehearsal log #3, #9).
      const planId = uuid(p, "planId");
      const stored = await deps.planStore.get(planId);
      const fallback = stored && !stored.intake.requestText && !stored.plan.brief.requestText ? await requestFor(planId, deps) : null;
      return planningOutcome(await rerunDirection(planId, deps.planning, fallback));
    }

    case "build_plan": {
      const planId = uuid(p, "planId");
      const stored = await deps.planStore.get(planId);
      if (!stored) return { ok: false, reason: `plan ${planId} not found`, result: { planId } };
      // Re-checked here even though the jobs trigger checked at request time: approval is the gate.
      if (stored.status !== "approved") {
        return { ok: false, reason: `plan ${planId} is "${stored.status}" — only an owner-approved plan is built`, result: { planId } };
      }
      // Step 4B M2: no build without the owner's track choice (also enforced by the jobs trigger, 0011).
      if (!stored.buildTrack) {
        return { ok: false, reason: `plan ${planId} has no build track — the owner chooses Track A or B when approving`, result: { planId } };
      }
      // Track A builds from the Track A starter (M3), Track B from the Next.js starter (M4). A Track B plan is
      // never built by another builder: that would silently ignore the owner's choice.
      if (stored.buildTrack === "B" && !deps.trackBWorkflow) {
        return { ok: false, reason: `plan ${planId} is Track B, but this runner has no Track B builder configured; it is not built as Track A`, result: { planId, buildTrack: "B" } };
      }
      const wf = linkRun(stored.buildTrack === "B" ? deps.trackBWorkflow! : deps.trackAWorkflow ?? deps.workflow, job, deps);
      const inputs = (await deps.inputs?.current(planId)) ?? [];
      const brief = briefForBuild(stored.plan, inputs, stored.plan.brief.requestText ? null : await requestFor(planId, deps));
      const extra = { planId, buildTrack: stored.buildTrack, inputsUsed: inputs.filter((i) => !i.waived).length, inputsWaived: inputs.filter((i) => i.waived).length, briefBasis: brief.briefBasis };
      let runId: string | null = null;
      try {
        const first = await buildAndVerify(brief, wf);
        runId = first.workflowRunId;
        return await autoHeal(await finishWorkflow(first, wf, extra), wf, extra, deps, startedAt);
      } catch (err) {
        return crashed(err, runId, wf, extra);
      }
    }

    case "resume": {
      const runId = uuid(p, "workflowRunId");
      // Resume with the builder that started the run (a Track A site is revised as content, not HTML).
      const template = await recordedBuilderTemplate(runId, deps.workflow.reader);
      const wf =
        template === "track-a" && deps.trackAWorkflow ? deps.trackAWorkflow : template === "track-b" && deps.trackBWorkflow ? deps.trackBWorkflow : deps.workflow;
      // Step 4D: "reopen" is a person asking to continue a run that stopped. Only a signed-in owner/admin can create this job
      // (the jobs trigger), and the run records who. The brief is the approved plan plus the details the owner has added since.
      const planId = typeof p.planId === "string" && UUID.test(p.planId) ? p.planId : null;
      const extra: Record<string, unknown> = planId ? { planId } : {};
      let reopen: ReopenRequest | undefined;
      if (p.reopen === true) {
        let brief: unknown;
        if (planId) {
          const stored = await deps.planStore.get(planId);
          const inputs = (await deps.inputs?.current(planId)) ?? [];
          if (stored && inputs.length > 0) {
            const b = briefForBuild(stored.plan, inputs, stored.plan.brief.requestText ? null : await requestFor(planId, deps));
            brief = b;
            extra.briefBasis = b.briefBasis;
          }
          extra.inputsUsed = inputs.filter((i) => !i.waived).length;
          extra.inputsWaived = inputs.filter((i) => i.waived).length;
        }
        const reason = typeof p.reason === "string" && p.reason.trim() ? p.reason.trim().slice(0, 200) : "continued from the Cockpit";
        reopen = { reason, by: job.createdBy, ...(brief !== undefined ? { brief } : {}), ...(p.force === true ? { force: true } : {}) };
      }
      // Where to continue (the Cockpit's step-targeted buttons): re-check the saved site, revise it with the last findings, or build again.
      const fromStep: ContinueFrom | undefined = p.fromStep === "qa" || p.fromStep === "revise" || p.fromStep === "rebuild" ? p.fromStep : undefined;
      if (fromStep) extra.fromStep = fromStep;
      try {
        return await autoHeal(
          await finishWorkflow(await resumeBuildAndVerify(runId, wf, { ...(reopen ? { reopen } : {}), ...(fromStep ? { fromStep } : {}) }), wf, extra),
          wf,
          extra,
          deps,
          startedAt,
        );
      } catch (err) {
        return crashed(err, runId, wf, extra);
      }
    }

    case "verify": {
      const relPath = str(p, "path", 200);
      if (!PAGE_PATH.test(relPath)) throw new Error("params.path must be clients/<slug>/pages/<name>.html");
      const clientSlug = relPath.split("/")[1]!;
      // Step 6: this job reads on the QA agent's behalf, so the QA scope decides, bound to the page's client and
      // to the entity that owns that client folder (clients/<slug>/brief.json; null for a client with no brief).
      const taskId = crypto.randomUUID();
      const entitySlug = fileClientEntityResolver(deps.repoRoot)(clientSlug);
      const registry = createSeedRegistry();
      const gate = permissionGateFor(registry, QA_EVALUATOR_ROLE, { taskId, runId: null, entitySlug, clientSlug, audit: deps.audit });
      const briefPath = `clients/${clientSlug}/brief.json`;
      try {
        await gate.authorize({ kind: "fs", op: "read", path: relPath });
        await gate.authorize({ kind: "fs", op: "read", path: briefPath });
      } catch (err) {
        if (err instanceof PermissionDeniedError) return { ok: false, reason: err.message, result: { path: relPath } };
        throw err;
      }
      let html = await deps.readArtifact(relPath);
      let source = "artifact-store";
      if (html === null) {
        html = await readFile(path.join(deps.repoRoot, relPath), "utf-8").catch(() => null);
        source = "repo";
      }
      if (html === null) return { ok: false, reason: `no page at ${relPath} (artifact store or repo)`, result: { path: relPath } };
      const sections = Array.isArray(p.sections) ? (p.sections as unknown[]).filter((s): s is string => typeof s === "string") : [];
      // Step 4B M1 claims gate: the client's brief on file is the only fact source; without one every
      // factual claim on the page fails as unsourced (fails closed).
      const briefOnFile = await readFile(path.join(deps.repoRoot, briefPath), "utf-8")
        .then((t) => JSON.parse(t) as { goal?: unknown; brandNotes?: unknown })
        .catch(() => null);
      const factSources = briefOnFile ? [briefOnFile.goal, briefOnFile.brandNotes].filter((s): s is string => typeof s === "string") : [];
      const run = await runAgent(
        deps.qaAgent,
        {
          taskId,
          entitySlug,
          clientSlug,
          role: QA_EVALUATOR_ROLE,
          input: {
            html,
            clientSlug,
            requiredSections: sections,
            otherClientSlugs: deps.knownClientSlugs.filter((s) => s !== clientSlug),
            goal: str(p, "goal", 1000),
            factSources,
          },
        },
        { registry, audit: deps.audit ? { sink: deps.audit } : null, clientEntityOf: fileClientEntityResolver(deps.repoRoot) },
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

/** The request behind an older plan, if the runner can look it up. A failed lookup is not a failed build: summary only. */
async function requestFor(planId: string, deps: HandlerDeps): Promise<string | null> {
  if (!deps.requests) return null;
  try {
    return await deps.requests.requestTextFor(planId);
  } catch {
    return null;
  }
}

/**
 * The brief a plan is built from. Plans approved before 2026-10-06 carry no page scope; their lead type says it.
 * Two owner details are not facts for the copy but settings the starters use: `asset.logo` (the uploaded logo record,
 * checked by the database when it was added and by the build when it runs) and `site_url` (the live address).
 */
export function briefForBuild(plan: Pick<Plan, "brief" | "intake">, inputs: PlanInput[] = [], requestText: string | null = null): PilotBrief {
  const scoped: PilotBrief = plan.brief.pageScope ? plan.brief : { ...plan.brief, pageScope: plan.intake.leadType === "landing_page" ? "single" : "multi" };
  // Build-quality Package 1: plans stored before 2026-10-14 carry no request. Use the intake job's text when it is on file
  // (the requested list stays empty: it was never checked), otherwise build from the summary and say so. Synonym sections
  // ("hero" and "home") are collapsed for those plans too (rehearsal log #4).
  const fallback = !scoped.requestText && requestText && requestText.length <= REQUEST_TEXT_MAX ? requestText : null;
  const base: PilotBrief = {
    ...scoped,
    requiredSections: canonicalSections(scoped.requiredSections),
    ...(fallback ? { requestText: fallback } : {}),
    briefBasis: scoped.requestText || fallback ? "request" : "summary-only",
  };
  const ownerFacts = ownerFactsFrom(inputs);
  const ownerSkipped = inputs.filter((i) => i.waived).map((i) => i.label);
  const logoInput = inputs.find((i) => i.key === LOGO_INPUT_KEY && !i.waived && i.value);
  let logo: PilotBrief["logo"];
  if (logoInput) {
    try {
      logo = parseBriefLogo(JSON.parse(logoInput.value!));
    } catch {
      throw new Error("the logo the owner added to this plan is not a readable logo record; upload it again");
    }
  }
  const siteUrl = inputs.find((i) => i.key === "site_url" && !i.waived && i.value)?.value;
  // Package 3: images the owner supplied per media slot (checked by the database when added, and again by the build).
  const images: SuppliedImage[] = [];
  for (const i of inputs) {
    if (!i.key.startsWith(IMAGE_INPUT_PREFIX) || i.waived || !i.value) continue;
    const slot = i.key.slice(IMAGE_INPUT_PREFIX.length);
    if (!SLOT_RE.test(slot)) continue;
    try {
      images.push({ slot, image: parseImageRecord(JSON.parse(i.value)) });
    } catch {
      throw new Error(`the image the owner added for ${slot} is not a readable image record; upload it again`);
    }
  }
  const launchWithPlaceholders = inputs.some((i) => i.key === LAUNCH_PLACEHOLDERS_KEY && !i.waived && i.value === "yes");
  return {
    ...base,
    ...(ownerFacts.length > 0 ? { ownerFacts } : {}),
    ...(ownerSkipped.length > 0 ? { ownerSkipped } : {}),
    ...(logo ? { logo } : {}),
    ...(siteUrl && /^https:\/\/[^/\s]+\/?$/i.test(siteUrl) ? { siteUrl } : {}),
    ...(images.length > 0 ? { images } : {}),
    ...(launchWithPlaceholders ? { launchWithPlaceholders: true } : {}),
  };
}
