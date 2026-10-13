/**
 * Costs (MVP M6): what the factory has spent on AI, per day, per client, per build and per call, against the
 * spend caps. Owner-only: the views and model_traces are owner-only by RLS (0008, 0020), and Blueprint §9 keeps
 * raw cost away from admins. Every figure says how sure it is: metered (list price), estimated (Agent 37, no
 * published rate) or history (calls recorded before Agent 37 had a price, estimated now from their real tokens).
 */
import { dateTime } from "../lib/model";
import { useLoad, useMe } from "../lib/state";
import { CAPS, PRICING_VERSION, byKey, callCost, dayKey, fetchCostData, money, runSpend, sumDays, tokens, total, type Spend, type TraceRow } from "../lib/costs";
import { Empty, LoadError, Loading, Notice, PageHead, Plate } from "../components/ui";

const role = (actor: string) => actor.replace(/^agent:/, "").replace(/-/g, " ");
const client = (slug: string | null) => (slug ? slug : "no client");

/** "$1.20 (est.)" when any part of the figure is an estimate. */
function Amount({ s }: { s: Spend }) {
  const est = s.estimated + s.history > 0;
  return (
    <>
      {money(total(s))}
      {est && <span className="quiet"> est.</span>}
    </>
  );
}

function CallCost({ t }: { t: TraceRow }) {
  const c = callCost(t);
  if (c.usd === null) return <>no price</>;
  return (
    <>
      {money(c.usd)}
      {c.basis !== "metered" && <span className="quiet"> {c.basis === "history" ? "est. (history)" : "est."}</span>}
    </>
  );
}

function CapLine({ label, spent, cap, proposed }: { label: string; spent: number; cap: number | null; proposed: number }) {
  const limit = cap ?? proposed;
  const pct = Math.min(100, Math.round((spent / limit) * 100));
  return (
    <div className="cap">
      <div className="cap-head">
        <b>{label}</b>
        <span className="fig">
          {money(spent)} of {money(limit)} {cap === null ? <span className="quiet">(proposed, not enforced)</span> : null}
        </span>
      </div>
      <div className="cap-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Number(spent.toFixed(2))}>
        <span style={{ width: `${pct}%` }} className={spent >= limit ? "over" : pct >= 80 ? "near" : undefined} />
      </div>
    </div>
  );
}

