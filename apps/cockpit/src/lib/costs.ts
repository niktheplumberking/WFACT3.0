/**
 * MVP M6 cost transparency: the numbers behind the owner-only Costs page and the Run page's cost line.
 *
 * Three kinds of dollars, never mixed up:
 *   metered    provider tokens x a published list price (Claude, OpenAI)
 *   estimated  tokens x a rate the provider does not publish (Agent 37, priced since model-routing.json 1.4.0)
 *   history    calls recorded before Agent 37 had a price (stored unpriced, append-only, never rewritten).
 *              Shown here as an estimate at the same rate, computed from their real token counts.
 * Prices and caps come from the factory's own config files (the one price table, packages/hermes), so the
 * Cockpit can never quote a different rate from the one the job runner charges against.
 */
import routing from "../../../../packages/hermes/config/model-routing.json";
import capsFile from "../../../../packages/hermes/config/spend-caps.json";
import { supabase } from "../supabaseClient";

type Price = { input: number; output: number } | null;
const prices = routing.models as Record<string, { usdPerMTok: Price; estimate?: boolean }>;

export const PRICING_VERSION = routing.version;
export const CAPS = {
  perBuildUsd: capsFile.perBuildUsd as number | null,
  weeklyUsd: capsFile.weeklyUsd as number | null,
  status: capsFile.status,
};

/** Tokens x the price table; null when the model has no price at all. */
export function priceTokens(model: string, inputTokens: number, outputTokens: number): number | null {
  const p = prices[model]?.usdPerMTok;
  return p ? (inputTokens / 1e6) * p.input + (outputTokens / 1e6) * p.output : null;
}

/** Before migration 0020 only Agent 37's hermes-agent was ever recorded unpriced, so run-level history is priced at its rate. */
const HISTORY_MODEL = "hermes-agent";

export interface DayRow {
  day: string;
  entity_slug: string;
  provider: string;
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  priced_usd: number | string;
  estimated_usd: number | string;
  unpriced_calls: number;
  unpriced_input_tokens: number;
  unpriced_output_tokens: number;
}
export interface RunRow {
  run_id: string;
  entity_slug: string | null;
  calls: number;
  errors: number;
  input_tokens: number;
  output_tokens: number;
  priced_usd: number | string;
  estimated_usd: number | string;
  unpriced_calls: number;
  unpriced_input_tokens: number;
  unpriced_output_tokens: number;
  first_call_at: string;
  last_call_at: string;
}
export interface TraceRow {
  id: string;
  occurred_at: string;
  run_id: string | null;
  actor: string;
  provider: string;
  model: string;
  entity_slug: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | string | null;
  price_basis: "metered" | "estimated" | "unpriced";
  latency_ms: number;
  outcome: string;
}

export interface Spend {
  metered: number;
  estimated: number;
  /** History: unpriced calls, estimated now from their real tokens. */
  history: number;
  /** Calls to a model with no price at all, even today (shown as a count, never as $0). */
  unknownCalls: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
}
export const total = (s: Spend) => s.metered + s.estimated + s.history;
/** What the spend caps count (packages/hermes/src/spendCaps.ts): priced rows only, never the pre-pricing history. */
export const capped = (s: Spend) => s.metered + s.estimated;
const empty = (): Spend => ({ metered: 0, estimated: 0, history: 0, unknownCalls: 0, calls: 0, inputTokens: 0, outputTokens: 0 });

function addDay(s: Spend, r: DayRow): Spend {
  const priced = Number(r.priced_usd);
  const estimated = Number(r.estimated_usd);
  const history = priceTokens(r.model, Number(r.unpriced_input_tokens), Number(r.unpriced_output_tokens));
  return {
    metered: s.metered + (priced - estimated),
    estimated: s.estimated + estimated,
    history: s.history + (Number(r.unpriced_calls) > 0 ? history ?? 0 : 0),
    unknownCalls: s.unknownCalls + (Number(r.unpriced_calls) > 0 && history === null ? Number(r.unpriced_calls) : 0),
    calls: s.calls + Number(r.calls),
    inputTokens: s.inputTokens + Number(r.input_tokens),
    outputTokens: s.outputTokens + Number(r.output_tokens),
  };
}
export const sumDays = (rows: DayRow[]): Spend => rows.reduce(addDay, empty());

export function runSpend(r: RunRow): Spend {
  const priced = Number(r.priced_usd);
  const estimated = Number(r.estimated_usd);
  return {
    metered: priced - estimated,
    estimated,
    history: Number(r.unpriced_calls) > 0 ? priceTokens(HISTORY_MODEL, Number(r.unpriced_input_tokens), Number(r.unpriced_output_tokens)) ?? 0 : 0,
    unknownCalls: 0,
    calls: Number(r.calls),
    inputTokens: Number(r.input_tokens),
    outputTokens: Number(r.output_tokens),
  };
}

/** One call's dollars and how sure we are of them. */
export function callCost(t: TraceRow): { usd: number | null; basis: "metered" | "estimated" | "history" | "unknown" } {
  if (t.price_basis === "metered") return { usd: Number(t.cost_usd), basis: "metered" };
  if (t.price_basis === "estimated") return { usd: Number(t.cost_usd), basis: "estimated" };
  const est = priceTokens(t.model, t.input_tokens, t.output_tokens);
  return est === null ? { usd: null, basis: "unknown" } : { usd: est, basis: "history" };
}

/** UTC day key (YYYY-MM-DD) n days before `now`. */
export const dayKey = (now: Date, daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);

export function byKey<T extends string>(rows: DayRow[], key: (r: DayRow) => T): { key: T; spend: Spend }[] {
  const m = new Map<T, DayRow[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return [...m.entries()].map(([k, rs]) => ({ key: k, spend: sumDays(rs) }));
}

export interface CostData {
  days: DayRow[];
  runs: RunRow[];
  costliest: TraceRow[];
  latest: TraceRow[];
}

const TRACE_COLS = "id,occurred_at,run_id,actor,provider,model,entity_slug,input_tokens,output_tokens,cost_usd,price_basis,latency_ms,outcome";

export async function fetchCostData(): Promise<CostData> {
  const [d, r, c, l] = await Promise.all([
    supabase.from("model_cost_by_day").select("*").order("day", { ascending: false }),
    supabase.from("model_cost_by_run").select("*").order("last_call_at", { ascending: false }).limit(25),
    supabase.from("model_traces").select(TRACE_COLS).order("input_tokens", { ascending: false }).limit(10),
    supabase.from("model_traces").select(TRACE_COLS).order("occurred_at", { ascending: false }).limit(25),
  ]);
  for (const res of [d, r, c, l]) if (res.error) throw new Error(res.error.message);
  return {
    days: (d.data ?? []) as DayRow[],
    runs: (r.data ?? []) as RunRow[],
    costliest: (c.data ?? []) as TraceRow[],
    latest: (l.data ?? []) as TraceRow[],
  };
}

/** The Run page's line: this build's spend, or null when nothing is recorded (or the viewer may not see cost). */
export async function fetchRunSpend(runId: string): Promise<Spend | null> {
  const { data, error } = await supabase.from("model_cost_by_run").select("*").eq("run_id", runId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? runSpend(data as RunRow) : null;
}

export const money = (n: number) => (n >= 100 ? `$${n.toFixed(0)}` : n >= 1 ? `$${n.toFixed(2)}` : n === 0 ? "$0" : `$${n.toFixed(3)}`);
export const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
