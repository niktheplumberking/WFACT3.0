/**
 * The Documentation agent (Factory Completion Plan Step 5; Continuation Plan Stage 6; Blueprint §8 episodic memory,
 * §16D). At the end of every workflow stage it appends one structured entry to clients/<slug>/memory.md, built
 * deterministically from the run's audit_log and model_traces rows (extract.ts), tied to the stage's audit task id.
 *
 * Extension point, proven again: this role is registered through the agent registry at composition time
 * (`registerDocumentationAgent`) and runs on the unchanged `runAgent` lifecycle. Nothing in packages/agent-runtime
 * names it (test/extensionPoint.test.ts checks that).
 *
 * Permissions (Step 6, enforced, default deny): read the run's audit_log and model_traces rows for the run's own
 * entity, read and append to the bound client's memory.md only, insert its own audit rows. No model slot and a $0
 * spend ceiling: it makes no model call, so a summary costs nothing (Step 5 "keep cost low": every field is in the
 * structured record already; a model would add cost and a hallucination risk for no information).
 *
 * Hard rules:
 *   - appends only (the memory store has no rewrite path and proves every append kept the prefix);
 *   - never records secrets or client PII: the brief is a hash, free text is redacted and capped (episodes.ts);
 *   - writes only to the memory file of the client the run is BOUND to (the task's clientSlug, checked against the
 *     owning entity by runAgent before spawn), never a path taken from its input or from the rows;
 *   - refuses a run whose rows belong to another client or entity;
 *   - if it cannot write it throws, so runAgent escalates (agent.escalate) and the workflow records
 *     workflow.documentation_escalated: never a silent skip.
 */
import { randomUUID } from "node:crypto";
import {
  AgentInputError,
  defineScope,
  runAgent,
  type Agent,
  type AgentDefinition,
  type AgentRegistry,
  type AgentRunContext,
} from "@wfact/agent-runtime";
import { recordAudit, type AuditSink } from "@wfact/audit";
import {
  EPISODE_SCHEMA_VERSION,
  parseEpisodes,
  renderEpisode,
  sha256Hex,
  validateEpisode,
  type Episode,
  type EpisodeStage,
} from "@wfact/hermes-lite/tools/episodes";
import { DOCUMENTATION_ACTOR, extractStageDrafts, type EpisodeDraft, type ExtractOptions } from "./extract.js";
import { appendChunk, gatedMemoryStore, memoryPathFor, type MemoryStore } from "./memoryStore.js";
import type { RunAuditRow, RunRecordReader } from "./records.js";

export const DOCUMENTATION_ROLE = "documentation";

export const DOCUMENTATION_AGENT_DEFINITION: AgentDefinition = {
  role: DOCUMENTATION_ROLE,
  description:
    "Appends one structured episodic entry per finished workflow stage to the bound client's memory.md, built from " +
    "the run's audit_log and model_traces rows (packages/documentation). Append-only; no model calls.",
  skillset: ["episodic-memory", "deterministic-extraction", "redaction", "backfill"],
  permissionScope: defineScope({
    models: [],
    db: [
      { table: "audit_log", ops: ["select", "insert"] },
      { table: "model_traces", ops: ["select"] },
    ],
    fsRead: ["clients/{client}/memory.md"],
    fsWrite: ["clients/{client}/memory.md"],
    tools: [],
    maxCostUsdPerRun: 0,
  }),
  modelSlots: [],
};

/** Registers the role on a registry (idempotent: a composition root may call it more than once). */
export function registerDocumentationAgent(registry: AgentRegistry): AgentRegistry {
  if (!registry.has(DOCUMENTATION_ROLE)) registry.register(DOCUMENTATION_AGENT_DEFINITION);
  return registry;
}

// ---------------------------------------------------------------------------------------------
// Input (the validated handoff) and output
// ---------------------------------------------------------------------------------------------

