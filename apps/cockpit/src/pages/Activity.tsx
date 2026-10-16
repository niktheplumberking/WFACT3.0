/**
 * Activity: everything the factory and the team did (lib/activity.ts), and for any build, why it stopped and what to do
 * next. Results come from the jobs table and the audit trail (written by the worker and the database), never from this
 * page's own claims.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import {
  Archive, ArrowCounterClockwise, ArrowSquareOut, ArrowsClockwise, BookmarkSimple, ChatCircleText, CheckCircle, FileText, Hammer, PencilSimple, Play, Question,
  SealCheck, StopCircle, UserMinus, UserPlus, XCircle, type Icon,
} from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import { archiveJob, cancelJob, dispatchJob, isActive, isFinished, isStaleQueued, isStaleRunning, type JobRow } from "../jobsClient";
import { latestBuildByPlan, planIdOfJob } from "../lib/attention";
import { asStopped, diagnoseJob } from "../lib/recovery";
import { enrichWithRows, loadRun } from "../lib/runInfo";
import { deriveTimeline, type Timeline } from "../lib/timeline";
import { loadBuildStats } from "../lib/buildStats";
import {
  KIND_LABEL, clock, dateTime, duration, explainJobError, jobState, planName, shortId,
  type PlanRow, type RoundRow,
} from "../lib/model";
import { canDecide, fetchJob, useFactory, useLoad, useMe, useToast } from "../lib/state";
import { ALL_ACTIVITY, FACTORY, actorName, byDay, factoryLines, fetchRoundEvents, matches, teamLines, type ActivityFilter, type ActivityLine } from "../lib/activity";
import { fetchPeople, fetchPersonEvents } from "../lib/phrases";
import { Button, EmptyState } from "../components/kit";
import { fetchRunSpend, money, total } from "../lib/costs";
import { stageLabel } from "../stages";
import { Aspect, ConfirmDialog, Empty, LoadError, Loading, Notice, PageHead, PagePreview, Plate } from "../components/ui";
import { ClientNeedsPanel } from "../components/Recovery";
import { StoppedBuild } from "../components/StoppedBuild";
import { SiteReview } from "../components/SiteReview";
import { clientNameOf } from "../lib/clients";
import { buildsOf } from "../lib/path";
import { PlaceholdersPanel } from "../components/Placeholders";
import { LiveBuild } from "../components/LiveBuild";

/* ---------------- the Activity room (Cockpit v2 phase 14) ---------------- */

const TYPES: [ActivityFilter["type"], string][] = [
  ["all", "Everything"],
  ["decision", "Decisions"],
  ["build", "Builds"],
  ["stop", "Stops"],
  ["detail", "Details"],
  ["team", "Team"],
];

const GLYPH: Record<ActivityLine["glyph"], Icon> = {
  approved: SealCheck,
  changes: ChatCircleText,
  detail: PencilSimple,
  build: Hammer,
  continue: Play,
  question: Question,
  proposal: FileText,
  archive: Archive,
  cancel: XCircle,
  team: UserPlus,
  declined: UserMinus,
  finished: CheckCircle,
  stopped: StopCircle,
  round: ArrowsClockwise,
};
const glyphTone = (l: ActivityLine) => (l.type === "stop" ? "var(--stop)" : l.type === "decision" ? "var(--need)" : "var(--ink-2)");
const hhmm = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/** The saved view lives in this browser only: profiles hold no settings column (checked 2026-10-16; BLOCKED-ON-NICK.md). */
const viewKey = (userId: string | null) => `cockpit-activity-view:${userId ?? "anon"}`;
function readView(userId: string | null): ActivityFilter {
  try {
    const v = localStorage.getItem(viewKey(userId));
    return v ? { ...ALL_ACTIVITY, ...(JSON.parse(v) as Partial<ActivityFilter>) } : ALL_ACTIVITY;
  } catch {
    return ALL_ACTIVITY;
  }
}
function writeView(userId: string | null, v: ActivityFilter | null) {
  try {
    if (v) localStorage.setItem(viewKey(userId), JSON.stringify(v));
    else localStorage.removeItem(viewKey(userId));
  } catch {
    /* private mode: the filters still work for this visit */
  }
}

async function loadActivity() {
  const [events, rounds, people] = await Promise.all([fetchPersonEvents(), fetchRoundEvents(), fetchPeople()]);
  return { events, rounds, people };
}

