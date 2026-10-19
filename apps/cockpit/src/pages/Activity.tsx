/**
 * Activity: everything the factory and the team did (lib/activity.ts), and for any build, why it stopped and what to do
 * next. Results come from the jobs table and the audit trail (written by the worker and the database), never from this
 * page's own claims.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import {
  Archive, ArrowCounterClockwise, ArrowsClockwise, BookmarkSimple, ChatCircleText, CheckCircle, FileText, Hammer, PencilSimple, Play, Question,
  SealCheck, StopCircle, UserMinus, UserPlus, XCircle, type Icon,
} from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import { archiveJob, cancelJob, dispatchJob, isActive, isFinished, isStaleQueued, isStaleRunning, type JobRow } from "../jobsClient";
import { latestBuildByPlan, planIdOfJob } from "../lib/attention";
import { asStopped, diagnoseJob } from "../lib/recovery";
import { enrichWithRows, loadRun } from "../lib/runInfo";
import { checkLabel, deriveTimeline, issueLabel, type Timeline } from "../lib/timeline";
import { loadBuildStats } from "../lib/buildStats";
import {
  KIND_LABEL, clock, dateTime, duration, explainJobError, planName,
  type PlanRow, type RoundRow,
} from "../lib/model";
import { canDecide, fetchJob, useFactory, useLoad, useMe, useToast } from "../lib/state";
import { ALL_ACTIVITY, FACTORY, actorName, byDay, factoryLines, fetchRoundEvents, matches, teamLines, type ActivityFilter, type ActivityLine } from "../lib/activity";
import { fetchPeople, fetchPersonEvents } from "../lib/phrases";
import { Button, ButtonLink, EmptyState, StatusChip, TechDetails, type StatusTone } from "../components/kit";
import { StepRow } from "../components/flow";
import { fetchRunSpend, money, total } from "../lib/costs";
import { stageLabel } from "../stages";
import { ConfirmDialog, Empty, LoadError, Loading, Notice, PageHead, PagePreview, Plate } from "../components/ui";
import { ClientNeedsPanel } from "../components/Recovery";
import { StoppedBuild } from "../components/StoppedBuild";
import { PlaceholderPicturesSection, RebuildWithPicturesDialog, SiteReview, usePlaceholderPictures } from "../components/SiteReview";
import { clientNameOf } from "../lib/clients";
import { buildsOf, KIND_OF_SITE } from "../lib/path";
import { placeholdersOf } from "../components/Placeholders";
import { LiveBuild } from "../components/LiveBuild";
import { activityViewKey } from "../lib/prefs";

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
const viewKey = activityViewKey;
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
  replan: "Revision",
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
      if (j.kind === "intake" || j.kind === "replan") return "A proposal is ready for your decision";
      if (j.kind === "direction") return "The direction is ready; the proposal is waiting for your decision";
      if (j.kind === "verify") return "The page passed its checks";
      return "Answered";
  }
}

/** The chip on a work page: glyph plus word, in the v2 states. */
function chipOf(j: JobRow): { tone: StatusTone; word: string } {
  const build = j.kind === "build_plan" || j.kind === "resume";
  if (isStaleRunning(j)) return { tone: "stop", word: "Stopped without reporting" };
  switch (j.status) {
    case "queued":
      return isStaleQueued(j) ? { tone: "stop", word: "Never started" } : { tone: "wait", word: "Waiting to start" };
    case "dispatched":
      return { tone: "run", word: "Starting" };
    case "running":
      return { tone: "run", word: "Running" };
    case "cancelled":
      return { tone: "skip", word: "Cancelled" };
    case "failed":
      return { tone: "stop", word: build ? "Build stopped" : "Stopped" };
    case "succeeded":
      return { tone: "done", word: build || j.kind === "verify" ? "Every check passed" : "Done" };
  }
}

interface SimpleStep {
  title: string;
  tone: StatusTone;
  word?: string;
  time?: string;
  sentence?: string;
}

/** Work that is not a started build: only what the record holds (when it was asked for, picked up, finished). A step
 *  with no time on the record says "Not recorded"; nothing is made up. */
