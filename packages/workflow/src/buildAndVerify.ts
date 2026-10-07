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
import { AuditWriteError, recordAudit, type AuditContext, type AuditReader, type AuditRecord, type AuditSink } from "@wfact/audit";
import {
  permissionGateFor,
  PermissionDeniedError,
  runAgent,
  type Agent,
  type AgentRegistry,
  type AgentRun,
  type PermissionGate,
} from "@wfact/agent-runtime";
import type { FrontendBuildInput } from "@wfact/frontend-loop/agent";
import type { FrontendLoopResult } from "@wfact/frontend-loop/loop";
import { briefFactSources, type PilotBrief } from "@wfact/frontend-loop/brief";
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
  /** Step 4B M4: binary files (a Track B site's fonts). Same contract, bytes instead of text. */
  writeBytes?(relPath: string, bytes: Buffer): Promise<StoredArtifact>;
  readVerifiedBytes?(artifact: StoredArtifact): Promise<Buffer>;
}

export class CheckpointIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckpointIntegrityError";
  }
}

const sha256 = (s: string | Buffer) => (typeof s === "string" ? createHash("sha256").update(s, "utf8") : createHash("sha256").update(s)).digest("hex");

/**
 * Where artifacts may live: a single page under clients/<slug>/pages/, or (Step 4B M3) the files of a
 * multi-page site under clients/<slug>/sites/<site>/ (pages, content.json, site.manifest.json). Since M4 a
 * site's files may sit in folders (a Next.js export's _next/static/..., the built source under _source/),
 * with the extensions a static site and its source use; never "..", never a dotfile.
 */
export const ARTIFACT_PATH_RE =
  /^clients\/[a-z][a-z0-9-]*\/(pages\/[a-z0-9-]+\.html|sites\/[a-z0-9-]+\/(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_.-]*(\/[A-Za-z0-9_][A-Za-z0-9_.-]*)*\.(html|json|txt|xml|js|mjs|css|svg|woff2|ico|webmanifest|ts|tsx))$/;

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
/** Step 4B M4: the project a Track B site was built from is stored beside its output, under this folder. */
export const SITE_SOURCE_DIR = "_source";

export interface SiteManifest {
  version: 1;
  starterVersion: string;
  pages: string[];
  /** Every file of the site, including the content source; each re-hashed before QA. */
  files: { name: string; sha256: string; bytes: number }[];
  source: string;
  /** Step 4B M4: files stored as bytes (fonts); hashes are over the bytes. */
  binary?: string[];
  /** Step 4B M4: how the static build ran (isolation probe, timings, output hash). */
  build?: unknown;
}

const isSiteManifest = (artifact: StoredArtifact) => artifact.path.endsWith(`/${SITE_MANIFEST}`);

/**
 * Writes every site file, then the manifest that pins their hashes. The manifest is the checkpoint.
 * Track B (M4) adds the built project under _source/ and stores fonts as bytes, not base64 text.
 */
