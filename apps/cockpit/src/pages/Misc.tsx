/**
 * Costs (the former Models room), the honest "Coming in Step N" pages, the phone "More" menu, Settings
 * and Not found. Cost honesty is unchanged from Stage 5: cost_usd is provider tokens × the configured
 * price; calls to a model with no price on file are counted as unpriced, and any total that includes
 * them is labelled a lower bound. model_usage_by_actor and model_traces are OWNER-ONLY by RLS (0008).
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ListChecks, Receipt, SignOut, GearSix, ChatCircleText, CaretRight } from "@phosphor-icons/react";
import { supabase } from "../supabaseClient";
import { dateTime } from "../lib/model";
import { applyTheme, canDecide, readThemePref, useLoad, useMe, type ThemePref } from "../lib/state";
import { COMING } from "../shell/Shell";
import { Empty, LoadError, Loading, Notice, PageHead, Plate } from "../components/ui";

/* ---------------- costs ---------------- */

interface UsageRow {
  model: string;
  provider: string;
  actor: string;
  calls: number;
  errors: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  unpriced_calls: number;
  avg_latency_ms: number;
  tasks: number;
  last_call_at: string;
}
interface TraceRow {
  id: string;
  occurred_at: string;
  actor: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  latency_ms: number;
  outcome: string;
}

const usd = (n: number | null) => (n === null ? "unpriced" : `$${Number(n).toFixed(4)}`);
const num = (n: number) => Number(n).toLocaleString("en-GB");
const role = (actor: string) => actor.replace(/^agent:/, "").replace(/-/g, " ");

async function fetchCosts(): Promise<{ usage: UsageRow[]; traces: TraceRow[] }> {
  const [u, t] = await Promise.all([
    supabase.from("model_usage_by_actor").select("*").order("cost_usd", { ascending: false, nullsFirst: false }),
    supabase.from("model_traces").select("id,occurred_at,actor,model,input_tokens,output_tokens,cost_usd,latency_ms,outcome").order("occurred_at", { ascending: false }).limit(25),
  ]);
  if (u.error) throw new Error(u.error.message);
  if (t.error) throw new Error(t.error.message);
  return { usage: (u.data ?? []) as UsageRow[], traces: (t.data ?? []) as TraceRow[] };
}

