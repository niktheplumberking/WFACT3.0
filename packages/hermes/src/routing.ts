/**
 * Model routing as configuration — Blueprint §6 ("Hermes should control: model selection, per the
 * routing table in Section 7, configured, not hardcoded per agent") and §4 Phase 4 ("routing logic
 * living in Hermes's configuration"). Continuation Plan Stage 4 acceptance: the fast/cheap-for-Intake,
 * mid-tier-for-Planner split is config, not code.
 *
 * Hermes decides WHICH model; it still never calls it (CLAUDE.md §6). Agents receive a resolved
 * route and build their own client from it. Selection order: env override
 * `WFACT_ROUTE_<SLOT>=<provider>:<model>` → config/model-routing.json → refuse (no silent default).
 * Prices come from the config's single `models` table; a model not in it is unpriced — reported as
 * unknown, never guessed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export type Provider = "anthropic";

export interface ModelRoute {
  slot: string;
  provider: Provider;
  model: string;
  tier: string;
  /** null when an env override points at a model the config has no price for. */
  usdPerMTok: { input: number; output: number } | null;
  source: "config" | "env";
  configVersion: string;
}

interface RoutingFile {
  version: string;
  slots: Record<string, { provider: string; model: string; tier: string }>;
  /** The one price table (Stage 5). null price = no price on file = "unpriced". */
  models: Record<string, { provider: string; usdPerMTok: { input: number; output: number } | null }>;
}

export class RoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutingError";
  }
}

const DEFAULT_CONFIG_PATH = path.resolve(import.meta.dirname, "..", "config", "model-routing.json");
const SLOT_PATTERN = /^[a-z][a-z0-9-]*$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9.-]*$/;

export function loadRoutingTable(configPath: string = DEFAULT_CONFIG_PATH): RoutingFile {
  const raw = JSON.parse(readFileSync(configPath, "utf-8")) as Partial<RoutingFile>;
  if (typeof raw.version !== "string" || !raw.slots || typeof raw.slots !== "object" || !raw.models) {
    throw new RoutingError(`${configPath}: needs a string "version", a "slots" object and a "models" price table`);
  }
  for (const [slot, r] of Object.entries(raw.slots)) {
    if (!SLOT_PATTERN.test(slot)) throw new RoutingError(`slot "${slot}" must be lowercase-hyphenated`);
    if (r.provider !== "anthropic") throw new RoutingError(`slot "${slot}": provider "${r.provider}" is not wired (only "anthropic")`);
    if (typeof r.model !== "string" || !MODEL_PATTERN.test(r.model)) throw new RoutingError(`slot "${slot}": bad model id`);
    if (!raw.models?.[r.model]) throw new RoutingError(`slot "${slot}": model "${r.model}" has no entry in "models" (the price table)`);
  }
  for (const [model, m] of Object.entries(raw.models ?? {})) {
    const p = m.usdPerMTok;
    if (p !== null && (typeof p?.input !== "number" || typeof p?.output !== "number")) {
      throw new RoutingError(`models["${model}"].usdPerMTok must be {input, output} numbers or null`);
    }
  }
  return raw as RoutingFile;
}

export function resolveModelRoute(
  slot: string,
  env: NodeJS.ProcessEnv = process.env,
  table: RoutingFile = loadRoutingTable(),
): ModelRoute {
  const configured = table.slots[slot];
  const override = env[`WFACT_ROUTE_${slot.toUpperCase().replace(/-/g, "_")}`];
  if (override) {
    const [provider, model] = override.split(":");
    if (provider !== "anthropic" || !model || !MODEL_PATTERN.test(model)) {
      throw new RoutingError(`WFACT_ROUTE_${slot.toUpperCase()} must look like "anthropic:<model-id>", got "${override}"`);
    }
    return {
      slot,
      provider,
      model,
      tier: configured?.tier ?? "override",
      usdPerMTok: table.models[model]?.usdPerMTok ?? null,
      source: "env",
      configVersion: table.version,
    };
  }
  if (!configured) {
    throw new RoutingError(`no route configured for slot "${slot}" — add it to config/model-routing.json; there is no silent default`);
  }
  return {
    slot,
    provider: "anthropic",
    model: configured.model,
    tier: configured.tier,
    usdPerMTok: table.models[configured.model]?.usdPerMTok ?? null,
    source: "config",
    configVersion: table.version,
  };
}

/** Real dollars from real token counts; null when the route has no known price. */
export function estimateCostUsd(route: ModelRoute, usage: { inputTokens: number; outputTokens: number }): number | null {
  if (!route.usdPerMTok) return null;
  return (usage.inputTokens / 1e6) * route.usdPerMTok.input + (usage.outputTokens / 1e6) * route.usdPerMTok.output;
}

// ---------------------------------------------------------------------------------------------
// Stage 5: the ONE price table. Every cost figure in the repo (traces, CLI cost lines) is computed
// here from the provider-reported token counts × the `models` table in config/model-routing.json —
// previously the same constants were copied into four CLIs. A model with no price returns
// basis "unpriced" and costUsd null: shown as unknown, never as $0 or a guess.
// ---------------------------------------------------------------------------------------------

export interface ModelCost {
  costUsd: number | null;
  basis: "metered" | "unpriced";
  pricingVersion: string;
}

export function costForModel(
  model: string,
  usage: { inputTokens: number; outputTokens: number },
  configPath: string = DEFAULT_CONFIG_PATH,
): ModelCost {
  const raw = JSON.parse(readFileSync(configPath, "utf-8")) as {
    version: string;
    models?: Record<string, { usdPerMTok: { input: number; output: number } | null }>;
  };
  const price = raw.models?.[model]?.usdPerMTok ?? null;
  if (!price) return { costUsd: null, basis: "unpriced", pricingVersion: raw.version };
  const costUsd = (usage.inputTokens / 1e6) * price.input + (usage.outputTokens / 1e6) * price.output;
  return { costUsd: Math.round(costUsd * 1e6) / 1e6, basis: "metered", pricingVersion: raw.version };
}
