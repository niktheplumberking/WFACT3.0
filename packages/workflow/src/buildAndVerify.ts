/**
 * Workflow engine v1 — `build-and-verify` (Continuation Build Plan Stage 3, Blueprint Phase 6 +
 * Fig. 02). The two-stage proof pattern, and only that:
 *
 *   front-end-builder ──► CHECKPOINT (built, not yet verified) ──► qa-evaluator
 *        ▲                                                             │ fail: specific failed checks
 *        └──────────── revise with those exact issues (bounded) ◄──────┘
 *                                                                      │ pass
 *                                         CHECKPOINT (verified) ──► launch GATE (human, never auto)
 *
 * Checkpoints are durable `workflow.checkpoint` rows in audit_log (not in-memory state), carrying
 * the artifact's path + sha256. QA always runs against the checkpointed artifact, re-hashed first —
 * never against an in-memory copy — so a crash between stages resumes from the last checkpoint via
 * `resumeBuildAndVerify(runId)` without re-running (or re-paying for) the build, and a tampered or
 * overwritten artifact is refused rather than verified (Blueprint §3: "never resume from an
 * unverified midpoint").
 *
 * STAND-IN DISCLOSURE (Continuation Plan rule 2): this is a hand-rolled, in-process workflow, NOT
 * the durable execution engine the Blueprint names (n8n / Temporal, §3/§13). Durability here is only
 * "checkpoints survive in Postgres and a human/CLI can resume"; nothing restarts a crashed run on its
 * own, and there is no queue. The Plan defers the real engine until concurrent workflows need it.
 *
 * Deploy is deliberately not a stage: an approved run ends at `awaiting_launch_approval`, a
 * hard-gate for a human (CLAUDE.md §3 — Launch stays human forever).
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { recordAudit, type AuditContext, type AuditReader, type AuditRecord, type AuditSink } from "@wfact/audit";
import { runAgent, type Agent, type AgentRegistry, type AgentRun } from "@wfact/agent-runtime";
import type { FrontendBuildInput } from "@wfact/frontend-loop/agent";
import type { FrontendLoopResult } from "@wfact/frontend-loop/loop";
import type { PilotBrief } from "@wfact/frontend-loop/brief";
import type { QaInput } from "@wfact/verification/agent";
import type { VerificationResult } from "@wfact/verification/verificationLoop";

export const WORKFLOW_ID = "build-and-verify";
/** Versioned per Blueprint §3 ("every workflow definition versioned ... referenced in every run"). */
export const WORKFLOW_VERSION = "1.0.0";
const DEFAULT_MAX_QA_REVISIONS = 2;

// ---------------------------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------------------------

export interface StoredArtifact {
  /** Repo-relative path, forward slashes. */
  path: string;
  sha256: string;
  bytes: number;
}

export interface ArtifactStore {
  write(relPath: string, content: string): Promise<StoredArtifact>;
  /** Returns the content only if it still hashes to `sha256`; throws `CheckpointIntegrityError` otherwise. */
  readVerified(artifact: StoredArtifact): Promise<string>;
}

export class CheckpointIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckpointIntegrityError";
  }
}

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/**
 * Where artifacts may live: a single page under clients/<slug>/pages/, or (Step 4B M3) the files of a
 * multi-page site under clients/<slug>/sites/<site>/ (pages, content.json, site.manifest.json).
 */
export const ARTIFACT_PATH_RE = /^clients\/[a-z][a-z0-9-]*\/(pages\/[a-z0-9-]+\.html|sites\/[a-z0-9-]+\/[a-z0-9][a-z0-9-.]*\.(html|json))$/;

function assertSafeRelPath(relPath: string): void {
  const normalized = path.posix.normalize(relPath);
  if (path.posix.isAbsolute(normalized) || normalized.startsWith("..") || normalized !== relPath || !ARTIFACT_PATH_RE.test(normalized)) {
    throw new CheckpointIntegrityError(`artifact path ${JSON.stringify(relPath)} is outside clients/<slug>/pages/ and clients/<slug>/sites/`);
  }
}

// ---------------------------------------------------------------------------------------------
// Multi-page sites (Step 4B M3): one manifest checkpoints every file
// ---------------------------------------------------------------------------------------------

export const SITE_MANIFEST = "site.manifest.json";
const SITE_SOURCE = "content.json";

export interface SiteManifest {
  version: 1;
  starterVersion: string;
  pages: string[];
  /** Every file of the site, including the content source; each re-hashed before QA. */
  files: { name: string; sha256: string; bytes: number }[];
  source: string;
}

