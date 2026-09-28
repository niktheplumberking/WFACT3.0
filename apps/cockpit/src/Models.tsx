/**
 * Room 4: Models — Continuation Plan Stage 5, Blueprint §9 Models panel ("usage by model, cost per
 * model per task type, latency"). Reads real rows only: the `model_usage_by_actor` roll-up and the
 * latest `model_traces` (migration 0008). Both are OWNER-ONLY by RLS (Blueprint §9: admins see
 * operational panels, not raw cost) — a non-owner sees an explicit notice, never zeros that look real.
 *
 * Cost honesty: cost_usd is provider-reported tokens × the configured price. Calls to a model with no
 * price on file (Agent 37's free-tier builder) are counted as "unpriced" and shown as such, so a total
 * is labelled a lower bound whenever any unpriced call is in it.
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

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
  price_basis: string;
  latency_ms: number;
  outcome: string;
  task_id: string | null;
}

const usd = (n: number | null) => (n === null ? "unpriced" : `$${Number(n).toFixed(4)}`);
const num = (n: number) => Number(n).toLocaleString();

export function Models() {
  const [usage, setUsage] = useState<UsageRow[] | null>(null);
  const [traces, setTraces] = useState<TraceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("model_usage_by_actor").select("*").order("cost_usd", { ascending: false, nullsFirst: false }),
      supabase
        .from("model_traces")
        .select("id,occurred_at,actor,model,input_tokens,output_tokens,cost_usd,price_basis,latency_ms,outcome,task_id")
        .order("occurred_at", { ascending: false })
        .limit(25),
    ]).then(([u, t]) => {
      if (cancelled) return;
      if (u.error || t.error) setError((u.error ?? t.error)!.message);
      setUsage((u.data as UsageRow[]) ?? []);
      setTraces((t.data as TraceRow[]) ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="error-state">{error}</p>;
  if (!usage || !traces) return <p className="loading-state">Loading model usage…</p>;
  if (usage.length === 0) {
    return (
      <p className="empty-state">
        No model calls visible. Either nothing has been traced yet, or your role can't see cost data (owner only).
      </p>
    );
  }

  const totalCost = usage.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const totalCalls = usage.reduce((s, r) => s + Number(r.calls), 0);
  const unpriced = usage.reduce((s, r) => s + Number(r.unpriced_calls), 0);
  const models = [...new Set(usage.map((r) => r.model))];

  return (
    <div>
      <section className="stat-strip">
        <div className="stat-tile stat-amber">
          <span className="stat-value">${totalCost.toFixed(4)}</span>
          <span className="stat-label">Metered spend{unpriced > 0 ? " (lower bound)" : ""}</span>
        </div>
        <div className="stat-tile stat-cyan">
          <span className="stat-value">{num(totalCalls)}</span>
          <span className="stat-label">Model calls traced</span>
        </div>
        <div className="stat-tile stat-green">
          <span className="stat-value">{models.length}</span>
          <span className="stat-label">Models in use</span>
        </div>
      </section>
      {unpriced > 0 && (
        <p className="plan-sub">
          {unpriced} call(s) are to a model with no price on file (e.g. Agent 37's free-tier builder) — counted, not
          priced. Spend above excludes them rather than guessing.
        </p>
      )}

      <h2 className="section-title">Cost per model per agent role</h2>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Role</th>
              <th>Calls</th>
              <th>Tasks</th>
              <th>Tokens in / out</th>
              <th>Cost</th>
              <th>Avg latency</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((r) => (
              <tr key={`${r.model}-${r.actor}`}>
                <td>
                  <code>{r.model}</code>
                </td>
                <td>{r.actor}</td>
                <td>{num(r.calls)}</td>
                <td>{num(r.tasks)}</td>
                <td>
                  {num(r.input_tokens)} / {num(r.output_tokens)}
                </td>
                <td>{Number(r.unpriced_calls) === Number(r.calls) ? "unpriced" : usd(r.cost_usd)}</td>
                <td>{(Number(r.avg_latency_ms) / 1000).toFixed(1)}s</td>
                <td>{Number(r.errors) > 0 ? <span className="pill status-default">{r.errors}</span> : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Latest calls</h2>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Role</th>
              <th>Model</th>
              <th>Tokens</th>
              <th>Cost</th>
              <th>Latency</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {traces.map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.occurred_at).toLocaleString()}</td>
                <td>{t.actor}</td>
                <td>
                  <code>{t.model}</code>
                </td>
                <td>
                  {num(t.input_tokens)} / {num(t.output_tokens)}
                </td>
                <td>{usd(t.cost_usd)}</td>
                <td>{(t.latency_ms / 1000).toFixed(1)}s</td>
                <td>{t.outcome}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
