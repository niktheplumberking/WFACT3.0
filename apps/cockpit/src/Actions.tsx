/**
 * Room 5: Actions — every pipeline action, from the Cockpit (2026-09-28). Each button only REQUESTS a
 * job (jobsClient.ts); the work runs on GitHub Actions with the secrets, and results stream back into
 * the list below. Launch stays a human gate: a verified build ends at "awaiting launch approval" —
 * there is deliberately no deploy button here.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { dispatchJob, previewHtml, requestJob, type JobKind, type JobRow } from "./jobsClient";

// A job still `queued` after this long was never dispatched (the function flips it to `dispatched` or
// `failed` within seconds) — stop polling for it and offer Start instead.
const STALE_QUEUED_MS = 2 * 60 * 1000;
const isStaleQueued = (j: JobRow) => j.status === "queued" && Date.now() - new Date(j.created_at).getTime() > STALE_QUEUED_MS;

interface PlanLite {
  id: string;
  client_slug: string;
  status: string;
  revision: number;
  decision_note: string | null;
  /** Step 4B M2: the owner's track; null for plans approved before migration 0011. */
  build_track: "A" | "B" | null;
  plan: { plan: { brief: { projectName: string; goal: string; requiredSections: string[] }; templateId: string } };
}

const KIND_LABEL: Record<JobKind, string> = {
  intake: "New request → plan",
  replan: "Re-plan",
  build_plan: "Build plan",
  resume: "Resume build",
  verify: "Verify page",
  ask: "Ask Hermes",
};