export function Costs() {
  const me = useMe();
  const costs = useLoad(fetchCostData, []);
  if (me.role !== "owner") {
    return (
      <>
        <PageHead title="Costs" />
        <Empty title="Costs are visible to owners only.">Admins see operational rooms, not raw cost (Blueprint §9).</Empty>
      </>
    );
  }
  const d = costs.data;
  const now = new Date();
  const all = d ? sumDays(d.days) : null;
  const week = d ? sumDays(d.days.filter((r) => r.day >= dayKey(now, 6))) : null;
  const last14 = d ? byKey(d.days.filter((r) => r.day >= dayKey(now, 13)), (r) => r.day).sort((a, b) => b.key.localeCompare(a.key)) : [];
  const clients = d ? byKey(d.days, (r) => r.entity_slug).sort((a, b) => total(b.spend) - total(a.spend)) : [];
  const models = d ? byKey(d.days, (r) => r.model).sort((a, b) => total(b.spend) - total(a.spend)) : [];
  const latestBuild = d?.runs[0] ? runSpend(d.runs[0]) : null;
  const capsOff = CAPS.perBuildUsd === null && CAPS.weeklyUsd === null;

  return (
    <>
      <PageHead
        title={all ? `${money(total(all))} spent on AI` : "Costs"}
        lead={
          all
            ? `${all.calls.toLocaleString("en-GB")} model calls, ${tokens(all.inputTokens)} tokens in and ${tokens(all.outputTokens)} out. ` +
              `${money(all.metered)} at list prices; ${money(all.estimated + all.history)} is an estimate for Agent 37, which publishes no rate.`
            : undefined
        }
      />
      <div className="stack">
        {costs.error && <LoadError what="costs" error={costs.error} onRetry={costs.reload} />}
        {!d && !costs.error && <Loading rows={4} label="Loading costs" />}
        {d && d.days.length === 0 && <Empty title="No model calls traced yet." />}
        {all && all.estimated + all.history > 0 && (
          <Notice tone="info" title="Estimates are not a bill.">
            Agent 37 calls are priced at $3 in / $15 out per million tokens (price table v{PRICING_VERSION}). Check its dashboard for the real figure; once its rate is on file, these become exact.
          </Notice>
        )}
        {all && all.unknownCalls > 0 && <Notice tone="caution">{all.unknownCalls} calls went to a model with no price on file. They are counted, not priced, so the total is a lower bound.</Notice>}

        {d && d.days.length > 0 && week && (
          <Plate title="Spend caps" note={capsOff ? "Off" : "On"}>
            <div className="caps">
              <CapLine label="Last 7 days" spent={total(week)} cap={CAPS.weeklyUsd} proposed={CAPS.proposed.weeklyUsd} />
              {latestBuild && d.runs[0] && (
                <CapLine label={`Latest build (${client(d.runs[0].entity_slug)}, ${dateTime(d.runs[0].first_call_at)})`} spent={total(latestBuild)} cap={CAPS.perBuildUsd} proposed={CAPS.proposed.perBuildUsd} />
              )}
              {capsOff && (
                <p className="fine quiet">
                  Caps are built but switched off: the amounts are pending Huraira and Nick ({CAPS.status}). Once set, a build or week over its cap is refused before the next model call.
                </p>
              )}
            </div>
          </Plate>
        )}

        {d && d.days.length > 0 && (
          <div className="cost-grid">
            <Plate title="Last 14 days">
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Spend per day, scrollable">
                <table className="table">
                  <thead>
                    <tr><th scope="col">Day</th><th scope="col">Calls</th><th scope="col">Tokens in / out</th><th scope="col">Spend</th></tr>
                  </thead>
                  <tbody>
                    {last14.length === 0 && <tr><td colSpan={4} className="quiet">No calls in the last 14 days.</td></tr>}
                    {last14.map(({ key, spend }) => (
                      <tr key={key}>
                        <td className="fig">{key}</td>
                        <td className="fig">{spend.calls}</td>
                        <td className="fig">{tokens(spend.inputTokens)} / {tokens(spend.outputTokens)}</td>
                        <td className="fig"><Amount s={spend} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Plate>
            <Plate title="By client">
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Spend per client, scrollable">
                <table className="table">
                  <thead>
                    <tr><th scope="col">Client</th><th scope="col">Calls</th><th scope="col">Spend</th></tr>
                  </thead>
                  <tbody>
                    {clients.map(({ key, spend }) => (
                      <tr key={key || "none"}>
                        <td>{client(key || null)}</td>
                        <td className="fig">{spend.calls}</td>
                        <td className="fig"><Amount s={spend} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="sub">By model</h3>
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Spend per model, scrollable">
                <table className="table">
                  <thead>
                    <tr><th scope="col">Model</th><th scope="col">Tokens in / out</th><th scope="col">Spend</th></tr>
                  </thead>
                  <tbody>
                    {models.map(({ key, spend }) => (
                      <tr key={key}>
                        <td className="fig">{key}</td>
                        <td className="fig">{tokens(spend.inputTokens)} / {tokens(spend.outputTokens)}</td>
                        <td className="fig"><Amount s={spend} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Plate>
          </div>
        )}

        {d && d.runs.length > 0 && (
          <Plate title="Builds" note="Latest 25. One build counts every retry and reopen.">
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Spend per build, scrollable">
              <table className="table">
                <thead>
                  <tr><th scope="col">Started</th><th scope="col">Client</th><th scope="col">Calls</th><th scope="col">Tokens in / out</th><th scope="col">Spend</th><th scope="col">Run</th></tr>
                </thead>
                <tbody>
                  {d.runs.map((r) => {
                    const s = runSpend(r);
                    const limit = CAPS.perBuildUsd ?? CAPS.proposed.perBuildUsd;
                    return (
                      <tr key={r.run_id}>
                        <td className="fig">{dateTime(r.first_call_at)}</td>
                        <td>{client(r.entity_slug)}</td>
                        <td className="fig">{r.calls}{Number(r.errors) > 0 ? <span className="quiet"> ({r.errors} failed)</span> : null}</td>
                        <td className="fig">{tokens(Number(r.input_tokens))} / {tokens(Number(r.output_tokens))}</td>
                        <td className="fig">
                          <Amount s={s} />
                          {total(s) >= limit && <span className="tag-over"> over {money(limit)}</span>}
                        </td>
                        <td className="fig">{r.run_id.slice(0, 8)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Plate>
        )}

        {d && d.costliest.length > 0 && <CallTable title="Biggest calls" note="Most input tokens. Outliers here are where tokens leak." rows={d.costliest} />}
        {d && d.latest.length > 0 && <CallTable title="Latest calls" rows={d.latest} />}
        {d && d.days.length > 0 && (
          <p className="fine quiet">
            Where the tokens go and how to cut them: docs/AI-COST-AUDIT.md in the repo.
          </p>
        )}
      </div>
    </>
  );
}

function CallTable({ title, note, rows }: { title: string; note?: string; rows: TraceRow[] }) {
  return (
    <Plate title={title} note={note}>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={`${title}, scrollable`}>
        <table className="table">
          <thead>
            <tr><th scope="col">When</th><th scope="col">Role</th><th scope="col">Client</th><th scope="col">Model</th><th scope="col">Tokens in / out</th><th scope="col">Cost</th><th scope="col">Time</th><th scope="col">Outcome</th></tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="fig">{dateTime(t.occurred_at)}</td>
                <td>{role(t.actor)}</td>
                <td>{client(t.entity_slug)}</td>
                <td className="fig">{t.model}</td>
                <td className="fig">{tokens(t.input_tokens)} / {tokens(t.output_tokens)}</td>
                <td className="fig"><CallCost t={t} /></td>
                <td className="fig">{(t.latency_ms / 1000).toFixed(1)} s</td>
                <td>{t.outcome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Plate>
  );
}
