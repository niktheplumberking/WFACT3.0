/**
 * Episodic memory entries (Factory Completion Plan Step 5, Continuation Plan Stage 6, Blueprint §8 "episodic memory
 * tied to task IDs"). One entry per finished workflow stage, appended to clients/<slug>/memory.md by the
 * Documentation agent (packages/documentation), read back by Hermes-lite's `memory.readClient` tool.
 *
 * The format is both human-readable and machine-parseable, from ONE source of truth:
 *
 *   ### 2026-09-30 16:29:57Z · build, cycle 0 · checkpointed
 *   <!-- wfact:episode {"v":1,"entryId":"ep-…",…} -->
 *   - What happened: …
 *   - …
 *
 * The JSON on the marker line is the record; the bullet lines are rendered from it deterministically
 * (`renderEpisode`). The parser validates the JSON against the versioned schema below and re-renders it: if the
 * block in the file is not byte-identical to the rendering, the entry is reported as `tampered` (somebody edited
 * history by hand), never silently trusted.
 *
 * It lives in Hermes-lite (beside the memory tools that read it) because both sides need it and agent-runtime
 * already depends on this package: putting it in packages/documentation would create a dependency cycle.
 *
 * Zero dependencies on purpose (no zod): a hand-written validator a reviewer can read end to end.
 */
import { createHash } from "node:crypto";

export const EPISODE_SCHEMA_VERSION = 1 as const;
export const EPISODE_MARKER = "<!-- wfact:episode ";
export const EPISODE_MARKER_END = " -->";
export const EPISODIC_LOG_HEADING = "## Episodic log (written by the Documentation agent)";
export const EPISODIC_LOG_PREAMBLE =
  "_One entry per finished workflow stage, appended by the `documentation` agent (packages/documentation) from the run's " +
  "audit_log and model_traces rows. Append-only: never edit, reorder or delete an entry; a hand-edited entry is reported " +
  "as tampered. Each entry's JSON line is the machine-readable record (schema v1, packages/hermes/src/tools/episodes.ts)._";

export const EPISODE_STAGES = ["build", "qa"] as const;
export type EpisodeStage = (typeof EPISODE_STAGES)[number];

/** Limits that keep an entry small and keep client text out of memory (only short, redacted excerpts). */
export const EPISODE_LIMITS = { text: 300, issues: 5, failedChecks: 20, ids: 60, inputs: 6 } as const;

export interface EpisodeInput {
  /** What the input was, e.g. "brief", "artifact clients/x/pages/y.html", "qa-issues from cycle 0". Never its content. */
  name: string;
  sha256: string;
}

export interface Episode {
  v: typeof EPISODE_SCHEMA_VERSION;
  /** Deterministic: the same stage of the same run always gets the same id (see `episodeId`), so nothing is recorded twice. */
  entryId: string;
  workflow: { id: string; version: string | null };
  workflowRunId: string;
  workflowTaskId: string | null;
  stage: EpisodeStage;
  cycle: number;
  /** The agent task that did the stage (the builder's or QA agent's task id); null when no agent ran (e.g. a corrupt checkpoint). */
  stageTaskId: string | null;
  /** When the stage ended (the closing audit row's time). */
  at: string;
  /** Who did the stage: `agent:<role>`, or `workflow:<id>` when the workflow itself stopped it. */
  actor: string;
  entitySlug: string;
  clientSlug: string;
  outcome: { status: string; summary: string; reason: string | null };
  inputs: EpisodeInput[];
  artifact: { path: string; sha256: string; bytes: number } | null;
  failedChecks: { checkId: string; detail: string | null }[];
  /** How many checks the QA stage ran; null for a build stage or when unknown. */
  checksRun: number | null;
  evaluatorVerdict: string | null;
  corrections: { builderRounds: number | null; builderApproved: boolean | null; issuesReturnedCount: number; issuesReturned: string[] };
  cost: { meteredUsd: number; calls: number; unpricedCalls: number; inputTokens: number; outputTokens: number; models: string[] };
  links: { auditRunQuery: string; auditRowIds: string[]; traceIds: string[] };
  backfilled: boolean;
  documentedBy: string;
  documentedAt: string;
  /** How many secrets / contact details were replaced with a placeholder while building this entry. */
  redactions: number;
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

export class EpisodeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EpisodeValidationError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z][a-z0-9-]*$/;
const SHA_RE = /^[0-9a-f]{64}$/;
const ENTRY_ID_RE = /^ep-[0-9a-f]{16}$/;
const ACTOR_RE = /^(agent|workflow):[a-z][a-z0-9-]*$/;
const STATUS_RE = /^[a-z][a-z0-9_]*$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;
const ARTIFACT_RE = /^clients\/[a-z][a-z0-9-]*\/[A-Za-z0-9_][A-Za-z0-9_./-]*$/;

