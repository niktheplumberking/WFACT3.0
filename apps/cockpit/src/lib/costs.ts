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

/** The per-build stop, in words, from spend-caps.json (never hard-coded: see BLOCKED-ON-NICK.md, caps conflict). */
export function buildStopLine(caps: { perBuildUsd: number | null } = CAPS): string {
  return caps.perBuildUsd == null ? "There is no per-build spending limit switched on." : `Each build stops itself at $${caps.perBuildUsd.toFixed(2)}.`;
}

/** The money sentence every paid confirm carries: the rough cost, then the per-build stop. */
export function costLine(about: string, caps: { perBuildUsd: number | null } = CAPS): string {
  return `Costs about ${about}. ${buildStopLine(caps)}`;
}

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

/** What reading a request and writing its proposal usually costs: the average per run of each step (intake, planner,
 *  direction), added up, from metered traces. Owner-only under RLS; null when there are fewer than 3 runs of the
 *  planner to go on, or the viewer cannot read the traces (the words then say "a few cents", never a made-up figure). */
export async function fetchRequestCost(): Promise<number | null> {
  try {
    const res = await supabase.from("model_traces").select("actor,run_id,cost_usd").in("actor", ["agent:intake", "agent:planner", "agent:direction"]).limit(1000);
    if (res.error || !res.data) return null;
    const rows = res.data as { actor: string; run_id: string | null; cost_usd: number | null }[];
    const per = (actor: string) => {
      const mine = rows.filter((r) => r.actor === actor);
      const runs = new Set(mine.map((r) => r.run_id ?? "")).size;
      return { runs, avg: runs ? mine.reduce((a, r) => a + (r.cost_usd ?? 0), 0) / runs : 0 };
    };
    const planner = per("agent:planner");
    if (planner.runs < 3) return null;
    return per("agent:intake").avg + planner.avg + per("agent:direction").avg;
  } catch {
    return null;
  }
}

/* ---------------- the Costs room (Cockpit v2 phase 15) ---------------- */

/** Dollars as the Costs room says them: two decimals, or "under $0.01" for a real but tiny figure. */
export const usd = (n: number) => (n > 0 && n < 0.005 ? "under $0.01" : `$${n.toFixed(2)}`);

/** What each part of the factory is for, in plain words (the model table's "Used for" and the caps example). */
export const STEP_OF_ACTOR: Record<string, string> = {
  "agent:front-end-builder": "Writing and fixing the site",
  "agent:qa-evaluator": "Checks and reviews",
  "agent:planner": "Writing the proposal",
  "agent:intake": "Reading the request",
  "agent:direction": "Choosing the direction",
  "hermes-lite": "Answering questions",
};
export const stepOf = (actor: string) => STEP_OF_ACTOR[actor] ?? "Other work";

export interface CostRoomData {
  days: DayRow[];
  runs: RunRow[];
  /** Every recorded call, newest first, up to TRACE_LIMIT (the totals come from the views, which are exact). */
  traces: TraceRow[];
  /** job.run links (task_id = job id), so a run can be tied to its job, its proposal and its client. */
  links: { task_id: string | null; run_id: string | null }[];
}
export const TRACE_LIMIT = 5000;

export async function fetchCostRoom(): Promise<CostRoomData> {
  const [d, r, t, l] = await Promise.all([
    supabase.from("model_cost_by_day").select("*").order("day", { ascending: false }),
    supabase.from("model_cost_by_run").select("*").order("last_call_at", { ascending: false }).limit(500),
    supabase.from("model_traces").select(TRACE_COLS).order("occurred_at", { ascending: false }).limit(TRACE_LIMIT),
    supabase.from("audit_log").select("task_id,run_id").eq("action", "job.run").limit(2000),
  ]);
  for (const res of [d, r, t, l]) if (res.error) throw new Error(res.error.message);
  return { days: (d.data ?? []) as DayRow[], runs: (r.data ?? []) as RunRow[], traces: (t.data ?? []) as TraceRow[], links: (l.data ?? []) as CostRoomData["links"] };
}

/** The spend the weekly cap counts, exactly as packages/hermes/src/spendCaps.ts does: priced spend on UTC days from 6 days ago. */
export const capWindowStart = (now: Date) => dayKey(now, 6);
export function capWeek(days: DayRow[], now: Date): Spend {
  return sumDays(days.filter((r) => r.day >= capWindowStart(now)));
}

/** Spend in consecutive 7-day blocks ending today, oldest first (the trend). */
export function weekBlocks(days: DayRow[], now: Date, n = 6): { from: string; to: string; spend: Spend }[] {
  return Array.from({ length: n }, (_, i) => {
    const k = n - 1 - i;
    const from = dayKey(now, 7 * k + 6);
    const to = dayKey(now, 7 * k);
    return { from, to, spend: sumDays(days.filter((r) => r.day >= from && r.day <= to)) };
  });
}

/** The middle half of past build costs (25th to 75th percentile), or null with fewer than 3 builds to go on. */
export function usualRange(values: number[]): [number, number] | null {
  if (values.length < 3) return null;
  const v = [...values].sort((a, b) => a - b);
  const at = (p: number) => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))]!;
  return [at(0.25), at(0.75)];
}

/** A traced run, tied to the job that ran it: whether it was a build, which job, which client. */
export interface RunInfo {
  jobId: string;
  build: boolean;
  planId: string | null;
}
type JobLike = { id: string; kind: string; params: Record<string, unknown> | null; result: Record<string, unknown> | null };

/** Run id -> its job. Builds name the run in result.workflowRunId (a continued build in params.workflowRunId),
 *  a request or a new proposal in result.runId, and every job that reached the worker has a job.run link row. */
export function runsOfJobs<J extends JobLike>(jobs: J[], links: CostRoomData["links"], planOf: (j: J) => string | null): Map<string, RunInfo> {
  const out = new Map<string, RunInfo>();
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const put = (runId: unknown, j: J) => {
    if (typeof runId !== "string" || out.has(runId)) return;
    out.set(runId, { jobId: j.id, build: j.kind === "build_plan" || j.kind === "resume", planId: planOf(j) });
  };
  for (const j of jobs) {
    put(j.result?.workflowRunId, j);
    put(j.params?.workflowRunId, j);
    put(j.result?.runId, j);
  }
  for (const l of links) if (l.task_id && byId.has(l.task_id)) put(l.run_id, byId.get(l.task_id)!);
  return out;
}

/** Sum of calls as dollars, with how sure: any estimate makes the whole figure an estimate. */
export function sumCalls(rows: TraceRow[]): { usd: number; estimated: boolean; unknown: number; calls: number } {
  let usdSum = 0;
  let estimated = false;
  let unknown = 0;
  for (const t of rows) {
    const c = callCost(t);
    if (c.usd === null) unknown += 1;
    else usdSum += c.usd;
    if (c.basis !== "metered") estimated = true;
  }
  return { usd: usdSum, estimated, unknown, calls: rows.length };
}
