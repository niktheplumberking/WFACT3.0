/**
 * Home (Cockpit v2, docs/design/cockpit-v2 "Home"): one sentence that says whether everything is fine and what needs
 * you, then those things in order (stopped, approvals, missing details), each with one button; then what is running
 * now and the spend against the cap; then every client on the six-step path. Every figure comes from real rows:
 * attention and the six-step path (lib/attention.ts, lib/clients.ts, lib/path.ts), jobs, and the owner-only cost
 * views. A room or figure the viewer cannot read is left out rather than guessed.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, Plus } from "@phosphor-icons/react";
import { canDecide, fetchProjects, useFactory, useLoad, useMe } from "../lib/state";
import { LoadError, Loading } from "../components/ui";
import { PathSegments, StatusChip, type StatusTone } from "../components/kit";
import { STEP_NAMES } from "../lib/path";
import { CAPS, buildStopLine, capped, dayKey, fetchCostData, money, runSpend, sumDays } from "../lib/costs";
import { estimate, formatMs, median } from "../lib/timeline";
import type { JobRow } from "../jobsClient";
import type { ClientRow } from "../lib/clients";

export { fetchProjects };
import { readHomeLayout, type HomeSection } from "../lib/prefs";

/* Section order and visibility: lib/prefs.ts (kept on this device; edited in Settings, Home). */
export type { HomeSection } from "../lib/prefs";

/* ---------------- words ---------------- */

const NUM = ["No things", "One thing", "Two things", "Three things", "Four things", "Five things"];
export function headline(n: number, first: string, hour: number): string {
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const count = n < NUM.length ? NUM[n]! : `${n} things`;
  return `${greet}, ${first}. ${count} ${n === 1 ? "needs" : "need"} you.`;
}
const today = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(d);
const firstName = (full: string | null, email: string) => (full?.trim().split(/\s+/)[0] || email.split("@")[0]) ?? "there";

function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

const toneOf = (t: string): StatusTone => (t === "need" || t === "run" || t === "stop" || t === "done" ? t : "wait");

/* ---------------- Home ---------------- */

export default function Home() {
  const me = useMe();
  const f = useFactory();
  const decider = canDecide(me.role);
  const owner = me.role === "owner";
  const now = useNow();
  const first = firstName(me.fullName, me.email);
  const layout = readHomeLayout();
  const costs = useLoad(async () => (owner ? fetchCostData() : null), [owner]);

  const loading = !f.clients && !f.error;
  const failed = !f.clients && !!f.error;
  const clients = f.clients ?? [];
  const needs = f.attention;
  // Empty only when the rows really say so: a failed load is never "no clients".
  const empty = !loading && !failed && clients.length === 0 && needs.length === 0;

  // Spend against the period cap (owner only: the cost views are owner-only under RLS). The period is the live
  // cap's (spend-caps.json: per 7 days today), never the design's sample month (BLOCKED-ON-NICK.md).
  const nowDate = new Date(now);
  const days = costs.data?.days ?? null;
  const spent = days ? capped(sumDays(days.filter((r) => r.day >= dayKey(nowDate, 6)))) : null;
  const cap = CAPS.weeklyUsd;
  const runs = (costs.data?.runs ?? []).map((r) => capped(runSpend(r))).filter((x) => x > 0);
  const usual = runs.length >= 3 ? median(runs) : null;

  const building = clients.filter((c) => c.path?.state === "building");
  const sub = failed
    ? ""
    : loading
    ? "Loading what needs you, what is running and this week's spend."
    : empty
      ? "There are no clients yet. Everything starts with a request."
      : [building.length ? `The factory is building ${building.length === 1 ? "one site" : `${building.length} sites`}.` : null, owner && spent !== null && cap !== null ? `This week: ${money(spent)} of your ${money(cap)} cap.` : null].filter(Boolean).join(" ");

  const title = failed ? "The factory's status could not be loaded." : loading ? "Checking the factory…" : !decider ? `Welcome, ${first}.` : empty ? `Welcome, ${first}.` : needs.length ? headline(needs.length, first, nowDate.getHours()) : `All calm, ${first}.`;

  const sections: Record<HomeSection, JSX.Element | null> = {
    needs: decider && !failed ? <NeedsYou key="needs" loading={loading} needs={needs} owner={owner} deciderName={f.decider} building={building} empty={empty} /> : null,
    overview: decider && !empty && !loading ? <Overview key="overview" building={building} jobs={f.jobs ?? []} now={now} owner={owner} spent={spent} cap={cap} usual={usual} costsError={costs.error} /> : null,
    clients: !loading && clients.length > 0 ? <EveryClient key="clients" clients={clients} pm={!decider} /> : null,
  };

  return (
    <div className="home">
      <header className="home-head">
        <p className="t-eyebrow">{today(nowDate)}</p>
        <h1 className="t-display">{title}</h1>
        {sub && <p className="t-lead muted">{sub}</p>}
      </header>
      {f.error && <LoadError what="the factory's status" error={f.error} onRetry={f.reload} />}
      {!decider && !loading && clients.length === 0 && <p className="muted">You have no clients assigned yet. They appear here once an owner assigns them to you.</p>}
      {layout.order.filter((k) => !layout.hidden.includes(k)).map((k) => sections[k])}
      {decider && (
        <p className="t-small quiet home-foot">
          Choose, reorder or hide these sections in <Link to="/settings?group=home">Settings, Home</Link>.
        </p>
      )}
    </div>
  );
}