function fail(path: string, why: string): never {
  throw new EpisodeValidationError(`episode.${path}: ${why}`);
}
function obj(v: unknown, p: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) fail(p, "must be an object");
  return v as Record<string, unknown>;
}
function str(v: unknown, p: string, re?: RegExp, max: number = EPISODE_LIMITS.text): string {
  if (typeof v !== "string" || v.length === 0 || v.length > max) fail(p, `must be a string of 1-${max} characters`);
  if (re && !re.test(v)) fail(p, `does not match ${re}`);
  return v;
}
function strOrNull(v: unknown, p: string, re?: RegExp, max?: number): string | null {
  return v === null ? null : str(v, p, re, max);
}
function int(v: unknown, p: string, min = 0): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min) fail(p, `must be an integer >= ${min}`);
  return v;
}
function num(v: unknown, p: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) fail(p, "must be a non-negative number");
  return v;
}
function bool(v: unknown, p: string): boolean {
  if (typeof v !== "boolean") fail(p, "must be a boolean");
  return v;
}
function list<T>(v: unknown, p: string, max: number, each: (x: unknown, p: string) => T): T[] {
  if (!Array.isArray(v) || v.length > max) fail(p, `must be a list of at most ${max}`);
  return v.map((x, i) => each(x, `${p}[${i}]`));
}
function exactKeys(o: Record<string, unknown>, p: string, keys: string[]): void {
  const extra = Object.keys(o).filter((k) => !keys.includes(k));
  if (extra.length) fail(p, `unexpected field(s) ${extra.join(", ")}`);
  for (const k of keys) if (!(k in o)) fail(`${p}.${k}`, "is missing");
}

const TOP_KEYS = [
  "v", "entryId", "workflow", "workflowRunId", "workflowTaskId", "stage", "cycle", "stageTaskId", "at", "actor", "entitySlug",
  "clientSlug", "outcome", "inputs", "artifact", "failedChecks", "checksRun", "evaluatorVerdict", "corrections", "cost", "links",
  "backfilled", "documentedBy", "documentedAt", "redactions",
];

