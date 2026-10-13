/**
 * MVP M6: spend caps (docs/MVP-CUTLINE.md §4). The per-role ceilings in agent-runtime stop one agent run;
 * these stop the TOTAL: one build across every task, retry and reopen, and the last 7 days across everything.
 * Hermes decides (CLAUDE.md §6): the caps are its configuration (config/spend-caps.json), the check reads the
 * recorded model_traces roll-ups (migration 0020) and refuses the call before any money is spent.
 *
 * Priced spend = metered + estimated rows. History recorded before Agent 37 had a price (unpriced rows) is not
 * counted, so a cap never refuses a build over spend nobody could see.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { runContext } from "@wfact/audit";

export interface SpendCaps {
  /** null = off. */
  perBuildUsd: number | null;
  weeklyUsd: number | null;
  version: string;
  source: "config" | "env";
}

export const SPEND_CAPS_PATH = path.resolve(import.meta.dirname, "..", "config", "spend-caps.json");

function capValue(v: unknown, name: string): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`spend cap ${name} must be a non-negative number or null (got ${JSON.stringify(v)})`);
  return n;
}

export function loadSpendCaps(env: NodeJS.ProcessEnv = process.env, file: string = SPEND_CAPS_PATH): SpendCaps {
  const raw = JSON.parse(readFileSync(file, "utf-8")) as { version: string; perBuildUsd: unknown; weeklyUsd: unknown };
  // An empty or blank variable (e.g. an unset CI variable) means "not set", never "cap off" or "$0".
  const fromEnv = (v: string | undefined) => (v === undefined || v.trim() === "" ? undefined : v.trim());
  const envBuild = fromEnv(env.WFACT_CAP_PER_BUILD_USD);
  const envWeek = fromEnv(env.WFACT_CAP_WEEKLY_USD);
  return {
    perBuildUsd: capValue(envBuild ?? raw.perBuildUsd, "perBuildUsd"),
    weeklyUsd: capValue(envWeek ?? raw.weeklyUsd, "weeklyUsd"),
    version: raw.version,
    source: envBuild !== undefined || envWeek !== undefined ? "env" : "config",
  };
}

/** Where the check reads recorded spend from. */
export interface SpendLedger {
  /** Priced spend recorded under this run id (one build). */
  buildSpentUsd(runId: string): Promise<number>;
  /** Priced spend recorded in the last 7 UTC days, today included. */
  weekSpentUsd(): Promise<number>;
}

export class SpendCapExceededError extends Error {
  constructor(
    readonly cap: "build" | "weekly",
    readonly spentUsd: number,
    readonly limitUsd: number,
  ) {
    super(
      cap === "build"
        ? `Spend cap reached: this build has spent $${spentUsd.toFixed(2)} of its $${limitUsd.toFixed(2)} cap. ` +
            "No further model calls run for it; raise the cap only on the owner's say-so (packages/hermes/config/spend-caps.json)."
        : `Weekly spend cap reached: $${spentUsd.toFixed(2)} of $${limitUsd.toFixed(2)} spent in the last 7 days. ` +
            "No new model calls run until spend drops under it or the owner raises it (packages/hermes/config/spend-caps.json).",
    );
    this.name = "SpendCapExceededError";
  }
}

/** Throws SpendCapExceededError when a cap that is on has been reached. Reads nothing when both caps are off. */
export async function checkSpendCaps(caps: SpendCaps, ledger: SpendLedger, runId: string | null): Promise<void> {
  if (caps.perBuildUsd !== null && runId) {
    const spent = await ledger.buildSpentUsd(runId);
    if (spent >= caps.perBuildUsd) throw new SpendCapExceededError("build", spent, caps.perBuildUsd);
  }
  if (caps.weeklyUsd !== null) {
    const spent = await ledger.weekSpentUsd();
    if (spent >= caps.weeklyUsd) throw new SpendCapExceededError("weekly", spent, caps.weeklyUsd);
  }
}

/** The cap check for whatever run is current (runContext), for callers that are not model clients (the screenshot reviewer). */
export function capCheckForCurrentRun(caps: SpendCaps, ledger: SpendLedger): () => Promise<void> {
  return () => checkSpendCaps(caps, ledger, runContext.getStore()?.runId ?? null);
}

/**
 * Wrap a model client so every call to `method` first checks the caps for the current run (runContext).
 * A call already in flight finishes, so a build can end slightly over its cap by at most one call.
 */
export function capModelClient<T extends object>(client: T, method: string, caps: SpendCaps, ledger: SpendLedger): T {
  if (caps.perBuildUsd === null && caps.weeklyUsd === null) return client;
  const original = (client as Record<string, unknown>)[method];
  if (typeof original !== "function") throw new Error(`capModelClient: client has no method "${method}"`);
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === method) {
        return async (...args: unknown[]) => {
          await checkSpendCaps(caps, ledger, runContext.getStore()?.runId ?? null);
          return (original as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** Reads the migration 0020 roll-ups with the service-role key (the job runner's own credentials). */
export class SupabaseSpendLedger implements SpendLedger {
  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async rows(query: string): Promise<{ priced_usd: number | string }[]> {
    const res = await this.fetchImpl(`${this.url.replace(/\/+$/, "")}/rest/v1/${query}`, {
      headers: { apikey: this.serviceRoleKey, Authorization: `Bearer ${this.serviceRoleKey}` },
    });
    // Fail closed: a cap that cannot read spend refuses the call rather than letting it run unchecked.
    if (!res.ok) throw new Error(`spend cap: could not read recorded spend (HTTP ${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return (await res.json()) as { priced_usd: number | string }[];
  }

  async buildSpentUsd(runId: string): Promise<number> {
    const rows = await this.rows(`model_cost_by_run?run_id=eq.${encodeURIComponent(runId)}&select=priced_usd`);
    return rows.reduce((s, r) => s + Number(r.priced_usd), 0);
  }

  async weekSpentUsd(): Promise<number> {
    const since = new Date(this.now().getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
    const rows = await this.rows(`model_cost_by_day?day=gte.${since}&select=priced_usd`);
    return rows.reduce((s, r) => s + Number(r.priced_usd), 0);
  }
}

export function spendLedgerFromEnv(env: NodeJS.ProcessEnv = process.env): SpendLedger | null {
  return env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? new SupabaseSpendLedger(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) : null;
}
