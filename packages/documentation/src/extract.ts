/**
 * Deterministic extraction: a workflow run's audit_log + model_traces rows -> one draft episode per finished stage.
 * No model is involved: every field is read or computed from the structured record (Factory Completion Plan Step 5,
 * "prefer deterministic extraction"). The same code serves the live path (the agent, at the end of a stage, extracts
 * the run so far and records the stage that just ended) and the backfill path (all stages of an old run), so a live
 * run also proves the backfill.
 *
 * Stage boundaries come from the workflow's own rows (packages/workflow/src/buildAndVerify.ts):
 *   build: opened by the builder agent's agent.spawn / agent.reject, closed by workflow.checkpoint{stage:"build"} or
 *          workflow.halt{stage:"build"};
 *   qa:    opened by the QA agent's agent.spawn / agent.reject (or by a qa halt with no QA run, e.g. a corrupt
 *          checkpoint), closed by workflow.gate, workflow.return_to_builder or workflow.halt{stage:"qa"}.
 * Rows written by the Documentation agent itself, and the workflow's documentation escalations, are ignored.
 *
 * Everything that could carry client text or model output (halt reasons, check details, evaluator issues) passes
 * through `safeText` (redaction, one line, no markup, capped). The brief is recorded as a hash, never its content.
 */
import {
  EPISODE_LIMITS,
  EPISODE_SCHEMA_VERSION,
  canonicalJson,
  episodeId,
  safeText,
  sha256Hex,
  type Episode,
  type EpisodeInput,
  type EpisodeStage,
} from "@wfact/hermes-lite/tools/episodes";
import type { RunAuditRow, RunTraceRow } from "./records.js";

export const DEFAULT_STAGE_ROLES = { build: "front-end-builder", qa: "qa-evaluator" } as const;
export const DOCUMENTATION_ACTOR = "agent:documentation";

/** An episode before the agent stamps who documented it and when. */
export type EpisodeDraft = Omit<Episode, "backfilled" | "documentedBy" | "documentedAt">;