export function Costs() {
  const me = useMe();
  const costs = useLoad(fetchCosts, []);
  if (me.role !== "owner") {
    return (
      <>
        <PageHead title="Costs" />
        <Empty title="Costs are visible to owners only.">Admins see operational rooms, not raw cost (Blueprint §9).</Empty>
      </>
    );
  }
  const d = costs.data;
  const totalCost = d?.usage.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0) ?? 0;
  const totalCalls = d?.usage.reduce((s, r) => s + Number(r.calls), 0) ?? 0;
  const unpriced = d?.usage.reduce((s, r) => s + Number(r.unpriced_calls), 0) ?? 0;
  const models = d ? new Set(d.usage.map((r) => r.model)).size : 0;
  return (
    <>
      <PageHead
        title={d ? `$${totalCost.toFixed(4)} metered${unpriced > 0 ? ", at least" : ""}` : "Costs"}
        lead={d ? `${num(totalCalls)} model calls traced across ${models} models. Cost per client and budget limits arrive in Step 12.` : undefined}
      />
      <div className="stack">
        {costs.error && <LoadError what="costs" error={costs.error} onRetry={costs.reload} />}
        {!d && !costs.error && <Loading rows={4} label="Loading costs" />}
        {d && d.usage.length === 0 && <Empty title="No model calls traced yet." />}
        {d && unpriced > 0 && (
          <Notice tone="info">
            {num(unpriced)} calls went to a model with no price on file (Agent 37's free-tier builder). They are counted, not priced, so the total above is a lower bound rather than a guess.
          </Notice>
        )}
        {d && d.usage.length > 0 && (
          <Plate title="Cost by model and role">
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Cost by model and role, scrollable">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Role</th>
                    <th scope="col">Model</th>
                    <th scope="col">Calls</th>
                    <th scope="col">Tokens in / out</th>
                    <th scope="col">Cost</th>
                    <th scope="col">Avg time</th>
                    <th scope="col">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {d.usage.map((r) => (
                    <tr key={`${r.model}-${r.actor}`}>
                      <td>{role(r.actor)}</td>
                      <td className="fig">{r.model}</td>
                      <td className="fig">{num(r.calls)}</td>
                      <td className="fig">
                        {num(r.input_tokens)} / {num(r.output_tokens)}
                      </td>
                      <td className="fig">{Number(r.unpriced_calls) === Number(r.calls) ? "unpriced" : usd(r.cost_usd)}</td>
                      <td className="fig">{(Number(r.avg_latency_ms) / 1000).toFixed(1)} s</td>
                      <td className="fig">{num(r.errors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Plate>
        )}
        {d && d.traces.length > 0 && (
          <Plate title="Latest calls">
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Latest model calls, scrollable">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Role</th>
                    <th scope="col">Model</th>
                    <th scope="col">Tokens</th>
                    <th scope="col">Cost</th>
                    <th scope="col">Time</th>
                    <th scope="col">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {d.traces.map((t) => (
                    <tr key={t.id}>
                      <td className="fig">{dateTime(t.occurred_at)}</td>
                      <td>{role(t.actor)}</td>
                      <td className="fig">{t.model}</td>
                      <td className="fig">
                        {num(t.input_tokens)} / {num(t.output_tokens)}
                      </td>
                      <td className="fig">{usd(t.cost_usd)}</td>
                      <td className="fig">{(t.latency_ms / 1000).toFixed(1)} s</td>
                      <td>{t.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Plate>
        )}
      </div>
    </>
  );
}

/* ---------------- coming next ---------------- */

export function ComingSoon() {
  const { slug } = useParams();
  const room = COMING.find((c) => c.slug === slug);
  if (!room) return <NotFound />;
  return (
    <>
      <PageHead kicker={`Coming in Step ${room.step}`} title={room.label} lead={room.what} />
      <Notice tone="info">
        This room isn't built yet, so it shows nothing rather than made-up numbers. It arrives with Step {room.step} of the Factory Completion Plan.
      </Notice>
    </>
  );
}

/* ---------------- phone "More" ---------------- */

export function More() {
  const me = useMe();
  const decider = canDecide(me.role);
  return (
    <>
      <PageHead title="More" />
      <div className="stack">
        {decider && (
          <Plate title="Work">
            <ul className="link-list">
              <li>
                <Link to="/activity">
                  <ListChecks aria-hidden="true" />
                  Activity
                  <CaretRight aria-hidden="true" style={{ marginLeft: "auto" }} />
                </Link>
              </li>
              <li>
                <Link to="/projects/new">
                  <ChatCircleText aria-hidden="true" />
                  New request or question
                  <CaretRight aria-hidden="true" style={{ marginLeft: "auto" }} />
                </Link>
              </li>
              {me.role === "owner" && (
                <li>
                  <Link to="/costs">
                    <Receipt aria-hidden="true" />
                    Costs
                    <CaretRight aria-hidden="true" style={{ marginLeft: "auto" }} />
                  </Link>
                </li>
              )}
            </ul>
          </Plate>
        )}
        <Plate title="Coming next">
          <ul className="link-list">
            {COMING.map((c) => (
              <li key={c.slug}>
                <Link to={`/soon/${c.slug}`}>
                  <c.icon aria-hidden="true" />
                  {c.label}{" "}
                  <span className="step">Step {c.step}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Plate>
        <Plate title="Account">
          <ul className="link-list">
            <li>
              <Link to="/settings">
                <GearSix aria-hidden="true" />
                Settings
                <CaretRight aria-hidden="true" style={{ marginLeft: "auto" }} />
              </Link>
            </li>
            <li>
              <button type="button" onClick={() => supabase.auth.signOut()}>
                <SignOut aria-hidden="true" />
                Sign out
              </button>
            </li>
          </ul>
        </Plate>
      </div>
    </>
  );
}

/* ---------------- settings ---------------- */

export function Settings() {
  const me = useMe();
  const [theme, setTheme] = useState<ThemePref>(readThemePref());
  function choose(t: ThemePref) {
    setTheme(t);
    try {
      localStorage.setItem("cockpit-theme", t);
    } catch {
      /* private mode: the choice lasts for this visit */
    }
    applyTheme(t);
  }
  return (
    <>
      <PageHead title="Settings" />
      <div className="stack">
        <Plate title="Your account">
          <div className="plate-body stack-tight">
            <dl className="kv" style={{ maxWidth: 520 }}>
              <div>
                <dt>Name</dt>
                <dd>{me.fullName ?? "Not given"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{me.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{me.role ?? "None"}</dd>
              </div>
            </dl>
            <div>
              <button className="btn" type="button" onClick={() => supabase.auth.signOut()}>
                <SignOut aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </Plate>
        <Plate title="Appearance">
          <fieldset className="plate-body tracks" style={{ maxWidth: 520 }}>
            <legend>Theme</legend>
            {(["system", "dark", "light"] as ThemePref[]).map((t) => (
              <label key={t} className={`track${theme === t ? " is-chosen" : ""}`}>
                <input type="radio" name="theme" checked={theme === t} onChange={() => choose(t)} />
                <span>
                  <b>{t === "system" ? "Match this device" : t === "dark" ? "Dark" : "Light"}</b>
                  <span className="muted">{t === "system" ? "Dark or light, following the device setting." : t === "dark" ? "The default panel, for dim rooms." : "The daylight panel."}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </Plate>
        <Plate title="Team">
          <div className="plate-body stack-tight">
            <p className="muted">
              Approve new accounts in <Link to="/decisions/accounts">Decisions, Accounts</Link>. Changing someone's role, removing access and assigning PMs to clients arrive with role-based views in Step 17; until then Huraira changes them directly in the database.
            </p>
          </div>
        </Plate>
        <Plate title="Alerts">
          <div className="plate-body">
            <p className="muted">Push and Telegram alerts by severity arrive in Step 17.</p>
          </div>
        </Plate>
      </div>
    </>
  );
}

export function NotFound() {
  return (
    <>
      <PageHead title="There's nothing at this address." lead="The link may be old, or the page may need a role you don't have." />
      <Link className="btn primary" to="/">
        Go to Home
      </Link>
    </>
  );
}