function NeedsYou({ loading, needs, owner, deciderName, building, empty }: { loading: boolean; needs: ReturnType<typeof useFactory>["attention"]; owner: boolean; deciderName: string; building: ClientRow[]; empty: boolean }) {
  if (loading)
    return (
      <div role="status" aria-label="Loading what needs you" className="skel-list">
        {[70, 55, 62].map((w) => (
          <div key={w} className="skel-row">
            <div className="skel" style={{ width: 120, height: 12 }} />
            <div className="skel" style={{ width: `${w}%`, height: 20 }} />
          </div>
        ))}
      </div>
    );
  if (empty)
    return (
      <section className="home-empty" aria-label="Get started">
        <p className="empty-title">Your first client starts with a request.</p>
        <p className="muted">Paste what the client asked for. The factory reads it and writes a proposal for you to approve. Nothing is built or spent until you say so.</p>
        <Link className="btn primary" to="/projects/new">
          <Plus aria-hidden="true" />
          Start a new request
        </Link>
      </section>
    );
  if (needs.length === 0)
    return (
      <section className="home-clear" aria-label="Nothing needs you">
        <CheckCircle weight="fill" aria-hidden="true" />
        <div>
          <p className="t-item">Nothing needs you right now.</p>
          <p className="muted">{building.length ? `The factory is building ${building.map((b) => b.name).join(" and ")}. It shows here when it finishes or needs you.` : "Anything that needs you shows here as soon as it happens."}</p>
        </div>
      </section>
    );
  return (
    <section aria-labelledby="needs-h" className="needs">
      <div className="section-head">
        <h2 id="needs-h" className="t-section">
          What needs you
        </h2>
        <span className="t-small quiet">Most urgent first</span>
      </div>
      <ol className="need-list">
        {needs.map((n, i) => {
          const canAct = !n.ownerOnly || owner;
          return (
            <li key={n.key} className="need enter">
              <span className="need-n" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="need-main">
                <div className="need-meta">
                  <StatusChip tone={n.tone === "stop" ? "stop" : "need"}>{n.label}</StatusChip>
                  {n.client && <span className="t-small muted">{n.client}</span>}
                </div>
                <p className="t-item">{n.title}</p>
                <p className="muted need-why">{n.why}</p>
              </div>
              {canAct ? (
                <Link className="btn primary need-cta" to={n.href} aria-label={`${n.cta}${n.client ? `: ${n.client}` : ""}`}>
                  {n.cta}
                  <ArrowRight aria-hidden="true" />
                </Link>
              ) : (
                <span className="need-cta t-small muted">{deciderName} decides this</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Overview({ building, jobs, now, owner, spent, cap, usual, costsError }: { building: ClientRow[]; jobs: JobRow[]; now: number; owner: boolean; spent: number | null; cap: number | null; usual: number | null; costsError: string | null }) {
  // How long a build usually takes: the median of past passing builds (at least 3), never a made-up figure.
  const past = jobs.filter((j) => (j.kind === "build_plan" || j.kind === "resume") && j.status === "succeeded" && j.started_at && j.finished_at).map((j) => Date.parse(j.finished_at!) - Date.parse(j.started_at!));
  const est = estimate(past);
  return (
    <div className="overview">
      <section aria-labelledby="run-h" className="card">
        <div className="card-head">
          <h2 id="run-h" className="t-item">
            Running now
          </h2>
          {building.length > 0 ? <StatusChip tone="run">Live</StatusChip> : <StatusChip tone="idle">Nothing running</StatusChip>}
        </div>
        {building.length === 0 && <p className="muted">Builds you start appear here while they work.</p>}
        {building.map((c) => {
          const b = c.path!.build!;
          const ran = now - Date.parse(b.started_at ?? b.created_at);
          const left = est.kind === "ok" ? Math.max(0, est.medianMs - ran) : null;
          return (
            <div key={c.key} className="running">
              <div>
                <p className="t-label">{c.name}</p>
                <p className="muted">{c.path!.sentence}</p>
              </div>
              <PathSegments step={3} tone="run" height={8} />
              <dl className="figures">
                <div>
                  <dt>Running for</dt>
                  <dd className="t-figure">{formatMs(ran)}</dd>
                </div>
                <div>
                  <dt>Time left</dt>
                  <dd className={left === null ? "t-small" : "t-figure"}>{left === null ? "Not enough past builds to say" : `~${formatMs(left)}`}</dd>
                </div>
              </dl>
              <Link className="btn" to={`/activity/${b.id}`} aria-label={`Watch the build: ${c.name}`}>
                Watch the build
              </Link>
            </div>
          );
        })}
      </section>
      {owner && (
        <section aria-labelledby="spend-h" className="card">
          <h2 id="spend-h" className="t-item">
            This week
          </h2>
          {costsError ? (
            <p className="muted">The spend could not be read: {costsError}</p>
          ) : spent === null ? (
            <Loading rows={1} label="Loading this week's spend" />
          ) : (
            <>
              <p className="spend-line">
                <span className="spend-big">{money(spent)}</span>
                <span className="muted">{cap !== null ? `of your ${money(cap)} cap for 7 days` : "spent in the last 7 days; no weekly cap is on"}</span>
              </p>
              {cap !== null && (
                <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={Number(spent.toFixed(2))} aria-label="Spend this week">
                  <span style={{ width: `${Math.min(100, (spent / cap) * 100)}%` }} />
                </div>
              )}
              <p className="t-small muted">
                {cap !== null ? `${money(Math.max(0, cap - spent))} left${usual ? `, about ${Math.floor(Math.max(0, cap - spent) / usual)} more builds at the usual ${money(usual)}` : ""}. ` : ""}
                {buildStopLine()}
              </p>
            </>
          )}
          <Link className="quiet-link" to="/costs">
            See costs
          </Link>
        </section>
      )}
    </div>
  );
}

function EveryClient({ clients, pm }: { clients: ClientRow[]; pm: boolean }) {
  return (
    <section aria-labelledby="clients-h" className="clients">
      <div className="section-head">
        <h2 id="clients-h" className="t-section">
          {pm ? "Your clients" : "Every client"}
        </h2>
        <Link className="quiet-link" to="/projects">
          All projects
        </Link>
      </div>
      <ul className="client-list">
        {clients.map((c) => (
          <li key={c.key} className="client-row">
            <div className="client-name">
              <Link to={c.href}>{c.name}</Link>
              {c.plan && <p className="t-small quiet">{c.kind ?? "Kind of site not chosen yet"}</p>}
            </div>
            {c.path ? (
              <>
                <div className="client-step">
                  <PathSegments step={c.path.step} tone={toneOf(c.path.tone)} />
                  <span className="t-small muted">
                    Step {c.path.step + 1} of 6 · {c.path.state === "stopped" ? "Building, stopped" : c.path.state === "approved" ? "Approved, waiting for launch" : STEP_NAMES[c.path.step]}
                  </span>
                </div>
                <div className="client-next">
                  <span className="t-small muted">{c.path.clientNext}</span>
                  <StatusChip tone={toneOf(c.path.tone)}>{c.path.chipWord}</StatusChip>
                </div>
              </>
            ) : (
              <p className="client-step t-small muted">{pm ? "Its progress isn't shared with project managers yet." : "No proposal on file, so there is no progress to show."}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
