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

  const { error: fnError } = await supabase.functions.invoke("dispatch-job", { body: { jobId: data.id } });
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
    return { jobId: data.id, error: `Job created but not started: ${detail}` };
  }
  return { jobId: data.id, error: null };
}

export async function previewUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("artifacts").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