const isSiteManifest = (artifact: StoredArtifact) => artifact.path.endsWith(`/${SITE_MANIFEST}`);

/** Writes every site file, then the manifest that pins their hashes. The manifest is the checkpoint. */
async function writeSite(store: ArtifactStore, dir: string, site: NonNullable<FrontendLoopResult["site"]>): Promise<StoredArtifact> {
  const entries = Object.entries({ ...site.files, [SITE_SOURCE]: site.contentJson }).sort(([a], [b]) => a.localeCompare(b));
  const files: SiteManifest["files"] = [];
  for (const [name, content] of entries) {
    const stored = await store.write(`${dir}/${name}`, content);
    files.push({ name, sha256: stored.sha256, bytes: stored.bytes });
  }
  const manifest: SiteManifest = { version: 1, starterVersion: site.starterVersion, pages: site.pages, files, source: SITE_SOURCE };
  return store.write(`${dir}/${SITE_MANIFEST}`, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Reads a checkpointed site back, refusing it if the manifest or any file changed since the checkpoint. */
export async function readSiteVerified(
  store: ArtifactStore,
  manifestArtifact: StoredArtifact,
): Promise<{ files: Record<string, string>; pages: string[]; contentJson: string }> {
  const manifest = JSON.parse(await store.readVerified(manifestArtifact)) as SiteManifest;
  const dir = manifestArtifact.path.slice(0, -SITE_MANIFEST.length - 1);
  const files: Record<string, string> = {};
  let contentJson = "";
  for (const f of manifest.files) {
    const content = await store.readVerified({ path: `${dir}/${f.name}`, sha256: f.sha256, bytes: f.bytes });
    if (f.name === manifest.source) contentJson = content;
    else files[f.name] = content;
  }
  for (const p of manifest.pages) {
    if (files[p] === undefined) throw new CheckpointIntegrityError(`site manifest lists page ${p} but has no file for it`);
  }
  return { files, pages: manifest.pages, contentJson };
}

/** Files under the repo root — the same location the front-end CLI has always written pages to. */
export class FileArtifactStore implements ArtifactStore {
  constructor(private readonly root: string) {}

  async write(relPath: string, content: string): Promise<StoredArtifact> {
    assertSafeRelPath(relPath);
    const abs = path.join(this.root, relPath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf-8");
    return { path: relPath, sha256: sha256(content), bytes: Buffer.byteLength(content, "utf8") };
  }

  async readVerified(artifact: StoredArtifact): Promise<string> {
    assertSafeRelPath(artifact.path);
    let content: string;
    try {
      content = readFileSync(path.join(this.root, artifact.path), "utf-8");
    } catch (err) {
      throw new CheckpointIntegrityError(`checkpointed artifact ${artifact.path} is unreadable: ${String(err)}`);
    }
    if (sha256(content) !== artifact.sha256) {
      throw new CheckpointIntegrityError(
        `checkpointed artifact ${artifact.path} no longer matches its checkpoint hash — refusing to verify a changed file`,
      );
    }
    return content;
  }
}

/** For tests. */
export class MemoryArtifactStore implements ArtifactStore {
  readonly files = new Map<string, string>();
  async write(relPath: string, content: string): Promise<StoredArtifact> {
    assertSafeRelPath(relPath);
    this.files.set(relPath, content);
    return { path: relPath, sha256: sha256(content), bytes: Buffer.byteLength(content, "utf8") };
  }
  async readVerified(artifact: StoredArtifact): Promise<string> {
    const content = this.files.get(artifact.path);
    if (content === undefined) throw new CheckpointIntegrityError(`checkpointed artifact ${artifact.path} is missing`);
    if (sha256(content) !== artifact.sha256) throw new CheckpointIntegrityError(`checkpointed artifact ${artifact.path} changed since checkpoint`);
    return content;
  }
}

// ---------------------------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------------------------

export interface WorkflowDeps {
  frontEndAgent: Agent<FrontendBuildInput, FrontendLoopResult>;
  qaAgent: Agent<QaInput, VerificationResult>;
  registry: AgentRegistry;
  /** Required, not optional: checkpoints must be durable for the workflow to mean anything. */
  audit: AuditSink;
  reader: AuditReader;
  artifacts: ArtifactStore;
  /** Every client slug the isolation check should treat as "someone else". */
  knownClientSlugs: string[];
  maxQaRevisions?: number;
}

export type WorkflowStatus =
  | "awaiting_launch_approval" // verified; the launch gate is a human's call
  | "failed_verification" // QA kept failing through every allowed revision
  | "not_verified_no_evaluator" // checks passed but no evaluator model — not "verified" (CLAUDE.md §1)
  | "build_failed" // builder escalated or was rejected
  | "qa_failed" // QA agent itself was rejected/escalated (not a verdict)
  | "checkpoint_corrupt" // artifact changed since its checkpoint — refused
  | "already_finished"; // resume of a run that already reached a terminal row

export interface QaFailure {
  failedChecks: { checkId: string; details: string[] }[];
  evaluatorIssues: string[];
}

export interface WorkflowResult {
  workflowRunId: string;
  workflowTaskId: string;
  status: WorkflowStatus;
  /** Build→QA cycles completed (1 = no revision needed). */
  cycles: number;
  lastCheckpoint: (StoredArtifact & { stage: "build" | "verified"; cycle: number }) | null;
  reason: string | null;
  /** The specific QA failure that stopped the run, when there was one. */
  qaFailure: QaFailure | null;
  /** Builder correction rounds from every build cycle, in order — for the correction-round log. */
  builderRounds: FrontendLoopResult["rounds"];
}

interface CheckpointState {
  stage: "build" | "verified";
  cycle: number;
  buildTaskId: string;
  artifact: StoredArtifact;
}

function requiredSectionsFor(brief: PilotBrief, templateSections: string[]): string[] {
  return [...new Set([...templateSections, ...brief.requiredSections])];
}

/** QA failure → the exact issue list the builder gets back. Specific check ids, never "try again". */
export function qaFailureToIssues(failure: QaFailure): string[] {
  return [
    ...failure.failedChecks.flatMap((c) =>
      c.details.length > 0 ? c.details.map((d) => `[${c.checkId}] ${d}`) : [`[${c.checkId}] failed`],
    ),
    ...failure.evaluatorIssues.map((i) => `[evaluator] ${i}`),
  ];
}

class Workflow {
  private readonly ctx: AuditContext;
  private readonly maxRevisions: number;
  private builderRounds: FrontendLoopResult["rounds"] = [];
  templateSections: string[] = [];

  constructor(
    private readonly deps: WorkflowDeps,
    readonly runId: string,
    readonly taskId: string,
    private readonly brief: PilotBrief,
  ) {
    this.ctx = { sink: deps.audit, actor: `workflow:${WORKFLOW_ID}`, runId, taskId, entitySlug: brief.entitySlug };
    this.maxRevisions = deps.maxQaRevisions ?? DEFAULT_MAX_QA_REVISIONS;
  }

  private result(
    status: WorkflowStatus,
    cycles: number,
    cp: CheckpointState | null,
    reason: string | null,
    qaFailure: QaFailure | null = null,
  ): WorkflowResult {
    return {
      workflowRunId: this.runId,
      workflowTaskId: this.taskId,
      status,
      cycles,
      lastCheckpoint: cp ? { ...cp.artifact, stage: cp.stage, cycle: cp.cycle } : null,
      reason,
      qaFailure,
      builderRounds: this.builderRounds,
    };
  }

  private async halt(
    status: WorkflowStatus,
    stage: string,
    cycles: number,
    cp: CheckpointState | null,
    reason: string,
    qaFailure: QaFailure | null = null,
  ): Promise<WorkflowResult> {
    await recordAudit(this.ctx, {
      action: "workflow.halt",
      outcome: "failure",
      payload: { workflow: WORKFLOW_ID, version: WORKFLOW_VERSION, status, stage, reason, qaFailure, cycles },
    });
    return this.result(status, cycles, cp, reason, qaFailure);
  }

  private async checkpoint(cp: CheckpointState): Promise<void> {
    await recordAudit(this.ctx, {
      action: "workflow.checkpoint",
      outcome: "success",
      payload: {
        workflow: WORKFLOW_ID,
        version: WORKFLOW_VERSION,
        stage: cp.stage,
        cycle: cp.cycle,
        buildTaskId: cp.buildTaskId,
        verified: cp.stage === "verified",
        ...cp.artifact,
      },
    });
  }

  async start(): Promise<WorkflowResult> {
    await recordAudit(this.ctx, {
      action: "workflow.start",
      outcome: "info",
      // The brief is stored so a resume can continue without the original file. Briefs carry no
      // secrets (see clients/<slug>/brief.json).
      payload: {
        workflow: WORKFLOW_ID,
        version: WORKFLOW_VERSION,
        brief: this.brief,
        maxQaRevisions: this.maxRevisions,
        // Which builder ran (e.g. "track-a"); a resume must use the same one.
        template: this.deps.frontEndAgent.parseInput({ brief: this.brief }).template.id,
      },
    });
    const built = await this.build(0, undefined);
    if ("halted" in built) return built.halted;
    return this.verifyLoop(built.cp);
  }

  /** Stage 1: run the builder (fresh or revision), write the artifact, checkpoint it. */
  private async build(
    cycle: number,
    revision: { html: string; issues: string[]; contentJson?: string } | undefined,
  ): Promise<{ cp: CheckpointState } | { halted: WorkflowResult }> {
    const buildTaskId = randomUUID();
    const run: AgentRun<FrontendLoopResult> = await runAgent(
      this.deps.frontEndAgent,
      { taskId: buildTaskId, role: this.deps.frontEndAgent.role, input: { brief: this.brief, revision }, entitySlug: this.brief.entitySlug },
      { registry: this.deps.registry, audit: { sink: this.deps.audit }, runId: this.runId },
    );
    if (run.output) this.builderRounds = [...this.builderRounds, ...run.output.rounds];
    if (run.status !== "completed" || !run.output?.finalHtml) {
      return { halted: await this.halt("build_failed", "build", cycle, null, `builder ${run.status}: ${run.reason ?? "no page produced"}`) };
    }
    const artifact = run.output.site
      ? await writeSite(this.deps.artifacts, `clients/${run.output.brief.clientSlug}/sites/${run.output.template.id}`, run.output.site)
      : await this.deps.artifacts.write(`clients/${run.output.brief.clientSlug}/pages/${run.output.template.id}.html`, run.output.finalHtml);
    const cp: CheckpointState = { stage: "build", cycle, buildTaskId, artifact };
    await this.checkpoint(cp);
    this.templateSections = run.output.template.requiredSections;
    return { cp };
  }

  /** Stage 2 (+ bounded revisions): QA the checkpointed artifact; bounce specifics back on failure. */
  async verifyLoop(initial: CheckpointState): Promise<WorkflowResult> {
    let cp = initial;
    for (;;) {
      let html: string;
      let site: { files: Record<string, string>; pages: string[]; contentJson: string } | null = null;
      try {
        if (isSiteManifest(cp.artifact)) {
          site = await readSiteVerified(this.deps.artifacts, cp.artifact);
          html = site.files[site.pages[0]!]!;
        } else {
          html = await this.deps.artifacts.readVerified(cp.artifact);
        }
      } catch (err) {
        return this.halt("checkpoint_corrupt", "qa", cp.cycle + 1, cp, err instanceof Error ? err.message : String(err));
      }

      const qaRun = await runAgent(
        this.deps.qaAgent,
        {
          taskId: randomUUID(),
          role: this.deps.qaAgent.role,
          entitySlug: this.brief.entitySlug,
          input: {
            html,
            clientSlug: this.brief.clientSlug,
            requiredSections: requiredSectionsFor(this.brief, this.templateSections),
            otherClientSlugs: this.deps.knownClientSlugs.filter((s) => s !== this.brief.clientSlug),
            goal: this.brief.goal,
            // Step 4B M1 claims gate: the approved brief is the only place a page fact may come from.
            factSources: [this.brief.goal, this.brief.brandNotes],
            ...(site ? { site: { files: site.files, pages: site.pages } } : {}),
          },
        },
        { registry: this.deps.registry, audit: { sink: this.deps.audit }, runId: this.runId },
      );
      if (qaRun.status !== "completed" || !qaRun.output) {
        return this.halt("qa_failed", "qa", cp.cycle + 1, cp, `qa-evaluator ${qaRun.status}: ${qaRun.reason}`);
      }
      const verdict = qaRun.output;

      if (verdict.status === "approved") {
        const verified: CheckpointState = { ...cp, stage: "verified" };
        await this.checkpoint(verified);
        await recordAudit(this.ctx, {
          action: "workflow.gate",
          outcome: "info",
          payload: {
            workflow: WORKFLOW_ID,
            version: WORKFLOW_VERSION,
            gate: "launch",
            tier: "hard-gate",
            note: "Verified and ready. Deploy is a human decision (CLAUDE.md §3); this workflow never deploys.",
            artifact: cp.artifact,
          },
        });
        return this.result("awaiting_launch_approval", cp.cycle + 1, verified, null);
      }

      if (verdict.status === "blocked_no_evaluator") {
        return this.halt(
          "not_verified_no_evaluator",
          "qa",
          cp.cycle + 1,
          cp,
          "deterministic checks passed but no evaluator model was configured — checks alone are not verification",
        );
      }

      const failure: QaFailure = {
        failedChecks: verdict.checkResults.filter((c) => !c.passed).map(({ checkId, details }) => ({ checkId, details })),
        evaluatorIssues: verdict.evaluator?.issues ?? [],
      };
      if (cp.cycle >= this.maxRevisions) {
        return this.halt(
          "failed_verification",
          "qa",
          cp.cycle + 1,
          cp,
          `QA still failing after ${this.maxRevisions} revision(s) — escalating to a human rather than retrying forever`,
          failure,
        );
      }

      const issues = qaFailureToIssues(failure);
      await recordAudit(this.ctx, {
        action: "workflow.return_to_builder",
        outcome: "info",
        payload: { workflow: WORKFLOW_ID, cycle: cp.cycle, issues, qaStatus: verdict.status },
      });
      const rebuilt = await this.build(cp.cycle + 1, site ? { html, issues, contentJson: site.contentJson } : { html, issues });
      if ("halted" in rebuilt) return rebuilt.halted;
      cp = rebuilt.cp;
    }
  }
}

/**
 * The single entry point for a client pipeline (Continuation Plan Stage 3, task 3): brief in,
 * either a verified page awaiting a human launch decision, or a specific, actionable failure.
 */
export async function buildAndVerify(rawBrief: unknown, deps: WorkflowDeps): Promise<WorkflowResult> {
  // Validate the brief exactly the way the builder will, before writing a single row.
  const brief = deps.frontEndAgent.parseInput({ brief: rawBrief }).brief;
  const wf = new Workflow(deps, randomUUID(), randomUUID(), brief);
  return wf.start();
}

/** The builder template a run recorded at start ("track-a", "clean-agency", ...), or null for older runs. */
export async function recordedBuilderTemplate(runId: string, reader: AuditReader): Promise<string | null> {
  const rows = await reader.listByRun(runId);
  const start = rows.find((r) => r.actor === `workflow:${WORKFLOW_ID}` && r.action === "workflow.start");
  const t = start?.payload?.template;
  return typeof t === "string" ? t : null;
}

/**
 * Crash recovery: continue a run from its last durable checkpoint. Never re-runs a build that has a
 * checkpoint; never trusts an artifact whose hash changed; never re-opens a run that already ended.
 */
export async function resumeBuildAndVerify(runId: string, deps: WorkflowDeps): Promise<WorkflowResult> {
  const rows: AuditRecord[] = await deps.reader.listByRun(runId);
  const workflowRows = rows.filter((r) => r.actor === `workflow:${WORKFLOW_ID}`);
  const start = workflowRows.find((r) => r.action === "workflow.start");
  if (!start || !start.taskId) {
    throw new Error(`no ${WORKFLOW_ID} run found for run_id ${runId}`);
  }
  const parsed = deps.frontEndAgent.parseInput({ brief: start.payload?.brief });
  const brief = parsed.brief;
  const recordedTemplate = start.payload?.template;
  if (typeof recordedTemplate === "string" && recordedTemplate !== parsed.template.id) {
    throw new Error(`run ${runId} was built by the "${recordedTemplate}" builder; resume it with that builder, not "${parsed.template.id}"`);
  }
  const wf = new Workflow(deps, runId, start.taskId, brief);

  const terminal = workflowRows.find((r) => r.action === "workflow.halt" || r.action === "workflow.gate");
  const checkpoints = workflowRows.filter((r) => r.action === "workflow.checkpoint");
  const last = checkpoints.at(-1);
  const lastCp: CheckpointState | null = last
    ? {
        stage: last.payload?.stage as "build" | "verified",
        cycle: Number(last.payload?.cycle),
        buildTaskId: String(last.payload?.buildTaskId),
        artifact: { path: String(last.payload?.path), sha256: String(last.payload?.sha256), bytes: Number(last.payload?.bytes) },
      }
    : null;

  if (terminal) {
    return {
      workflowRunId: runId,
      workflowTaskId: start.taskId,
      status: "already_finished",
      cycles: lastCp ? lastCp.cycle + 1 : 0,
      lastCheckpoint: lastCp ? { ...lastCp.artifact, stage: lastCp.stage, cycle: lastCp.cycle } : null,
      reason: `run already ended with ${terminal.action} — not re-opened`,
      qaFailure: null,
      builderRounds: [],
    };
  }
  if (!lastCp) {
    // Crashed before the first checkpoint: there's nothing to resume from, so the build starts
    // again under the same run id (Blueprint §3's rollback target is "the last checkpoint" — none).
    return wf.start();
  }
  // Template sections come from the brief's template choice, exactly as the builder derives them.
  wf.templateSections = deps.frontEndAgent.parseInput({ brief }).template.requiredSections;
  // A "verified" checkpoint without its gate row is re-verified rather than gated on trust.
  return wf.verifyLoop({ ...lastCp, stage: "build" });
}
