/**
 * Cockpit → job queue. The Cockpit never runs pipeline work itself (Blueprint §2: it displays and
 * gates): it inserts a `jobs` row (RLS + a trigger validate who/what, migration 0009) and asks the
 * `dispatch-job` Edge Function to start it on GitHub Actions. Both steps use the signed-in session;
 * no secret is ever in the browser.
 */
import { supabase } from "./supabaseClient";

export type JobKind = "intake" | "replan" | "build_plan" | "resume" | "verify" | "ask";

export interface JobRow {
  id: string;
  created_at: string;
  kind: JobKind;
  params: Record<string, unknown>;
  status: "queued" | "dispatched" | "running" | "succeeded" | "failed";
  started_at: string | null;
  finished_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  gh_run_url: string | null;
}

export async function requestJob(kind: JobKind, params: Record<string, unknown>): Promise<{ jobId: string | null; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { jobId: null, error: "Not signed in." };

  const { data, error } = await supabase.from("jobs").insert({ created_by: userId, kind, params }).select("id").single();
  if (error || !data) return { jobId: null, error: error?.message ?? "Could not create the job." };

  const dispatchError = await dispatchJob(data.id);
  return { jobId: data.id, error: dispatchError ? `Job created but not started: ${dispatchError} — use Start on the job below to retry.` : null };
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

/**
 * Fetch a built page's HTML for an in-Cockpit preview. Supabase Storage deliberately serves every
 * .html object as `text/plain` with `Content-Security-Policy: sandbox` (so its shared domain can't host
 * live pages), so opening the signed URL shows source, not a page. The caller renders this text in a
 * sandboxed iframe instead (Actions.tsx).
 */
export async function previewHtml(path: string): Promise<{ html: string | null; error: string | null }> {
  const { data, error } = await supabase.storage.from("artifacts").download(path);
  if (error || !data) return { html: null, error: error?.message ?? "Could not load the built page." };
  return { html: await data.text(), error: null };
}
