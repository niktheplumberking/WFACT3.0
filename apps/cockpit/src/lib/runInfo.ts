/**
 * What the run itself says about a stopped job (Step 4D). A job row only knows what the worker managed to write before it
 * stopped; the run's own audit trail knows more: which run it was (`job.run`, linked the moment the run started) and what
 * was saved (`workflow.checkpoint` rows). Owners and admins can read the audit log (RLS), so the Cockpit asks.
 * Anything missing or unreadable falls back to the job row: never a made-up answer.
 */
import { supabase } from "../supabaseClient";
import type { JobRow } from "../jobsClient";
import { progressFromAudit, type AuditRow } from "./recovery";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The job as the run itself describes it: run id, what is saved, how it ended. */
export async function enrichFromRun(j: JobRow): Promise<JobRow> {
  try {
    const r = (j.result ?? {}) as Record<string, unknown>;
    let runId = typeof r.workflowRunId === "string" ? r.workflowRunId : typeof j.params?.workflowRunId === "string" ? (j.params.workflowRunId as string) : null;
    if (!runId) {
      const link = await supabase.from("audit_log").select("run_id").eq("action", "job.run").eq("task_id", j.id).limit(1);
      const id = (link.data?.[0] as { run_id?: string } | undefined)?.run_id;
      runId = id && UUID.test(id) ? id : null;
    }
    if (!runId) return j;
    const rows = await supabase.from("audit_log").select("action,payload").eq("run_id", runId).like("action", "workflow.%").order("occurred_at", { ascending: true }).limit(1000);
    if (rows.error || !rows.data || rows.data.length === 0) return { ...j, result: { ...r, workflowRunId: runId } };
    const p = progressFromAudit(rows.data as AuditRow[]);
    return { ...j, result: { ...r, workflowRunId: runId, progress: p, ...(r.status === undefined ? { status: p.haltStatus ?? "crashed" } : {}) } };
  } catch {
    return j;
  }
}
