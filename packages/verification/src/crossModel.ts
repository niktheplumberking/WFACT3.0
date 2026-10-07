/**
 * Cross-model separation, enforced by configuration (Factory Completion Plan Step 7 task 5; CLAUDE.md §6:
 * "The evaluator is never the same instance, and ideally not the same model/vendor, as the builder").
 *
 * Every model is resolved to a FAMILY from config/evaluator.json (vendor + model-id pattern). A builder and an
 * evaluator in the same family are refused with CrossModelViolationError, loudly, at composition time (before
 * any build or model call). A model no family matches is refused too: an unknown model cannot be shown to be
 * different. Same instance is always refused.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

export interface ModelIdentity {
  vendor: string;
  model: string;
  /** Test doubles only: lets a test give two mocks distinct families. */
  family?: string;
}

interface FamilyRule {
  family: string;
  vendor: string;
  match: string;
  caveat?: string;
}

export interface EvaluatorCandidate {
  provider: "anthropic" | "openai";
  model: string;
  keyEnv: string;
  modelEnv?: string;
  why: string;
}

export interface EvaluatorConfig {
  version: string;
  separation: "model-family";
  candidates: EvaluatorCandidate[];
  families: FamilyRule[];
}

export class CrossModelViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrossModelViolationError";
  }
}

export const EVALUATOR_CONFIG_PATH = path.resolve(import.meta.dirname, "..", "config", "evaluator.json");

export function loadEvaluatorConfig(file: string = EVALUATOR_CONFIG_PATH): EvaluatorConfig {
  const raw = JSON.parse(readFileSync(file, "utf-8")) as EvaluatorConfig;
  if (typeof raw.version !== "string" || raw.separation !== "model-family" || !Array.isArray(raw.candidates) || !Array.isArray(raw.families)) {
    throw new Error(`${file}: needs version, separation "model-family", candidates and families`);
  }
  for (const c of raw.candidates) {
    if (c.provider !== "anthropic" && c.provider !== "openai") throw new Error(`${file}: evaluator provider "${c.provider}" is not wired (anthropic, openai)`);
    if (!/^[A-Z][A-Z0-9_]*$/.test(c.keyEnv)) throw new Error(`${file}: keyEnv must be an environment variable NAME`);
  }
  return raw;
}

/** The family a model belongs to, or throws (fail closed) when no rule matches. */
export function familyOf(id: ModelIdentity, config: EvaluatorConfig = loadEvaluatorConfig()): string {
  if (id.vendor === "mock" && id.family) return id.family;
  const rule = config.families.find((f) => f.vendor === id.vendor && new RegExp(f.match).test(id.model));
  if (!rule) {
    throw new CrossModelViolationError(
      `model ${id.vendor}:${id.model} matches no model family in config/evaluator.json, so it cannot be shown to differ from the other role's model; add a family rule (and its price) before using it`,
    );
  }
  return rule.family;
}

/** Who a ModelClient is, from its public fields (name, modelIdUsed). Works through the tracing and permission proxies. */
export function modelIdentity(client: object): ModelIdentity {
  const c = client as { name?: unknown; modelIdUsed?: unknown; family?: unknown };
  const name = typeof c.name === "string" ? c.name : "";
  const modelId = typeof c.modelIdUsed === "string" ? c.modelIdUsed : null;
  if (name === "claude" && modelId) return { vendor: "anthropic", model: modelId };
  if (name.startsWith("claude:")) return { vendor: "anthropic", model: name.slice("claude:".length) };
  if (name === "openai" && modelId) return { vendor: "openai", model: modelId };
  if (name === "agent37") return { vendor: "agent37", model: modelId ?? "hermes-agent" };
  if (name === "mock") return { vendor: "mock", model: modelId ?? "mock", ...(typeof c.family === "string" ? { family: c.family } : {}) };
  throw new CrossModelViolationError(`cannot tell which model the "${name || "unnamed"}" client runs; refusing rather than guessing (add it to crossModel.modelIdentity)`);
}

/**
 * The builder's identity from its vendor name alone (the rendered-QA CLI only knows WFACT_BUILDER_VENDOR).
 * agent37 → hermes-agent; claude → the configured default Claude model (same family whichever Claude it is).
 */
export function identityFromVendor(vendor: string, model?: string): ModelIdentity {
  if (vendor === "agent37") return { vendor: "agent37", model: model ?? "hermes-agent" };
  if (vendor === "claude" || vendor === "anthropic") return { vendor: "anthropic", model: model ?? "claude-sonnet-5" };
  if (vendor === "openai") return { vendor: "openai", model: model ?? "gpt-5.4" };
  return { vendor, model: model ?? vendor };
}

export interface Separation {
  builder: ModelIdentity & { family: string };
  evaluator: (ModelIdentity & { family: string }) | null;
  configVersion: string;
}

/**
 * Throws CrossModelViolationError when the evaluator is the builder's instance or resolves to the builder's model
 * family. A null evaluator is allowed (the run cannot be approved without one; VerificationLoop reports it).
 */
export function assertCrossModelSeparation(
  builder: ModelIdentity,
  evaluator: ModelIdentity | null,
  opts: { config?: EvaluatorConfig; sameInstance?: boolean } = {},
): Separation {
  const config = opts.config ?? loadEvaluatorConfig();
  if (opts.sameInstance) throw new CrossModelViolationError("the evaluator is the builder's own model instance (CLAUDE.md §6)");
  const b = { ...builder, family: familyOf(builder, config) };
  if (!evaluator) return { builder: b, evaluator: null, configVersion: config.version };
  const e = { ...evaluator, family: familyOf(evaluator, config) };
  if (b.family === e.family) {
    throw new CrossModelViolationError(
      `builder ${b.vendor}:${b.model} and evaluator ${e.vendor}:${e.model} are both "${b.family}" models; the evaluator must be a different model family (CLAUDE.md §6, config/evaluator.json). ` +
        "Configure the builder's provider (AGENT37_BASE_URL + AGENT37_API_KEY) or a second-vendor evaluator key, then retry.",
    );
  }
  return { builder: b, evaluator: e, configVersion: config.version };
}
