/**
 * What the run itself says about a job (Step 4D, build progress UX). A job row only knows what the worker managed to write
 * before it stopped; the run's own audit trail knows more: which run it was (`job.run`, linked the moment the run started),
 * every step it took (agent.* rows), what the checks found (verification.decision) and what was saved (workflow.checkpoint).
 * Owners and admins can read the audit log (RLS), so the Cockpit asks. Anything missing or unreadable falls back to the job
 * row: never a made-up answer.
 *
 * Payloads are selected field by field where they can be large (workflow.start and workflow.reopen carry the whole brief)
 * or carry spend (verification.decision's costs: cost figures stay owner-only, on the Costs page and RunCost).
 */
import { supabase } from "../supabaseClient";
import type { JobRow } from "../jobsClient";
import { progressFromAudit, type AuditRow } from "./recovery";
import type { RunRow } from "./timeline";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rows whose whole payload is small and needed. */
const FULL_ACTIONS = ["agent.spawn", "agent.complete", "agent.escalate", "agent.reject", "workflow.checkpoint", "workflow.return_to_builder", "workflow.halt", "workflow.gate", "workflow.preflight"];
const START_FIELDS = "action,occurred_at,task_id,maxQaRevisions:payload->maxQaRevisions,reason:payload->>reason,by:payload->>by,fromStatus:payload->>fromStatus,baseCycle:payload->baseCycle,fromStep:payload->>fromStep";
const DECISION_FIELDS = "action,occurred_at,task_id,status:payload->>status,checks:payload->checks";

/** The run id of a job: its result, its params (a resume), or the job.run link row. */
export async function runIdOfJob(j: JobRow): Promise<string | null> {
  const r = (j.result ?? {}) as Record<string, unknown>;
  const direct = typeof r.workflowRunId === "string" ? r.workflowRunId : typeof j.params?.workflowRunId === "string" ? (j.params.workflowRunId as string) : null;
  if (direct) return direct;
  const link = await supabase.from("audit_log").select("run_id").eq("action", "job.run").eq("task_id", j.id).limit(1);
  const id = (link.data?.[0] as { run_id?: string } | undefined)?.run_id;
  return id && UUID.test(id) ? id : null;
}

/** Normalise a row that came back with selected top-level fields into {action, occurred_at, payload}. */
function asRunRow(x: Record<string, unknown>): RunRow {
  const { action, occurred_at, task_id, payload, run_id: _run, ...rest } = x;
  void _run;
  return {
    action: String(action),
    occurred_at: String(occurred_at),
    task_id: (task_id as string | null | undefined) ?? null,
    payload: { ...((payload as Record<string, unknown> | null) ?? {}), ...rest },
  };
}

/** Every row the timeline needs for one run, oldest first. Throws on a database error so the caller can say so. */
export async function fetchRunRows(runId: string): Promise<RunRow[]> {
  const [full, starts, decisions] = await Promise.all([
    supabase.from("audit_log").select("action,occurred_at,task_id,payload").eq("run_id", runId).in("action", FULL_ACTIONS).order("occurred_at", { ascending: true }).limit(1000),
    supabase.from("audit_log").select(START_FIELDS).eq("run_id", runId).in("action", ["workflow.start", "workflow.reopen"]).order("occurred_at", { ascending: true }).limit(200),
    supabase.from("audit_log").select(DECISION_FIELDS).eq("run_id", runId).eq("action", "verification.decision").order("occurred_at", { ascending: true }).limit(200),
  ]);
  const err = full.error ?? starts.error ?? decisions.error;
  if (err) throw new Error(err.message);
  return [...(full.data ?? []), ...(starts.data ?? []), ...(decisions.data ?? [])]
    .map((x) => asRunRow(x as Record<string, unknown>))
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
}

/** Names for the people who continued a run (best effort: if profiles can't be read, the timeline says "a teammate"). */
export async function fetchNames(rows: RunRow[]): Promise<Record<string, string>> {
  const ids = [...new Set(rows.filter((r) => r.action === "workflow.reopen").map((r) => r.payload?.by).filter((x): x is string => typeof x === "string" && UUID.test(x)))];
  if (ids.length === 0) return {};
  try {
    const res = await supabase.from("profiles").select("id,full_name").in("id", ids);
    if (res.error || !res.data) return {};
    const out: Record<string, string> = {};
    for (const p of res.data as { id: string; full_name: string | null }[]) if (p.full_name) out[p.id] = p.full_name.split(" ")[0]!;
    return out;
  } catch {
    return {};
  }
}

/** Fold what the run says into the job row (run id, what is saved, how it ended, what the readiness check found). Pure. */
export function enrichWithRows(j: JobRow, runId: string, rows: RunRow[]): JobRow {
  const r = (j.result ?? {}) as Record<string, unknown>;
  const wf = rows.filter((x) => x.action.startsWith("workflow."));
  if (wf.length === 0) return { ...j, result: { ...r, workflowRunId: runId } };
  const p = progressFromAudit(wf as AuditRow[]);
  const pre = [...wf].reverse().find((x) => x.action === "workflow.preflight");
  const halt = [...wf].reverse().find((x) => x.action === "workflow.halt" || x.action === "workflow.reopen" || x.action === "workflow.gate");
  const haltReason = halt?.action === "workflow.halt" && typeof halt.payload?.reason === "string" ? halt.payload.reason : null;
  return {
    ...j,
    result: {
      ...r,
      workflowRunId: runId,
      progress: p,
      ...(haltReason ? { haltReason } : {}),
      ...(pre ? { preflight: { ok: pre.payload?.ok === true, needs: Array.isArray(pre.payload?.needs) ? pre.payload!.needs : [] } } : {}),
      ...(r.status === undefined && j.status === "failed" ? { status: p.haltStatus ?? "crashed" } : {}),
    },
  };
}

/** The job as the run itself describes it: run id, what is saved, how it ended. */
export async function enrichFromRun(j: JobRow): Promise<JobRow> {
  try {
    const runId = await runIdOfJob(j);
    if (!runId) return j;
    return enrichWithRows(j, runId, await fetchRunRows(runId));
  } catch {
    return j;
  }
}

/** One fetch for the run page: the run id, its rows and the names of whoever continued it. Never throws. */
export async function loadRun(j: JobRow): Promise<{ jobId: string; runId: string | null; rows: RunRow[]; names: Record<string, string>; error: string | null }> {
  try {
    const runId = await runIdOfJob(j);
    if (!runId) return { jobId: j.id, runId: null, rows: [], names: {}, error: null };
    const rows = await fetchRunRows(runId);
    return { jobId: j.id, runId, rows, names: await fetchNames(rows), error: null };
  } catch (e) {
    return { jobId: j.id, runId: null, rows: [], names: {}, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Per-step durations from past runs (agent.complete {role, durationMs}), for "usually takes" and stall notes. */
export async function fetchStepDurations(runIds: string[]): Promise<{ role: unknown; durationMs: unknown }[]> {
  if (runIds.length === 0) return [];
  const res = await supabase.from("audit_log").select("run_id,role:payload->>role,durationMs:payload->durationMs").in("run_id", runIds).eq("action", "agent.complete").limit(500);
  if (res.error || !res.data) return [];
  return (res.data as Record<string, unknown>[]).map((x) => {
    const p = (x.payload as Record<string, unknown> | undefined) ?? {};
    return { role: x.role ?? p.role, durationMs: x.durationMs ?? p.durationMs };
  });
}