/** Throws EpisodeValidationError unless `raw` is a well-formed v1 episode. Returns it typed (same object). */
export function validateEpisode(raw: unknown): Episode {
  const e = obj(raw, "(root)");
  exactKeys(e, "(root)", TOP_KEYS);
  if (e.v !== EPISODE_SCHEMA_VERSION) fail("v", `must be ${EPISODE_SCHEMA_VERSION} (this reader understands schema v${EPISODE_SCHEMA_VERSION} only)`);
  str(e.entryId, "entryId", ENTRY_ID_RE);
  const wf = obj(e.workflow, "workflow");
  exactKeys(wf, "workflow", ["id", "version"]);
  str(wf.id, "workflow.id", SLUG_RE, 100);
  strOrNull(wf.version, "workflow.version", /^\d+\.\d+\.\d+$/, 20);
  str(e.workflowRunId, "workflowRunId", UUID_RE);
  strOrNull(e.workflowTaskId, "workflowTaskId", UUID_RE);
  if (!EPISODE_STAGES.includes(e.stage as EpisodeStage)) fail("stage", `must be one of ${EPISODE_STAGES.join("/")}`);
  int(e.cycle, "cycle");
  strOrNull(e.stageTaskId, "stageTaskId", UUID_RE);
  str(e.at, "at", ISO_RE, 40);
  str(e.actor, "actor", ACTOR_RE, 100);
  str(e.entitySlug, "entitySlug", SLUG_RE, 100);
  str(e.clientSlug, "clientSlug", SLUG_RE, 100);
  const out = obj(e.outcome, "outcome");
  exactKeys(out, "outcome", ["status", "summary", "reason"]);
  str(out.status, "outcome.status", STATUS_RE, 60);
  str(out.summary, "outcome.summary", undefined, EPISODE_LIMITS.text * 2);
  strOrNull(out.reason, "outcome.reason");
  list(e.inputs, "inputs", EPISODE_LIMITS.inputs, (x, p) => {
    const i = obj(x, p);
    exactKeys(i, p, ["name", "sha256"]);
    str(i.name, `${p}.name`, undefined, 200);
    str(i.sha256, `${p}.sha256`, SHA_RE);
  });
  if (e.artifact !== null) {
    const a = obj(e.artifact, "artifact");
    exactKeys(a, "artifact", ["path", "sha256", "bytes"]);
    str(a.path, "artifact.path", ARTIFACT_RE, 300);
    str(a.sha256, "artifact.sha256", SHA_RE);
    int(a.bytes, "artifact.bytes");
  }
  list(e.failedChecks, "failedChecks", EPISODE_LIMITS.failedChecks, (x, p) => {
    const c = obj(x, p);
    exactKeys(c, p, ["checkId", "detail"]);
    str(c.checkId, `${p}.checkId`, /^[A-Za-z0-9_.:-]+$/, 100);
    strOrNull(c.detail, `${p}.detail`);
  });
  if (e.checksRun !== null) int(e.checksRun, "checksRun");
  strOrNull(e.evaluatorVerdict, "evaluatorVerdict", STATUS_RE, 60);
  const cor = obj(e.corrections, "corrections");
  exactKeys(cor, "corrections", ["builderRounds", "builderApproved", "issuesReturnedCount", "issuesReturned"]);
  if (cor.builderRounds !== null) int(cor.builderRounds, "corrections.builderRounds");
  if (cor.builderApproved !== null) bool(cor.builderApproved, "corrections.builderApproved");
  int(cor.issuesReturnedCount, "corrections.issuesReturnedCount");
  list(cor.issuesReturned, "corrections.issuesReturned", EPISODE_LIMITS.issues, (x, p) => str(x, p));
  const cost = obj(e.cost, "cost");
  exactKeys(cost, "cost", ["meteredUsd", "calls", "unpricedCalls", "inputTokens", "outputTokens", "models"]);
  num(cost.meteredUsd, "cost.meteredUsd");
  int(cost.calls, "cost.calls");
  int(cost.unpricedCalls, "cost.unpricedCalls");
  int(cost.inputTokens, "cost.inputTokens");
  int(cost.outputTokens, "cost.outputTokens");
  list(cost.models, "cost.models", 10, (x, p) => str(x, p, MODEL_RE, 100));
  const links = obj(e.links, "links");
  exactKeys(links, "links", ["auditRunQuery", "auditRowIds", "traceIds"]);
  str(links.auditRunQuery, "links.auditRunQuery", /^audit_log\?run_id=eq\.[0-9a-f-]{36}(&task_id=eq\.[0-9a-f-]{36})?$/, 200);
  list(links.auditRowIds, "links.auditRowIds", EPISODE_LIMITS.ids, (x, p) => str(x, p, UUID_RE));
  list(links.traceIds, "links.traceIds", EPISODE_LIMITS.ids, (x, p) => str(x, p, UUID_RE));
  bool(e.backfilled, "backfilled");
  str(e.documentedBy, "documentedBy", ACTOR_RE, 100);
  str(e.documentedAt, "documentedAt", ISO_RE, 40);
  int(e.redactions, "redactions");
  return e as unknown as Episode;
}