function simpleSteps(j: JobRow): SimpleStep[] {
  const end = j.finished_at;
  const steps: SimpleStep[] = [{ title: "Requested", tone: "done", time: clock(j.created_at), sentence: `${dateTime(j.created_at)}.` }];
  if (j.status === "queued") {
    steps.push(
      isStaleQueued(j)
        ? { title: "Never reached the factory worker", tone: "stop", word: "Never started", sentence: "The hand-off to the factory worker never landed, so nothing ran and nothing was spent. Start it again or close it." }
        : { title: "Waiting for the factory worker", tone: "wait", sentence: "The worker usually picks it up within seconds." },
    );
    return steps;
  }
  if (j.status === "cancelled") {
    steps.push({ title: "Cancelled", tone: "skip", word: "Cancelled", time: end ? clock(end) : undefined, sentence: j.error ? `Reason given: ${j.error}` : "No reason was recorded." });
    return steps;
  }
  const active = j.status === "running" || j.status === "dispatched";
  steps.push(
    j.started_at
      ? { title: "Picked up by the factory worker", tone: "done", time: clock(j.started_at) }
      : active
        ? { title: "Starting", tone: "run", sentence: "The factory worker is picking it up." }
        : { title: "Picked up by the factory worker", tone: "skip", word: "Not recorded", sentence: "This record has no start time." },
  );
  if (active && isStaleRunning(j))
    steps.push({ title: "Stopped without reporting", tone: "stop", sentence: "It has been going far longer than this work takes, so the worker most likely ran out of time or crashed. What it saved is kept." });
  else if (active) steps.push({ title: "Working", tone: "run", sentence: "This page refreshes every few seconds." });
  else if (j.status === "succeeded")
    steps.push({ title: "Finished", tone: "done", time: end ? clock(end) : undefined, sentence: end ? `Took ${duration(j.started_at ?? j.created_at, end) || "under a minute"}.` : "No finish time was recorded." });
  else if (j.status === "failed")
    steps.push({ title: "Stopped and handed to a person", tone: "stop", time: end ? clock(end) : undefined, sentence: "Retries are capped; after that the factory stops and asks, by design." });
  return steps;
}

interface Round {
  round: number;
  verdict: string;
  issues: string[];
}