export default function Activity() {
  const me = useMe();
  const f = useFactory();
  const toast = useToast();
  const decider = canDecide(me.role);
  const [v, setV] = useState<ActivityFilter>(() => readView(me.userId));
  const set = (patch: Partial<ActivityFilter>) => setV((x) => ({ ...x, ...patch }));
  const load = useLoad(() => (decider ? loadActivity() : Promise.resolve(null)), [decider]);

  const lines = useMemo(() => {
    if (!load.data || !f.jobs || !f.plans) return null;
    return [...teamLines(load.data.events, load.data.people, f.jobs, f.plans), ...factoryLines(f.jobs, f.plans, load.data.rounds)];
  }, [load.data, f.jobs, f.plans]);
  const people = load.data?.people ?? {};
  const who = (actor: string) => actorName(actor, people, me.userId);

  const clients = useMemo(() => [...new Set((lines ?? []).map((l) => l.client).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)), [lines]);
  const persons = useMemo(() => {
    const ids = [...new Set((lines ?? []).map((l) => l.actor).filter((a) => a !== FACTORY))];
    return ids.map((id) => ({ id, name: actorName(id, people, me.userId) })).sort((a, b) => (a.id === me.userId ? -1 : b.id === me.userId ? 1 : a.name.localeCompare(b.name)));
  }, [lines, people, me.userId]);
  const days = useMemo(() => byDay((lines ?? []).filter((l) => matches(l, v))), [lines, v]);

  if (!decider) {
    return (
      <div className="activity">
        <header className="activity-head">
          <h1 className="t-title">Activity</h1>
        </header>
        <EmptyState title="Activity is for owners and admins.">Your clients’ progress is on each client’s page in Projects.</EmptyState>
      </div>
    );
  }

  const error = load.error ?? f.error;
  return (
    <div className="activity">
      <header className="activity-head">
        <h1 className="t-title">Activity</h1>
        <p className="muted">Everything the factory and the team did, newest first.</p>
      </header>
      <div className="projects-tools">
        <label className="select-field">
          <span>Client</span>
          <select value={v.client} onChange={(e) => set({ client: e.target.value })}>
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {v.client !== "all" && !clients.includes(v.client) && <option value={v.client}>{v.client}</option>}
          </select>
        </label>
        <label className="select-field">
          <span>Person</span>
          <select value={v.person} onChange={(e) => set({ person: e.target.value })}>
            <option value="all">Anyone</option>
            <option value={FACTORY}>The factory</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {v.person !== "all" && v.person !== FACTORY && !persons.some((p) => p.id === v.person) && <option value={v.person}>{who(v.person)}</option>}
          </select>
        </label>
        <button
          type="button"
          className="btn quiet"
          onClick={() => {
            const before = readView(me.userId);
            writeView(me.userId, v);
            toast("Saved on this device. Activity opens like this next time you use this browser.", { label: "Undo", run: () => writeView(me.userId, before) });
          }}
        >
          <BookmarkSimple aria-hidden="true" />
          Save this view
        </button>
      </div>
      <div role="group" aria-label="Type" className="filters">
        {TYPES.map(([k, label]) => (
          <button key={k} type="button" className="pill" aria-pressed={v.type === k} onClick={() => set({ type: k })}>
            {label}
          </button>
        ))}
      </div>

      {error && <LoadError what="the activity" error={error} onRetry={() => void Promise.all([load.reload(), f.reload()])} />}
      {!error && !lines && <Loading rows={4} label="Loading the activity" />}
      {lines && lines.length === 0 && <EmptyState title="Nothing has happened yet.">Requests, decisions and builds appear here as they happen.</EmptyState>}
      {lines && lines.length > 0 && days.length === 0 && (
        <div role="status" className="no-match">
          <p className="muted">Nothing matches these filters yet.</p>
          <Button onClick={() => setV(ALL_ACTIVITY)}>Show everything</Button>
        </div>
      )}
      {days.map((day) => (
        <section key={day.label} className="activity-day" aria-labelledby={`day-${day.label}`}>
          <h2 id={`day-${day.label}`} className="activity-day-h">
            {day.label}
          </h2>
          <ol className="activity-list">
            {day.items.map((l) => {
              const G = GLYPH[l.glyph];
              return (
                <li key={l.key} className="activity-row">
                  <time className="activity-time fig" dateTime={l.at}>
                    {hhmm.format(new Date(l.at))}
                  </time>
                  <G aria-hidden="true" className="activity-glyph" style={{ color: glyphTone(l) }} />
                  <div className="activity-what">
                    <p>
                      <b>{who(l.actor)}</b> · {l.jobId ? <Link to={`/activity/${l.jobId}`}>{l.text}</Link> : <span>{l.text}</span>}
                    </p>
                    {l.client ? (
                      <span className="activity-client">{l.client}</span>
                    ) : (
                      <span className="activity-client">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">No client</span>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/* ---------------- fix rounds ---------------- */

function ActivityTabs() {
  return (
    <nav className="tabs" aria-label="Activity views">
      <NavLink to="/activity" end>
        Activity
      </NavLink>
      <NavLink to="/activity/fixes">Fix rounds</NavLink>
    </nav>
  );
}

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
  direction: "Direction",
  verify: "Page check",
  ask: "Question",
};

function title(j: JobRow, plan: PlanRow | undefined): string {
  const name = plan ? planName(plan) : null;
  const build = j.kind === "build_plan" || j.kind === "resume";
  if (isStaleRunning(j)) return `${NOUN[j.kind]} stopped without reporting`;
  switch (j.status) {
    case "failed":
      return `${NOUN[j.kind]} stopped: ${diagnoseJob(j).headline}`;
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
      if (j.kind === "direction") return "The direction is ready; the plan is waiting for your decision";
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
          {(j.status === "running" || j.status === "dispatched") && isStaleRunning(j) && (
            <li className="bad">
              <b>Stopped without reporting</b>
              <span className="muted">It has been going far longer than a build takes, so the worker most likely hit GitHub's time limit or crashed. What it saved is kept.</span>
            </li>
          )}
          {(j.status === "running" || j.status === "dispatched") && !isStaleRunning(j) && (
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
      {r.briefBasis === "summary-only" && (
        <Notice tone="caution">Built from a summary only: the client's original request was not on file for this plan, so the builder could not check the site against the client's own words.</Notice>
      )}
      {(j.kind === "intake" || j.kind === "replan" || j.kind === "direction") && typeof r.planId === "string" && (
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

const runIdOf = (j: JobRow): string | null => {
  const id = j.result?.workflowRunId ?? j.params?.workflowRunId;
  return typeof id === "string" ? id : null;
};

/** MVP M6: this build's AI spend (every retry and reopen of the run). Owners only, like the Costs page. */
function RunCost({ runId }: { runId: string | null }) {
  const me = useMe();
  const owner = me.role === "owner";
  const spend = useLoad(() => (owner && runId ? fetchRunSpend(runId) : Promise.resolve(null)), [owner, runId]);
  const s = spend.data;
  if (!s) return null;
  return <>. AI spend {money(total(s))}{s.estimated + s.history > 0 ? " est." : ""} over {s.calls} calls</>;
}

export function RunPage() {
  const { jobId = "" } = useParams();
  const f = useFactory();
  const nav = useNavigate();
  const toast = useToast();
  const me = useMe();
  const jobActive = useCallback((j: JobRow | null) => !!j && isActive(j), []);
  const job = useLoad(() => fetchJob(jobId), [jobId], { pollMs: 5000, pollWhile: jobActive });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // A build is read together with the run's own record: every step it took, what it saved, how it ended. Polled (about
  // every 5 s) only while the job is active; a finished run is read once.
  const stopped = job.data ? asStopped(job.data) : null;
  const isBuildJob = !!stopped && (stopped.kind === "build_plan" || stopped.kind === "resume");
  const activeRef = useRef(false);
  activeRef.current = !!job.data && isActive(job.data);
  const runPoll = useCallback(() => activeRef.current, []);
  const run = useLoad(() => (stopped && isBuildJob ? loadRun(stopped) : Promise.resolve(null)), [stopped?.id, stopped?.status, stopped?.finished_at, isBuildJob], {
    pollMs: 5000,
    pollWhile: runPoll,
  });
  const j = job.data;
  const planIdEarly = j ? planIdOfJob(j, f.jobs ?? []) : null;
  const planEarly = planIdEarly ? f.plans?.find((p) => p.id === planIdEarly) : undefined;
  const track = planEarly?.build_track ?? null;
  const live = !!j && isBuildJob && isActive(j);
  const stats = useLoad(() => (live ? loadBuildStats(f.jobs ?? [], f.plans ?? [], track, j?.id) : Promise.resolve(null)), [live, track, f.jobs?.length ?? 0]);
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
  const siblings = planId ? jobs.filter((x) => planIdOfJob(x, jobs) === planId).sort((a, b) => b.created_at.localeCompare(a.created_at)) : [];
  // A stop that a later build of the same plan already fixed needs no button; the pointer below says so.
  const runData = run.data && stopped && run.data.runId && run.data.jobId === stopped.id ? run.data : null;
  const jv = runData && stopped ? enrichWithRows(stopped, runData.runId!, runData.rows) : stopped ?? j;
  const runReady = !isBuildJob || run.data?.jobId === j.id;
  const timeline: Timeline | null = isBuildJob
    ? deriveTimeline({
        rows: runData?.rows ?? [],
        job: jv,
        plan: plan ? { decidedAt: plan.decided_at ?? null, track: plan.build_track ?? null } : null,
        names: runData?.names,
        meId: me.userId,
        active: isActive(j),
        neverStarted: isStaleQueued(j),
      })
    : null;
  const showRecovery = jv.status === "failed" && !superseded && !j.archived_at && runReady && !!timeline;

  async function act(fn: () => Promise<string | null>, ok: string) {
    setBusy(true);
    setActionError(null);
    const e = await fn();
    setBusy(false);
    if (e) return setActionError(e);
    toast(ok);
    await Promise.all([job.reload(), f.reload()]);
  }

  // Cockpit v2: the newest passing build, waiting for approval, is the finished site review.
  const reviewing = build && j.status === "succeeded" && j.result?.status === "awaiting_launch_approval" && !j.archived_at && latest?.id === j.id;
  if (reviewing) {
    return (
      <SiteReview job={j} planId={planId} clientName={plan ? clientNameOf(plan) : "The site"} onStarted={(id) => nav(`/activity/${id}`)}>
        <ClientNeedsPanel job={j} planId={planId} onStarted={(id) => nav(`/activity/${id}`)} />
      </SiteReview>
    );
  }

  // Cockpit v2: a stopped build is its own view (chip, headline, facts, the fix, Why?).
  if (showRecovery) {
    const n = planId ? [...buildsOf(planId, jobs)].sort((a, b) => a.created_at.localeCompare(b.created_at)).findIndex((x) => x.id === j.id) + 1 : 0;
    const context = [plan ? clientNameOf(plan) : null, n > 0 ? `Build ${n}` : "Build"].filter(Boolean).join(" · ");
    return (
      <>
        {actionError && <Notice tone="stop" title="That didn't work.">{actionError} Nothing changed.</Notice>}
        <StoppedBuild
          job={jv}
          siblings={siblings}
          planId={planId}
          planName={plan ? planName(plan) : null}
          context={context}
          timeline={timeline!}
          onChanged={async () => {
            await Promise.all([job.reload(), f.reload()]);
          }}
          onStarted={(id) => nav(`/activity/${id}`)}
          onArchive={() => void act(() => archiveJob(j.id, true), "Put away. It's hidden from Activity and Home; nothing was deleted.")}
        />
      </>
    );
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
              <RunCost runId={runIdOf(j)} />
            </span>
          </>
        }
        title={title(j, plan)}
        lead={`${KIND_LABEL[j.kind]}${plan ? ` for ${planName(plan)}` : ""}${plan?.build_track ? `, Track ${plan.build_track}` : ""}.${j.kind === "ask" ? ` You asked: “${String(j.params?.question ?? "")}”` : ""}`}
        actions={
          <>
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
          {j.status === "failed" && superseded && (
            <Notice tone="stop" title="What happened.">
              {explainJobError(j).happened}
            </Notice>
          )}
          {build && j.status === "succeeded" && <ClientNeedsPanel job={j} planId={planId} onStarted={(id) => nav(`/activity/${id}`)} />}
          {build && j.status === "succeeded" && <PlaceholdersPanel job={j} planId={planId} onStarted={(id) => nav(`/activity/${id}`)} />}
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
          {timeline && !runReady ? (
            <Plate title="What the factory did">
              <Loading rows={3} label="Reading the build's steps" />
            </Plate>
          ) : timeline && !showRecovery ? (
            <Plate title={live ? "Build progress" : "What the factory did"} note={timeline.fromAudit ? undefined : "From the build's own record"}>
              <div className="plate-body">
                <LiveBuild
                  timeline={timeline}
                  stats={stats.data}
                  startedAt={j.started_at ?? j.created_at}
                  finishedAt={j.finished_at}
                  tech={[{ k: "job", v: j.id }, ...(j.result?.workflowRunId ? [{ k: "run", v: String(j.result.workflowRunId) }] : []), ...(j.gh_run_url ? [{ k: "worker log", v: j.gh_run_url }] : [])]}
                />
                {run.data?.error && <p className="quiet fine" style={{ marginTop: 12 }}>The run's step-by-step record couldn't be read just now (“{run.data.error}”), so this shows what the job itself reported. Nothing changed.</p>}
              </div>
            </Plate>
          ) : !timeline ? (
            <Plate title="What the factory did">
              <div className="plate-body">
                <Steps j={j} />
              </div>
            </Plate>
          ) : null}
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