// ---------------------------------------------------------------------------------------------
// Ids, hashing, redaction
// ---------------------------------------------------------------------------------------------

export const sha256Hex = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

/** JSON with sorted keys, so the same value always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}

/** The stable id of one stage of one run. */
export function episodeId(workflowRunId: string, stage: EpisodeStage, cycle: number, stageTaskId: string | null): string {
  return `ep-${sha256Hex(`${workflowRunId}|${stage}|${cycle}|${stageTaskId ?? "none"}`).slice(0, 16)}`;
}

/**
 * Secret and contact-detail patterns replaced before any free text (a halt reason, a failed check's detail, an
 * evaluator issue) enters memory. Deliberately broad: a false positive costs a word in a log line.
 */
export const REDACTION_PATTERNS: { id: string; re: RegExp; replacement: string }[] = [
  { id: "private-key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, replacement: "[redacted-secret]" },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, replacement: "[redacted-secret]" },
  { id: "anthropic-openai-key", re: /\bsk-[A-Za-z0-9_-]{12,}/g, replacement: "[redacted-secret]" },
  { id: "doppler-token", re: /\bdp\.(st|pt|sa|ct|scim|audit)\.[A-Za-z0-9._-]{16,}/g, replacement: "[redacted-secret]" },
  { id: "github-token", re: /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, replacement: "[redacted-secret]" },
  { id: "aws-key", re: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "[redacted-secret]" },
  { id: "bearer", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, replacement: "Bearer [redacted-secret]" },
  {
    id: "assigned-secret",
    re: /\b([A-Za-z_]*(?:api[_-]?key|secret|token|password|passwd|service[_-]?role[_-]?key)[A-Za-z_]*)\s*[:=]\s*["']?[^\s"',;]{6,}/gi,
    replacement: "$1=[redacted-secret]",
  },
  { id: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: "[redacted-email]" },
  { id: "phone-long", re: /(?<![\w-])(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]\d{4}(?![\w-])/g, replacement: "[redacted-phone]" },
  { id: "phone-short", re: /(?<![\w.:/-])\d{3}-\d{4}(?![\w-])/g, replacement: "[redacted-phone]" },
];

/**
 * Make one piece of untrusted text (model output, check details) safe to store: redact secrets and contact details,
 * collapse it to one line, neutralise markup (so it can never forge an episode marker, a heading or HTML), and cap it.
 */
export function safeText(raw: unknown, max: number = EPISODE_LIMITS.text): { text: string; redactions: number } {
  let text = typeof raw === "string" ? raw : raw === undefined || raw === null ? "" : JSON.stringify(raw);
  let redactions = 0;
  for (const p of REDACTION_PATTERNS) {
    text = text.replace(p.re, (...m: unknown[]) => {
      redactions += 1;
      // Keep the `$1=` form for assigned secrets; everything else is a fixed placeholder.
      return p.id === "assigned-secret" ? `${String(m[1])}=[redacted-secret]` : p.replacement;
    });
  }
  text = text
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/</g, "‹")
    .replace(/>/g, "›")
    .replace(/`/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > max) text = `${text.slice(0, max - 1).trimEnd()}…`;
  return { text, redactions };
}

// ---------------------------------------------------------------------------------------------
// Rendering and parsing
// ---------------------------------------------------------------------------------------------

/** JSON that can sit inside an HTML comment on one line: `<`, `>` and `&` are escaped (still valid JSON). */
function commentSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

const short = (id: string | null) => (id ? `${id.slice(0, 8)}…` : "none");
const usd = (n: number) => `$${n.toFixed(4)}`;

function headingTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toISOString().slice(0, 19).replace("T", " ")}Z`;
}

/** The markdown block for one entry. Deterministic: the parser re-renders and compares byte for byte. */
export function renderEpisode(e: Episode): string {
  const stageLabel = e.stage === "build" ? `build, cycle ${e.cycle}` : `QA, cycle ${e.cycle}`;
  const lines = [
    `### ${headingTime(e.at)} · ${stageLabel} · ${e.outcome.status}${e.backfilled ? " · backfilled" : ""}`,
    `${EPISODE_MARKER}${commentSafeJson(e)}${EPISODE_MARKER_END}`,
    `- What happened: ${e.outcome.summary}`,
  ];
  if (e.outcome.reason) lines.push(`- Reason: ${e.outcome.reason}`);
  lines.push(
    `- Task: \`${e.stageTaskId ?? "none"}\` by ${e.actor} (workflow ${e.workflow.id}${e.workflow.version ? ` ${e.workflow.version}` : ""}, run \`${e.workflowRunId}\`, workflow task \`${e.workflowTaskId ?? "none"}\`)`,
  );
  if (e.inputs.length) lines.push(`- Inputs (hashes only): ${e.inputs.map((i) => `${i.name} \`${i.sha256.slice(0, 12)}\``).join("; ")}`);
  if (e.artifact) lines.push(`- Artifact: \`${e.artifact.path}\` (${e.artifact.bytes} bytes, sha256 \`${e.artifact.sha256.slice(0, 12)}\`)`);
  if (e.stage === "qa") {
    const checks = e.checksRun === null ? "checks run: unknown" : `${e.checksRun} check(s) run`;
    const failed = e.failedChecks.length ? e.failedChecks.map((c) => (c.detail ? `${c.checkId} (${c.detail})` : c.checkId)).join("; ") : "none";
    lines.push(`- Checks: ${checks}; failed: ${failed}; evaluator: ${e.evaluatorVerdict ?? "none"}`);
  }
  const corr: string[] = [];
  if (e.corrections.builderRounds !== null) {
    corr.push(`${e.corrections.builderRounds} builder round(s)${e.corrections.builderApproved === null ? "" : e.corrections.builderApproved ? ", approved by the builder's reviewer" : ", not approved by the builder's reviewer"}`);
  }
  if (e.corrections.issuesReturnedCount > 0) {
    corr.push(`${e.corrections.issuesReturnedCount} issue(s) sent back to the builder${e.corrections.issuesReturned.length ? `: ${e.corrections.issuesReturned.join(" | ")}` : ""}`);
  }
  lines.push(`- Corrections: ${corr.length ? corr.join("; ") : "none"}`);
  lines.push(
    `- Cost: ${usd(e.cost.meteredUsd)} metered over ${e.cost.calls} model call(s)${e.cost.unpricedCalls ? `, plus ${e.cost.unpricedCalls} unpriced call(s)` : ""}; ${e.cost.inputTokens} in / ${e.cost.outputTokens} out tokens${e.cost.models.length ? ` (${e.cost.models.join(", ")})` : ""}`,
  );
  lines.push(
    `- Audit: \`${e.links.auditRunQuery}\`; ${e.links.auditRowIds.length} audit_log row(s) ${e.links.auditRowIds.map(short).join(", ") || "none"}; ${e.links.traceIds.length} model_traces row(s) ${e.links.traceIds.map(short).join(", ") || "none"}`,
  );
  lines.push(`- Recorded by ${e.documentedBy} at ${e.documentedAt}${e.backfilled ? " (backfilled from the run's audit trail after the fact)" : ""}${e.redactions ? `; ${e.redactions} redaction(s)` : ""}`);
  return `${lines.join("\n")}\n`;
}

