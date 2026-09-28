/**
 * Model routing as configuration — Blueprint §6 ("Hermes should control: model selection, per the
 * routing table in Section 7, configured, not hardcoded per agent") and §4 Phase 4 ("routing logic
 * living in Hermes's configuration"). Continuation Plan Stage 4 acceptance: the fast/cheap-for-Intake,
 * mid-tier-for-Planner split is config, not code.
 *
 * Hermes decides WHICH model; it still never calls it (CLAUDE.md §6). Agents receive a resolved
 * route and build their own client from it. Selection order: env override
 * `WFACT_ROUTE_<SLOT>=<provider>:<model>` → config/model-routing.json → refuse (no silent default).
 * An env override keeps the config's price only if the model id is unchanged — otherwise the price is
 * unknown and reported as such, never guessed.
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
  slots: Record<string, { provider: string; model: string; tier: string; usdPerMTok: { input: number; output: number } }>;
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
  if (typeof raw.version !== "string" || !raw.slots || typeof raw.slots !== "object") {
    throw new RoutingError(`${configPath}: needs a string "version" and a "slots" object`);
  }
  for (const [slot, r] of Object.entries(raw.slots)) {
    if (!SLOT_PATTERN.test(slot)) throw new RoutingError(`slot "${slot}" must be lowercase-hyphenated`);
    if (r.provider !== "anthropic") throw new RoutingError(`slot "${slot}": provider "${r.provider}" is not wired (only "anthropic")`);
    if (typeof r.model !== "string" || !MODEL_PATTERN.test(r.model)) throw new RoutingError(`slot "${slot}": bad model id`);
    if (!r.usdPerMTok || typeof r.usdPerMTok.input !== "number" || typeof r.usdPerMTok.output !== "number") {
      throw new RoutingError(`slot "${slot}": usdPerMTok.input/output must be numbers`);
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
      usdPerMTok: configured && configured.model === model ? configured.usdPerMTok : null,
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
    usdPerMTok: configured.usdPerMTok,
    source: "config",
    configVersion: table.version,
  };
}

/** Real dollars from real token counts; null when the route has no known price. */
export function estimateCostUsd(route: ModelRoute, usage: { inputTokens: number; outputTokens: number }): number | null {
  if (!route.usdPerMTok) return null;
  return (usage.inputTokens / 1e6) * route.usdPerMTok.input + (usage.outputTokens / 1e6) * route.usdPerMTok.output;
}
