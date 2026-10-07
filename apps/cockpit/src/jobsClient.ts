/**
 * Cockpit → job queue. The Cockpit never runs pipeline work itself (Blueprint §2: it displays and
 * gates): it inserts a `jobs` row (RLS + a trigger validate who/what, migration 0009) and asks the
 * `dispatch-job` Edge Function to start it on GitHub Actions. Both steps use the signed-in session;
 * no secret is ever in the browser.
 */
import { supabase } from "./supabaseClient";

export type JobKind = "intake" | "replan" | "build_plan" | "resume" | "verify" | "ask";
/** `cancelled` arrived with migration 0013 (a queued job that never started, closed by an owner/admin). */
export type JobStatus = "queued" | "dispatched" | "running" | "succeeded" | "failed" | "cancelled";

export interface JobRow {
  id: string;
  created_at: string;
  kind: JobKind;
  params: Record<string, unknown>;
  status: JobStatus;
  started_at: string | null;
  finished_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  gh_run_url: string | null;
  /** Migration 0015: a finished run an owner/admin hid from Activity and Home. Never deleted. */
  archived_at: string | null;
}

export const JOB_COLUMNS = "id,created_at,kind,params,status,started_at,finished_at,result,error,gh_run_url,archived_at";

export const isFinished = (j: Pick<JobRow, "status">) => j.status === "succeeded" || j.status === "failed" || j.status === "cancelled";

// A job still `queued` after this long was never dispatched (the function flips it to `dispatched` or
// `failed` within seconds) — stop polling for it and offer Start or Cancel instead. Same 2 minutes as
// cancel_job's guard in migration 0013.
export const STALE_QUEUED_MS = 2 * 60 * 1000;

export function isStaleQueued(j: Pick<JobRow, "status" | "created_at">, now = Date.now()): boolean {
  return j.status === "queued" && now - new Date(j.created_at).getTime() > STALE_QUEUED_MS;
}

/**
 * A job still `dispatched` or `running` after this long was killed without reporting (GitHub stops a run at 30 minutes; a
 * crash with no Doppler leaves no safety-net write). Same 45 minutes the jobs trigger (0018) uses to stop such a row from
 * blocking a new attempt. It is shown as "stopped without reporting", never as still running.
 */
export const STALE_RUNNING_MS = 45 * 60 * 1000;

export function isStaleRunning(j: Pick<JobRow, "status" | "created_at">, now = Date.now()): boolean {
  return (j.status === "dispatched" || j.status === "running") && now - new Date(j.created_at).getTime() > STALE_RUNNING_MS;
}

export function isActive(j: Pick<JobRow, "status" | "created_at">, now = Date.now()): boolean {
  return (j.status === "queued" && !isStaleQueued(j, now)) || ((j.status === "dispatched" || j.status === "running") && !isStaleRunning(j, now));
}

export async function requestJob(kind: JobKind, params: Record<string, unknown>): Promise<{ jobId: string | null; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { jobId: null, error: "You're signed out. Sign in again, then retry." };

  const { data, error } = await supabase.from("jobs").insert({ created_by: userId, kind, params }).select("id").single();
  if (error || !data) return { jobId: null, error: error?.message ?? "Could not create the job." };

  const dispatchError = await dispatchJob(data.id);
  return {
    jobId: data.id,
    error: dispatchError ? `The request was saved but didn't start: ${dispatchError}. Open it and press Start again.` : null,
  };
}

/**
 * Ask `dispatch-job` to start an existing `queued` job on GitHub Actions. Split out of `requestJob` so a
 * job whose dispatch never landed (e.g. a network or CORS failure — the row stays `queued` because the
 * function never saw the request) can be started again instead of being stranded. The function itself
 * refuses anything that isn't the caller's own still-queued job.
 */
export async function dispatchJob(jobId: string): Promise<string | null> {
  const { error: fnError } = await supabase.functions.invoke("dispatch-job", { body: { jobId } });
  if (fnError) {
    // The function records the reason on the job row (e.g. dispatcher not configured) — surface both.
    let detail = fnError.message;
    const ctx = (fnError as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = (await ctx.json()) as { error?: string };
        if (body?.error) detail = body.error;
      } catch {
        /* keep the generic message */
      }
    }
    return detail;
  }
  return null;
}

/** Close a job that never started (migration 0013). The database checks role, status, age and reason. */
/** Hide (or bring back) a finished run. The database keeps it; archive_job (0015) checks role and status. */
export async function archiveJob(jobId: string, archived = true): Promise<string | null> {
  const { error } = await supabase.rpc("archive_job", { p_job_id: jobId, p_archived: archived });
  return error ? error.message : null;
}

export async function cancelJob(jobId: string, reason: string): Promise<string | null> {
  const { error } = await supabase.rpc("cancel_job", { p_job_id: jobId, p_reason: reason });
  return error ? error.message : null;
}

/**
 * Fetch a built page's HTML for an in-Cockpit preview. Supabase Storage deliberately serves every
 * .html object as `text/plain` with `Content-Security-Policy: sandbox` (so its shared domain can't host
 * live pages), so opening the signed URL shows source, not a page. The caller renders this text in a
 * sandboxed iframe instead (components/PagePreview.tsx).
 */
export async function previewHtml(path: string): Promise<{ html: string | null; error: string | null }> {
  const { data, error } = await supabase.storage.from("artifacts").download(path);
  if (error || !data) return { html: null, error: error?.message ?? "Could not load the built page." };
  return { html: await data.text(), error: null };
}