export interface DocumentationInput {
  /** "stage-end": record the stage that just ended. "backfill": record every stage of a finished run not yet in memory. */
  mode: "stage-end" | "backfill";
  workflowRunId: string;
  clientSlug: string;
  entitySlug: string;
  stage?: EpisodeStage;
  stageTaskId?: string | null;
  cycle?: number;
}

export interface DocumentationOutput {
  memoryPath: string;
  /** Entries appended by this run. */
  appended: string[];
  /** Entries already in the file (same stage of the same run): not written twice. */
  alreadyRecorded: string[];
  /** Of `appended`: entries the agent had already recorded live (documentation.entry rows) and this run wrote to the file. */
  materialized: string[];
  /** Of `appended`: entries generated from the raw audit trail after the fact. */
  backfilled: string[];
  /** Audit rows of the run left out because they belonged to another entity. */
  excludedRows: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z][a-z0-9-]*$/;

export function parseDocumentationInput(raw: unknown): DocumentationInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AgentInputError("input must be an object");
  const r = raw as Record<string, unknown>;
  const allowed = ["mode", "workflowRunId", "clientSlug", "entitySlug", "stage", "stageTaskId", "cycle"];
  const extra = Object.keys(r).filter((k) => !allowed.includes(k));
  if (extra.length) throw new AgentInputError(`unexpected field(s): ${extra.join(", ")}`);
  if (r.mode !== "stage-end" && r.mode !== "backfill") throw new AgentInputError('mode must be "stage-end" or "backfill"');
  if (typeof r.workflowRunId !== "string" || !UUID_RE.test(r.workflowRunId)) throw new AgentInputError("workflowRunId must be a UUID");
  if (typeof r.clientSlug !== "string" || !SLUG_RE.test(r.clientSlug)) throw new AgentInputError("clientSlug must be a slug");
  if (typeof r.entitySlug !== "string" || !SLUG_RE.test(r.entitySlug)) throw new AgentInputError("entitySlug must be a slug");
  const input: DocumentationInput = { mode: r.mode, workflowRunId: r.workflowRunId, clientSlug: r.clientSlug, entitySlug: r.entitySlug };
  if (r.mode === "stage-end") {
    if (r.stage !== "build" && r.stage !== "qa") throw new AgentInputError('stage-end needs stage "build" or "qa"');
    if (r.stageTaskId !== null && (typeof r.stageTaskId !== "string" || !UUID_RE.test(r.stageTaskId))) throw new AgentInputError("stageTaskId must be a UUID or null");
    if (r.cycle !== undefined && (typeof r.cycle !== "number" || !Number.isInteger(r.cycle) || r.cycle < 0)) throw new AgentInputError("cycle must be a non-negative integer");
    input.stage = r.stage;
    input.stageTaskId = r.stageTaskId as string | null;
    if (r.cycle !== undefined) input.cycle = r.cycle as number;
  } else if (r.stage !== undefined || r.stageTaskId !== undefined || r.cycle !== undefined) {
    throw new AgentInputError("backfill takes no stage, stageTaskId or cycle");
  }
  return input;
}

// ---------------------------------------------------------------------------------------------
// The agent
// ---------------------------------------------------------------------------------------------

export interface DocumentationAgentOptions {
  records: RunRecordReader;
  memory: MemoryStore;
  now?: () => Date;
  roles?: ExtractOptions["roles"];
}

export class DocumentationRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentationRefusedError";
  }
}

/** Entries the agent already recorded live (its own documentation.entry rows), keyed by entry id. */
function recordedEntries(rows: RunAuditRow[]): Map<string, Episode> {
  const out = new Map<string, Episode>();
  for (const r of rows) {
    if (r.actor !== DOCUMENTATION_ACTOR || r.action !== "documentation.entry" || r.payload.status !== "appended") continue;
    try {
      const e = validateEpisode(r.payload.entry);
      out.set(e.entryId, e);
    } catch {
      // A malformed row is ignored here; the stage is regenerated from the raw trail instead (marked backfilled).
    }
  }
  return out;
}

