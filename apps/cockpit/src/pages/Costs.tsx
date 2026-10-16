/**
 * Costs (Cockpit v2 phase 15, brief §6.11): what the factory spent on AI against the live caps. Owner-only: the cost
 * views and model_traces are owner-only by RLS (0008, 0020), so admins and PMs see a plain notice (role conflict logged
 * in BLOCKED-ON-NICK.md). Every figure comes from the cost views or the recorded calls; the caps and their period come
 * from spend-caps.json (today "per 7 days", not the design's "this month": caps conflict logged). Estimates (the site
 * builder publishes no price) are labelled wherever they appear; the per-model table sits in Technical details.
 */
import { useMemo } from "react";
import { clientNameOf } from "../lib/clients";
import { planIdOfJob } from "../lib/attention";
import { SPEND } from "../lib/recovery";
import { dateTime } from "../lib/model";
import { useFactory, useLoad, useMe } from "../lib/state";
import {
  CAPS, PRICING_VERSION, TRACE_LIMIT, buildStopLine, byKey, capWeek, capWindowStart, capped, fetchCostRoom, runSpend, runsOfJobs, stepOf, sumCalls, total, usd,
  usualRange, weekBlocks, type TraceRow,
} from "../lib/costs";
import { EmptyState, TechDetails } from "../components/kit";
import { LoadError, Loading } from "../components/ui";

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const short = (day: string) => dayFmt.format(new Date(`${day}T00:00:00Z`));
const NO_CLIENT = "Not tied to a client";

