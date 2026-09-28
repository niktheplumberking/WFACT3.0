// dispatch-job — the only path from a Cockpit click to a GitHub Actions run (cockpit-job.yml).
//
// The Cockpit has already INSERTed the job (RLS + the jobs trigger validated who and what). This
// function re-checks, with the service role, that the caller is a signed-in owner/admin, that the job
// exists, belongs to them and is still `queued` — then dispatches the workflow with ONLY the job id
// and marks the job `dispatched`. The GitHub token never leaves this function's secrets
// (GITHUB_DISPATCH_TOKEN); the browser never sees it.
//
// Secrets: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// GITHUB_DISPATCH_TOKEN must be set by the owner (a token with Actions: write on the repo).
import { createClient } from "npm:@supabase/supabase-js@2";

const REPO = Deno.env.get("GITHUB_REPO") ?? "niktheplumberking/WFACT3.0";
const WORKFLOW_FILE = "cockpit-job.yml";
const REF = Deno.env.get("GITHUB_DISPATCH_REF") ?? "main";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The Cockpit's own Vercel hosts: the production alias, per-deployment URLs (`wfact-cockpit-<hash>-…`)
// and Git branch previews (`wfact-cockpit-git-<branch>-…`). Branch previews were missing until
// 2026-09-28: their preflight got a 204 with no CORS headers, so the browser silently dropped the POST
// and the job stayed `queued`. CORS is not the access control here — the caller's JWT is (below).
const COCKPIT_ORIGIN = /^https:\/\/wfact-cockpit(-git-[a-z0-9-]+|-[a-z0-9]+)?-niktheplumberkings-projects\.vercel\.app$/;
// Exact extra hosts: local dev, and `dist-rho-lime-95` — a second production alias of the
// wfact-cockpit project (left over from the 2026-09-22 manual `dist` deploy) that doesn't fit the pattern.
const EXTRA_ORIGINS = new Set(["http://localhost:5173", "https://dist-rho-lime-95.vercel.app"]);

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (EXTRA_ORIGINS.has(origin) || COCKPIT_ORIGIN.test(origin)) return origin;
  return null;
}

function respond(req: Request, status: number, body: Record<string, unknown>): Response {
  const origin = allowedOrigin(req.headers.get("origin"));
  // A 204 must have a null body — Deno throws otherwise (caught live: the CORS preflight 500'd).
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(origin
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            Vary: "Origin",
          }
        : {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    // Edge logs don't record the Origin header, so name a refused one here — otherwise a browser
    // silently dropping the POST is invisible from the server side.
    const origin = req.headers.get("origin");
    if (origin && !allowedOrigin(origin)) console.warn(`dispatch-job: CORS refused origin ${JSON.stringify(origin.slice(0, 200))}`);
    return respond(req, 204, {});
  }
  if (req.method !== "POST") return respond(req, 405, { error: "POST only" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // 1. Who is calling? (verify_jwt already rejected unsigned requests; this resolves the user.)
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return respond(req, 401, { error: "not signed in" });
  const userId = userData.user.id;

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!profile || !["owner", "admin"].includes(profile.role)) return respond(req, 403, { error: "owner/admin only" });

  // 2. Which job, and is it dispatchable by this user?
  let jobId: unknown;
  try {
    jobId = (await req.json())?.jobId;
  } catch {
    return respond(req, 400, { error: "body must be JSON {jobId}" });
  }
  if (typeof jobId !== "string" || !UUID.test(jobId)) return respond(req, 400, { error: "jobId must be a UUID" });
  const { data: job } = await admin.from("jobs").select("id,status,created_by,kind").eq("id", jobId).maybeSingle();
  if (!job) return respond(req, 404, { error: "job not found" });
  if (job.created_by !== userId) return respond(req, 403, { error: "you can only dispatch your own jobs" });
  if (job.status !== "queued") return respond(req, 409, { error: `job is already ${job.status}` });

  // 3. Dispatch — or fail the job loudly; never leave it looking queued-and-fine.
  const token = Deno.env.get("GITHUB_DISPATCH_TOKEN");
  if (!token) {
    await admin.from("jobs").update({ status: "failed", error: "Dispatcher not configured: GITHUB_DISPATCH_TOKEN is not set (see docs/COCKPIT-JOBS.md).", finished_at: new Date().toISOString() }).eq("id", jobId);
    return respond(req, 503, { error: "dispatcher not configured (GITHUB_DISPATCH_TOKEN missing)" });
  }
  const gh = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: REF, inputs: { job_id: jobId } }),
  });
  if (gh.status !== 204) {
    const detail = (await gh.text()).slice(0, 300);
    await admin.from("jobs").update({ status: "failed", error: `GitHub dispatch failed (HTTP ${gh.status}): ${detail}`, finished_at: new Date().toISOString() }).eq("id", jobId);
    return respond(req, 502, { error: `GitHub dispatch failed (HTTP ${gh.status})` });
  }
  await admin.from("jobs").update({ status: "dispatched", dispatched_at: new Date().toISOString() }).eq("id", jobId).eq("status", "queued");
  await admin.from("audit_log").insert({
    actor: userId, action: "job.dispatched", outcome: "info", task_id: jobId, payload: { kind: job.kind, workflow: WORKFLOW_FILE, ref: REF },
  });
  return respond(req, 202, { ok: true, jobId, status: "dispatched" });
});