export async function writeSite(store: ArtifactStore, dir: string, site: NonNullable<FrontendLoopResult["site"]>): Promise<StoredArtifact> {
  const binary = new Set(site.binary ?? []);
  if (binary.size && !store.writeBytes) throw new CheckpointIntegrityError("this artifact store cannot hold binary files, so the site cannot be checkpointed");
  const sourceFiles = Object.fromEntries(Object.entries(site.source ?? {}).map(([rel, text]) => [`${SITE_SOURCE_DIR}/${rel}`, text]));
  const entries = Object.entries({ ...site.files, ...sourceFiles, [SITE_SOURCE]: site.contentJson }).sort(([a], [b]) => a.localeCompare(b));
  const files: SiteManifest["files"] = [];
  for (const [name, content] of entries) {
    const stored = binary.has(name) ? await store.writeBytes!(`${dir}/${name}`, Buffer.from(content, "base64")) : await store.write(`${dir}/${name}`, content);
    files.push({ name, sha256: stored.sha256, bytes: stored.bytes });
  }
  const manifest: SiteManifest = {
    version: 1,
    starterVersion: site.starterVersion,
    pages: site.pages,
    files,
    source: SITE_SOURCE,
    ...(binary.size ? { binary: [...binary].sort() } : {}),
    ...(site.buildRecord ? { build: site.buildRecord } : {}),
  };
  return store.write(`${dir}/${SITE_MANIFEST}`, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Reads a checkpointed site back, refusing it if the manifest or any file changed since the checkpoint. */
export async function readSiteVerified(
  store: ArtifactStore,
  manifestArtifact: StoredArtifact,
): Promise<{ files: Record<string, string>; pages: string[]; contentJson: string; binary?: string[] }> {
  const manifest = JSON.parse(await store.readVerified(manifestArtifact)) as SiteManifest;
  const dir = manifestArtifact.path.slice(0, -SITE_MANIFEST.length - 1);
  const binary = new Set(manifest.binary ?? []);
  if (binary.size && !store.readVerifiedBytes) throw new CheckpointIntegrityError("this artifact store cannot read binary files back");
  const files: Record<string, string> = {};
  let contentJson = "";
  for (const f of manifest.files) {
    const artifact = { path: `${dir}/${f.name}`, sha256: f.sha256, bytes: f.bytes };
    // Every file is re-hashed, the built source included, even though QA only serves the output.
    const content = binary.has(f.name) ? (await store.readVerifiedBytes!(artifact)).toString("base64") : await store.readVerified(artifact);
    if (f.name === manifest.source) contentJson = content;
    else if (!f.name.startsWith(`${SITE_SOURCE_DIR}/`)) files[f.name] = content;
  }
  for (const p of manifest.pages) {
    if (files[p] === undefined) throw new CheckpointIntegrityError(`site manifest lists page ${p} but has no file for it`);
  }
  return { files, pages: manifest.pages, contentJson, ...(binary.size ? { binary: [...binary] } : {}) };
}

/**
 * Step 6: a view of an ArtifactStore whose every write and read is first authorized against an agent role's
 * permission gate (fs:write / fs:read of the exact path). The workflow writes the builder's output through the
 * builder's gate and reads the checkpoint back through the QA agent's gate, so each role's scope (its own client
 * folder only) decides, not this file. The path allow-list in the stores below still applies on top.
 */
export function gatedArtifactStore(store: ArtifactStore, gate: PermissionGate): ArtifactStore {
  const fs = (op: "read" | "write", p: string) => gate.authorize({ kind: "fs", op, path: p });
  return {
    write: async (relPath, content) => {
      await fs("write", relPath);
      return store.write(relPath, content);
    },
    readVerified: async (artifact) => {
      await fs("read", artifact.path);
      return store.readVerified(artifact);
    },
    ...(store.writeBytes
      ? {
          writeBytes: async (relPath: string, bytes: Buffer) => {
            await fs("write", relPath);
            return store.writeBytes!(relPath, bytes);
          },
        }
      : {}),
    ...(store.readVerifiedBytes
      ? {
          readVerifiedBytes: async (artifact: StoredArtifact) => {
            await fs("read", artifact.path);
            return store.readVerifiedBytes!(artifact);
          },
        }
      : {}),
  };
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

  async writeBytes(relPath: string, bytes: Buffer): Promise<StoredArtifact> {
    assertSafeRelPath(relPath);
    const abs = path.join(this.root, relPath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, bytes);
    return { path: relPath, sha256: sha256(bytes), bytes: bytes.length };
  }

  async readVerifiedBytes(artifact: StoredArtifact): Promise<Buffer> {
    assertSafeRelPath(artifact.path);
    let bytes: Buffer;
    try {
      bytes = readFileSync(path.join(this.root, artifact.path));
    } catch (err) {
      throw new CheckpointIntegrityError(`checkpointed artifact ${artifact.path} is unreadable: ${String(err)}`);
    }
    if (sha256(bytes) !== artifact.sha256) {
      throw new CheckpointIntegrityError(`checkpointed artifact ${artifact.path} no longer matches its checkpoint hash — refusing to verify a changed file`);
    }
    return bytes;
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
  readonly blobs = new Map<string, Buffer>();
  async writeBytes(relPath: string, bytes: Buffer): Promise<StoredArtifact> {
    assertSafeRelPath(relPath);
    this.blobs.set(relPath, Buffer.from(bytes));
    return { path: relPath, sha256: sha256(bytes), bytes: bytes.length };
  }
  async readVerifiedBytes(artifact: StoredArtifact): Promise<Buffer> {
    const bytes = this.blobs.get(artifact.path);
    if (bytes === undefined) throw new CheckpointIntegrityError(`checkpointed artifact ${artifact.path} is missing`);
    if (sha256(bytes) !== artifact.sha256) throw new CheckpointIntegrityError(`checkpointed artifact ${artifact.path} changed since checkpoint`);
    return bytes;
  }
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

/**
 * Step 5 (Continuation Plan Stage 6): the end of every workflow stage is announced to an observer, which the
 * composition root fills with the Documentation agent (packages/documentation). A schema-validated handoff, not
 * prose: ids, the stage, its cycle and the stage's own agent task. The observer reads the rest from the run's
 * audit trail itself.
 */
export interface StageEndEvent {
  workflow: string;
  workflowVersion: string;
  workflowRunId: string;
  workflowTaskId: string;
  stage: "build" | "qa";
  cycle: number;
  /** The builder's or QA agent's task id for this stage; null when no agent ran (e.g. the checkpoint was corrupt). */
  stageTaskId: string | null;
  /** The stage's result as the workflow saw it, e.g. "checkpointed", "build_failed", "returned_to_builder", "awaiting_launch_approval". */
  status: string;
  entitySlug: string;
  clientSlug: string;
}

export interface StageObserverResult {
  /** False when the stage could not be documented: the workflow records an escalation, it never skips silently. */
  ok: boolean;
  reason: string | null;
  /** The observer's own agent task (for the escalation row), when it ran one. */
  taskId?: string | null;
}

export interface StageObserver {
  stageEnded(event: StageEndEvent): Promise<StageObserverResult>;
}

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
  /** Step 5: told about the end of every stage (the Documentation agent). Optional so older callers are unchanged. */
  stageObserver?: StageObserver;
  /**
   * Step 4D: told the run id the moment a new run starts, before any model is paid. The job runner uses it to link the
   * Cockpit job to the run, so a job that the runner never got to finish (GitHub timeout, crash) can still be continued.
   */
  onRunStart?: (runId: string) => Promise<void>;
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
  /** Step 5: stages the observer could not document (each also a `workflow.documentation_escalated` row). */
  documentationEscalations?: { stage: "build" | "qa"; cycle: number; reason: string }[];
  /** Step 4D: what the evaluator says the client still has to supply ("NEEDS CLIENT INPUT" notes on an approval). */
  needsFromClient?: string[];
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

/**
 * Why a run that passed every deterministic check is still not verified. Two different situations share
 * that status: a required review that could not run (e.g. the design reviewer's gateway was down: 2026-10-03,
 * Cockpit job 5c85914b, HTTP 502 four times) and no evaluator model at all. The reason names which, so
 * the Cockpit does not tell the owner to fix a configuration that is fine.
 */
export function notVerifiedReason(checkResults: { checkId: string; details: string[]; notRun?: boolean }[]): string {
  const notRun = checkResults.filter((c) => c.notRun);
  if (notRun.length === 0) {
    return "deterministic checks passed but no evaluator model was configured — checks alone are not verification";
  }
  const what = notRun.map((c) => `${c.checkId}: ${c.details.join(" ").slice(0, 300) || "no answer"}`).join("; ");
  return `deterministic checks passed but a required review could not run (${what}) — checks alone are not verification; nothing is wrong with the site's checks, start the build again once the reviewer is reachable`;
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
  private readonly documentationEscalations: NonNullable<WorkflowResult["documentationEscalations"]> = [];
  templateSections: string[] = [];
  /**
   * Step 4D: the cycle a reopened run restarts counting revisions from. A run that was reopened by a person gets a fresh
   * revision budget (maxRevisions more rounds), otherwise a run halted at its cap would halt again on the first failed check.
   */
  cycleBase = 0;
  private clientNeeds: string[] = [];

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
      ...(this.deps.stageObserver ? { documentationEscalations: [...this.documentationEscalations] } : {}),
      ...(this.clientNeeds.length > 0 ? { needsFromClient: [...this.clientNeeds] } : {}),
    };
  }

  /**
   * Step 5: tell the observer a stage ended. A failure to document is an escalation (an audit row the Cockpit can
   * show and a field on the result), never a silent skip, and never a reason to undo the stage itself. An audit write
   * failure is not swallowed: audit is fail-closed.
   */
  private async stageEnded(stage: "build" | "qa", cycle: number, stageTaskId: string | null, status: string): Promise<void> {
    const observer = this.deps.stageObserver;
    if (!observer) return;
    let res: StageObserverResult;
    try {
      res = await observer.stageEnded({
        workflow: WORKFLOW_ID,
        workflowVersion: WORKFLOW_VERSION,
        workflowRunId: this.runId,
        workflowTaskId: this.taskId,
        stage,
        cycle,
        stageTaskId,
        status,
        entitySlug: this.brief.entitySlug,
        clientSlug: this.brief.clientSlug,
      });
    } catch (err) {
      if (err instanceof AuditWriteError) throw err;
      res = { ok: false, reason: `the stage observer threw: ${err instanceof Error ? err.message : String(err)}` };
    }
    if (res.ok) return;
    const reason = res.reason ?? "the stage could not be documented (no reason given)";
    this.documentationEscalations.push({ stage, cycle, reason });
    await recordAudit(this.ctx, {
      action: "workflow.documentation_escalated",
      outcome: "failure",
      payload: {
        workflow: WORKFLOW_ID,
        version: WORKFLOW_VERSION,
        stage,
        cycle,
        stageTaskId,
        status,
        documentationTaskId: res.taskId ?? null,
        reason,
        tier: "notify-and-wait",
        note: "Memory entry missing for this stage: fix the cause, then backfill it from the audit trail (packages/documentation).",
      },
    });
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

  /** Step 6: the gate for I/O this workflow does on behalf of `role` for one of its tasks. */
  private gateFor(role: string, taskId: string): PermissionGate {
    return permissionGateFor(this.deps.registry, role, {
      taskId,
      runId: this.runId,
      entitySlug: this.brief.entitySlug,
      clientSlug: this.brief.clientSlug,
      audit: this.deps.audit,
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
    await this.deps.onRunStart?.(this.runId);
    return this.buildFrom(0, null);
  }

  /** Build (cycle `cycle`) and then verify. `prior` is the last checkpoint when a reopened run builds again, kept on a halt. */
  async buildFrom(cycle: number, prior: CheckpointState | null): Promise<WorkflowResult> {
    const built = await this.build(cycle, undefined, prior);
    if ("halted" in built) return built.halted;
    return this.verifyLoop(built.cp);
  }

  /** Stage 1: run the builder (fresh or revision), write the artifact, checkpoint it. */
  private async build(
    cycle: number,
    revision: { html: string; issues: string[]; contentJson?: string } | undefined,
    prior: CheckpointState | null = null,
  ): Promise<{ cp: CheckpointState } | { halted: WorkflowResult }> {
    const buildTaskId = randomUUID();
    const run: AgentRun<FrontendLoopResult> = await runAgent(
      this.deps.frontEndAgent,
      {
        taskId: buildTaskId,
        role: this.deps.frontEndAgent.role,
        input: { brief: this.brief, revision },
        entitySlug: this.brief.entitySlug,
        // Step 6: the build is bound to this client's folder; a client of another entity is refused before it runs.
        clientSlug: this.brief.clientSlug,
      },
      { registry: this.deps.registry, audit: { sink: this.deps.audit }, runId: this.runId },
    );
    if (run.output) this.builderRounds = [...this.builderRounds, ...run.output.rounds];
    if (run.status !== "completed" || !run.output?.finalHtml) {
      const halted = await this.halt("build_failed", "build", cycle, prior, `builder ${run.status}: ${run.reason ?? "no page produced"}`);
      await this.stageEnded("build", cycle, buildTaskId, "build_failed");
      return { halted };
    }
    // Written on the builder's behalf, through the builder's scope and binding (its own client folder only).
    const writer = gatedArtifactStore(this.deps.artifacts, this.gateFor(this.deps.frontEndAgent.role, buildTaskId));
    let artifact: StoredArtifact;
    try {
      artifact = run.output.site
        ? await writeSite(writer, `clients/${run.output.brief.clientSlug}/sites/${run.output.template.id}`, run.output.site)
        : await writer.write(`clients/${run.output.brief.clientSlug}/pages/${run.output.template.id}.html`, run.output.finalHtml);
    } catch (err) {
      if (err instanceof PermissionDeniedError) {
        const halted = await this.halt("build_failed", "build", cycle, prior, err.message);
        await this.stageEnded("build", cycle, buildTaskId, "build_failed");
        return { halted };
      }
      throw err;
    }
    const cp: CheckpointState = { stage: "build", cycle, buildTaskId, artifact };
    await this.checkpoint(cp);
    await this.stageEnded("build", cycle, buildTaskId, "checkpointed");
    this.templateSections = run.output.template.requiredSections;
    return { cp };
  }

  /** Stage 2 (+ bounded revisions): QA the checkpointed artifact; bounce specifics back on failure. */
  async verifyLoop(initial: CheckpointState): Promise<WorkflowResult> {
    let cp = initial;
    for (;;) {
      let html: string;
      let site: { files: Record<string, string>; pages: string[]; contentJson: string; binary?: string[] } | null = null;
      const qaTaskId = randomUUID();
      // Read back on the QA agent's behalf, through its scope and binding.
      const reader = gatedArtifactStore(this.deps.artifacts, this.gateFor(this.deps.qaAgent.role, qaTaskId));
      try {
        if (isSiteManifest(cp.artifact)) {
          site = await readSiteVerified(reader, cp.artifact);
          html = site.files[site.pages[0]!]!;
        } else {
          html = await reader.readVerified(cp.artifact);
        }
      } catch (err) {
        const status: WorkflowStatus = err instanceof PermissionDeniedError ? "qa_failed" : "checkpoint_corrupt";
        const halted = await this.halt(status, "qa", cp.cycle + 1, cp, err instanceof Error ? err.message : String(err));
        await this.stageEnded("qa", cp.cycle, null, status);
        return halted;
      }

      const qaRun = await runAgent(
        this.deps.qaAgent,
        {
          taskId: qaTaskId,
          role: this.deps.qaAgent.role,
          entitySlug: this.brief.entitySlug,
          clientSlug: this.brief.clientSlug,
          input: {
            html,
            clientSlug: this.brief.clientSlug,
            requiredSections: requiredSectionsFor(this.brief, this.templateSections),
            otherClientSlugs: this.deps.knownClientSlugs.filter((s) => s !== this.brief.clientSlug),
            goal: this.brief.goal,
            // Step 4B M1 claims gate: the approved brief is the only place a page fact may come from.
            factSources: briefFactSources(this.brief),
            ...(site ? { site: { files: site.files, pages: site.pages, ...(site.binary ? { binary: site.binary } : {}) } } : {}),
          },
        },
        { registry: this.deps.registry, audit: { sink: this.deps.audit }, runId: this.runId },
      );
      if (qaRun.status !== "completed" || !qaRun.output) {
        const halted = await this.halt("qa_failed", "qa", cp.cycle + 1, cp, `qa-evaluator ${qaRun.status}: ${qaRun.reason}`);
        await this.stageEnded("qa", cp.cycle, qaTaskId, "qa_failed");
        return halted;
      }
      const verdict = qaRun.output;

      if (verdict.status === "approved") {
        this.clientNeeds = (verdict.evaluator?.notes ?? []).filter((n) => /NEEDS CLIENT INPUT/i.test(n)).map((n) => n.replace(/^.*?NEEDS CLIENT INPUT:?\s*/i, "").trim()).filter(Boolean);
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
        await this.stageEnded("qa", cp.cycle, qaTaskId, "awaiting_launch_approval");
        return this.result("awaiting_launch_approval", cp.cycle + 1, verified, null);
      }

      if (verdict.status === "blocked_no_evaluator") {
        const halted = await this.halt("not_verified_no_evaluator", "qa", cp.cycle + 1, cp, notVerifiedReason(verdict.checkResults));
        await this.stageEnded("qa", cp.cycle, qaTaskId, "not_verified_no_evaluator");
        return halted;
      }

      const failure: QaFailure = {
        // Step 7: advisory (minor) failures are reported in the audit row, not sent back to the builder on their own.
        failedChecks: verdict.checkResults.filter((c) => !c.passed && !c.advisory).map(({ checkId, details }) => ({ checkId, details })),
        evaluatorIssues: verdict.evaluator?.issues ?? [],
      };
      if (cp.cycle - this.cycleBase >= this.maxRevisions) {
        const halted = await this.halt(
          "failed_verification",
          "qa",
          cp.cycle + 1,
          cp,
          `QA still failing after ${this.maxRevisions} revision(s) — escalating to a human rather than retrying forever`,
          failure,
        );
        await this.stageEnded("qa", cp.cycle, qaTaskId, "failed_verification");
        return halted;
      }

      const issues = qaFailureToIssues(failure);
      await recordAudit(this.ctx, {
        action: "workflow.return_to_builder",
        outcome: "info",
        payload: { workflow: WORKFLOW_ID, cycle: cp.cycle, issues, qaStatus: verdict.status },
      });
      await this.stageEnded("qa", cp.cycle, qaTaskId, "returned_to_builder");
      const rebuilt = await this.build(cp.cycle + 1, site ? { html, issues, contentJson: site.contentJson } : { html, issues }, cp);
      if ("halted" in rebuilt) return rebuilt.halted;
      cp = rebuilt.cp;
    }
  }
}

/**
 * An exception that escaped a run that had already started keeps its own type; the run id is attached to it, so the
 * job runner can record it and the Cockpit can offer to continue the run instead of losing it (Step 4D).
 */
const RUN_ID = Symbol.for("wfact.workflowRunId");
function tagRunId(err: unknown, runId: string): unknown {
  if (typeof err === "object" && err !== null) (err as Record<symbol, unknown>)[RUN_ID] = runId;
  return err;
}
export function runIdOfError(err: unknown): string | null {
  const v = typeof err === "object" && err !== null ? (err as Record<symbol, unknown>)[RUN_ID] : null;
  return typeof v === "string" ? v : null;
}

/**
 * The single entry point for a client pipeline (Continuation Plan Stage 3, task 3): brief in,
 * either a verified page awaiting a human launch decision, or a specific, actionable failure.
 */
export async function buildAndVerify(rawBrief: unknown, deps: WorkflowDeps): Promise<WorkflowResult> {
  // Validate the brief exactly the way the builder will, before writing a single row.
  const brief = deps.frontEndAgent.parseInput({ brief: rawBrief }).brief;
  const wf = new Workflow(deps, randomUUID(), randomUUID(), brief);
  try {
    return await wf.start();
  } catch (err) {
    throw tagRunId(err, wf.runId);
  }
}

/** The builder template a run recorded at start ("track-a", "clean-agency", ...), or null for older runs. */
export async function recordedBuilderTemplate(runId: string, reader: AuditReader): Promise<string | null> {
  const rows = await reader.listByRun(runId);
  const start = rows.find((r) => r.actor === `workflow:${WORKFLOW_ID}` && r.action === "workflow.start");
  const t = start?.payload?.template;
  return typeof t === "string" ? t : null;
}

/**
 * Step 4D: a person asked to continue a run that had stopped. Only a person can do this (the job that carries it was
 * requested by a signed-in owner/admin), and it is recorded as a `workflow.reopen` row so the run's history stays honest.
 */
export interface ReopenRequest {
  /** Why, in the owner's terms ("fix and continue", "details added", "tried again after a top-up", "automatic retry: reviewer was unreachable"). */
  reason: string;
  /** The user id, or "auto" for the bounded automatic retry. */
  by: string;
  /** The brief to continue with, e.g. the approved brief plus the facts the owner added. Absent: the run keeps the brief it has. */
  brief?: unknown;
}

/** Where a run stands, from its audit rows: what is saved, how many times it was reopened, whether it ended. */
export interface RunProgress {
  /** `none`: no checkpoint (nothing saved); `built`: a built site is saved; `verified`: it passed and awaits the launch decision. */
  saved: "none" | "built" | "verified";
  /** Cycle of the last saved checkpoint, or null. */
  savedCycle: number | null;
  reopens: number;
  /** `running` = no ending row since the last start/reopen; `halted` = stopped (see haltStatus); `gate` = verified. */
  state: "running" | "halted" | "gate";
  haltStatus: WorkflowStatus | null;
}

export function runProgress(rows: AuditRecord[]): RunProgress {
  const wf = rows.filter((r) => r.actor === `workflow:${WORKFLOW_ID}`);
  const lastReopen = wf.map((r) => r.action).lastIndexOf("workflow.reopen");
  const epoch = lastReopen >= 0 ? wf.slice(lastReopen + 1) : wf;
  const end = epoch.find((r) => r.action === "workflow.halt" || r.action === "workflow.gate");
  const cps = wf.filter((r) => r.action === "workflow.checkpoint");
  const last = cps.at(-1);
  return {
    saved: !last ? "none" : last.payload?.stage === "verified" ? "verified" : "built",
    savedCycle: last ? Number(last.payload?.cycle) : null,
    reopens: wf.filter((r) => r.action === "workflow.reopen").length,
    state: !end ? "running" : end.action === "workflow.gate" ? "gate" : "halted",
    haltStatus: end?.action === "workflow.halt" ? ((end.payload?.status as WorkflowStatus | undefined) ?? null) : null,
  };
}

/**
 * Crash recovery: continue a run from its last durable checkpoint. Never re-runs a build that has a
 * checkpoint; never trusts an artifact whose hash changed; never re-opens a run that already ended
 * UNLESS a person asked for it (`opts.reopen`, Step 4D) and the run stopped for a reason a person can
 * address. A run that reached the launch gate is never reopened, and one whose saved site no longer
 * matches its hash (`checkpoint_corrupt`) cannot be: it needs a fresh build.
 */
export async function resumeBuildAndVerify(runId: string, deps: WorkflowDeps, opts: { reopen?: ReopenRequest } = {}): Promise<WorkflowResult> {
  const rows: AuditRecord[] = await deps.reader.listByRun(runId);
  const workflowRows = rows.filter((r) => r.actor === `workflow:${WORKFLOW_ID}`);
  const start = workflowRows.find((r) => r.action === "workflow.start");
  if (!start || !start.taskId) {
    throw new Error(`no ${WORKFLOW_ID} run found for run_id ${runId}`);
  }
  // The brief a reopened run continues with is the newest one a person supplied; otherwise the one it started with.
  const lastBriefReopen = [...workflowRows].reverse().find((r) => r.action === "workflow.reopen" && r.payload?.brief !== undefined);
  const parsed = deps.frontEndAgent.parseInput({ brief: opts.reopen?.brief ?? lastBriefReopen?.payload?.brief ?? start.payload?.brief });
  const brief = parsed.brief;
  const recordedTemplate = start.payload?.template;
  if (typeof recordedTemplate === "string" && recordedTemplate !== parsed.template.id) {
    throw new Error(`run ${runId} was built by the "${recordedTemplate}" builder; resume it with that builder, not "${parsed.template.id}"`);
  }
  const wf = new Workflow(deps, runId, start.taskId, brief);

  const progress = runProgress(rows);
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
  const finished = (reason: string, status: WorkflowStatus = "already_finished"): WorkflowResult => ({
    workflowRunId: runId,
    workflowTaskId: start.taskId!,
    status,
    cycles: lastCp ? lastCp.cycle + 1 : 0,
    lastCheckpoint: lastCp ? { ...lastCp.artifact, stage: lastCp.stage, cycle: lastCp.cycle } : null,
    reason,
    qaFailure: null,
    builderRounds: [],
  });

  if (progress.state === "gate") return finished("run already reached its launch gate — not re-opened");
  if (progress.state === "halted") {
    if (!opts.reopen) return finished("run already ended with workflow.halt — not re-opened");
    if (progress.haltStatus === "checkpoint_corrupt") {
      return finished("the saved site no longer matches its hash, so this run cannot continue: a fresh build is needed", "checkpoint_corrupt");
    }
    // Written before anything runs, so the run's history shows who continued it and why, and the revision budget restarts here.
    await recordAudit(
      { sink: deps.audit, actor: `workflow:${WORKFLOW_ID}`, runId, taskId: start.taskId, entitySlug: brief.entitySlug },
      {
        action: "workflow.reopen",
        outcome: "info",
        payload: {
          workflow: WORKFLOW_ID,
          version: WORKFLOW_VERSION,
          reason: opts.reopen.reason,
          by: opts.reopen.by,
          fromStatus: progress.haltStatus,
          baseCycle: lastCp ? lastCp.cycle : 0,
          ...(opts.reopen.brief !== undefined ? { brief } : {}),
        },
      },
    );
    wf.cycleBase = lastCp ? lastCp.cycle : 0;
  } else if (opts.reopen?.brief !== undefined) {
    // A crashed (never halted) run continued with new facts: recorded, so the next resume keeps this brief and its revision budget.
    await recordAudit(
      { sink: deps.audit, actor: `workflow:${WORKFLOW_ID}`, runId, taskId: start.taskId, entitySlug: brief.entitySlug },
      { action: "workflow.reopen", outcome: "info", payload: { workflow: WORKFLOW_ID, version: WORKFLOW_VERSION, reason: opts.reopen.reason, by: opts.reopen.by, fromStatus: null, baseCycle: lastCp ? lastCp.cycle : 0, brief } },
    );
    wf.cycleBase = lastCp ? lastCp.cycle : 0;
  } else {
    const reopens = workflowRows.filter((r) => r.action === "workflow.reopen");
    wf.cycleBase = reopens.length ? Number(reopens.at(-1)!.payload?.baseCycle ?? 0) : 0;
  }
  try {
    if (!lastCp) {
      // Nothing was saved: the build starts again under the same run id (Blueprint §3's rollback target is "the last checkpoint" — none).
      return await wf.buildFrom(0, null);
    }
    // Template sections come from the brief's template choice, exactly as the builder derives them.
    wf.templateSections = deps.frontEndAgent.parseInput({ brief }).template.requiredSections;
    // A "verified" checkpoint without its gate row is re-verified rather than gated on trust.
    return await wf.verifyLoop({ ...lastCp, stage: "build" });
  } catch (err) {
    throw tagRunId(err, runId);
  }
}