interface OpenStage {
  stage: EpisodeStage;
  taskId: string | null;
  role: string | null;
  rows: RunAuditRow[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const numOr = (v: unknown, d: number | null): number | null => (typeof v === "number" && Number.isFinite(v) ? v : d);
const strOr = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const SHA_RE = /^[0-9a-f]{64}$/;
const STATUS_RE = /^[a-z][a-z0-9_]*$/;

function artifactOf(p: Record<string, unknown> | undefined): Episode["artifact"] {
  if (!p) return null;
  const path = strOr(p.path);
  const sha = strOr(p.sha256);
  const bytes = numOr(p.bytes, null);
  if (!path || !sha || !SHA_RE.test(sha) || bytes === null || !/^clients\/[a-z][a-z0-9-]*\/[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(path)) return null;
  return { path, sha256: sha, bytes: Math.max(0, Math.round(bytes)) };
}

export interface ExtractOptions {
  roles?: { build: string; qa: string };
}

export interface ExtractResult {
  workflow: { id: string; version: string | null };
  workflowTaskId: string | null;
  entitySlug: string | null;
  clientSlug: string | null;
  drafts: EpisodeDraft[];
}

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

/** Throws ExtractionError if the rows are not a workflow run (no workflow.start). */
export function extractStageDrafts(rowsIn: RunAuditRow[], traces: RunTraceRow[], opts: ExtractOptions = {}): ExtractResult {
  const roles = opts.roles ?? DEFAULT_STAGE_ROLES;
  const rows = rowsIn.filter((r) => r.actor !== DOCUMENTATION_ACTOR && r.action !== "workflow.documentation_escalated");
  const start = rows.find((r) => r.action === "workflow.start" && r.actor.startsWith("workflow:"));
  if (!start) throw new ExtractionError("no workflow.start row in this run, so it is not a workflow run");
  const workflowActor = start.actor;
  const workflowId = workflowActor.slice("workflow:".length);
  const version = strOr(start.payload.version);
  const brief = isObj(start.payload.brief) ? start.payload.brief : null;
  const briefSha = brief ? sha256Hex(canonicalJson(brief)) : null;
  const template = strOr(start.payload.template);
  const runId = start.runId!;
  const entitySlug = start.entitySlug ?? strOr(brief?.entitySlug);
  const clientSlug = strOr(brief?.clientSlug);

  const drafts: EpisodeDraft[] = [];
  let open: OpenStage | null = null;
  let lastBuildCycle = 0;
  let lastArtifact: Episode["artifact"] = null;
  let pendingIssues: string[] | null = null;
  let buildCount = 0;

  const close = (closing: RunAuditRow, stage: EpisodeStage) => {
    const st: OpenStage = open && open.stage === stage ? open : { stage, taskId: null, role: null, rows: [] };
    if (!st.rows.includes(closing)) st.rows.push(closing);
    drafts.push(buildDraft(st, closing));
    open = null;
  };

  const buildDraft = (st: OpenStage, closing: RunAuditRow): EpisodeDraft => {
    let redactions = 0;
    const clean = (raw: unknown, max?: number) => {
      const r = safeText(raw, max);
      redactions += r.redactions;
      return r.text;
    };
    const p = closing.payload;
    const agentEnd = st.rows.find((r) => r.taskId === st.taskId && ["agent.complete", "agent.escalate", "agent.reject"].includes(r.action));
    const summary = isObj(agentEnd?.payload.summary) ? (agentEnd!.payload.summary as Record<string, unknown>) : {};
    const stageTraces = st.taskId ? traces.filter((t) => t.taskId === st.taskId) : [];
    const cost = {
      meteredUsd: Math.round(stageTraces.reduce((s, t) => s + (t.priceBasis === "metered" && t.costUsd !== null ? t.costUsd : 0), 0) * 1e6) / 1e6,
      calls: stageTraces.length,
      unpricedCalls: stageTraces.filter((t) => t.priceBasis === "unpriced").length,
      inputTokens: stageTraces.reduce((s, t) => s + t.inputTokens, 0),
      outputTokens: stageTraces.reduce((s, t) => s + t.outputTokens, 0),
      models: [...new Set(stageTraces.map((t) => t.model))].slice(0, 10),
    };
    const inputs: EpisodeInput[] = [];
    let cycle: number;
    let status: string;
    let summaryText: string;
    let reason: string | null = null;
    let artifact: Episode["artifact"] = null;
    let failedChecks: Episode["failedChecks"] = [];
    let checksRun: number | null = null;
    let evaluatorVerdict: string | null = null;
    let issuesReturned: string[] = [];
    let issuesReturnedCount = 0;
    const builderRounds = st.stage === "build" ? numOr(summary.correctionRounds, null) : null;
    const builderApproved = st.stage === "build" && typeof summary.approved === "boolean" ? summary.approved : null;
    const agentWord = agentEnd ? ({ "agent.complete": "completed", "agent.escalate": "escalated", "agent.reject": "was rejected" } as Record<string, string>)[agentEnd.action]! : "did not finish";

    if (st.stage === "build") {
      cycle = closing.action === "workflow.checkpoint" ? numOr(p.cycle, buildCount)! : numOr(p.cycles, buildCount)!;
      if (briefSha) inputs.push({ name: "brief", sha256: briefSha });
      if (cycle > 0 && lastArtifact) inputs.push({ name: `previous artifact ${lastArtifact.path}`.slice(0, 200), sha256: lastArtifact.sha256 });
      if (cycle > 0 && pendingIssues) inputs.push({ name: `QA issues from cycle ${cycle - 1}`, sha256: sha256Hex(canonicalJson(pendingIssues)) });
      if (closing.action === "workflow.checkpoint") {
        status = "checkpointed";
        artifact = artifactOf(p);
        lastArtifact = artifact;
        summaryText =
          `Build cycle ${cycle}: the builder${template ? ` (${template})` : ""} produced ${artifact?.path ?? "an artifact"}` +
          `${builderRounds !== null ? ` after ${builderRounds} internal correction round(s)` : ""}` +
          `${builderApproved === true ? ", approved by its own reviewer" : builderApproved === false ? ", without its own reviewer's approval" : ""}; checkpointed as built, not yet verified.`;
      } else {
        status = strOr(p.status) && STATUS_RE.test(String(p.status)) ? String(p.status) : "build_failed";
        reason = clean(p.reason);
        summaryText = `Build cycle ${cycle}: the build stopped (${status}); the builder agent ${agentWord}, and no artifact was checkpointed.`;
      }
      buildCount = cycle + 1;
      lastBuildCycle = cycle;
    } else {
      cycle = lastBuildCycle;
      const decision = st.rows.find((r) => r.action === "verification.decision" && r.taskId === st.taskId);
      const checks = Array.isArray(decision?.payload.checks) ? (decision!.payload.checks as unknown[]).filter(isObj) : null;
      if (checks) {
        checksRun = checks.length;
        failedChecks = checks
          .filter((c) => c.passed === false)
          .slice(0, EPISODE_LIMITS.failedChecks)
          .map((c) => ({
            checkId: clean(c.checkId, 100).replace(/[^A-Za-z0-9_.:-]/g, "-") || "unknown",
            detail: Array.isArray(c.details) && c.details.length ? clean((c.details as unknown[]).join(" "), 200) : null,
          }));
      } else if (Array.isArray(summary.failedChecks)) {
        failedChecks = (summary.failedChecks as unknown[])
          .slice(0, EPISODE_LIMITS.failedChecks)
          .map((id) => ({ checkId: clean(id, 100).replace(/[^A-Za-z0-9_.:-]/g, "-") || "unknown", detail: null }));
      }
      const verdict = isObj(decision?.payload.evaluator) ? (decision!.payload.evaluator as Record<string, unknown>).verdict : summary.evaluatorVerdict;
      evaluatorVerdict = typeof verdict === "string" && STATUS_RE.test(verdict) ? verdict : null;
      const checkpoint = rows.filter((r) => r.action === "workflow.checkpoint" && r.payload.stage === "build" && rows.indexOf(r) < rows.indexOf(closing)).at(-1);
      const verifiedArtifact = artifactOf(checkpoint?.payload) ?? lastArtifact;
      if (verifiedArtifact) inputs.push({ name: `artifact ${verifiedArtifact.path}`.slice(0, 200), sha256: verifiedArtifact.sha256 });
      artifact = verifiedArtifact;
      const checksText = checksRun !== null ? `${checksRun - failedChecks.length} of ${checksRun} automated checks passed` : "the automated checks ran";
      if (closing.action === "workflow.gate") {
        status = "verified_awaiting_launch_approval";
        summaryText =
          `QA cycle ${cycle}: approved. ${checksText} and the independent evaluator ${evaluatorVerdict === "approved" ? "approved" : `returned "${evaluatorVerdict ?? "no verdict"}"`}; ` +
          "the work is verified and waits for a human launch decision (nothing was deployed).";
      } else if (closing.action === "workflow.return_to_builder") {
        status = "returned_to_builder";
        const issues = Array.isArray(p.issues) ? (p.issues as unknown[]) : [];
        pendingIssues = issues.map((i) => String(i));
        issuesReturnedCount = issues.length;
        issuesReturned = issues.slice(0, EPISODE_LIMITS.issues).map((i) => clean(i, 240)).filter((t) => t.length > 0);
        summaryText =
          `QA cycle ${cycle}: not approved. ${checksText}${failedChecks.length ? ` (failed: ${failedChecks.map((c) => c.checkId).join(", ")})` : ""}; ` +
          `evaluator verdict "${evaluatorVerdict ?? "none"}"; ${issuesReturnedCount} issue(s) were sent back to the builder for a revision.`;
      } else {
        status = strOr(p.status) && STATUS_RE.test(String(p.status)) ? String(p.status) : "qa_halted";
        reason = clean(p.reason);
        const qf = isObj(p.qaFailure) ? p.qaFailure : null;
        if (qf && failedChecks.length === 0 && Array.isArray(qf.failedChecks)) {
          failedChecks = (qf.failedChecks as unknown[]).filter(isObj).slice(0, EPISODE_LIMITS.failedChecks).map((c) => ({
            checkId: clean(c.checkId, 100).replace(/[^A-Za-z0-9_.:-]/g, "-") || "unknown",
            detail: Array.isArray(c.details) && c.details.length ? clean((c.details as unknown[]).join(" "), 200) : null,
          }));
        }
        summaryText =
          `QA cycle ${cycle}: the run stopped with "${status}"${st.taskId ? ` after the QA agent ${agentWord}` : " before the QA agent ran"}. ` +
          `${checksRun !== null ? `${checksText}. ` : ""}A human has to decide what happens next.`;
      }
    }

    const auditRowIds = [...new Set(st.rows.map((r) => r.id))].slice(0, EPISODE_LIMITS.ids);
    const traceIds = stageTraces.map((t) => t.id).slice(0, EPISODE_LIMITS.ids);
    const actor = st.role ? `agent:${st.role}` : workflowActor;
    return {
      v: EPISODE_SCHEMA_VERSION,
      entryId: episodeId(runId, st.stage, cycle, st.taskId),
      workflow: { id: workflowId, version },
      workflowRunId: runId,
      workflowTaskId: start.taskId,
      stage: st.stage,
      cycle,
      stageTaskId: st.taskId,
      at: new Date(closing.occurredAt).toISOString(),
      actor,
      entitySlug: entitySlug ?? "unknown",
      clientSlug: clientSlug ?? "unknown",
      outcome: { status, summary: summaryText.slice(0, EPISODE_LIMITS.text * 2), reason: reason || null },
      inputs: inputs.slice(0, EPISODE_LIMITS.inputs),
      artifact,
      failedChecks,
      checksRun,
      evaluatorVerdict,
      corrections: { builderRounds, builderApproved, issuesReturnedCount, issuesReturned },
      cost,
      links: {
        auditRunQuery: st.taskId ? `audit_log?run_id=eq.${runId}&task_id=eq.${st.taskId}` : `audit_log?run_id=eq.${runId}`,
        auditRowIds,
        traceIds,
      },
      redactions,
    };
  };

  for (const row of rows) {
    const role = row.actor.startsWith("agent:") ? row.actor.slice("agent:".length) : null;
    const opens = row.action === "agent.spawn" || row.action === "agent.reject";
    if (role && opens && row.taskId && (open as OpenStage | null)?.taskId !== row.taskId) {
      if (role === roles.build) open = { stage: "build", taskId: row.taskId, role, rows: [] };
      else if (role === roles.qa) open = { stage: "qa", taskId: row.taskId, role, rows: [] };
    }
    const cur = open as OpenStage | null;
    if (cur && (row.taskId === cur.taskId || row.actor === workflowActor) && row.action !== "workflow.start") cur.rows.push(row);

    if (row.actor !== workflowActor) continue;
    const stagePayload = row.payload.stage;
    if (row.action === "workflow.checkpoint" && stagePayload === "build") close(row, "build");
    else if (row.action === "workflow.halt" && stagePayload === "build") close(row, "build");
    else if (row.action === "workflow.gate") close(row, "qa");
    else if (row.action === "workflow.return_to_builder") close(row, "qa");
    else if (row.action === "workflow.halt" && stagePayload === "qa") close(row, "qa");
  }

  return { workflow: { id: workflowId, version }, workflowTaskId: start.taskId ?? null, entitySlug: entitySlug ?? null, clientSlug, drafts };
}