export function Costs() {
  const me = useMe();
  const f = useFactory();
  const owner = me.role === "owner";
  const load = useLoad(() => (owner ? fetchCostRoom() : Promise.resolve(null)), [owner]);
  const now = useMemo(() => new Date(), []);

  const room = useMemo(() => {
    const d = load.data;
    if (!d || !f.jobs || !f.plans) return null;
    const jobs = f.jobs;
    const planById = new Map(f.plans.map((p) => [p.id, p]));
    const runs = runsOfJobs(jobs, d.links, (j) => planIdOfJob(j, jobs));
    const clientOfRun = (runId: string | null) => {
      const planId = runId ? runs.get(runId)?.planId : null;
      const plan = planId ? planById.get(planId) : undefined;
      return plan ? clientNameOf(plan) : null;
    };

    const week = capWeek(d.days, now);
    const builds = d.runs.filter((r) => runs.get(r.run_id)?.build);
    const last = builds[0] ?? null;
    const range = usualRange(builds.map((r) => total(runSpend(r))).filter((v) => v > 0));
    const blocks = weekBlocks(d.days, now);

    const since = capWindowStart(now);
    const inWindow = d.traces.filter((t) => t.occurred_at.slice(0, 10) >= since);
    const perClientMap = new Map<string, TraceRow[]>();
    for (const t of inWindow) {
      const name = clientOfRun(t.run_id) ?? NO_CLIENT;
      perClientMap.set(name, [...(perClientMap.get(name) ?? []), t]);
    }
    const perClient = [...perClientMap.entries()].map(([name, rows]) => ({ name, ...sumCalls(rows) })).sort((a, b) => b.usd - a.usd);

    // The caps example: the newest build a cap stopped, else the newest build.
    const capStopped = jobs
      .filter((j) => (j.kind === "build_plan" || j.kind === "resume") && SPEND.test(j.error ?? ""))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const stoppedRun = capStopped ? [...runs.entries()].find(([, r]) => r.jobId === capStopped.id)?.[0] ?? null : null;
    const exampleRun = stoppedRun ?? last?.run_id ?? null;
    const exampleCalls = exampleRun ? d.traces.filter((t) => t.run_id === exampleRun).reverse() : [];
    const steps: { name: string; usd: number; estimated: boolean }[] = [];
    for (const t of exampleCalls) {
      const name = stepOf(t.actor);
      const c = sumCalls([t]);
      const prev = steps[steps.length - 1];
      if (prev && prev.name === name) {
        prev.usd += c.usd;
        prev.estimated ||= c.estimated;
      } else steps.push({ name, usd: c.usd, estimated: c.estimated });
    }

    const usedFor = new Map<string, Set<string>>();
    for (const t of d.traces) usedFor.set(t.model, (usedFor.get(t.model) ?? new Set()).add(stepOf(t.actor)));
    const models = byKey(d.days, (r) => r.model).sort((a, b) => total(b.spend) - total(a.spend));

    return { d, week, last, range, blocks, perClient, steps, exampleClient: clientOfRun(exampleRun), stopped: !!stoppedRun, usedFor, models, clientOfRun, builds };
  }, [load.data, f.jobs, f.plans, now]);

  if (!owner) {
    return (
      <div className="costs">
        <header className="costs-head">
          <h1 className="t-title">Costs</h1>
        </header>
        <EmptyState title="Costs are for owners only.">The cost records can be read by owners only, so this room shows nothing for other roles.</EmptyState>
      </div>
    );
  }

  const error = load.error ?? f.error;
  if (error) {
    return (
      <div className="costs">
        <header className="costs-head">
          <h1 className="t-title">Costs</h1>
        </header>
        <LoadError what="the costs" error={error} onRetry={() => void Promise.all([load.reload(), f.reload()])} />
      </div>
    );
  }
  if (!room) {
    return (
      <div className="costs">
        <header className="costs-head">
          <h1 className="t-title">Costs</h1>
        </header>
        <Loading rows={4} label="Loading the costs" />
      </div>
    );
  }
  if (room.d.days.length === 0) {
    return (
      <div className="costs">
        <header className="costs-head">
          <h1 className="t-title">Costs</h1>
        </header>
        <EmptyState title="Nothing has been spent yet.">Costs appear here once the factory has read its first request.</EmptyState>
      </div>
    );
  }

  const weekCap = CAPS.weeklyUsd;
  const buildCap = CAPS.perBuildUsd;
  const spent = capped(room.week);
  const headline = weekCap === null ? `Last 7 days: ${usd(spent)}.` : `Last 7 days: ${usd(spent)} of your ${usd(weekCap)} cap.`;
  const lastCost = room.last ? total(runSpend(room.last)) : null;
  const lead = [
    lastCost === null ? "No build has run yet." : `The last build cost ${usd(lastCost)}.`,
    room.range ? `Most builds cost between ${usd(room.range[0])} and ${usd(room.range[1])}.` : null,
    room.week.estimated > 0 ? "Part of this is an estimate: the site builder publishes no price." : null,
  ]
    .filter(Boolean)
    .join(" ");

  // Trend: 7-day blocks against the 7-day cap.
  const values = room.blocks.map((b) => total(b.spend));
  const scale = Math.max(weekCap ?? 0, ...values, 0.01) * 1.08;
  const label = (i: number) => (i === room.blocks.length - 1 ? "Last 7 days" : short(room.blocks[i]!.from));
  const anyEstimate = room.blocks.some((b) => b.spend.estimated + b.spend.history > 0);
  const trendText =
    `Spend per 7 days: ${room.blocks.map((b, i) => `${i === room.blocks.length - 1 ? "the last 7 days" : `${short(b.from)} to ${short(b.to)}`} ${usd(values[i]!)}`).join(", ")}.` +
    (weekCap !== null ? ` The cap is ${usd(weekCap)} per 7 days.` : " No 7-day cap is switched on.") +
    (anyEstimate ? " Includes estimates." : "");

  const maxClient = Math.max(...room.perClient.map((c) => c.usd), 0.0001);

  // The caps example bar.
  const exampleTotal = room.steps.reduce((a, s) => a + s.usd, 0);
  const barScale = Math.max((buildCap ?? 0) * 1.2, exampleTotal, 0.01);
  let before = 0;
  const segs = room.steps.map((s, i) => {
    const seg = { ...s, left: (before / barScale) * 100, width: (s.usd / barScale) * 100, over: buildCap !== null && before + s.usd > buildCap, alt: i % 2 === 1 };
    before += s.usd;
    return seg;
  });
  const who = room.exampleClient ? `${room.exampleClient}'s` : "The";
  const exampleText =
    room.steps.length === 0
      ? null
      : `${room.stopped ? "The last build a cap stopped" : `${who} last build`}: ${room.steps.map((s) => `${s.name.toLowerCase()} ${usd(s.usd)}`).join(", ")}. ` +
        (buildCap !== null ? `${usd(exampleTotal)} of the ${usd(buildCap)} per-build cap.` : `${usd(exampleTotal)} in all.`);

  return (
    <div className="costs">
      <header className="costs-head">
        <p className="costs-eyebrow">{short(capWindowStart(now))} to today</p>
        <h1 className="costs-title">{headline}</h1>
        <p className="costs-lead">{lead}</p>
      </header>

      <div className="costs-grid">
        <section aria-labelledby="tr-h" className="costs-card">
          <h2 id="tr-h" className="costs-h2">The last six weeks</h2>
          <div role="img" aria-label={trendText} className="trend">
            <div className="trend-plot">
              {weekCap !== null && (
                <>
                  <span aria-hidden="true" className="trend-cap" style={{ bottom: `${(weekCap / scale) * 100}%` }} />
                  <span aria-hidden="true" className="trend-cap-label" style={{ bottom: `calc(${(weekCap / scale) * 100}% + 4px)` }}>
                    {usd(weekCap)} cap
                  </span>
                </>
              )}
              {values.map((v, i) => (
                <div key={room.blocks[i]!.from} className="trend-col">
                  <span className="trend-v" style={{ bottom: `calc(${(v / scale) * 100}% + 4px)` }}>
                    {usd(v)}
                  </span>
                  <span className={`trend-bar${i === values.length - 1 ? " now" : ""}`} style={{ height: `${(v / scale) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="trend-axis" aria-hidden="true">
              {room.blocks.map((b, i) => (
                <span key={b.from}>{label(i)}</span>
              ))}
            </div>
          </div>
          <p className="costs-note">Each bar is 7 days, from the date under it; the same period the cap counts.{anyEstimate ? " Includes estimates." : ""}</p>
        </section>

        <section aria-labelledby="pc-h" className="costs-card">
          <h2 id="pc-h" className="costs-h2">Cost per client, last 7 days</h2>
          {room.perClient.length === 0 ? (
            <p className="muted">Nothing was spent in the last 7 days.</p>
          ) : (
            <ul className="per-client">
              {room.perClient.map((c) => (
                <li key={c.name}>
                  <span className="per-client-row">
                    <span>{c.name}</span>
                    <span className="fig">
                      {usd(c.usd)}
                      {c.estimated && <span className="quiet"> estimate</span>}
                    </span>
                  </span>
                  <span className="per-client-bar" aria-hidden="true">
                    <span style={{ width: `${(c.usd / maxClient) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="cap-h" className="caps-protect">
        <h2 id="cap-h" className="costs-h2 big">How the caps protect you</h2>
        <div className="caps-protect-grid">
          <div className="caps-protect-text">
            <p className="costs-p">
              {buildStopLine()}{" "}
              {weekCap !== null ? `Over the last 7 days the factory stops at ${usd(weekCap)}, even in the middle of a build.` : "No 7-day cap is switched on."}{" "}
              Before every AI call it checks what has been spent, and refuses the call once a cap is reached, so the last call can take spending slightly past it.
            </p>
            <p className="muted">{room.stopped ? "The picture shows the last build a cap stopped." : "No build has reached a cap yet. The picture shows the last build against its cap."}</p>
            <p className="muted">The caps are set in the factory’s own settings and change only on Nick’s say-so.</p>
          </div>
          {exampleText ? (
            <div role="img" aria-label={exampleText} className="caps-bar-box">
              <div className="caps-bar">
                {segs.map((s, i) => (
                  <span key={`${s.name}-${i}`} className={`caps-seg${s.alt ? " alt" : ""}${s.over ? " over" : ""}`} style={{ left: `${s.left}%`, width: `${s.width}%` }} />
                ))}
                {buildCap !== null && <span aria-hidden="true" className="caps-line" style={{ left: `${(buildCap / barScale) * 100}%` }} />}
              </div>
              <div className="caps-legend" aria-hidden="true">
                {room.steps.map((s, i) => (
                  <span key={`${s.name}-${i}`}>
                    {s.name} {usd(s.usd)}
                    {s.estimated ? " (estimate)" : ""}
                  </span>
                ))}
              </div>
              <p className={room.stopped ? "caps-caption stop" : "caps-caption"} aria-hidden="true">
                {room.stopped ? `Stopped at ${usd(exampleTotal)}, before its next AI call.` : buildCap !== null ? `${usd(exampleTotal)} of ${usd(buildCap)}.` : `${usd(exampleTotal)}.`}
              </p>
            </div>
          ) : (
            <p className="muted">No build has recorded any calls yet, so there is nothing to show here.</p>
          )}
        </div>
      </section>

      <TechDetails summary="Technical details: cost by AI model">
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Cost by AI model, scrollable">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col">Used for</th>
                <th scope="col" className="num">Calls</th>
                <th scope="col" className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {room.models.map(({ key, spend }) => (
                <tr key={key}>
                  <td className="fig">{key}</td>
                  <td>{[...(room.usedFor.get(key) ?? [])].join(", ") || "Not recorded"}</td>
                  <td className="fig num">{spend.calls}</td>
                  <td className="fig num">
                    {usd(total(spend))}
                    {spend.estimated + spend.history > 0 && " (estimated)"}
                    {spend.unknownCalls > 0 && ` + ${spend.unknownCalls} unpriced`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="costs-note">
          Prices from the factory’s own price table (version {PRICING_VERSION}). The site builder publishes no price, so its cost is an estimate and labelled as one. Calls recorded before it had a price are estimated from their real token counts.
        </p>
        {room.builds.length > 0 && (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Cost per build, scrollable">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Started</th>
                  <th scope="col">Client</th>
                  <th scope="col" className="num">Calls</th>
                  <th scope="col" className="num">Cost</th>
                  <th scope="col">Run</th>
                </tr>
              </thead>
              <tbody>
                {room.builds.slice(0, 25).map((r) => {
                  const s = runSpend(r);
                  return (
                    <tr key={r.run_id}>
                      <td className="fig">{dateTime(r.first_call_at)}</td>
                      <td>{room.clientOfRun(r.run_id) ?? NO_CLIENT}</td>
                      <td className="fig num">{r.calls}</td>
                      <td className="fig num">
                        {usd(total(s))}
                        {s.estimated + s.history > 0 && " (estimated)"}
                      </td>
                      <td className="fig">{r.run_id.slice(0, 8)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {room.d.traces.length >= TRACE_LIMIT && <p className="costs-note">Only the newest {TRACE_LIMIT} calls are read for the per-client and per-step figures; the totals above count every call.</p>}
      </TechDetails>
    </div>
  );
}
