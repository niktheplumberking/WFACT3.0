/**
 * Activity: everything the factory did, and for any run, why it failed and what to do next.
 * Results come from the jobs table (written by the worker), never from this page's own claims.
 */
import { useState } from "react";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Archive, ArrowClockwise, ArrowCounterClockwise, ArrowSquareOut, Play, XCircle } from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import { archiveJob, cancelJob, dispatchJob, isActive, isFinished, isStaleQueued, requestJob, type JobRow } from "../jobsClient";
import { latestBuildByPlan, planIdOfJob } from "../lib/attention";
import {
  KIND_LABEL, clock, dateTime, duration, explainJobError, jobState, planName, shortId,
  type PlanRow, type RoundRow,
} from "../lib/model";
import { fetchJob, useFactory, useLoad, useToast } from "../lib/state";
import { stageLabel } from "../stages";
import { Aspect, ConfirmDialog, Empty, LoadError, Loading, Notice, PageHead, PagePreview, Plate } from "../components/ui";
import { subjectOf } from "./Home";

/* ---------------- list ---------------- */

// Archived runs (migration 0015) are hidden everywhere except their own filter.
const FILTERS: { id: string; label: string; test: (j: JobRow) => boolean }[] = [
  { id: "all", label: "All", test: (j) => !j.archived_at },
  { id: "failed", label: "Failed", test: (j) => !j.archived_at && j.status === "failed" },
  { id: "stuck", label: "Never started", test: (j) => !j.archived_at && isStaleQueued(j) },
  { id: "running", label: "Running", test: (j) => isActive(j) },
  { id: "archived", label: "Archived", test: (j) => !!j.archived_at },
];

function ActivityTabs() {
  return (
    <nav className="tabs" aria-label="Activity views">
      <NavLink to="/activity" end>
        Runs
      </NavLink>
      <NavLink to="/activity/fixes">Fix rounds</NavLink>
    </nav>
  );
}