export function createDocumentationAgent(opts: DocumentationAgentOptions): Agent<DocumentationInput, DocumentationOutput> {
  const now = opts.now ?? (() => new Date());
  return {
    role: DOCUMENTATION_ROLE,
    // One retry for a transient write problem, then escalate (bounded, never forever).
    retry: { maxAttempts: 2, baseDelayMs: 250 },
    parseInput: parseDocumentationInput,
    async execute(input: DocumentationInput, ctx: AgentRunContext): Promise<DocumentationOutput> {
      const gate = ctx.permissions;
      const bound = gate.binding;
      // The run must be bound to one client and entity, and the input must name exactly those (runAgent has already
      // checked the client folder belongs to that entity). The memory path comes from the binding, never the input.
      if (!bound.clientSlug || !bound.entitySlug) {
        throw new DocumentationRefusedError("a documentation run must be bound to one client and one entity");
      }
      // Denied (and audited as agent.deny) unless the input names the bound client and the bound entity.
      await gate.authorize({ kind: "client", clientSlug: input.clientSlug, ownerEntity: input.entitySlug });

      // Read the structured run record, for this run's own entity only.
      await gate.authorize({ kind: "db", table: "audit_log", op: "select", entitySlug: bound.entitySlug });
      await gate.authorize({ kind: "db", table: "model_traces", op: "select", entitySlug: bound.entitySlug });
      const allRows = await opts.records.auditRows(input.workflowRunId);
      const allTraces = await opts.records.traces(input.workflowRunId);
      // Rows of another entity are never used. Legacy exception, stated: before Step 6 the verification loop
      // attributed its decision row to the CLIENT slug (e.g. run 0cfc6675), so the bound client's slug is accepted.
      const ownEntity = (slug: string | null) => slug === null || slug === bound.entitySlug || slug === bound.clientSlug;
      const rows = allRows.filter((r) => ownEntity(r.entitySlug));
      const traces = allTraces.filter((t) => ownEntity(t.entitySlug));
      const excludedRows = allRows.length - rows.length + (allTraces.length - traces.length);

      const extracted = extractStageDrafts(rows, traces, { roles: opts.roles });
      if (extracted.entitySlug !== bound.entitySlug || extracted.clientSlug !== bound.clientSlug) {
        throw new DocumentationRefusedError(
          `run ${input.workflowRunId} belongs to client ${JSON.stringify(extracted.clientSlug)} of entity ${JSON.stringify(extracted.entitySlug)}, ` +
            `not to client "${bound.clientSlug}" of entity "${bound.entitySlug}" this run is bound to — refusing to write it into this client's memory`,
        );
      }

      let targets: EpisodeDraft[];
      if (input.mode === "stage-end") {
        const matches = extracted.drafts.filter(
          (d) => d.stage === input.stage && d.stageTaskId === (input.stageTaskId ?? null) && (input.cycle === undefined || d.cycle === input.cycle),
        );
        const hit = matches.at(-1);
        if (!hit) {
          throw new DocumentationRefusedError(
            `no finished ${input.stage} stage with task ${input.stageTaskId ?? "none"}${input.cycle !== undefined ? ` (cycle ${input.cycle})` : ""} in run ${input.workflowRunId}'s audit trail`,
          );
        }
        targets = [hit];
      } else {
        targets = extracted.drafts;
        if (targets.length === 0) throw new DocumentationRefusedError(`run ${input.workflowRunId} has no finished stage to document`);
      }

      const memory = gatedMemoryStore(opts.memory, gate);
      const memoryPath = memoryPathFor(bound.clientSlug);
      const existing = await memory.read(memoryPath);
      const inFile = new Set(parseEpisodes(existing ?? "").episodes.map((e) => e.entryId));
      const live = recordedEntries(allRows);

      const out: DocumentationOutput = { memoryPath, appended: [], alreadyRecorded: [], materialized: [], backfilled: [], excludedRows };
      let content = existing;
      for (const draft of targets) {
        if (inFile.has(draft.entryId)) {
          out.alreadyRecorded.push(draft.entryId);
          continue;
        }
        const recorded = live.get(draft.entryId);
        const entry: Episode = recorded ?? validateEpisode({
          ...draft,
          v: EPISODE_SCHEMA_VERSION,
          backfilled: input.mode === "backfill",
          documentedBy: DOCUMENTATION_ACTOR,
          documentedAt: now().toISOString(),
        });
        const block = renderEpisode(entry);
        const chunk = appendChunk(content, bound.clientSlug, [block]);
        await memory.append(memoryPath, chunk);
        content = (content ?? "") + chunk;
        inFile.add(entry.entryId);
        out.appended.push(entry.entryId);
        if (recorded) out.materialized.push(entry.entryId);
        else if (entry.backfilled) out.backfilled.push(entry.entryId);
        // The durable copy: audit_log is append-only by trigger, so this row outlives a runner's disk (CI runs) and is
        // what a later backfill materializes into the file. Written after the append, through the gated audit sink.
        if (ctx.audit && !recorded) {
          await recordAudit(ctx.audit, {
            action: "documentation.entry",
            outcome: "success",
            payload: {
              status: "appended",
              entryId: entry.entryId,
              schemaVersion: EPISODE_SCHEMA_VERSION,
              stage: entry.stage,
              cycle: entry.cycle,
              stageTaskId: entry.stageTaskId,
              workflowRunId: entry.workflowRunId,
              memoryPath,
              entrySha256: sha256Hex(block),
              backfilled: entry.backfilled,
              entry,
            },
          });
        }
      }
      if (ctx.audit && out.alreadyRecorded.length > 0) {
        await recordAudit(ctx.audit, {
          action: "documentation.skip",
          outcome: "info",
          payload: { status: "already_recorded", entryIds: out.alreadyRecorded, memoryPath, workflowRunId: input.workflowRunId },
        });
      }
      return out;
    },
    summarize: (o) => ({
      memoryPath: o.memoryPath,
      appended: o.appended,
      alreadyRecorded: o.alreadyRecorded.length,
      materialized: o.materialized.length,
      backfilled: o.backfilled.length,
      excludedRows: o.excludedRows,
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// The workflow's stage observer
// ---------------------------------------------------------------------------------------------

/** Structurally the same as @wfact/workflow's StageEndEvent / StageObserver (this package does not import the workflow). */
export interface StageEndEventLike {
  workflowRunId: string;
  stage: "build" | "qa";
  cycle: number;
  stageTaskId: string | null;
  entitySlug: string;
  clientSlug: string;
}

export interface DocumentationObserverOptions {
  agent: Agent<DocumentationInput, DocumentationOutput>;
  /** Must have the documentation role registered (registerDocumentationAgent). */
  registry: AgentRegistry;
  audit: AuditSink | null;
}

/**
 * Runs the Documentation agent at the end of each stage, on the workflow's run id (its rows land beside the stage's
 * rows). Returns ok:false with the reason when the agent did not complete, so the workflow escalates.
 */
export function createDocumentationObserver(opts: DocumentationObserverOptions) {
  return {
    async stageEnded(e: StageEndEventLike): Promise<{ ok: boolean; reason: string | null; taskId: string }> {
      const taskId = randomUUID();
      const run = await runAgent(
        opts.agent,
        {
          taskId,
          role: DOCUMENTATION_ROLE,
          input: { mode: "stage-end", workflowRunId: e.workflowRunId, clientSlug: e.clientSlug, entitySlug: e.entitySlug, stage: e.stage, stageTaskId: e.stageTaskId, cycle: e.cycle },
          entitySlug: e.entitySlug,
          clientSlug: e.clientSlug,
        },
        { registry: opts.registry, audit: opts.audit ? { sink: opts.audit } : null, runId: e.workflowRunId },
      );
      return run.status === "completed"
        ? { ok: true, reason: null, taskId }
        : { ok: false, reason: `documentation agent ${run.status}: ${run.reason ?? "no reason"}`, taskId };
    },
  };
}