function useJobs() {
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from("jobs")
      .select("id,created_at,kind,params,status,started_at,finished_at,result,error,gh_run_url")
      .order("created_at", { ascending: false })
      .limit(25);
    if (e) setError(e.message);
    else setJobs(data as JobRow[]);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  // Poll while anything is in flight — jobs take ~30s (intake) to a few minutes (build).
  useEffect(() => {
    const active = jobs?.some((j) => ["queued", "dispatched", "running"].includes(j.status) && !isStaleQueued(j));
    if (!active) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [jobs, load]);
  return { jobs, error, reload: load };
}

/**
 * A built page, rendered inside the Cockpit. The iframe is sandboxed WITHOUT allow-same-origin: the page
 * gets an opaque origin, so its scripts (animations etc.) run but can never read the Cockpit's signed-in
 * session. Built pages are model output — treat them as untrusted.
 */
function PagePreview({ path }: { path: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [full, setFull] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await previewHtml(path);
    setLoading(false);
    setHtml(res.html);
    setError(res.error);
  }

  if (html === null) {
    return (
      <p>
        <button className="btn" disabled={loading} onClick={load}>
          {loading ? "Loading…" : "Preview built page"}
        </button>
        {error && <span className="error-state"> {error}</span>}
      </p>
    );
  }
  return (
    <div className={full ? "page-preview full" : "page-preview"}>
      <div className="plan-actions page-preview-bar">
        <code>{path}</code>
        <button className="btn" onClick={() => setFull(!full)}>
          {full ? "Exit full screen" : "Full screen"}
        </button>
        <button className="btn" onClick={() => { setHtml(null); setFull(false); }}>
          Close preview
        </button>
      </div>
      <iframe title={`Preview of ${path}`} sandbox="allow-scripts" srcDoc={html} className="page-preview-frame" />
    </div>
  );
}

function ResultView({ job }: { job: JobRow }) {
  const r = job.result ?? {};
  const checkpoint = r.lastCheckpoint as { path?: string; stage?: string } | null | undefined;

  if (job.kind === "ask" && typeof r.answer === "string") return <p className="plan-goal">{r.answer}</p>;
  if ((job.kind === "intake" || job.kind === "replan") && r.planId) {
    const plan = r.plan as { templateId?: string } | null;
    return (
      <p className="plan-sub">
        Plan <code>{String(r.planId).slice(0, 8)}</code> ({plan?.templateId}) is waiting in <strong>Approvals</strong>.
      </p>
    );
  }
  // A job that failed before the pipeline ran (e.g. dispatch refused) has no result — show only its error.
  if ((job.kind === "build_plan" || job.kind === "resume") && r.status !== undefined) {
    return (
      <div className="plan-sub">
        <p>
          {String(r.status ?? "")} · {String(r.cycles ?? "?")} build→QA cycle(s) · {String(r.correctionRounds ?? 0)} builder correction round(s)
        </p>
        {Array.isArray(r.qaIssues) && r.qaIssues.length > 0 && (
          <ul>{(r.qaIssues as string[]).slice(0, 8).map((i, n) => <li key={n}>{i}</li>)}</ul>
        )}
        {checkpoint?.path && <PagePreview path={checkpoint.path} />}
        {r.status === "awaiting_launch_approval" && <p>Verified. Launch is a human decision — nothing was deployed.</p>}
      </div>
    );
  }
  if (job.kind === "verify" && Array.isArray(r.checks)) {
    const failed = (r.checks as { checkId: string; passed: boolean }[]).filter((c) => !c.passed).map((c) => c.checkId);
    return (
      <p className="plan-sub">
        {String(r.status)} · source {String(r.source)} · {failed.length ? `failed: ${failed.join(", ")}` : "all checks passed"}
      </p>
    );
  }
  return null;
}

export function Actions() {
  const { jobs, error: jobsError, reload } = useJobs();
  const [plans, setPlans] = useState<PlanLite[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [requestText, setRequestText] = useState("");
  const [question, setQuestion] = useState("");
  const [verifyPath, setVerifyPath] = useState("clients/dreamsign-pilot/pages/clean-agency.html");
  const [verifyGoal, setVerifyGoal] = useState("");

  const loadPlans = useCallback(async () => {
    const { data } = await supabase
      .from("plan_approvals")
      .select("id,client_slug,status,revision,decision_note,build_track,plan")
      .in("status", ["approved", "rejected"])
      .order("created_at", { ascending: false })
      .limit(10);
    setPlans((data as PlanLite[]) ?? []);
  }, []);
  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  async function go(kind: JobKind, params: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setMessage(null);
    const { error } = await requestJob(kind, params);
    setBusy(false);
    setMessage(
      error
        ? { text: error, isError: true }
        : { text: `${KIND_LABEL[kind]} started — it runs on GitHub Actions; status updates below.`, isError: false },
    );
    if (!error) after?.();
    await reload();
  }

  async function start(job: JobRow) {
    setBusy(true);
    setMessage(null);
    const error = await dispatchJob(job.id);
    setBusy(false);
    setMessage(
      error
        ? { text: `Not started: ${error}`, isError: true }
        : { text: `${KIND_LABEL[job.kind]} started — it runs on GitHub Actions; status updates below.`, isError: false },
    );
    await reload();
  }

  return (
    <div>
      {message && <p className={message.isError ? "error-state" : "plan-sub"}>{message.text}</p>}

      <section className="panel plan-card">
        <h3 className="plan-title">New client request</h3>
        <p className="plan-sub">Paste the lead email or form. Intake classifies it, the Planner writes a plan, and it lands in Approvals.</p>
        <textarea
          className="plan-note action-textarea"
          rows={6}
          maxLength={20000}
          placeholder="Paste the raw request here…"
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
        />
        <div className="plan-actions">
          <button className="btn primary" disabled={busy || !requestText.trim()} onClick={() => go("intake", { text: requestText }, () => setRequestText(""))}>
            Run intake + plan
          </button>
        </div>
      </section>

      <section className="panel plan-card">
        <h3 className="plan-title">Plans ready for the next step</h3>
        {plans.length === 0 && <p className="empty-state">No approved or rejected plans yet — decide one in Approvals first.</p>}
        {plans.map((p) => (
          <div key={p.id} className="plan-actions action-row">
            <span className="action-label">
              <strong>{p.plan.plan.brief.projectName}</strong> · <code>{p.plan.plan.templateId}</code> · {p.status}
              {p.build_track && ` · Track ${p.build_track}`}
              {p.status === "rejected" && p.decision_note ? ` — “${p.decision_note}”` : ""}
            </span>
            {p.status === "approved" && p.build_track === "A" && (
              <button className="btn primary" disabled={busy} onClick={() => go("build_plan", { planId: p.id })}>
                Build + verify
              </button>
            )}
            {p.status === "approved" && p.build_track === "B" && (
              <span className="pill status-default">Track B builder arrives in Step 4B M4</span>
            )}
            {p.status === "approved" && !p.build_track && (
              <span className="pill status-default">approved before track choice existed: needs a new plan</span>
            )}
            {p.status === "rejected" && p.revision < 2 && (
              <button className="btn" disabled={busy} onClick={() => go("replan", { planId: p.id }, loadPlans)}>
                Re-plan from note
              </button>
            )}
            {p.status === "rejected" && p.revision >= 2 && <span className="pill status-default">re-plan limit reached — needs a human</span>}
          </div>
        ))}
      </section>

      <section className="panel plan-card">
        <h3 className="plan-title">Ask Hermes</h3>
        <div className="plan-actions">
          <input className="plan-note" maxLength={500} placeholder="e.g. What stage is DreamSign in?" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button className="btn primary" disabled={busy || !question.trim()} onClick={() => go("ask", { question }, () => setQuestion(""))}>
            Ask
          </button>
        </div>
      </section>

      <section className="panel plan-card">
        <h3 className="plan-title">Verify a page</h3>
        <div className="plan-actions">
          <input className="plan-note" placeholder="clients/<slug>/pages/<name>.html" value={verifyPath} onChange={(e) => setVerifyPath(e.target.value)} />
          <input className="plan-note" maxLength={1000} placeholder="What the page must achieve" value={verifyGoal} onChange={(e) => setVerifyGoal(e.target.value)} />
          <button className="btn primary" disabled={busy || !verifyGoal.trim()} onClick={() => go("verify", { path: verifyPath, goal: verifyGoal })}>
            Verify
          </button>
        </div>
      </section>

      <h2 className="section-title">Jobs</h2>
      {jobsError && <p className="error-state">{jobsError}</p>}
      {jobs && jobs.length === 0 && <p className="empty-state">No jobs yet.</p>}
      {jobs?.map((j) => (
        <article key={j.id} className={`panel plan-card job-${j.status}`}>
          <header className="plan-head">
            <div>
              <h3 className="plan-title">{KIND_LABEL[j.kind]}</h3>
              <p className="plan-meta">
                <span className={`pill job-pill-${j.status}`}>{j.status}</span>
                {new Date(j.created_at).toLocaleString()}
                {j.gh_run_url && (
                  <a href={j.gh_run_url} target="_blank" rel="noreferrer">
                    run log
                  </a>
                )}
              </p>
            </div>
          </header>
          {j.error && <p className="error-state">{j.error}</p>}
          {j.status === "queued" && (
            <div className="plan-actions">
              {isStaleQueued(j) && <span className="plan-sub">Never reached GitHub.</span>}
              <button className="btn" disabled={busy} onClick={() => start(j)}>
                Start
              </button>
            </div>
          )}
          <ResultView job={j} />
          {(j.kind === "build_plan" || j.kind === "resume") && j.status === "failed" && typeof j.result?.workflowRunId === "string" && (
            <div className="plan-actions">
              <button className="btn" disabled={busy} onClick={() => go("resume", { workflowRunId: j.result!.workflowRunId })}>
                Resume from last checkpoint
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