export default function Activity() {
  const f = useFactory();
  const [params, setParams] = useSearchParams();
  const show = FILTERS.find((x) => x.id === params.get("show")) ?? FILTERS[0]!;
  const jobs = f.jobs?.filter(show.test) ?? null;
  return (
    <>
      <PageHead title="Activity" lead="Every request the factory ran, newest first. Open one to see what happened and why." />
      <ActivityTabs />
      <div className="row-wrap" role="group" aria-label="Filter runs" style={{ marginBottom: 16 }}>
        {FILTERS.map((x) => (
          <button key={x.id} type="button" className={`btn small${x.id === show.id ? " primary" : ""}`} aria-pressed={x.id === show.id} onClick={() => setParams(x.id === "all" ? {} : { show: x.id })}>
            {x.label}
          </button>
        ))}
      </div>
      <Plate title={show.id === "all" ? "Runs" : `${show.label} runs`} note={f.jobs ? `${jobs!.length} of ${f.jobs.filter((j) => (show.id === "archived") === !!j.archived_at).length}` : undefined}>
        {f.error && <div className="plate-body"><LoadError what="runs" error={f.error} onRetry={f.reload} /></div>}
        {!f.jobs && !f.error && <Loading rows={4} label="Loading runs" />}
        {jobs && jobs.length === 0 && <Empty title={show.id === "all" ? "Nothing has run yet." : show.id === "archived" ? "Nothing is archived." : "No runs match this filter."}>{show.id === "archived" ? "Archive a finished run from its page to hide it here." : "Requests you start appear here."}</Empty>}
        {jobs && jobs.length > 0 && (
          <ul className="rows">
            {jobs.map((j) => {
              const s = jobState(j);
              const subject = subjectOf(j, f.plans ?? []);
              return (
                <li key={j.id}>
                  <Aspect tone={s.tone}>{s.label}</Aspect>
                  <div>
                    <Link className="row-link what" to={`/activity/${j.id}`}>
                      {KIND_LABEL[j.kind]}
                      {subject ? `: ${subject}` : ""}
                    </Link>
                    {j.status === "failed" && <p className="why">{explainJobError(j).headline}</p>}
                  </div>
                  <span className="when fig">
                    {dateTime(j.created_at)}
                    {duration(j.started_at, j.finished_at) ? `, ${duration(j.started_at, j.finished_at)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Plate>
    </>
  );
}

/* ---------------- fix rounds ---------------- */

async function fetchRounds(): Promise<RoundRow[]> {
  const res = await supabase
    .from("correction_rounds")
    .select("id,round_number,stage,flagged_by,issue,fixed_by,created_at,projects(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as unknown as RoundRow[];
}

export function FixRounds() {
  const rounds = useLoad(fetchRounds, []);
  return (
    <>
      <PageHead title="Activity" lead="Correction rounds: each time a check or a person sent work back to be fixed. This is the honest quality number the factory is measured on." />
      <ActivityTabs />
      <Plate title="Fix rounds" note={rounds.data ? `${rounds.data.length} logged` : undefined}>
        {rounds.error && <div className="plate-body"><LoadError what="fix rounds" error={rounds.error} onRetry={rounds.reload} /></div>}
        {!rounds.data && !rounds.error && <Loading rows={3} label="Loading fix rounds" />}
        {rounds.data && rounds.data.length === 0 && <Empty title="No fix rounds logged yet." />}
        {rounds.data && rounds.data.length > 0 && (
          <ul className="rows">
            {rounds.data.map((r) => (
              <li key={r.id}>
                <span className="aspect idle">Round {r.round_number}</span>
                <div>
                  <p className="what">{r.projects?.name ?? "Unknown project"}</p>
                  <p className="why" style={{ color: "var(--ink)" }}>{r.issue}</p>
                  <p className="why">
                    {stageLabel(r.stage)}. Flagged by {r.flagged_by}
                    {r.fixed_by ? `, fixed by ${r.fixed_by}` : ""}.
                  </p>
                </div>
                <span className="when fig">{dateTime(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Plate>
    </>
  );
}

/* ---------------- run page ---------------- */

const NOUN: Record<JobRow["kind"], string> = {
  build_plan: "Build",
  resume: "Build",
  intake: "Planning",
  replan: "Re-plan",
  verify: "Page check",
  ask: "Question",
};

function title(j: JobRow, plan: PlanRow | undefined): string {
  const name = plan ? planName(plan) : null;
  const build = j.kind === "build_plan" || j.kind === "resume";
  switch (j.status) {
    case "failed":
      return `${NOUN[j.kind]} stopped: ${explainJobError(j).headline}`;
    case "cancelled":
      return "This request was cancelled";
    case "queued":
      return isStaleQueued(j) ? "This request never started" : "Waiting to start";
    case "dispatched":
    case "running":
      return build ? `Building${name ? ` ${name}` : ""}` : j.kind === "ask" ? "Finding the answer" : "Working on it";
    case "succeeded":
      if (build) return `${name ?? "The"} build passed every check`;
      if (j.kind === "intake" || j.kind === "replan") return "A plan is ready for your decision";
      if (j.kind === "verify") return "The page passed its checks";
      return "Answered";
  }
}

function Steps({ j }: { j: JobRow }) {
  const end = j.finished_at;
  return (
    <ol className="steps">
      <li className="ok">
        <b>Requested</b>
        <span className="fig quiet">{clock(j.created_at)}</span>
        <span className="muted">{dateTime(j.created_at)}.</span>
      </li>
      {j.status === "queued" ? (
        <li className={isStaleQueued(j) ? "bad" : "now"}>
          <b>{isStaleQueued(j) ? "Never reached GitHub" : "Waiting for the worker"}</b>
          <span className="muted">{isStaleQueued(j) ? "The hand-off to the factory worker never landed. Start it again or close it." : "The worker usually picks it up within seconds."}</span>
        </li>
      ) : j.status === "cancelled" ? (
        <li className="notrun">
          <b>Cancelled</b>
          {end && <span className="fig quiet">{clock(end)}</span>}
          <span className="muted">{j.error}</span>
        </li>
      ) : (
        <>
          <li className={j.started_at ? "ok" : "now"}>
            <b>{j.started_at ? "Started on GitHub" : "Starting"}</b>
            {j.started_at && <span className="fig quiet">{clock(j.started_at)}</span>}
            <span className="muted">Picked up by the factory worker.</span>
          </li>
          {(j.status === "running" || j.status === "dispatched") && (
            <li className="now">
              <b>Working</b>
              <span className="muted">This page refreshes every few seconds.</span>
            </li>
          )}
          {j.status === "succeeded" && end && (
            <li className="ok">
              <b>Finished</b>
              <span className="fig quiet">{clock(end)}</span>
              <span className="muted">Took {duration(j.started_at ?? j.created_at, end)}.</span>
            </li>
          )}
          {j.status === "failed" && (
            <li className="bad">
              <b>Stopped and handed to a person</b>
              {end && <span className="fig quiet">{clock(end)}</span>}
              <span className="muted">Retries are capped; after that the factory stops and asks, by design.</span>
            </li>
          )}
        </>
      )}
    </ol>
  );
}

interface Round {
  round: number;
  verdict: string;
  issues: string[];
}

function Results({ j }: { j: JobRow }) {
  const r = j.result ?? {};
  const rounds = (Array.isArray(r.builderRounds) ? r.builderRounds : []) as Round[];
  const qa = (Array.isArray(r.qaIssues) ? r.qaIssues : []) as string[];
  const checks = (Array.isArray(r.checks) ? r.checks : []) as { checkId: string; passed: boolean; details?: string }[];
  const checkpoint = r.lastCheckpoint as { path?: string } | null | undefined;
  return (
    <>
      {j.kind === "ask" && typeof r.answer === "string" && (
        <Plate title="Answer">
          <div className="plate-body stack-tight">
            <p className="lede">{r.answer}</p>
            {r.needsHuman === true && <Notice tone="caution">The factory wasn't sure and flagged this for a person.</Notice>}
          </div>
        </Plate>
      )}
      {(j.kind === "intake" || j.kind === "replan") && typeof r.planId === "string" && (
        <Plate title="The plan">
          <div className="plate-body">
            <Link className="btn primary" to={`/decisions/plans/${r.planId}`}>
              Open the plan to decide
            </Link>
          </div>
        </Plate>
      )}
      {checkpoint?.path && (
        <Plate title="What was built" note="Shown safely: the page can't read your session.">
          <div className="plate-body">
            <PagePreview path={checkpoint.path} />
          </div>
        </Plate>
      )}
      {qa.length > 0 && (
        <Plate title="Checks that failed">
          <ul className="plain plate-body" style={{ paddingLeft: 40 }}>
            {qa.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </Plate>
      )}
      {checks.length > 0 && (
        <Plate title="Checks" note={`${checks.filter((c) => c.passed).length} of ${checks.length} passed`}>
          <ul className="rows">
            {checks.map((c) => (
              <li key={c.checkId}>
                <Aspect tone={c.passed ? "clear" : "stop"}>{c.passed ? "Passed" : "Failed"}</Aspect>
                <div>
                  <p className="what fig">{c.checkId}</p>
                  {c.details && <p className="why">{c.details}</p>}
                </div>
                <span />
              </li>
            ))}
          </ul>
        </Plate>
      )}
      {rounds.length > 0 && (
        <Plate title="Fix rounds during this build" note={`${rounds.length} round${rounds.length === 1 ? "" : "s"}: the reviewer sent work back, the builder fixed it`}>
          <div className="plate-body rounds">
            {rounds.map((x) => (
              <div key={x.round}>
                <h3>
                  Round {x.round}: {x.verdict === "approved" ? "approved" : "changes requested"}
                </h3>
                {x.issues.length > 0 ? (
                  <ul className="plain" style={{ paddingLeft: 20 }}>
                    {x.issues.map((i, n) => (
                      <li key={n} className="muted">
                        {i}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No issues.</p>
                )}
              </div>
            ))}
          </div>
        </Plate>
      )}
    </>
  );
}

export function RunPage() {
  const { jobId = "" } = useParams();
  const f = useFactory();
  const nav = useNavigate();
  const toast = useToast();
  const job = useLoad(() => fetchJob(jobId), [jobId], { pollMs: 5000, pollWhile: (j) => !!j && isActive(j) });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const j = job.data;
  if (job.error) return <LoadError what="this run" error={job.error} onRetry={job.reload} />;
  if (job.loading && !j) return <Loading rows={4} label="Loading the run" />;
  if (!j) return <Empty title="This run doesn't exist, or your role can't see it.">Runs are visible to owners and admins. <Link to="/activity">Back to Activity</Link></Empty>;

  const jobs = f.jobs ?? [];
  const planId = planIdOfJob(j, jobs);
  const plan = planId ? f.plans?.find((p) => p.id === planId) : undefined;
  const s = jobState(j);
  const build = j.kind === "build_plan" || j.kind === "resume";
  const latest = planId ? latestBuildByPlan(jobs).get(planId) : undefined;
  const superseded = build && j.status === "failed" && latest && latest.id !== j.id && latest.status === "succeeded" ? latest : null;
  const canResume = build && j.status === "failed" && typeof j.result?.workflowRunId === "string";
  const explanation = j.status === "failed" ? explainJobError(j) : null;

  async function act(fn: () => Promise<string | null>, ok: string) {
    setBusy(true);
    setActionError(null);
    const e = await fn();
    setBusy(false);
    if (e) return setActionError(e);
    toast(ok);
    await Promise.all([job.reload(), f.reload()]);
  }

  return (
    <>
      <PageHead
        kicker={
          <>
            <Aspect tone={s.tone}>{s.label}</Aspect>{" "}
            <span className="fig" style={{ marginLeft: 10 }}>
              {dateTime(j.created_at)}
              {duration(j.started_at, j.finished_at) ? `. Took ${duration(j.started_at, j.finished_at)}` : ""}
            </span>
          </>
        }
        title={title(j, plan)}
        lead={`${KIND_LABEL[j.kind]}${plan ? ` for ${planName(plan)}` : ""}${plan?.build_track ? `, Track ${plan.build_track}` : ""}.${j.kind === "ask" ? ` You asked: “${String(j.params?.question ?? "")}”` : ""}`}
        actions={
          <>
            {canResume && (
              <button
                className="btn primary"
                type="button"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const { jobId: id, error } = await requestJob("resume", { workflowRunId: j.result!.workflowRunId });
                    if (!id) return error;
                    nav(`/activity/${id}`);
                    return null;
                  }, "Resuming from the last saved step.")
                }
              >
                <ArrowClockwise aria-hidden="true" />
                Resume build
              </button>
            )}
            {j.status === "queued" && (
              <button className="btn primary" type="button" disabled={busy} onClick={() => act(() => dispatchJob(j.id), "Started. The worker picks it up within seconds.")}>
                <Play aria-hidden="true" />
                Start again
              </button>
            )}
            {isStaleQueued(j) && (
              <button className="btn danger" type="button" disabled={busy} onClick={() => { setCancelError(null); setCancelOpen(true); }}>
                <XCircle aria-hidden="true" />
                Close it
              </button>
            )}
            {isFinished(j) && (
              <button
                className="btn ghost"
                type="button"
                disabled={busy}
                onClick={() => act(() => archiveJob(j.id, !j.archived_at), j.archived_at ? "Back in Activity." : "Archived. It's hidden from Activity and Home; nothing was deleted.")}
              >
                {j.archived_at ? <ArrowCounterClockwise aria-hidden="true" /> : <Archive aria-hidden="true" />}
                {j.archived_at ? "Unarchive" : "Archive"}
              </button>
            )}
            {planId && (
              <Link className="btn ghost" to={`/decisions/plans/${planId}`}>
                Open the plan
              </Link>
            )}
          </>
        }
      />
      <div className="split narrow">
        <div className="stack">
          {explanation && (
            <Notice tone="stop" title="What happened.">
              {explanation.happened} <b>What to do.</b> {explanation.todo}
            </Notice>
          )}
          {superseded && (
            <Notice tone="info">
              A later build of the same plan passed every check ({dateTime(superseded.finished_at ?? superseded.created_at)}). You probably don't need to resume this one.{" "}
              <Link to={`/activity/${superseded.id}`}>Open the later build</Link>
            </Notice>
          )}
          {build && j.status === "succeeded" && j.result?.status === "awaiting_launch_approval" && (
            <Notice tone="clear" title="Verified, not published.">
              Every check passed. Launch is Nick's decision and happens outside the Cockpit; nothing here deploys a site.
            </Notice>
          )}
          {j.archived_at && (
            <Notice tone="info" title="Archived.">
              Hidden from Activity and Home since {dateTime(j.archived_at)}. The record is kept; Unarchive brings it back.
            </Notice>
          )}
          {actionError && <Notice tone="stop" title="That didn't work.">{actionError} Nothing changed.</Notice>}
          <Plate title="What the factory did">
            <div className="plate-body">
              <Steps j={j} />
            </div>
          </Plate>
          <Results j={j} />
        </div>
        <Plate title="Technical details">
          <dl className="kv plate-body">
            <div>
              <dt>Job</dt>
              <dd className="fig">{shortId(j.id)}</dd>
            </div>
            {typeof j.result?.workflowRunId === "string" && (
              <div>
                <dt>Workflow run</dt>
                <dd className="fig">{shortId(j.result.workflowRunId)}</dd>
              </div>
            )}
            {planId && (
              <div>
                <dt>Plan</dt>
                <dd className="fig">{shortId(planId)}</dd>
              </div>
            )}
            {typeof j.result?.cycles === "number" && (
              <div>
                <dt>Build and check cycles</dt>
                <dd className="fig">{j.result.cycles}</dd>
              </div>
            )}
            {typeof j.result?.status === "string" && (
              <div>
                <dt>Pipeline status</dt>
                <dd className="fig">{j.result.status}</dd>
              </div>
            )}
          </dl>
          {j.error && (
            <details className="raw plate-body" style={{ paddingTop: 0 }}>
              <summary>Raw error</summary>
              <pre>{j.error}</pre>
            </details>
          )}
          {j.gh_run_url && (
            <div className="plate-body" style={{ paddingTop: 0 }}>
              <a className="btn small" href={j.gh_run_url} target="_blank" rel="noreferrer">
                <ArrowSquareOut aria-hidden="true" />
                GitHub run log
              </a>
            </div>
          )}
        </Plate>
      </div>
      <ConfirmDialog
        open={cancelOpen}
        title="Close this request?"
        body="It never started, so nothing ran. Closing it marks it cancelled with your reason. It can't be reopened; start a new request if the work is still needed."
        confirmLabel="Close request"
        reasonLabel="Reason"
        danger
        busy={busy}
        error={cancelError}
        onCancel={() => setCancelOpen(false)}
        onConfirm={async (reason) => {
          setBusy(true);
          const e = await cancelJob(j.id, reason);
          setBusy(false);
          if (e) return setCancelError(`It wasn't closed: ${e}.`);
          setCancelOpen(false);
          toast("Request closed.");
          await Promise.all([job.reload(), f.reload()]);
        }}
      />
    </>
  );
}