export interface ParsedEpisodes {
  episodes: Episode[];
  /** Marker lines that failed to parse or validate, or whose rendered block was changed by hand. */
  problems: { line: number; entryId: string | null; problem: string }[];
}

/** Every episode in a memory file, in file order. Never throws on bad content: problems are reported, not hidden. */
export function parseEpisodes(markdown: string): ParsedEpisodes {
  const episodes: Episode[] = [];
  const problems: ParsedEpisodes["problems"] = [];
  const seen = new Set<string>();
  const lines = markdown.split("\n");
  lines.forEach((line, i) => {
    if (!line.startsWith(EPISODE_MARKER)) return;
    let entryId: string | null = null;
    try {
      if (!line.endsWith(EPISODE_MARKER_END)) throw new EpisodeValidationError("marker line is not closed");
      const raw = JSON.parse(line.slice(EPISODE_MARKER.length, line.length - EPISODE_MARKER_END.length)) as unknown;
      entryId = typeof (raw as { entryId?: unknown })?.entryId === "string" ? (raw as { entryId: string }).entryId : null;
      const ep = validateEpisode(raw);
      // The block must be exactly what this entry renders to: the heading line right above, the bullets below.
      const rendered = renderEpisode(ep).trimEnd().split("\n");
      const actual = lines.slice(i - 1, i - 1 + rendered.length);
      if (i === 0 || actual.join("\n") !== rendered.join("\n")) {
        problems.push({ line: i + 1, entryId, problem: "tampered: the entry's text no longer matches its record (edited by hand?)" });
        return;
      }
      if (seen.has(ep.entryId)) {
        problems.push({ line: i + 1, entryId, problem: "duplicate entry id" });
        return;
      }
      seen.add(ep.entryId);
      episodes.push(ep);
    } catch (err) {
      problems.push({ line: i + 1, entryId, problem: err instanceof Error ? err.message : String(err) });
    }
  });
  return { episodes, problems };
}