/** What the work produced, in plain words: the answer, the saved site, each check, and this build's rounds of fixes. */
function Results({ j, showRounds }: { j: JobRow; showRounds: boolean }) {
  const r = j.result ?? {};
  const rounds = (Array.isArray(r.builderRounds) ? r.builderRounds : []) as Round[];
  const qa = (Array.isArray(r.qaIssues) ? r.qaIssues : []) as string[];
  const checks = (Array.isArray(r.checks) ? r.checks : []) as { checkId: string; passed: boolean; details?: string }[];
  const checkpoint = r.lastCheckpoint as { path?: string } | null | undefined;
  return (
    <>
      {j.kind === "ask" && typeof r.answer === "string" && (
        <section aria-labelledby="run-answer" className="run-sec">
          <h2 id="run-answer" className="t-section">
            Answer
          </h2>
          <p className="t-lead">{r.answer}</p>
          {r.needsHuman === true && <Notice tone="caution">The factory wasn't sure and flagged this for a person.</Notice>}
        </section>
      )}
      {r.briefBasis === "summary-only" && (
        <Notice tone="caution">Built from a summary only: the client's original request was not on file for this proposal, so the builder could not check the site against the client's own words.</Notice>
      )}
      {checkpoint?.path && (
        <section aria-labelledby="run-built" className="run-sec">
          <h2 id="run-built" className="t-section">
            What was built
          </h2>
          <PagePreview path={checkpoint.path} />
        </section>
      )}
      {(checks.length > 0 || qa.length > 0) && (
        <section aria-labelledby="run-checks" className="run-sec">
          <h2 id="run-checks" className="t-section">
            Checks
          </h2>
          {checks.length > 0 && (
            <>
              <p className="muted">
                {checks.filter((c) => c.passed).length} of {checks.length} passed.
              </p>
              <ul className="review-checks">
                {checks.map((c) => (
                  <li key={c.checkId}>
                    <StatusChip tone={c.passed ? "done" : "stop"}>{c.passed ? "Passed" : "Failed"}</StatusChip>
                    {checkLabel(c.checkId)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {qa.length > 0 && (
            <>
              <p className="muted">What the checks found:</p>
              <ul className="step-extra">
                {qa.map((q, i) => (
                  <li key={i}>{issueLabel(q)}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      {showRounds && rounds.length > 0 && (
        <section aria-labelledby="run-rounds" className="run-sec">
          <h2 id="run-rounds" className="t-section">
            Rounds of fixes
          </h2>
          <p className="muted">
            {rounds.length} {rounds.length === 1 ? "round" : "rounds"}: the reviewer sent work back, the builder fixed it.
          </p>
          <ol className="steps-v2" aria-label="Rounds of fixes">
            {rounds.map((x, i) => (
              <StepRow
                key={x.round}
                n={i + 1}
                title={`Round ${x.round}`}
                tone={x.verdict === "approved" ? "done" : "need"}
                word={x.verdict === "approved" ? "Approved" : "Changes asked for"}
                sentence={x.issues.length ? undefined : "No problems were noted."}
              >
                {x.issues.length > 0 && (
                  <ul className="step-extra">
                    {x.issues.map((it, n) => (
                      <li key={n}>{issueLabel(it)}</li>
                    ))}
                  </ul>
                )}
              </StepRow>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

/** The placeholder pictures of a passing build that is not the one under review (older, archived): the same v2 rows
 *  and the same plan_inputs writes as the finished site review. */
function BuildPictures({ job, planId, onStarted }: { job: JobRow; planId: string; onStarted: (jobId: string) => void }) {
  const ph = usePlaceholderPictures(job, planId, onStarted);
  return (
    <>
      <PlaceholderPicturesSection ph={ph} />
      <RebuildWithPicturesDialog ph={ph} />
    </>
  );
}

const runIdOf = (j: JobRow): string | null => {
  const id = j.result?.workflowRunId ?? j.params?.workflowRunId;
  return typeof id === "string" ? id : null;
};

/** MVP M6: this build's spend (every retry and reopen of the run). Owners only, like the Costs page. */
function RunCost({ runId }: { runId: string | null }) {
  const me = useMe();
  const owner = me.role === "owner";
  const spend = useLoad(() => (owner && runId ? fetchRunSpend(runId) : Promise.resolve(null)), [owner, runId]);
  const s = spend.data;
  if (!s) return null;
  return (
    <span>
      Spent {money(total(s))}
      {s.estimated + s.history > 0 ? " (partly estimated)" : ""}
    </span>
  );
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
  if (job.error) return <LoadError what="this work" error={job.error} onRetry={job.reload} />;
  if (job.loading && !j) return <Loading rows={4} label="Loading this work" />;
  if (!j) return <Empty title="This work doesn't exist, or your role can't see it.">It is visible to owners and admins. <Link to="/activity">Back to Activity</Link></Empty>;

  // Which view a job gets (the review, the stop, or this page) depends on its siblings: wait for them, so the wrong view
  // never flashes first.
  if (!f.jobs && !f.error) return <Loading rows={4} label="Loading this work" />;
  const jobs = f.jobs ?? [];
  const planId = planIdOfJob(j, jobs);
  const plan = planId ? f.plans?.find((p) => p.id === planId) : undefined;
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

  // Cockpit v2 (Package 4 R1): every other work page in the grammar of the build, stop and review views: chip and context,
  // the title, a plain lead, then the steps, what it produced, and Technical details. "Start again", "Close it",
  // "Archive" and "Unarchive" have no frame in the locked design (BLOCKED-ON-NICK.md), so they stay as quiet buttons.
  const chip = chipOf(j);
  const n = build && planId ? [...buildsOf(planId, jobs)].sort((a, b) => a.created_at.localeCompare(b.created_at)).findIndex((x) => x.id === j.id) + 1 : 0;
  const context = [plan ? clientNameOf(plan) : null, build ? (n > 0 ? `Build ${n}` : "Build") : NOUN[j.kind]].filter(Boolean).join(" · ");
  const took = duration(j.started_at, j.finished_at);
  // A started build reads as the live build (its ten steps); anything else lists only what its record holds.
  const started = build && !!timeline && (!!j.started_at || ["dispatched", "running", "succeeded", "failed"].includes(j.status));
  const newer = build && j.status === "succeeded" && latest && latest.id !== j.id && latest.status === "succeeded" ? latest : null;
  const proposalReady = (j.kind === "intake" || j.kind === "replan" || j.kind === "direction") && j.status === "succeeded" && typeof j.result?.planId === "string" ? j.result.planId : null;
  const pictures = build && j.status === "succeeded" && !!planId && placeholdersOf(j).length > 0;
  const r = j.result ?? {};
  const tech = [
    { k: "job", v: j.id },
    ...(typeof r.workflowRunId === "string" ? [{ k: "run", v: r.workflowRunId }] : []),
    ...(planId ? [{ k: "plan", v: planId }] : []),
    ...(typeof r.cycles === "number" ? [{ k: "build and check cycles", v: String(r.cycles) }] : []),
    { k: "status", v: typeof r.status === "string" ? `${j.status} / ${r.status}` : j.status },
    ...(j.gh_run_url ? [{ k: "worker log", v: j.gh_run_url }] : []),
  ];
  const checkNotes = (Array.isArray(r.checks) ? (r.checks as { checkId: string; details?: string }[]) : []).filter((c) => c.details);
  const qaRaw = (Array.isArray(r.qaIssues) ? r.qaIssues : []) as string[];

  return (
    <article className="stopped runpage" aria-labelledby="run-h">
      <header className="stopped-head">
        <p className="stopped-meta">
          <StatusChip tone={chip.tone}>{chip.word}</StatusChip>
          {context && <span>{context}</span>}
          <span className="fig">{dateTime(j.created_at)}</span>
          {took && <span>Took {took}</span>}
          <RunCost runId={runIdOf(j)} />
        </p>
        <h1 id="run-h" className="t-title">
          {title(j, plan)}
        </h1>
        <p className="t-lead muted">
          {KIND_LABEL[j.kind]}
          {plan ? ` for ${planName(plan)}` : ""}
          {plan?.build_track ? `, ${(KIND_OF_SITE[plan.build_track] ?? "a kind of site").toLowerCase()}` : ""}.
          {j.kind === "ask" ? ` You asked: “${String(j.params?.question ?? "")}”` : ""}
        </p>
      </header>

      {(proposalReady || newer || superseded || j.status === "queued" || isFinished(j) || planId) && (
        <div className="run-actions">
          {proposalReady ? (
            <ButtonLink to={`/decisions/plans/${proposalReady}`} variant="primary" size="page">
              Open the proposal to decide
            </ButtonLink>
          ) : newer ? (
            <ButtonLink to={`/activity/${newer.id}`} variant="primary" size="page">
              Open the newest build
            </ButtonLink>
          ) : superseded ? (
            <ButtonLink to={`/activity/${superseded.id}`} variant="primary" size="page">
              Open the later build
            </ButtonLink>
          ) : null}
          {j.status === "queued" && (
            <Button variant="quiet" icon={Play} disabled={busy} onClick={() => act(() => dispatchJob(j.id), "Started. The worker picks it up within seconds.")}>
              Start again
            </Button>
          )}
          {isStaleQueued(j) && (
            <Button
              variant="quiet"
              icon={XCircle}
              disabled={busy}
              onClick={() => {
                setCancelError(null);
                setCancelOpen(true);
              }}
            >
              Close it
            </Button>
          )}
          {isFinished(j) && (
            <Button
              variant="quiet"
              icon={j.archived_at ? ArrowCounterClockwise : Archive}
              disabled={busy}
              onClick={() => act(() => archiveJob(j.id, !j.archived_at), j.archived_at ? "Back in Activity." : "Archived. It's hidden from Activity and Home; nothing was deleted.")}
            >
              {j.archived_at ? "Unarchive" : "Archive"}
            </Button>
          )}
          {planId && !proposalReady && (
            <ButtonLink to={`/decisions/plans/${planId}`} variant="quiet">
              Open the proposal
            </ButtonLink>
          )}
        </div>
      )}

      {actionError && (
        <Notice tone="stop" title="That didn't work.">
          {actionError} Nothing changed.
        </Notice>
      )}
      {j.status === "failed" && superseded && (
        <Notice tone="stop" title="What happened.">
          {explainJobError(j).happened}
        </Notice>
      )}
      {superseded && (
        <Notice tone="info">
          A later build of the same proposal passed every check ({dateTime(superseded.finished_at ?? superseded.created_at)}). You probably don't need to resume this one.
        </Notice>
      )}
      {newer && (
        <Notice tone="info">
          A newer build of this site passed every check ({dateTime(newer.finished_at ?? newer.created_at)}). The site to review and approve is that one; this page keeps this build's record.
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

      {build && j.status === "succeeded" && <ClientNeedsPanel job={j} planId={planId} onStarted={(id) => nav(`/activity/${id}`)} />}
      {pictures && <BuildPictures job={j} planId={planId!} onStarted={(id) => nav(`/activity/${id}`)} />}

      {started && !runReady ? (
        <Loading rows={3} label="Reading the build's steps" />
      ) : started ? (
        <section aria-label={live ? "Build progress" : "What the factory did"} className="run-sec">
          <LiveBuild timeline={timeline!} stats={stats.data} startedAt={j.started_at ?? j.created_at} finishedAt={j.finished_at} />
          {run.data?.error && (
            <p className="t-small muted">
              The build's step-by-step record couldn't be read just now, so this shows what the build itself reported. Nothing changed.
            </p>
          )}
        </section>
      ) : (
        <section aria-labelledby="run-steps" className="run-sec">
          <h2 id="run-steps" className="t-section">
            What the factory did
          </h2>
          <ol className="steps-v2" aria-label="What the factory did">
            {simpleSteps(j).map((x, i) => (
              <StepRow key={x.title} n={i + 1} title={x.title} tone={x.tone} word={x.word} time={x.time} sentence={x.sentence} />
            ))}
          </ol>
        </section>
      )}

      <Results j={j} showRounds={!started} />

      <TechDetails items={tech}>
        {run.data?.error && <p className="t-small muted">Step record: {run.data.error}</p>}
        {checkNotes.length > 0 && (
          <ul className="step-extra">
            {checkNotes.map((c) => (
              <li key={c.checkId}>
                <span className="fig">{c.checkId}</span>: {c.details}
              </li>
            ))}
          </ul>
        )}
        {qaRaw.length > 0 && <pre className="tech-log">{qaRaw.join("\n")}</pre>}
        {j.error && <pre className="tech-log">{j.error}</pre>}
      </TechDetails>

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
    </article>
  );
}