// ---------------------------------------------------------------------------------------------
// Digest for Hermes-lite (plain, compact, deterministic)
// ---------------------------------------------------------------------------------------------

/**
 * A compact, chronological digest of a client's episodes, grouped by workflow run, for Hermes-lite's prompt. It
 * carries the facts (what each stage did, outcome, cost, task ids) and nothing else, so the model phrases an answer
 * from the record instead of from hand-written prose.
 */
export function digestEpisodes(episodes: Episode[]): string {
  if (episodes.length === 0) return "(no episodic entries yet)";
  const byRun = new Map<string, Episode[]>();
  for (const e of [...episodes].sort((a, b) => a.at.localeCompare(b.at))) {
    const list = byRun.get(e.workflowRunId) ?? [];
    list.push(e);
    byRun.set(e.workflowRunId, list);
  }
  const totalMetered = episodes.reduce((s, e) => s + e.cost.meteredUsd, 0);
  const totalUnpriced = episodes.reduce((s, e) => s + e.cost.unpricedCalls, 0);
  const out: string[] = [
    `${byRun.size} workflow run(s), ${episodes.length} stage entr${episodes.length === 1 ? "y" : "ies"}; metered model cost across them ${usd(totalMetered)}` +
      `${totalUnpriced ? ` plus ${totalUnpriced} unpriced call(s)` : ""}.`,
  ];
  let n = 0;
  for (const [runId, list] of byRun) {
    n += 1;
    const last = list.at(-1)!;
    const runCost = list.reduce((s, e) => s + e.cost.meteredUsd, 0);
    out.push(
      `Run ${n} of ${byRun.size}: run ${runId.slice(0, 8)} (${list[0]!.workflow.id}), first stage ended ${headingTime(list[0]!.at)}, last stage ended ${headingTime(last.at)} with "${last.outcome.status}"; ${list.length} stage(s), ${usd(runCost)} metered.`,
    );
    for (const e of list) {
      out.push(
        `  - ${headingTime(e.at)} ${e.stage} cycle ${e.cycle} [${e.outcome.status}]${e.backfilled ? " (backfilled)" : ""}: ${e.outcome.summary}` +
          `${e.outcome.reason ? ` Reason: ${e.outcome.reason}` : ""} Cost ${usd(e.cost.meteredUsd)} over ${e.cost.calls} call(s)` +
          `${e.cost.unpricedCalls ? ` (${e.cost.unpricedCalls} unpriced)` : ""}. Task ${e.stageTaskId?.slice(0, 8) ?? "none"}.`,
      );
    }
  }
  return out.join("\n");
}
